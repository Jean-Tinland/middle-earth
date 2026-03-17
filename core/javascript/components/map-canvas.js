import "./map-button.js";
import "./map-controls.js";
import "./map-information.js";
import "./map-nomenclature.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";

/** The step for scaling the map. */
const SCALE_STEP = 1;
/** The maximum scale of the map. */
const MAX_SCALE = 11;
/** The minimum scale of the map. */
const MIN_SCALE = 1;
/** The accumulated deltaY required to trigger one zoom step. */
const WHEEL_THRESHOLD = 100;
/** Tile size in source map pixels. */
const TILE_SIZE = 512;
/** Highest available tile zoom folder. */
const MAX_TILE_ZOOM = 7;
/** Base map width used for layout coordinates. */
const BASE_MAP_WIDTH = 1800;
/** Base map height used for layout coordinates. */
const BASE_MAP_HEIGHT = 1300;
/** Off-screen margin used to preload nearby tiles. */
const TILE_PRELOAD_MARGIN = 256;
/** Minimum font scale applied on narrow portrait viewports. */
const PORTRAIT_MIN_FONT_SCALE = 0.65;
/** Effective font scale cap so size stays constant once scale reaches 9+. */
const FONT_SCALE_LOCK_THRESHOLD = 8;
/** Duration of animated zoom transitions in milliseconds. */
const ZOOM_TRANSITION_MS = 320;
/** Delay before swapping tile layers after wheel zoom input settles. */
const WHEEL_TILE_SWAP_DELAY_MS = 120;

/**
 * Detects iOS and iPadOS devices.
 * iPadOS can report itself as macOS, so touch capability is part of the check.
 * @returns {boolean}
 */
const isAppleMobileDevice = () => {
  const userAgent = window.navigator.userAgent;
  const platform = window.navigator.platform;
  const hasTouchPoints = window.navigator.maxTouchPoints > 1;

  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && hasTouchPoints)
  );
};
/**
 * Default values for the map canvas.
 * @type {Object}
 * @property {number} FONT_SIZE_REF - The default font size reference.
 * @property {number} SCALE - The default scale.
 * @property {number} ZOOM - The default zoom.
 * @property {number} TRANSLATE_X - The default X translation.
 * @property {number} TRANSLATE_Y - The default Y translation.
 * @property {Object} PREVIOUS_TOUCH - The previous touch event.
 * @readonly
 */
const DEFAULTS = Object.freeze({
  FONT_SIZE_REF: 12,
  SCALE: 1,
  ZOOM: 0,
  TRANSLATE_X: 0,
  TRANSLATE_Y: 0,
  PREVIOUS_TOUCH: undefined,
});

/**
 * Represents a custom HTML element for a map canvas with zoom and drag functionalities.
 * @extends HTMLElement
 */
export default class MapCanvas extends HTMLElement {
  constructor() {
    super();

    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.fontSizeRef = DEFAULTS.FONT_SIZE_REF / (this.scale / 1.7);
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.wheelRafId = null;
    this.lastWheelEvent = null;
    this.lastWheelDirection = 0;
    this.wheelDeltaAccumulator = 0;
    this.dragRafId = null;
    this.resizeRafId = null;
    this.transitionTimeoutId = null;
    this.tileSwapTimeoutId = null;
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.isDragging = false;
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartScale = 1;
    this.canvasNaturalWidth = 0;
    this.canvasNaturalHeight = 0;
    this.tileLayers = new Map();
    this.activeTileZoom = DEFAULTS.ZOOM;
    this.previousTileZoom = null;
    this.pendingTileZoom = DEFAULTS.ZOOM;
    this.tileVisibilityRafId = null;

    this.root = this.attachShadow({ mode: "closed" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  /**
   * Resets the canvas to its initial state.
   * @private
   */
  #reset = () => {
    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    clearTimeout(this.tileSwapTimeoutId);
    this.tileSwapTimeoutId = null;
    this.canvas.style.removeProperty("transition");
    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.previousTileZoom = null;
    this.#updateFontSizeRef();
    this.#renderTiles(this.zoom);
    this.#renderPois();
    this.#updateControls();
    this.#updateCanvas();
  };

  /**
   * Renders POIs for the current zoom and font reference.
   * @private
   */
  #renderPois = () => {
    if (!this.mapPois) return;
    this.mapPois.render(this.zoom, this.fontSizeRef);
  };

  /**
   * Returns the focal point used to keep zoom centered.
   * Wheel and double click zoom around the pointer.
   * Control button clicks zoom around the viewport center.
   * @param {Event} e
   * @returns {{x: number, y: number}}
   * @private
   */
  #getZoomFocalPoint = (e) => {
    const viewportCenter = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };

    if (!e || e.type === "click") return viewportCenter;

    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY)) {
      return { x: e.clientX, y: e.clientY };
    }

    return viewportCenter;
  };

  /**
   * Prepares a smooth transform-based zoom transition.
   * @private
   */
  #prepareAnimatedZoom = () => {
    clearTimeout(this.transitionTimeoutId);
    this.canvas.style.setProperty("transition", "none");
    this.canvas.getBoundingClientRect();
    this.canvas.style.setProperty(
      "transition",
      `transform ${ZOOM_TRANSITION_MS}ms var(--transition-easing)`,
    );
  };

  /**
   * Clears transform transition after animated zoom completes.
   * @private
   */
  #scheduleTransitionCleanup = () => {
    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = setTimeout(() => {
      this.canvas.style.removeProperty("transition");
      // Recompute tile visibility after the animated transform settles.
      this.#scheduleTileVisibilityUpdate();
      this.transitionTimeoutId = null;
    }, ZOOM_TRANSITION_MS);
  };

  /**
   * Schedules a tile layer swap once zoom interaction settles.
   * @param {number} zoom
   * @param {number} delayMs
   * @private
   */
  #scheduleTileLayerSwap = (zoom, delayMs = 0) => {
    const boundedZoom = Math.max(DEFAULTS.ZOOM, Math.min(MAX_TILE_ZOOM, zoom));
    this.pendingTileZoom = boundedZoom;

    clearTimeout(this.tileSwapTimeoutId);
    this.tileSwapTimeoutId = null;

    if (delayMs <= 0) {
      this.#renderTiles(this.pendingTileZoom);
      return;
    }

    this.tileSwapTimeoutId = setTimeout(() => {
      this.#renderTiles(this.pendingTileZoom);
      this.tileSwapTimeoutId = null;
    }, delayMs);
  };

  /**
   * Zooms in the canvas.
   */
  zoomIn = (e) => {
    if (this.scale === MAX_SCALE) return;
    e.preventDefault();

    if (e.type !== "wheel") {
      this.#prepareAnimatedZoom();
    }

    const focalPoint = this.#getZoomFocalPoint(e);

    this.scale = Math.min(this.scale + 1, MAX_SCALE);
    this.zoom = Math.min(Math.round(this.scale - SCALE_STEP), MAX_TILE_ZOOM);

    this.translateX -= (focalPoint.x - window.innerWidth / 2) / this.scale;
    this.translateY -= (focalPoint.y - window.innerHeight / 2) / this.scale;

    this.#updateFontSizeRef();
    this.#renderPois();
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateControls();

    const tileSwapDelay =
      e.type === "wheel" ? WHEEL_TILE_SWAP_DELAY_MS : ZOOM_TRANSITION_MS;
    this.#scheduleTileLayerSwap(this.zoom, tileSwapDelay);

    if (e.type !== "wheel") {
      this.#scheduleTransitionCleanup();
    }
  };

  /**
   * Zooms out the canvas.
   */
  zoomOut = (e) => {
    if (this.scale === MIN_SCALE) return;
    e.preventDefault();

    if (e.type !== "wheel") {
      this.#prepareAnimatedZoom();
    }

    const focalPoint = this.#getZoomFocalPoint(e);

    this.scale = Math.max(this.scale - 1, MIN_SCALE);
    this.zoom = Math.max(Math.round(this.scale - SCALE_STEP), DEFAULTS.ZOOM);
    this.translateX += (focalPoint.x - window.innerWidth / 2) / this.scale;
    this.translateY += (focalPoint.y - window.innerHeight / 2) / this.scale;
    this.#updateFontSizeRef();
    this.#renderPois();
    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateControls();

    const tileSwapDelay =
      e.type === "wheel" ? WHEEL_TILE_SWAP_DELAY_MS : ZOOM_TRANSITION_MS;
    this.#scheduleTileLayerSwap(this.zoom, tileSwapDelay);

    if (e.type !== "wheel") {
      this.#scheduleTransitionCleanup();
    }
  };

  /**
   * Updates the zoom controls.
   * @private
   */
  #updateControls = () => {
    if (!this.controls?.zoomInButton || !this.controls?.zoomOutButton) return;

    this.controls.zoomOutButton.disabled = this.scale === MIN_SCALE;
    this.controls.zoomInButton.disabled = this.scale === MAX_SCALE;
  };

  /**
   * Hides controls on iOS and iPadOS devices.
   * @private
   */
  #hideControlsOnAppleMobile = () => {
    if (!this.controls || !isAppleMobileDevice()) return;
    this.controls.style.setProperty("display", "none");
  };

  /**
   * Updates the canvas transformation.
   * @private
   */
  #updateCanvas = () => {
    this.canvas.style.setProperty(
      "transform",
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`,
    );
    this.#scheduleTileVisibilityUpdate();
  };

  /**
   * Returns a scale factor that reduces font sizes on portrait viewports.
   * Landscape viewports (width ≥ height) return 1 — no change to desktop.
   * Portrait viewports return a value proportional to their aspect ratio,
   * clamped to PORTRAIT_MIN_FONT_SCALE so labels stay legible.
   * @returns {number}
   * @private
   */
  #computePortraitFontScalar = () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    return Math.max(PORTRAIT_MIN_FONT_SCALE, Math.min(1, aspectRatio));
  };

  /**
   * Updates the font size reference.
   * @private
   */
  #updateFontSizeRef = () => {
    // The font size reference is inversely proportional to the scale.
    const divider = this.zoom === 0 ? 1.5 : 2;
    const effectiveScale = Math.min(this.scale, FONT_SCALE_LOCK_THRESHOLD);
    const portraitFontScalar = this.#computePortraitFontScalar();
    this.fontSizeRef =
      (DEFAULTS.FONT_SIZE_REF / (effectiveScale / divider)) *
      portraitFontScalar;
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontSizeRef.toFixed(2)}px`,
    );
  };

  /**
   * Stores the canvas's natural (un-zoomed) dimensions.
   * Must be called after the map has been laid out.
   * @private
   */
  #measureNaturalDimensions = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const fitScale = Math.min(
      viewportWidth / BASE_MAP_WIDTH,
      viewportHeight / BASE_MAP_HEIGHT,
    );

    this.canvasNaturalWidth = Math.max(
      1,
      Math.floor(BASE_MAP_WIDTH * fitScale),
    );
    this.canvasNaturalHeight = Math.max(
      1,
      Math.floor(BASE_MAP_HEIGHT * fitScale),
    );
  };

  /**
   * Applies the measured natural canvas size in pixels.
   * Keeps dimensions stable while transform-based interactions are active.
   * @private
   */
  #setNaturalCanvasSize = () => {
    this.canvas.style.setProperty("max-width", "none");
    this.canvas.style.setProperty("max-height", "none");
    this.canvas.style.setProperty("width", `${this.canvasNaturalWidth}px`);
    this.canvas.style.setProperty("height", `${this.canvasNaturalHeight}px`);
    this.map.style.setProperty("width", `${this.canvasNaturalWidth}px`);
    this.map.style.setProperty("height", `${this.canvasNaturalHeight}px`);
  };

  /**
   * Handles window resize events by re-measuring the canvas natural dimensions,
   * fixing any boundary violations, and redrawing active layers.
   * @private
   */
  #handleResize = () => {
    if (this.resizeRafId !== null) return;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      const previousWidth = this.canvasNaturalWidth;
      const previousHeight = this.canvasNaturalHeight;
      this.#measureNaturalDimensions();
      const didNaturalSizeChange =
        previousWidth !== this.canvasNaturalWidth ||
        previousHeight !== this.canvasNaturalHeight;

      if (didNaturalSizeChange) {
        this.#resetTileLayers();
      }

      this.#setNaturalCanvasSize();
      this.#renderTiles(this.zoom);
      if (this.scale === MIN_SCALE) {
        return this.#reset();
      }
      this.#checkAndFixBoundaries();
      this.#updateCanvas();
    });
  };

  /**
   * Calculates the distance between two touch points.
   * @param {TouchList} touches
   * @returns {number}
   * @private
   */
  #getPinchDistance = (touches) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  /**
   * Handles the start of a touch event.
   * Starts dragging immediately for single-touch gestures and prepares
   * pinch tracking when two touches are detected.
   * @param {TouchEvent} e
   * @private
   */
  #touchStart = (e) => {
    e.preventDefault();
    this.isDragging = true;
    clearTimeout(this.transitionTimeoutId);
    this.canvas.style.setProperty("transition", "none");

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.previousTouch = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    }

    if (e.touches.length !== 2) return;

    this.isPinching = true;
    this.pinchStartDistance = this.#getPinchDistance(e.touches);
    this.pinchStartScale = this.scale;
    this.previousTouch = undefined;
  };

  /**
   * Applies the queued drag movement immediately.
   * @private
   */
  #applyPendingDrag = () => {
    if (this.pendingMovementX === 0 && this.pendingMovementY === 0) return;

    this.translateX += this.pendingMovementX / this.scale;
    this.translateY += this.pendingMovementY / this.scale;
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.#updateCanvas();
  };

  /**
   * Handles the start of a drag event.
   * @param {PointerEvent} e - The pointer event.
   * @private
   */
  #dragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
    clearTimeout(this.transitionTimeoutId);
    this.canvas.addEventListener("pointermove", this.#dragging);
    this.canvas.style.setProperty("cursor", "grabbing");
    this.canvas.style.setProperty("transition", "none");
  };

  /**
   * Handles the end of a drag event.
   * @param {PointerEvent} e - The pointer event.
   * @private
   */
  #dragEnd = (e) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    e.preventDefault();
    e.stopPropagation();
    this.canvas.removeEventListener("pointermove", this.#dragging);
    this.canvas.style.removeProperty("cursor");
    this.canvas.style.removeProperty("transition");

    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
      this.pendingMovementX = 0;
      this.pendingMovementY = 0;
    }

    this.previousTouch = undefined;

    let didCompletePinch = false;

    if (this.isPinching) {
      this.isPinching = false;
      this.pinchStartDistance = 0;
      this.scale = Math.round(this.scale);
      this.zoom = Math.min(Math.round(this.scale - SCALE_STEP), MAX_TILE_ZOOM);
      this.#updateFontSizeRef();
      this.#updateControls();
      didCompletePinch = true;
    }

    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }

    this.#checkAndFixBoundaries();
    this.#updateCanvas();

    if (didCompletePinch) {
      this.#scheduleTileLayerSwap(this.zoom, 0);
      this.#renderPois();
    }
  };

  #checkAndFixBoundaries = () => {
    const canvasBounds = this.canvas.getBoundingClientRect();
    const bodyBounds = document.body.getBoundingClientRect();

    if (canvasBounds.left > bodyBounds.left) {
      this.translateX -= (canvasBounds.left - bodyBounds.left) / this.scale;
    }
    if (canvasBounds.top > bodyBounds.top) {
      this.translateY -= (canvasBounds.top - bodyBounds.top) / this.scale;
    }
    if (canvasBounds.right < bodyBounds.right) {
      this.translateX += (bodyBounds.right - canvasBounds.right) / this.scale;
    }
    if (canvasBounds.bottom < bodyBounds.bottom) {
      this.translateY += (bodyBounds.bottom - canvasBounds.bottom) / this.scale;
    }
  };

  /**
   * Handles the dragging event.
   * @param {PointerEvent} e - The pointer event.
   * @private
   */
  #dragging = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.touches?.length === 2 && this.isPinching) {
      const distance = this.#getPinchDistance(e.touches);
      const rawScale =
        (distance / this.pinchStartDistance) * this.pinchStartScale;
      this.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, rawScale));
      this.zoom = Math.max(
        DEFAULTS.ZOOM,
        Math.min(MAX_TILE_ZOOM, Math.round(this.scale - SCALE_STEP)),
      );
      this.#updateFontSizeRef();
      this.#updateControls();
      this.#renderPois();
      this.#updateCanvas();
      return;
    }

    // Touch events do not have movementX and movementY properties.
    // We calculate them using the previous touch event.
    if (e.type === "touchmove") {
      this.canvas.style.setProperty("transition", "none");

      const touch = e.touches[0];

      e.movementX = this.previousTouch
        ? touch.clientX - this.previousTouch.clientX
        : 0;
      e.movementY = this.previousTouch
        ? touch.clientY - this.previousTouch.clientY
        : 0;

      this.previousTouch = {
        clientX: touch.clientX,
        clientY: touch.clientY,
      };
    }

    this.pendingMovementX += e.movementX;
    this.pendingMovementY += e.movementY;

    if (this.dragRafId !== null) return;

    this.#applyPendingDrag();

    this.dragRafId = requestAnimationFrame(() => {
      this.dragRafId = null;
      this.#applyPendingDrag();
    });
  };

  /**
   * Builds a tile layer for one zoom level.
   * @param {number} zoom
   * @returns {{ element: HTMLDivElement, tiles: Array<{slot: HTMLDivElement, image: HTMLImageElement, src: string, requested: boolean, ready: boolean}> }}
   * @private
   */
  #buildTileLayer = (zoom) => {
    const sourceScale = zoom + 1;
    const layoutScale = this.canvasNaturalWidth / BASE_MAP_WIDTH;
    const snapStep = 1 / sourceScale;
    const snapToZoomGrid = (value) => Math.round(value / snapStep) * snapStep;
    const sourceWidth = BASE_MAP_WIDTH * sourceScale;
    const sourceHeight = BASE_MAP_HEIGHT * sourceScale;
    const cols = Math.ceil(sourceWidth / TILE_SIZE);
    const rows = Math.ceil(sourceHeight / TILE_SIZE);

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;";
    layer.hidden = true;

    const tiles = [];

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const sourceLeft = col * TILE_SIZE;
        const sourceTop = row * TILE_SIZE;
        const sourceRight = Math.min(sourceLeft + TILE_SIZE, sourceWidth);
        const sourceBottom = Math.min(sourceTop + TILE_SIZE, sourceHeight);

        const left = snapToZoomGrid((sourceLeft * layoutScale) / sourceScale);
        const top = snapToZoomGrid((sourceTop * layoutScale) / sourceScale);
        const right = snapToZoomGrid((sourceRight * layoutScale) / sourceScale);
        const bottom = snapToZoomGrid(
          (sourceBottom * layoutScale) / sourceScale,
        );
        const width = Math.max(0, right - left).toFixed(2);
        const height = Math.max(0, bottom - top).toFixed(2);

        const slot = document.createElement("div");
        slot.style.cssText = [
          "position:absolute",
          `left:${left}px`,
          `top:${top}px`,
          `width:${width}px`,
          `height:${height}px`,
          "visibility:hidden",
        ].join(";");

        const image = document.createElement("img");
        const src = `./assets/images/map/tiles/${zoom}/${row}-${col}.jpg`;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.style.cssText =
          "display:block;width:100%;height:100%;object-fit:cover;pointer-events:none;";

        const tile = { slot, image, src, requested: false, ready: false };

        const markTileReady = () => {
          if (tile.ready) return;
          tile.ready = true;
          this.#scheduleTileVisibilityUpdate();
        };

        image.addEventListener("load", () => {
          if (typeof image.decode !== "function") {
            markTileReady();
            return;
          }

          image
            .decode()
            .catch(() => {})
            .finally(markTileReady);
        });
        image.addEventListener("error", () => {
          // Keep layer handoff moving if a tile fails to load.
          markTileReady();
        });

        slot.appendChild(image);
        layer.appendChild(slot);
        tiles.push(tile);
      }
    }

    return { element: layer, tiles };
  };

  /**
   * Clears all cached tile layers so they can be rebuilt for a new base size.
   * @private
   */
  #resetTileLayers = () => {
    for (const { element } of this.tileLayers.values()) {
      element.remove();
    }
    this.tileLayers.clear();
    this.previousTileZoom = null;
  };

  /**
   * Gets one tile layer from cache or creates it on first use.
   * @param {number} zoom
   * @returns {{ element: HTMLDivElement, tiles: Array<{slot: HTMLDivElement, image: HTMLImageElement, src: string, requested: boolean, ready: boolean}> }}
   * @private
   */
  #getTileLayer = (zoom) => {
    const existingLayer = this.tileLayers.get(zoom);
    if (existingLayer) return existingLayer;

    const newLayer = this.#buildTileLayer(zoom);
    this.tileLayers.set(zoom, newLayer);
    this.map.prepend(newLayer.element);
    return newLayer;
  };

  /**
   * Activates the tile layer for the current zoom level.
   * @param {number} zoom
   * @private
   */
  #renderTiles = (zoom) => {
    const boundedZoom = Math.max(DEFAULTS.ZOOM, Math.min(MAX_TILE_ZOOM, zoom));
    const previousZoom = this.activeTileZoom;
    const activeLayer = this.#getTileLayer(boundedZoom);

    this.activeTileZoom = boundedZoom;
    this.previousTileZoom = previousZoom === boundedZoom ? null : previousZoom;

    const visibleZooms = new Set([this.activeTileZoom]);
    if (this.previousTileZoom !== null) {
      visibleZooms.add(this.previousTileZoom);
      const previousLayer = this.#getTileLayer(this.previousTileZoom);
      previousLayer.element.hidden = false;
    }

    for (const [layerZoom, layer] of this.tileLayers.entries()) {
      layer.element.hidden = !visibleZooms.has(layerZoom);
      layer.element.style.setProperty("z-index", "-2");
    }

    activeLayer.element.hidden = false;

    if (this.previousTileZoom !== null) {
      const previousLayer = this.#getTileLayer(this.previousTileZoom);
      previousLayer.element.style.setProperty("z-index", "-1");
      activeLayer.element.style.setProperty("z-index", "0");
    } else {
      activeLayer.element.style.setProperty("z-index", "0");
    }

    this.#scheduleTileVisibilityUpdate();
  };

  /**
   * Updates one layer's viewport visibility and starts nearby tile loading.
   * @param {{ tiles: Array<{slot: HTMLDivElement, image: HTMLImageElement, src: string, requested: boolean, ready: boolean}> }} layer
   * @param {boolean} revealOnlyReadyTiles
   * @returns {boolean}
   * @private
   */
  #updateLayerVisibility = (layer, revealOnlyReadyTiles = false) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const preloadLeft = -TILE_PRELOAD_MARGIN;
    const preloadTop = -TILE_PRELOAD_MARGIN;
    const preloadRight = viewportWidth + TILE_PRELOAD_MARGIN;
    const preloadBottom = viewportHeight + TILE_PRELOAD_MARGIN;
    let allVisibleTilesReady = true;

    for (const tile of layer.tiles) {
      const rect = tile.slot.getBoundingClientRect();
      const isVisible =
        rect.right > 0 &&
        rect.bottom > 0 &&
        rect.left < viewportWidth &&
        rect.top < viewportHeight;
      const isNearViewport =
        rect.right > preloadLeft &&
        rect.bottom > preloadTop &&
        rect.left < preloadRight &&
        rect.top < preloadBottom;

      if (isNearViewport && !tile.requested) {
        tile.image.src = tile.src;
        tile.requested = true;
      }

      if (isVisible && !tile.ready) {
        allVisibleTilesReady = false;
      }

      const shouldShowTile = revealOnlyReadyTiles
        ? isVisible && tile.ready
        : isVisible;
      tile.slot.style.setProperty(
        "visibility",
        shouldShowTile ? "visible" : "hidden",
      );
    }

    return allVisibleTilesReady;
  };

  /**
   * Schedules a single tile visibility update pass.
   * @private
   */
  #scheduleTileVisibilityUpdate = () => {
    if (this.tileVisibilityRafId !== null) return;

    this.tileVisibilityRafId = requestAnimationFrame(() => {
      this.tileVisibilityRafId = null;
      this.#updateTileVisibility();
    });
  };

  /**
   * Loads near-viewport tiles lazily and hides out-of-viewport tiles.
   * Hidden tiles keep their position and dimensions in the layer grid.
   * @private
   */
  #updateTileVisibility = () => {
    const activeLayer = this.tileLayers.get(this.activeTileZoom);
    if (!activeLayer) return;

    const allVisibleTilesReady = this.#updateLayerVisibility(activeLayer, true);

    if (this.previousTileZoom === null) return;

    const previousLayer = this.tileLayers.get(this.previousTileZoom);
    if (!previousLayer) {
      this.previousTileZoom = null;
      activeLayer.element.style.setProperty("z-index", "0");
      return;
    }

    previousLayer.element.hidden = false;
    previousLayer.element.style.setProperty("z-index", "-1");
    activeLayer.element.style.setProperty("z-index", "0");
    this.#updateLayerVisibility(previousLayer, false);

    if (!allVisibleTilesReady) return;

    previousLayer.element.hidden = true;
    previousLayer.element.style.setProperty("z-index", "-2");
    activeLayer.element.style.setProperty("z-index", "0");
    this.previousTileZoom = null;
  };

  /**
   * Loads the points of interest (POIs).
   * @private
   */
  #loadPois = async () => {
    const pois = await fetch("/assets/data/pois.json");
    const data = await pois.json();
    this.pois = data.pois;
  };

  /**
   * Draws the points of interest (POIs).
   * @private
   */
  #drawPois = () => {
    this.mapPois = new MapPois(this.pois);
    this.map.appendChild(this.mapPois);
  };

  /**
   * Handles the map load event.
   * @private
   */
  #onMapLoad = () => {
    this.setAttribute("ready", "");
  };

  /**
   * Handles the double click event on the canvas.
   * Zooms in or out depending on the shift key.
   * @param {MouseEvent} e - The mouse event.
   * @private
   */
  #handleCanvasDoubleClick = (e) => {
    if (e.shiftKey) {
      this.zoomOut(e);
    } else {
      this.zoomIn(e);
    }
  };

  /**
   * Handles the mouse wheel event.
   * Zooms in or out depending on the wheel direction.
   * @param {WheelEvent} e - The wheel event.
   * @private
   */
  #handleMouseWheel = (e) => {
    this.wheelDeltaAccumulator += e.deltaY;

    if (Math.abs(this.wheelDeltaAccumulator) < WHEEL_THRESHOLD) return;

    this.lastWheelEvent = e;
    this.lastWheelDirection = this.wheelDeltaAccumulator > 0 ? 1 : -1;
    this.wheelDeltaAccumulator = 0;

    if (this.wheelRafId !== null) return;

    clearTimeout(this.transitionTimeoutId);
    this.canvas.style.setProperty("transition", "none");

    this.wheelRafId = requestAnimationFrame(() => {
      this.wheelRafId = null;
      const event = this.lastWheelEvent;
      const direction = this.lastWheelDirection;
      this.lastWheelEvent = null;
      if (direction > 0) {
        this.zoomOut(event);
      } else {
        this.zoomIn(event);
      }
      this.canvas.style.removeProperty("transition");
    });
  };

  /**
   * Gets the percentage coordinates of the clicked point.
   * Only active when the debugMap is enabled on window.
   * @param {MouseEvent} e - The mouse event.
   * @private
   */
  #getPercentageCoordinates = async (e) => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.has("debug");
    if (!debugEnabled) return;
    const { left, top, width, height } = this.canvas.getBoundingClientRect();
    const scaledX = (e.clientX - left) / this.scale;
    const scaledY = (e.clientY - top) / this.scale;
    const x = (scaledX / (width / this.scale)) * 100;
    const y = (scaledY / (height / this.scale)) * 100;
    await navigator.clipboard.writeText(`[${x.toFixed(2)}, ${y.toFixed(2)}]`);
  };

  /**
   * Resolves once the document and blocking resources are fully loaded.
   * @returns {Promise<void>}
   * @private
   */
  #waitForPageLoad = async () => {
    if (document.readyState === "complete") return;
    await new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  };

  /**
   * Called when the element is connected to the document's DOM.
   */
  async connectedCallback() {
    this.canvas = this.root.querySelector(".canvas");
    this.map = this.root.querySelector(".map");
    this.controls = this.root.querySelector("map-controls");
    await this.#waitForPageLoad();
    this.#hideControlsOnAppleMobile();

    await this.#loadPois();
    this.#measureNaturalDimensions();
    this.#setNaturalCanvasSize();
    this.#renderTiles(this.zoom);
    this.#drawPois();
    this.#onMapLoad();
    this.#updateFontSizeRef();
    this.#renderPois();
    this.#updateCanvas();

    this.canvas.addEventListener("dblclick", this.#handleCanvasDoubleClick);
    this.canvas.addEventListener("mousedown", this.#dragStart);
    this.canvas.addEventListener("mouseup", this.#dragEnd);
    this.canvas.addEventListener("touchstart", this.#touchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.#dragging, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.#dragEnd, { passive: false });
    this.canvas.addEventListener("click", this.#getPercentageCoordinates);
    window.addEventListener("wheel", this.#handleMouseWheel);
    window.addEventListener("mouseout", this.#dragEnd);
    window.addEventListener("resize", this.#handleResize);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   */
  disconnectedCallback() {
    if (this.wheelRafId !== null) {
      cancelAnimationFrame(this.wheelRafId);
    }
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
    }
    clearTimeout(this.transitionTimeoutId);
    clearTimeout(this.tileSwapTimeoutId);
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
    }
    if (this.tileVisibilityRafId !== null) {
      cancelAnimationFrame(this.tileVisibilityRafId);
    }
    window.removeEventListener("resize", this.#handleResize);
    window.removeEventListener("mouseout", this.#dragEnd);
    window.removeEventListener("wheel", this.#handleMouseWheel);
    this.canvas.removeEventListener("click", this.#getPercentageCoordinates);
    this.canvas.removeEventListener("touchend", this.#dragEnd);
    this.canvas.removeEventListener("touchmove", this.#dragging);
    this.canvas.removeEventListener("touchstart", this.#touchStart);
    this.canvas.removeEventListener("mouseup", this.#dragEnd);
    this.canvas.removeEventListener("mousedown", this.#dragStart);
    this.canvas.removeEventListener("dblclick", this.#handleCanvasDoubleClick);
  }
}

customElements.define("map-canvas", MapCanvas);
