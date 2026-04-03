/** Tile size in pixels.  */
const TILE_SIZE = 512;
/** Maximum tile zoom level. */
const MAX_TILE_ZOOM = 7;
/** Pixels outside the viewport to start loading tiles on desktop. */
const TILE_PRELOAD_MARGIN = 128;
/** On mobile, only load what is actually on screen to save memory. */
const MOBILE_TILE_PRELOAD_MARGIN = 0;
/** Maximum concurrent tile requests on desktop. */
const TILE_LOAD_BATCH_SIZE = 10;
/** Fewer concurrent requests on mobile to reduce peak memory. */
const MOBILE_TILE_LOAD_BATCH_SIZE = 4;
/** How long (ms) a backdrop layer may live on mobile before being force-removed. */
const MOBILE_BACKDROP_MAX_AGE_MS = 1500;
const ZOOM_SOURCE_SCALE = [1, 2, 3, 4, 5, 6, 8, 10];

export { MAX_TILE_ZOOM };

export default class TileManager {
  #buildVersion = document.documentElement.dataset.buildVersion || "0";
  #mapElement;
  #baseMapWidth;
  #baseMapHeight;
  #isMobile;
  #batchSize;
  #preloadMargin;
  #tileLayers = new Map();
  /** Maps placeholder <div> elements → tile objects. */
  #elemToTile = new WeakMap();
  #tileLoadQueue = [];
  #tileLoadInFlight = 0;
  #tileLoadTimeoutId = null;
  #backdropTimeoutId = null;
  #activeTileZoom = 0;
  #previousTileZoom = null;
  #backdropLayer = null;
  #backdropOriginalWidth = 0;
  #tileObserver = null;

  constructor(mapElement, baseMapWidth, baseMapHeight, isMobile = false) {
    this.#mapElement = mapElement;
    this.#baseMapWidth = baseMapWidth;
    this.#baseMapHeight = baseMapHeight;
    this.#isMobile = isMobile;
    this.#batchSize = isMobile
      ? MOBILE_TILE_LOAD_BATCH_SIZE
      : TILE_LOAD_BATCH_SIZE;
    this.#preloadMargin = isMobile
      ? MOBILE_TILE_PRELOAD_MARGIN
      : TILE_PRELOAD_MARGIN;
  }

  get activeTileZoom() {
    return this.#activeTileZoom;
  }

  get previousTileZoom() {
    return this.#previousTileZoom;
  }

  get hasBackdrop() {
    return this.#backdropLayer !== null;
  }

  removeBackdrop() {
    if (!this.#backdropLayer) return;
    if (this.#backdropTimeoutId !== null) {
      clearTimeout(this.#backdropTimeoutId);
      this.#backdropTimeoutId = null;
    }
    for (const tile of this.#backdropLayer.tiles) {
      if (tile.image) {
        tile.imgVersion++;
        tile.image.src = "";
        tile.placeholder.removeChild(tile.image);
        tile.image = null;
      }
    }
    this.#backdropLayer.element.remove();
    this.#backdropLayer = null;
  }

  installBackdrop(oldW, oldH, canvasWidth) {
    if (this.#backdropLayer) {
      const scaleRatio = canvasWidth / this.#backdropOriginalWidth;
      this.#backdropLayer.element.style.transform = `scale(${scaleRatio})`;
      return;
    }

    const activeLayer = this.#tileLayers.get(this.#activeTileZoom);
    if (!activeLayer) return;

    // Disconnect all observations atomically: far cheaper than n individual
    // unobserve() calls (936 calls at zoom level 7). resetLayers(), called
    // immediately after by the canvas, will re-establish observations for the
    // new layer via #observeLayer once the debounce fires.
    this.#tileObserver?.disconnect();
    this.#tileLayers.delete(this.#activeTileZoom);

    const scaleRatio = canvasWidth / oldW;

    activeLayer.element.style.cssText = [
      "position:absolute",
      "top:0",
      "left:0",
      `width:${oldW}px`,
      `height:${oldH}px`,
      "overflow:hidden",
      "pointer-events:none",
      `transform:scale(${scaleRatio})`,
      "transform-origin:top left",
      "z-index:0",
    ].join(";");
    activeLayer.element.hidden = false;

    this.#backdropOriginalWidth = oldW;
    this.#backdropLayer = activeLayer;

    if (this.#isMobile) {
      this.#backdropTimeoutId = setTimeout(() => {
        this.#backdropTimeoutId = null;
        this.removeBackdrop();
        const activeLayer = this.#tileLayers.get(this.#activeTileZoom);
        if (activeLayer) {
          activeLayer.element.style.setProperty("z-index", "0");
        }
      }, MOBILE_BACKDROP_MAX_AGE_MS);
    }
  }

  resetLayers() {
    this.#tileObserver?.disconnect();
    for (const layer of this.#tileLayers.values()) {
      for (const tile of layer.tiles) {
        if (tile.image) {
          tile.imgVersion++;
          tile.image.src = "";
          // tile.image is a child of tile.placeholder which is a child of
          // layer.element: layer.element.remove() cleans up the whole tree.
        }
      }
      layer.element.remove();
    }
    this.#tileLayers.clear();
    this.#previousTileZoom = null;
    this.#tileLoadQueue = [];
    this.#tileLoadInFlight = 0;
  }

  cancelPendingLoad() {
    if (this.#tileLoadTimeoutId === null) return;
    clearTimeout(this.#tileLoadTimeoutId);
    this.#tileLoadTimeoutId = null;
  }

  scheduleTileLoad(zoom, delay) {
    this.cancelPendingLoad();
    this.#tileLoadTimeoutId = setTimeout(() => {
      this.#tileLoadTimeoutId = null;
      this.renderTiles(zoom);
    }, delay);
  }

  renderTiles(zoom) {
    const boundedZoom = Math.max(0, Math.min(MAX_TILE_ZOOM, zoom));
    const previousZoom = this.#activeTileZoom;
    const activeLayer = this.#getLayer(boundedZoom);

    this.#activeTileZoom = boundedZoom;

    const hasPreviousLayer =
      previousZoom !== boundedZoom && this.#tileLayers.has(previousZoom);
    this.#previousTileZoom = hasPreviousLayer ? previousZoom : null;

    const visibleZooms = new Set([this.#activeTileZoom]);
    if (this.#previousTileZoom !== null) {
      visibleZooms.add(this.#previousTileZoom);
      const previousLayer = this.#tileLayers.get(this.#previousTileZoom);
      previousLayer.element.hidden = false;
    }

    for (const [layerZoom, layer] of this.#tileLayers.entries()) {
      layer.element.hidden = !visibleZooms.has(layerZoom);
      layer.element.style.setProperty("z-index", "-2");
    }

    activeLayer.element.hidden = false;

    const activeZIndex = this.#backdropLayer ? "-1" : "0";

    if (this.#previousTileZoom !== null) {
      const previousLayer = this.#tileLayers.get(this.#previousTileZoom);
      previousLayer.element.style.setProperty("z-index", "-1");
      activeLayer.element.style.setProperty("z-index", activeZIndex);
    } else {
      activeLayer.element.style.setProperty("z-index", activeZIndex);
    }
  }

  checkLayerHandoff() {
    const activeLayer = this.#tileLayers.get(this.#activeTileZoom);
    if (!activeLayer) return;

    const allReady =
      activeLayer.intersectingCount > 0 &&
      activeLayer.intersectingCount === activeLayer.readyIntersectingCount;

    if (this.#backdropLayer && allReady) {
      this.removeBackdrop();
      activeLayer.element.style.setProperty("z-index", "0");
    }

    if (this.#previousTileZoom === null) return;

    const previousLayer = this.#tileLayers.get(this.#previousTileZoom);
    if (!previousLayer) {
      this.#previousTileZoom = null;
      activeLayer.element.style.setProperty("z-index", "0");
      return;
    }

    if (!allReady) return;

    previousLayer.element.hidden = true;
    previousLayer.element.style.setProperty("z-index", "-2");
    activeLayer.element.style.setProperty("z-index", "0");
    this.#previousTileZoom = null;
  }

  destroy() {
    this.cancelPendingLoad();
    if (this.#backdropTimeoutId !== null) {
      clearTimeout(this.#backdropTimeoutId);
      this.#backdropTimeoutId = null;
    }
    this.removeBackdrop();
    this.resetLayers();
  }

  #getLayer(zoom) {
    const existing = this.#tileLayers.get(zoom);
    if (existing) return existing;

    const state = { intersectingCount: 0, readyIntersectingCount: 0 };
    const { element, tiles } = this.#buildLayer(zoom, state);
    state.element = element;
    state.tiles = tiles;
    this.#tileLayers.set(zoom, state);
    this.#mapElement.prepend(state.element);
    this.#observeLayer(state);
    return state;
  }

  #buildLayer(zoom, layerState) {
    const canvasW = this.canvasWidth;
    const canvasH = this.canvasHeight;
    const sourceScale = ZOOM_SOURCE_SCALE[zoom] ?? zoom + 1;
    const sourceWidth = this.#baseMapWidth * sourceScale;
    const sourceHeight = this.#baseMapHeight * sourceScale;
    const cols = Math.ceil(sourceWidth / TILE_SIZE);
    const rows = Math.ceil(sourceHeight / TILE_SIZE);

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;contain:layout paint style;";
    layer.hidden = true;

    const tiles = [];

    const colEdges = new Array(cols + 1);
    for (let c = 0; c <= cols; c++) {
      colEdges[c] = Math.round(
        (Math.min(c * TILE_SIZE, sourceWidth) / sourceWidth) * canvasW,
      );
    }
    const rowEdges = new Array(rows + 1);
    for (let r = 0; r <= rows; r++) {
      rowEdges[r] = Math.round(
        (Math.min(r * TILE_SIZE, sourceHeight) / sourceHeight) * canvasH,
      );
    }

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = colEdges[col];
        const top = rowEdges[row];
        const width = colEdges[col + 1] - left;
        const height = rowEdges[row + 1] - top;

        // Lightweight placeholder: no <img> until the tile enters the
        // viewport. This keeps hundreds of invisible img elements out of the
        // DOM, dramatically reducing memory pressure on iOS.
        const placeholder = document.createElement("div");
        placeholder.style.cssText = `display:block;position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;pointer-events:none;contain:strict;`;

        const tile = {
          placeholder,
          image: null,
          src: `./assets/images/map/tiles/${zoom}/${row}-${col}.jpg?v=${this.#buildVersion}`,
          imgVersion: 0,
          requested: false,
          ready: false,
          /** True while tile.image.src has been set but load/error hasn't fired. */
          inFlight: false,
          intersecting: false,
          layerState,
        };

        this.#elemToTile.set(placeholder, tile);
        layer.appendChild(placeholder);
        tiles.push(tile);
      }
    }

    return { element: layer, tiles };
  }

  /** Create and attach an <img> element to a tile's placeholder. */
  #createTileImage(tile) {
    const image = document.createElement("img");
    image.alt = "";
    image.decoding = "async";
    image.style.cssText =
      "display:block;width:100%;height:100%;pointer-events:none;";

    const version = ++tile.imgVersion;

    const markReady = () => {
      if (tile.imgVersion !== version) return; // stale: tile was destroyed
      if (tile.ready) return;
      tile.ready = true;
      tile.inFlight = false;
      if (tile.intersecting) tile.layerState.readyIntersectingCount++;
      this.#tileLoadInFlight = Math.max(0, this.#tileLoadInFlight - 1);
      this.#drainQueue();
      this.checkLayerHandoff();
    };

    image.addEventListener("load", () => {
      if (typeof image.decode !== "function") {
        markReady();
        return;
      }
      image
        .decode()
        .catch(() => {})
        .finally(markReady);
    });
    image.addEventListener("error", markReady);

    tile.placeholder.appendChild(image);
    return image;
  }

  /**
   * Cancel and remove a tile's <img> element, freeing its memory.
   * Correctly handles in-flight requests so tileLoadInFlight stays accurate.
   */
  #destroyTileImage(tile) {
    if (!tile.image) return;
    const wasInFlight = tile.inFlight;
    tile.imgVersion++; // invalidate any pending markReady / decode callbacks
    tile.inFlight = false;
    tile.image.src = ""; // cancel pending HTTP request
    tile.placeholder.removeChild(tile.image);
    tile.image = null;
    tile.ready = false;
    tile.requested = false;
    if (wasInFlight) {
      this.#tileLoadInFlight = Math.max(0, this.#tileLoadInFlight - 1);
      this.#drainQueue(); // free up the reclaimed slot immediately
    }
  }

  #observeLayer(layer) {
    const observer = this.#getOrCreateObserver();
    for (const tile of layer.tiles) {
      observer.observe(tile.placeholder);
    }
  }

  #getOrCreateObserver() {
    if (this.#tileObserver) return this.#tileObserver;
    this.#tileObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tile = this.#elemToTile.get(entry.target);
          if (!tile) continue;
          const layer = tile.layerState;
          const wasIntersecting = tile.intersecting;
          tile.intersecting = entry.isIntersecting;
          if (entry.isIntersecting && !wasIntersecting) {
            layer.intersectingCount++;
            if (tile.ready) layer.readyIntersectingCount++;
            if (!tile.requested) {
              tile.requested = true;
              tile.image = this.#createTileImage(tile);
              this.#tileLoadQueue.push(tile);
            }
          } else if (!entry.isIntersecting && wasIntersecting) {
            layer.intersectingCount--;
            if (tile.ready) layer.readyIntersectingCount--;
            this.#destroyTileImage(tile);
          }
        }
        this.#drainQueue();
        this.checkLayerHandoff();
      },
      { rootMargin: `${this.#preloadMargin}px` },
    );
    return this.#tileObserver;
  }

  #drainQueue() {
    while (
      this.#tileLoadInFlight < this.#batchSize &&
      this.#tileLoadQueue.length > 0
    ) {
      const tile = this.#tileLoadQueue.shift();
      // Skip tiles that finished loading or whose image was destroyed.
      if (tile.ready || !tile.image) continue;
      tile.inFlight = true;
      this.#tileLoadInFlight++;
      tile.image.src = tile.src;
    }
  }

  /** Must be set by the canvas before each operation that builds layers. */
  canvasWidth = 0;
  canvasHeight = 0;
}
