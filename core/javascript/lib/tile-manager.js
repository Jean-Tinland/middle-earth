const TILE_SIZE = 512;
const MAX_TILE_ZOOM = 8;
const ZOOM_SOURCE_SCALE = [1, 2, 3, 4, 5, 6, 8, 10, 12];
const TILES_CANON_DIR = "./assets/images/map/tiles";
const TILES_EXTENDED_DIR = "./assets/images/map/tiles-extended";

const DESKTOP_PRELOAD_MARGIN = 128;
const DESKTOP_BATCH_SIZE = 10;
const MOBILE_PRELOAD_MARGIN = 0;
const MOBILE_BATCH_SIZE = 4;
const MOBILE_BACKDROP_TTL = 1500;

export { MAX_TILE_ZOOM };

export default class TileManager {
  /** @type {string} */
  #version;
  /** @type {HTMLElement} */
  #container;
  /** @type {number} */
  #baseW;
  /** @type {number} */
  #baseH;
  /** @type {boolean} */
  #mobile;
  /** @type {number} */
  #batch;
  /** @type {number} */
  #margin;
  /** @type {string} */
  #tilesDir;

  // Active layer state
  /** @type {number} */
  #activeZoom = -1;
  /** @type {HTMLElement|null} */
  #activeEl = null;
  /** @type {Uint8Array|null} Tile state bitfield: bit0=requested, bit1=ready, bit2=intersecting, bit3=inFlight */
  #activeState = null;
  /** @type {HTMLElement[]|null} Placeholder divs */
  #activePlaceholders = null;
  /** @type {HTMLImageElement[]|null} Image elements (sparse: null when not loaded) */
  #activeImages = null;
  /** @type {string[]|null} Source URLs */
  #activeSrcs = null;
  /** @type {number} */
  #activeCols = 0;
  /** @type {number} */
  #activeRows = 0;
  /** @type {number} */
  #activeIntersecting = 0;
  /** @type {number} */
  #activeReadyIntersecting = 0;
  /** @type {Uint32Array|null} Version counter per tile to invalidate stale callbacks */
  #activeVersions = null;

  // Previous layer (kept for handoff)
  /** @type {HTMLElement|null} */
  #prevEl = null;

  // Backdrop
  /** @type {HTMLElement|null} */
  #backdropEl = null;
  /** @type {number} */
  #backdropBaseW = 0;
  /** @type {number} */
  #backdropTimerId = 0;

  // Loading
  /** @type {number[]} Queue of tile indices */
  #queue = [];
  /** @type {number} */
  #inFlight = 0;
  /** @type {number} */
  #loadTimerId = 0;

  // Observer
  /** @type {IntersectionObserver|null} */
  #observer = null;
  /** @type {WeakMap<HTMLElement, number>} Maps placeholder → tile index */
  #elToIdx = new WeakMap();

  // Public: set by canvas before layer builds
  canvasWidth = 0;
  canvasHeight = 0;

  // State bits
  static #REQUESTED = 1;
  static #READY = 2;
  static #INTERSECTING = 4;
  static #IN_FLIGHT = 8;

  constructor(container, baseW, baseH, mobile = false, canonOnly = false) {
    this.#version = document.documentElement.dataset.buildVersion || "0";
    this.#container = container;
    this.#baseW = baseW;
    this.#baseH = baseH;
    this.#mobile = mobile;
    this.#batch = mobile ? MOBILE_BATCH_SIZE : DESKTOP_BATCH_SIZE;
    this.#margin = mobile ? MOBILE_PRELOAD_MARGIN : DESKTOP_PRELOAD_MARGIN;
    this.#tilesDir = canonOnly ? TILES_CANON_DIR : TILES_EXTENDED_DIR;
  }

  setCanonOnly(canonOnly, zoom = this.#activeZoom) {
    const nextDir = canonOnly ? TILES_CANON_DIR : TILES_EXTENDED_DIR;
    if (nextDir === this.#tilesDir) return;

    this.#tilesDir = nextDir;
    this.cancelPendingLoad();
    this.removeBackdrop();
    this.resetLayers();

    const targetZoom =
      Number.isFinite(zoom) && zoom >= 0 ? zoom : Math.max(0, this.#activeZoom);
    this.renderTiles(targetZoom);
  }

  get activeTileZoom() {
    return this.#activeZoom;
  }

  get hasBackdrop() {
    return this.#backdropEl !== null;
  }

  removeBackdrop() {
    if (!this.#backdropEl) return;
    if (this.#backdropTimerId) {
      clearTimeout(this.#backdropTimerId);
      this.#backdropTimerId = 0;
    }
    this.#backdropEl.remove();
    this.#backdropEl = null;
  }

  installBackdrop(oldW, oldH, newW) {
    if (this.#backdropEl) {
      this.#backdropEl.style.transform = `scale(${newW / this.#backdropBaseW})`;
      return;
    }

    if (!this.#activeEl) return;

    // Detach observer before stealing the active layer
    this.#observer?.disconnect();

    const el = this.#activeEl;
    // Release JS references so the typed arrays can be GC'd, but do NOT
    // blank image sources: the loaded pixels must stay visible as backdrop.
    this.#releaseActiveRefs();

    el.style.cssText = [
      "position:absolute",
      "top:0;left:0",
      `width:${oldW}px;height:${oldH}px`,
      "overflow:hidden",
      "pointer-events:none",
      `transform:scale(${newW / oldW})`,
      "transform-origin:top left",
      "z-index:0",
    ].join(";");
    el.hidden = false;

    this.#backdropBaseW = oldW;
    this.#backdropEl = el;

    if (this.#mobile) {
      this.#backdropTimerId = setTimeout(() => {
        this.#backdropTimerId = 0;
        this.removeBackdrop();
        if (this.#activeEl) this.#activeEl.style.zIndex = "0";
      }, MOBILE_BACKDROP_TTL);
    }
  }

  renderTiles(zoom) {
    const z = Math.max(0, Math.min(MAX_TILE_ZOOM, zoom));
    const prevZoom = this.#activeZoom;

    // Build layer if zoom changed or no layer exists
    if (z !== this.#activeZoom || !this.#activeEl) {
      // Stash current active as previous for handoff
      if (this.#activeEl && prevZoom !== z) {
        this.#disposePreviousLayer();
        this.#prevEl = this.#activeEl;
        this.#prevEl.style.zIndex = "-1";
        this.#prevEl.hidden = false;
        // Clear active bookkeeping but keep DOM
        this.#clearActiveLayer(false);
      }

      this.#buildLayer(z);
      this.#observeActive();
    }

    // Z-index management
    if (this.#activeEl) {
      this.#activeEl.hidden = false;
      this.#activeEl.style.zIndex = this.#backdropEl ? "-1" : "0";
    }
    if (this.#prevEl) {
      this.#prevEl.hidden = false;
      this.#prevEl.style.zIndex = "-1";
      if (this.#activeEl) {
        this.#activeEl.style.zIndex = this.#backdropEl ? "-1" : "0";
      }
    }
  }

  resetLayers() {
    this.#observer?.disconnect();
    this.#disposePreviousLayer();
    this.#clearActiveLayer(true);
    this.#queue.length = 0;
    this.#inFlight = 0;
  }

  cancelPendingLoad() {
    if (this.#loadTimerId) {
      clearTimeout(this.#loadTimerId);
      this.#loadTimerId = 0;
    }
  }

  scheduleTileLoad(zoom, delay) {
    this.cancelPendingLoad();
    this.#loadTimerId = setTimeout(() => {
      this.#loadTimerId = 0;
      this.renderTiles(zoom);
    }, delay);
  }

  checkLayerHandoff() {
    if (!this.#activeEl || !this.#activeState) return;

    const allReady =
      this.#activeIntersecting > 0 &&
      this.#activeIntersecting === this.#activeReadyIntersecting;

    if (this.#backdropEl && allReady) {
      this.removeBackdrop();
      this.#activeEl.style.zIndex = "0";
    }

    if (this.#prevEl && allReady) {
      this.#disposePreviousLayer();
      this.#activeEl.style.zIndex = "0";
    }
  }

  destroy() {
    this.cancelPendingLoad();
    if (this.#backdropTimerId) {
      clearTimeout(this.#backdropTimerId);
      this.#backdropTimerId = 0;
    }
    this.removeBackdrop();
    this.resetLayers();
    this.#observer = null;
  }

  #buildLayer(zoom) {
    const cw = this.canvasWidth;
    const ch = this.canvasHeight;
    const srcScale = ZOOM_SOURCE_SCALE[zoom] ?? zoom + 1;
    const srcW = this.#baseW * srcScale;
    const srcH = this.#baseH * srcScale;
    const cols = Math.ceil(srcW / TILE_SIZE);
    const rows = Math.ceil(srcH / TILE_SIZE);
    const count = cols * rows;

    // Pre-compute edge positions (integer pixel coordinates)
    const colEdge = new Float64Array(cols + 1);
    for (let c = 0; c <= cols; c++) {
      colEdge[c] = Math.round((Math.min(c * TILE_SIZE, srcW) / srcW) * cw);
    }
    const rowEdge = new Float64Array(rows + 1);
    for (let r = 0; r <= rows; r++) {
      rowEdge[r] = Math.round((Math.min(r * TILE_SIZE, srcH) / srcH) * ch);
    }

    // Typed arrays for tile data
    const state = new Uint8Array(count);
    const versions = new Uint32Array(count);
    const placeholders = new Array(count);
    const images = new Array(count).fill(null);
    const srcs = new Array(count);

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;contain:layout paint style;";
    layer.hidden = true;

    // Use a fragment to batch DOM insertions
    const frag = document.createDocumentFragment();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const left = colEdge[c];
        const top = rowEdge[r];
        const w = colEdge[c + 1] - left;
        const h = rowEdge[r + 1] - top;

        srcs[i] = `${this.#tilesDir}/${zoom}/${r}-${c}.jpg?v=${this.#version}`;

        const ph = document.createElement("div");
        ph.style.cssText = `display:block;position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;pointer-events:none;contain:strict;`;
        placeholders[i] = ph;
        this.#elToIdx.set(ph, i);
        frag.appendChild(ph);
      }
    }

    layer.appendChild(frag);
    this.#container.prepend(layer);

    this.#activeZoom = zoom;
    this.#activeEl = layer;
    this.#activeState = state;
    this.#activePlaceholders = placeholders;
    this.#activeImages = images;
    this.#activeSrcs = srcs;
    this.#activeCols = cols;
    this.#activeRows = rows;
    this.#activeVersions = versions;
    this.#activeIntersecting = 0;
    this.#activeReadyIntersecting = 0;
  }

  #observeActive() {
    if (!this.#activePlaceholders) return;

    if (!this.#observer) {
      this.#observer = new IntersectionObserver(this.#onIntersect, {
        rootMargin: `${this.#margin}px`,
      });
    }

    const phs = this.#activePlaceholders;
    for (let i = 0, len = phs.length; i < len; i++) {
      this.#observer.observe(phs[i]);
    }
  }

  #onIntersect = (entries) => {
    const S = TileManager;
    for (let e = 0, elen = entries.length; e < elen; e++) {
      const entry = entries[e];
      const idx = this.#elToIdx.get(entry.target);
      if (idx === undefined || !this.#activeState) continue;

      const was = this.#activeState[idx];
      const wasIntersecting = was & S.#INTERSECTING;

      if (entry.isIntersecting && !wasIntersecting) {
        this.#activeState[idx] |= S.#INTERSECTING;
        this.#activeIntersecting++;
        if (was & S.#READY) this.#activeReadyIntersecting++;

        if (!(was & S.#REQUESTED)) {
          this.#activeState[idx] |= S.#REQUESTED;
          this.#createTileImage(idx);
          this.#queue.push(idx);
        }
      } else if (!entry.isIntersecting && wasIntersecting) {
        this.#activeState[idx] &= ~S.#INTERSECTING;
        this.#activeIntersecting--;
        if (was & S.#READY) this.#activeReadyIntersecting--;
        this.#destroyTileImage(idx);
      }
    }

    this.#drain();
    this.checkLayerHandoff();
  };

  #createTileImage(idx) {
    const img = document.createElement("img");
    img.alt = "";
    img.decoding = "async";
    img.style.cssText =
      "display:block;width:100%;height:100%;pointer-events:none;";

    const version = ++this.#activeVersions[idx];

    const onDone = () => {
      if (!this.#activeVersions || this.#activeVersions[idx] !== version)
        return;
      if (this.#activeState[idx] & TileManager.#READY) return;

      this.#activeState[idx] |= TileManager.#READY;
      this.#activeState[idx] &= ~TileManager.#IN_FLIGHT;

      if (this.#activeState[idx] & TileManager.#INTERSECTING) {
        this.#activeReadyIntersecting++;
      }

      this.#inFlight = Math.max(0, this.#inFlight - 1);
      this.#drain();
      this.checkLayerHandoff();
    };

    img.onload = () => {
      if (typeof img.decode === "function") {
        img
          .decode()
          .catch(() => {})
          .finally(onDone);
      } else {
        onDone();
      }
    };
    img.onerror = onDone;

    this.#activePlaceholders[idx].appendChild(img);
    this.#activeImages[idx] = img;
  }

  #destroyTileImage(idx) {
    const img = this.#activeImages[idx];
    if (!img) return;

    const wasInFlight = this.#activeState[idx] & TileManager.#IN_FLIGHT;
    this.#activeVersions[idx]++;
    this.#activeState[idx] &= ~(
      TileManager.#IN_FLIGHT |
      TileManager.#READY |
      TileManager.#REQUESTED
    );

    img.onload = null;
    img.onerror = null;
    img.src = "";
    img.remove();
    this.#activeImages[idx] = null;

    if (wasInFlight) {
      this.#inFlight = Math.max(0, this.#inFlight - 1);
      this.#drain();
    }
  }

  #drain() {
    while (this.#inFlight < this.#batch && this.#queue.length > 0) {
      const idx = this.#queue.shift();
      if (!this.#activeState || !this.#activeImages) break;
      if (this.#activeState[idx] & TileManager.#READY) continue;
      if (!this.#activeImages[idx]) continue;

      this.#activeState[idx] |= TileManager.#IN_FLIGHT;
      this.#inFlight++;
      this.#activeImages[idx].src = this.#activeSrcs[idx];
    }
  }

  /**
   * Release JS references for the active layer without touching DOM or
   * image sources. Used when the layer element is being repurposed as a
   * backdrop: the images must remain visible.
   */
  #releaseActiveRefs() {
    if (this.#activeImages) {
      for (let i = 0, len = this.#activeImages.length; i < len; i++) {
        const img = this.#activeImages[i];
        if (img) {
          img.onload = null;
          img.onerror = null;
        }
      }
    }
    this.#activeEl = null;
    this.#activeState = null;
    this.#activePlaceholders = null;
    this.#activeImages = null;
    this.#activeSrcs = null;
    this.#activeVersions = null;
    this.#activeZoom = -1;
    this.#activeIntersecting = 0;
    this.#activeReadyIntersecting = 0;
  }

  #clearActiveLayer(removeDOM) {
    if (this.#activeImages) {
      for (let i = 0, len = this.#activeImages.length; i < len; i++) {
        const img = this.#activeImages[i];
        if (img) {
          img.onload = null;
          img.onerror = null;
          img.src = "";
        }
      }
    }

    if (removeDOM && this.#activeEl) {
      this.#activeEl.remove();
    }

    this.#activeEl = null;
    this.#activeState = null;
    this.#activePlaceholders = null;
    this.#activeImages = null;
    this.#activeSrcs = null;
    this.#activeVersions = null;
    this.#activeZoom = -1;
    this.#activeIntersecting = 0;
    this.#activeReadyIntersecting = 0;
  }

  #disposePreviousLayer() {
    if (!this.#prevEl) return;
    this.#prevEl.remove();
    this.#prevEl = null;
  }

  /**
   * Reposition tiles of the active layer to match current canvasWidth/Height
   * without rebuilding. Returns true if the layer was resized, false if there
   * is no active layer to resize.
   */
  resizeActiveLayer() {
    if (!this.#activeEl || this.#activeZoom < 0) return false;

    const zoom = this.#activeZoom;
    const cw = this.canvasWidth;
    const ch = this.canvasHeight;
    const srcScale = ZOOM_SOURCE_SCALE[zoom] ?? zoom + 1;
    const srcW = this.#baseW * srcScale;
    const srcH = this.#baseH * srcScale;
    const cols = this.#activeCols;
    const rows = this.#activeRows;

    const colEdge = new Float64Array(cols + 1);
    for (let c = 0; c <= cols; c++) {
      colEdge[c] = Math.round((Math.min(c * TILE_SIZE, srcW) / srcW) * cw);
    }
    const rowEdge = new Float64Array(rows + 1);
    for (let r = 0; r <= rows; r++) {
      rowEdge[r] = Math.round((Math.min(r * TILE_SIZE, srcH) / srcH) * ch);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const left = colEdge[c];
        const top = rowEdge[r];
        const w = colEdge[c + 1] - left;
        const h = rowEdge[r + 1] - top;

        const ph = this.#activePlaceholders[i];
        ph.style.left = `${left}px`;
        ph.style.top = `${top}px`;
        ph.style.width = `${w}px`;
        ph.style.height = `${h}px`;
      }
    }

    return true;
  }
}
