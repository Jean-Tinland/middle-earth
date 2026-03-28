const TILE_SIZE = 512;
const MAX_TILE_ZOOM = 7;
const TILE_PRELOAD_MARGIN = 128;
const TILE_LOAD_BATCH_SIZE = 10;
const ZOOM_SOURCE_SCALE = [1, 2, 3, 4, 5, 6, 8, 10];

export { MAX_TILE_ZOOM };

export default class TileManager {
  #buildVersion = document.documentElement.dataset.buildVersion || "0";
  #mapElement;
  #baseMapWidth;
  #baseMapHeight;
  #tileLayers = new Map();
  #imgToTile = new WeakMap();
  #tileLoadQueue = [];
  #tileLoadInFlight = 0;
  #tileLoadTimeoutId = null;
  #activeTileZoom = 0;
  #previousTileZoom = null;
  #backdropLayer = null;
  #backdropOriginalWidth = 0;
  #tileObserver = null;

  constructor(mapElement, baseMapWidth, baseMapHeight) {
    this.#mapElement = mapElement;
    this.#baseMapWidth = baseMapWidth;
    this.#baseMapHeight = baseMapHeight;
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
    for (const tile of this.#backdropLayer.tiles) {
      tile.image.removeAttribute("src");
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

    if (this.#tileObserver) {
      for (const tile of activeLayer.tiles) {
        this.#tileObserver.unobserve(tile.image);
      }
    }
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
  }

  resetLayers() {
    this.#tileObserver?.disconnect();
    this.#tileObserver = null;
    for (const layer of this.#tileLayers.values()) {
      for (const tile of layer.tiles) {
        tile.image.removeAttribute("src");
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
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;content-visibility:auto;contain-intrinsic-size:auto auto;";
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

        const image = document.createElement("img");
        image.alt = "";
        image.decoding = "async";
        image.dataset.src = `./assets/images/map/tiles/${zoom}/${row}-${col}.jpg?v=${this.#buildVersion}`;
        image.style.cssText = `display:block;position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;pointer-events:none;`;

        const tile = {
          image,
          requested: false,
          ready: false,
          intersecting: false,
          layerState,
        };
        this.#imgToTile.set(image, tile);

        const markReady = () => {
          if (tile.ready) return;
          tile.ready = true;
          if (tile.intersecting) layerState.readyIntersectingCount++;
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

        layer.appendChild(image);
        tiles.push(tile);
      }
    }

    return { element: layer, tiles };
  }

  #observeLayer(layer) {
    const observer = this.#getOrCreateObserver();
    for (const tile of layer.tiles) {
      observer.observe(tile.image);
    }
  }

  #getOrCreateObserver() {
    if (this.#tileObserver) return this.#tileObserver;
    this.#tileObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tile = this.#imgToTile.get(entry.target);
          if (!tile) continue;
          const layer = tile.layerState;
          const wasIntersecting = tile.intersecting;
          tile.intersecting = entry.isIntersecting;
          if (entry.isIntersecting && !wasIntersecting) {
            layer.intersectingCount++;
            if (tile.ready) layer.readyIntersectingCount++;
            if (!tile.requested) {
              tile.requested = true;
              this.#tileLoadQueue.push(tile);
            }
          } else if (!entry.isIntersecting && wasIntersecting) {
            layer.intersectingCount--;
            if (tile.ready) {
              layer.readyIntersectingCount--;
              tile.image.removeAttribute("src");
              tile.ready = false;
              tile.requested = false;
            }
          }
        }
        this.#drainQueue();
        this.checkLayerHandoff();
      },
      { rootMargin: `${TILE_PRELOAD_MARGIN}px` },
    );
    return this.#tileObserver;
  }

  #drainQueue() {
    while (
      this.#tileLoadInFlight < TILE_LOAD_BATCH_SIZE &&
      this.#tileLoadQueue.length > 0
    ) {
      const tile = this.#tileLoadQueue.shift();
      if (tile.ready) continue;
      this.#tileLoadInFlight++;
      tile.image.src = tile.image.dataset.src;
    }
  }

  /** Must be set by the canvas before each operation that builds layers. */
  canvasWidth = 0;
  canvasHeight = 0;
}
