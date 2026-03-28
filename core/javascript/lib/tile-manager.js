const TILES_BUILD_VERSION = "2";
const TILE_SIZE = 512;
const MAX_TILE_ZOOM = 7;
const ZOOM_SOURCE_SCALE = [1, 2, 3, 4, 5, 6, 8, 10];

export { MAX_TILE_ZOOM };

export default class TileManager {
  #mapElement;
  #baseMapWidth;
  #baseMapHeight;
  #tileLayers = new Map();
  #tileLoadTimeoutId = null;
  #activeTileZoom = 0;
  #previousTileZoom = null;
  #backdropLayer = null;
  #backdropOriginalWidth = 0;

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
    for (const img of this.#backdropLayer.images) {
      img.removeAttribute("src");
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
    for (const layer of this.#tileLayers.values()) {
      for (const img of layer.images) {
        img.removeAttribute("src");
      }
      layer.element.remove();
    }
    this.#tileLayers.clear();
    this.#previousTileZoom = null;
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

    const vpW = window.innerWidth;
    const vpH = window.innerHeight;
    let intersectingCount = 0;
    let readyIntersectingCount = 0;

    for (const img of activeLayer.images) {
      const r = img.getBoundingClientRect();
      if (r.right > 0 && r.bottom > 0 && r.left < vpW && r.top < vpH) {
        intersectingCount++;
        if (activeLayer.decoded.has(img)) readyIntersectingCount++;
      }
    }

    const allReady =
      intersectingCount > 0 && intersectingCount === readyIntersectingCount;

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

    const decoded = new WeakSet();
    const state = { element: null, images: null, decoded };
    const { element, images } = this.#buildLayer(zoom, decoded);
    state.element = element;
    state.images = images;
    this.#tileLayers.set(zoom, state);
    this.#mapElement.prepend(state.element);
    return state;
  }

  #buildLayer(zoom, decoded) {
    const canvasW = this.canvasWidth;
    const canvasH = this.canvasHeight;
    const sourceScale = ZOOM_SOURCE_SCALE[zoom] ?? zoom + 1;
    const sourceWidth = this.#baseMapWidth * sourceScale;
    const sourceHeight = this.#baseMapHeight * sourceScale;
    const cols = Math.ceil(sourceWidth / TILE_SIZE);
    const rows = Math.ceil(sourceHeight / TILE_SIZE);

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;";
    layer.hidden = true;

    const images = [];

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

        const img = document.createElement("img");
        img.loading = "lazy";
        img.alt = "";
        img.decoding = "async";
        img.src = `./assets/images/map/tiles/${zoom}/${row}-${col}.jpg?v=${TILES_BUILD_VERSION}`;
        img.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${width}px;height:${height}px;display:block;pointer-events:none;`;

        const markDecoded = () => {
          decoded.add(img);
          this.checkLayerHandoff();
        };

        img.addEventListener("load", () => {
          if (typeof img.decode === "function") {
            img
              .decode()
              .catch(() => {})
              .finally(markDecoded);
          } else {
            markDecoded();
          }
        });
        img.addEventListener("error", markDecoded);

        layer.appendChild(img);
        images.push(img);
      }
    }

    return { element: layer, images };
  }

  /** Must be set by the canvas before each operation that builds layers. */
  canvasWidth = 0;
  canvasHeight = 0;
}
