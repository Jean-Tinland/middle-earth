import "./map-button.js";
import "./map-compass.js";
import "./map-controls.js";
import "./map-information.js";
import "./map-nomenclature.js";
import "./map-scale.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";

/** Build version used for cache-busting tile URLs. Increment when tile assets change. */
const BUILD_VERSION = "2";
/** The number of discrete zoom steps available. */
const NUM_ZOOM_STEPS = 16;
/** The maximum scale multiplier at the final zoom step. */
const MAX_SCALE = 16;
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
const TILE_PRELOAD_MARGIN = 128;
/**
 * Source scale multiplier per tile zoom level.
 * Zoom levels 0-5 are linear (zoom+1), but 6 and 7 use larger source images.
 */
const ZOOM_SOURCE_SCALE = [1, 2, 3, 4, 5, 6, 8, 10];
/** Minimum font scale applied on narrow portrait viewports. */
const PORTRAIT_MIN_FONT_SCALE = 0.65;
/** Effective font scale cap so size stays constant once scale reaches 9+. */
const FONT_SCALE_LOCK_THRESHOLD = 8;
/**
 * Viewport height (px) representing the intended design target for POI zoom thresholds.
 * A 900 px-tall viewport produces canvasNaturalWidth ~ 1246 px, the reference below which
 * POI appearance is shifted forward to avoid overcrowded labels on smaller canvases.
 */
const POI_ZOOM_REFERENCE_HEIGHT = 900;
/** Duration of animated zoom transitions in milliseconds. */
const ZOOM_TRANSITION_MS = 320;
/** Small threshold used when comparing floating-point translate values. */
const TRANSLATE_EPSILON = 0.01;
/** Milliseconds of zoom inactivity before tile loading begins. */
const TILE_LOAD_DEBOUNCE_MS = 600;
/** Degrees of map rotation applied per horizontal pixel during shift-drag. */
const ROTATION_SPEED = 0.3;

/**
 * Maps a discrete zoom level to a scale multiplier.
 * Uses an exponential curve so each step increases scale more than the last.
 * @param {number} zoomLevel - Integer from 0 to NUM_ZOOM_STEPS.
 * @returns {number}
 */
const computeScaleForZoomLevel = (zoomLevel) => {
  if (zoomLevel <= 0) return 1;
  if (zoomLevel >= NUM_ZOOM_STEPS) return MAX_SCALE;
  return Math.pow(MAX_SCALE, zoomLevel / NUM_ZOOM_STEPS);
};

const DEFAULTS = Object.freeze({
  FONT_SIZE_REF: 12,
  SCALE: 1,
  ZOOM: 0,
  ZOOM_LEVEL: 0,
  TRANSLATE_X: 0,
  TRANSLATE_Y: 0,
  PREVIOUS_TOUCH: undefined,
  ROTATION: 0,
});

/**
 * Map canvas using real-size rendering to avoid sub-pixel tile gaps.
 *
 * Instead of applying CSS scale() to a fixed-size container (which causes
 * compositor rounding gaps between tiles on WebKit/Blink), the canvas is
 * resized to its actual zoomed pixel dimensions. Tiles are placed at integer
 * coordinates inside this real-size container. Panning uses translate() only.
 *
 * @extends HTMLElement
 */
export default class MapCanvas extends HTMLElement {
  constructor() {
    super();

    this.zoomLevel = DEFAULTS.ZOOM_LEVEL;
    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.rotation = DEFAULTS.ROTATION;
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
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.isDragging = false;
    this.canvasNaturalWidth = 0;
    this.canvasNaturalHeight = 0;
    this.tileLayers = new Map();
    this.activeTileZoom = DEFAULTS.ZOOM;
    this.previousTileZoom = null;
    this.backdropElement = null;
    this.backdropOriginalWidth = 0;
    this.tileVisibilityRafId = null;
    this.tileLoadTimeoutId = null;
    this.mapCompass = null;
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoomLevel = 0;
    this.pinchFocalPoint = null;
    this.pinchCurrentAngle = 0;

    this.root = this.attachShadow({ mode: "open" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  /**
   * Returns the current canvas pixel width (naturalWidth * scale).
   * @returns {number}
   * @private
   */
  #canvasWidth = () => Math.round(this.canvasNaturalWidth * this.scale);

  /**
   * Returns the current canvas pixel height (naturalHeight * scale).
   * @returns {number}
   * @private
   */
  #canvasHeight = () => Math.round(this.canvasNaturalHeight * this.scale);

  /**
   * Removes the zoom-in backdrop element from the DOM.
   * @private
   */
  #removeBackdrop = () => {
    if (!this.backdropElement) return;
    this.backdropElement.remove();
    this.backdropElement = null;
  };

  /**
   * Extracts the current active tile layer from the cache, scales it to fill
   * the new (just-applied) canvas size, and parks it as a visible backdrop.
   * The layer is removed from tileLayers so #resetTileLayers won't destroy it.
   * @param {number} oldW - Canvas pixel width before resize.
   * @param {number} oldH - Canvas pixel height before resize.
   * @private
   */
  #installBackdrop = (oldW, oldH) => {
    if (this.backdropElement) {
      // A backdrop from a previous rapid zoom already exists — just rescale it
      // to match the new canvas dimensions without replacing it.
      const newW = this.#canvasWidth();
      const scaleRatio = newW / this.backdropOriginalWidth;
      this.backdropElement.style.transform = `scale(${scaleRatio})`;
      return;
    }

    const activeLayer = this.tileLayers.get(this.activeTileZoom);
    if (!activeLayer) return;

    this.tileLayers.delete(this.activeTileZoom);

    const newW = this.#canvasWidth();
    const scaleRatio = newW / oldW;

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

    this.backdropOriginalWidth = oldW;
    this.backdropElement = activeLayer.element;
  };

  /**
   * Resets the canvas to its initial state.
   * @private
   */
  #reset = () => {
    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.#cancelPendingTileLoad();
    this.canvas.style.removeProperty("transition");
    this.#removeBackdrop();
    this.zoomLevel = DEFAULTS.ZOOM_LEVEL;
    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.rotation = DEFAULTS.ROTATION;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.previousTileZoom = null;
    this.#applyCanvasSize();
    this.#resetTileLayers();
    this.#updateFontSizeRef();
    this.#renderTiles(this.zoom);
    this.#renderPois();
    this.#updateControls();
    this.#updateCanvas();
    this.#updateUrlState();
    this.#dispatchZoomChange();
    this.#notifyRotationChange();
  };

  /**
   * Returns how many discrete zoom steps must be subtracted so that POIs
   * appear at the same visual canvas size as on the reference desktop.
   * On desktop-sized viewports the offset is zero, leaving behaviour unchanged.
   * @returns {number}
   * @private
   */
  #computePoiZoomOffset = () => {
    const referenceNaturalWidth = Math.floor(
      BASE_MAP_WIDTH * (POI_ZOOM_REFERENCE_HEIGHT / BASE_MAP_HEIGHT),
    );
    if (this.canvasNaturalWidth >= referenceNaturalWidth) return 0;
    return Math.floor(
      (NUM_ZOOM_STEPS *
        Math.log(referenceNaturalWidth / this.canvasNaturalWidth)) /
        Math.log(MAX_SCALE),
    );
  };

  /**
   * Renders POIs for the current zoom and font reference.
   * Uses a canvas-size-adjusted zoom level to gate visibility so POIs appear
   * at an equivalent canvas size across different viewport sizes. The raw
   * zoomLevel is forwarded separately for illustration-mode switching, which
   * must always reflect the true zoom step regardless of viewport size.
   * @private
   */
  #renderPois = () => {
    if (!this.mapPois) return;
    const effectivePoiZoomLevel = Math.max(
      0,
      this.zoomLevel - this.#computePoiZoomOffset(),
    );
    this.mapPois.render(
      effectivePoiZoomLevel,
      this.fontSizeRef,
      this.zoomLevel,
    );
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
      this.#scheduleTileVisibilityUpdate();
      this.transitionTimeoutId = null;
    }, ZOOM_TRANSITION_MS);
  };

  /**
   * Cancels any pending deferred tile load.
   * @private
   */
  #cancelPendingTileLoad = () => {
    if (this.tileLoadTimeoutId === null) return;
    clearTimeout(this.tileLoadTimeoutId);
    this.tileLoadTimeoutId = null;
  };

  /**
   * Schedules tile loading after a debounce delay, allowing rapid zoom
   * without triggering intermediate tile loads.
   * @param {number} zoom
   * @private
   */
  #scheduleTileLoad = (zoom) => {
    this.#cancelPendingTileLoad();
    this.tileLoadTimeoutId = setTimeout(() => {
      this.tileLoadTimeoutId = null;
      this.#renderTiles(zoom);
    }, TILE_LOAD_DEBOUNCE_MS);
  };

  /**
   * Applies the zoom change, adjusting translate to preserve the focal point.
   * The canvas is resized to actual pixel dimensions; translate is in screen
   * pixels so focal-point math works directly.
   * @param {number} oldScale
   * @param {{x: number, y: number}} focalPoint
   * @private
   */
  #adjustTranslateForZoom = (oldScale, focalPoint) => {
    const vpCenterX = window.innerWidth / 2;
    const vpCenterY = window.innerHeight / 2;
    const oldW = Math.round(this.canvasNaturalWidth * oldScale);
    const oldH = Math.round(this.canvasNaturalHeight * oldScale);
    const newW = this.#canvasWidth();
    const newH = this.#canvasHeight();

    // Focal point position within the old canvas (pixels from left/top edge):
    const mapX = focalPoint.x - (vpCenterX + this.translateX - oldW / 2);
    const mapY = focalPoint.y - (vpCenterY + this.translateY - oldH / 2);

    // Same proportional point in the new canvas:
    const newMapX = (mapX / oldW) * newW;
    const newMapY = (mapY / oldH) * newH;

    // Compensate for both the focal-point scaling and the flex centering
    // shift (the canvas origin moves by -(newW - oldW) / 2 when it grows).
    this.translateX += mapX - newMapX + (newW - oldW) / 2;
    this.translateY += mapY - newMapY + (newH - oldH) / 2;
  };

  /**
   * Applies a zoom level change and schedules tile loading after a debounce.
   * @param {number} targetLevel - Desired zoom level, clamped to valid range.
   * @param {{x: number, y: number}} focalPoint - Viewport point to zoom around.
   * @private
   */
  #applyZoomStep = (targetLevel, focalPoint) => {
    const oldScale = this.scale;
    const oldW = this.#canvasWidth();
    const oldH = this.#canvasHeight();

    this.zoomLevel = Math.max(0, Math.min(targetLevel, NUM_ZOOM_STEPS));
    this.scale = computeScaleForZoomLevel(this.zoomLevel);
    this.zoom = Math.min(this.zoomLevel, MAX_TILE_ZOOM);

    this.#applyCanvasSize();
    this.#installBackdrop(oldW, oldH);
    this.#resetTileLayers();
    this.#adjustTranslateForZoom(oldScale, focalPoint);
    this.#updateFontSizeRef();
    this.#renderPois();

    if (this.zoomLevel === 0) {
      this.translateX = DEFAULTS.TRANSLATE_X;
      this.translateY = DEFAULTS.TRANSLATE_Y;
      this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    } else {
      this.#checkAndFixBoundaries();
    }

    this.#updateCanvas();
    this.#updateControls();
    this.#updateUrlState();
    this.#dispatchZoomChange();
    this.#scheduleTileLoad(this.zoom);
  };

  /**
   * Dispatches a zoom-change event with the current canvas measurement data.
   * @private
   */
  #dispatchZoomChange = () => {
    this.dispatchEvent(
      new CustomEvent("zoom-change", {
        bubbles: false,
        detail: {
          canvasNaturalWidth: this.canvasNaturalWidth,
          scale: this.scale,
        },
      }),
    );
  };

  /**
   * Zooms in the canvas.
   */
  zoomIn = (e) => {
    if (this.zoomLevel >= NUM_ZOOM_STEPS) return;
    e.preventDefault();

    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.canvas.style.removeProperty("transition");

    this.#applyZoomStep(this.zoomLevel + 1, this.#getZoomFocalPoint(e));
  };

  /**
   * Zooms out the canvas.
   */
  zoomOut = (e) => {
    if (this.zoomLevel <= 0) return;
    e.preventDefault();

    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.canvas.style.removeProperty("transition");

    this.#applyZoomStep(this.zoomLevel - 1, this.#getZoomFocalPoint(e));
  };

  /**
   * Updates the zoom controls.
   * @private
   */
  #updateControls = () => {
    if (!this.controls?.zoomInButton || !this.controls?.zoomOutButton) return;

    this.controls.zoomOutButton.disabled = this.zoomLevel === 0;
    this.controls.zoomInButton.disabled = this.zoomLevel === NUM_ZOOM_STEPS;
  };

  /**
   * Updates the canvas position and rotation via transform.
   * @private
   */
  #updateCanvas = () => {
    this.canvas.style.setProperty(
      "transform",
      `translate(${this.translateX}px, ${this.translateY}px) rotate(${this.rotation}deg)`,
    );
    this.#scheduleTileVisibilityUpdate();
  };

  /**
   * Rotates the map by the given degrees, keeping the viewport center fixed.
   * Adjusts translateX/Y so the point at the viewport center stays stationary.
   * @param {number} degrees - Rotation delta in degrees (positive = clockwise).
   * @private
   */
  #rotateAroundViewportCenter = (degrees) => {
    const rad = (degrees * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const prevTx = this.translateX;
    const prevTy = this.translateY;
    this.translateX = prevTx * cos - prevTy * sin;
    this.translateY = prevTx * sin + prevTy * cos;
    this.rotation += degrees;
  };

  /**
   * Applies rotation from both horizontal and vertical drag movement (shift-drag).
   * Rightward or upward movement rotates clockwise; leftward or downward is counter-clockwise.
   * @param {number} movementX - Horizontal pixel movement.
   * @param {number} movementY - Vertical pixel movement.
   * @private
   */
  #applyRotationDelta = (movementX, movementY) => {
    this.#rotateAroundViewportCenter((movementX - movementY) * ROTATION_SPEED);
    this.#updateCanvas();
    this.#notifyRotationChange();
  };

  /**
   * Notifies the compass and POIs of the current rotation angle.
   * @private
   */
  #notifyRotationChange = () => {
    this.mapCompass?.setRotation(this.rotation);
    this.mapPois?.setRotation(this.rotation);
  };

  /**
   * Resets the map back to north with a smooth animation.
   * Preserves the current zoom level and visible map center.
   */
  resetRotation = () => {
    let normalized = ((this.rotation % 360) + 360) % 360;
    if (normalized > 180) normalized -= 360;
    if (Math.abs(normalized) < 0.01) return;

    // Apply the normalized-equivalent rotation without animation.
    // Visually identical since rotate(x) === rotate(x ± 360).
    this.rotation = normalized;
    this.canvas.style.setProperty("transition", "none");
    this.canvas.getBoundingClientRect();
    this.#updateCanvas();

    // Animate the short arc back to north.
    this.#prepareAnimatedZoom();
    this.#rotateAroundViewportCenter(-normalized);
    this.rotation = 0;
    this.#updateCanvas();
    this.#scheduleTransitionCleanup();
    this.#updateUrlState();
    this.#notifyRotationChange();
  };

  /**
   * Returns a scale factor that reduces font sizes on portrait viewports.
   * @returns {number}
   * @private
   */
  #computePortraitFontScalar = () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    return Math.max(PORTRAIT_MIN_FONT_SCALE, Math.min(1, aspectRatio));
  };

  /**
   * Updates the font size reference.
   * Font sizes grow with scale since there is no CSS scale() enlarging them.
   * @private
   */
  #updateFontSizeRef = () => {
    const divider = this.zoom === 0 ? 1.5 : 2;
    const effectiveScale = Math.min(this.scale, FONT_SCALE_LOCK_THRESHOLD);
    const portraitFontScalar = this.#computePortraitFontScalar();
    this.fontSizeRef =
      (DEFAULTS.FONT_SIZE_REF / (effectiveScale / divider)) *
      this.scale *
      portraitFontScalar;
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontSizeRef.toFixed(2)}px`,
    );
  };

  /**
   * Stores the canvas's natural (un-zoomed) dimensions.
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
   * Applies the current zoomed canvas size in pixels.
   * Canvas and map are set to naturalSize * scale so tiles render at 1:1.
   * @private
   */
  #applyCanvasSize = () => {
    const w = this.#canvasWidth();
    const h = this.#canvasHeight();
    this.canvas.style.setProperty("max-width", "none");
    this.canvas.style.setProperty("max-height", "none");
    this.canvas.style.setProperty("width", `${w}px`);
    this.canvas.style.setProperty("height", `${h}px`);
    this.map.style.setProperty("width", `${w}px`);
    this.map.style.setProperty("height", `${h}px`);
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
      this.#cancelPendingTileLoad();
      const previousWidth = this.canvasNaturalWidth;
      const previousHeight = this.canvasNaturalHeight;
      this.#measureNaturalDimensions();
      const didNaturalSizeChange =
        previousWidth !== this.canvasNaturalWidth ||
        previousHeight !== this.canvasNaturalHeight;

      if (didNaturalSizeChange) {
        this.#removeBackdrop();
        this.#resetTileLayers();
      }

      this.#applyCanvasSize();
      this.#renderTiles(this.zoom);
      if (this.zoomLevel === 0) {
        return this.#reset();
      }
      this.#checkAndFixBoundaries();
      this.#updateCanvas();
      this.#dispatchZoomChange();
    });
  };

  /**
   * Handles the start of a touch event.
   * @param {TouchEvent} e
   * @private
   */
  #touchStart = (e) => {
    e.preventDefault();
    clearTimeout(this.transitionTimeoutId);
    this.canvas.style.setProperty("transition", "none");

    if (e.touches.length === 2) {
      this.isDragging = false;
      this.previousTouch = undefined;
      this.#initPinch(e);
      return;
    }

    if (e.touches.length !== 1) return;

    this.isPinching = false;
    this.isDragging = true;
    const touch = e.touches[0];
    this.previousTouch = {
      clientX: touch.clientX,
      clientY: touch.clientY,
    };
  };

  /**
   * Applies the queued drag movement immediately.
   * @private
   */
  #applyPendingDrag = () => {
    if (this.pendingMovementX === 0 && this.pendingMovementY === 0) return;

    this.translateX += this.pendingMovementX;
    this.translateY += this.pendingMovementY;
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.#updateCanvas();
  };

  /**
   * Handles the start of a drag event.
   * @param {PointerEvent} e
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
   * @param {PointerEvent} e
   * @private
   */
  #dragEnd = (e) => {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.isPinching = false;
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

    if (this.zoomLevel === 0) {
      const didSnapToDefault =
        Math.abs(this.translateX - DEFAULTS.TRANSLATE_X) > TRANSLATE_EPSILON ||
        Math.abs(this.translateY - DEFAULTS.TRANSLATE_Y) > TRANSLATE_EPSILON;

      this.translateX = DEFAULTS.TRANSLATE_X;
      this.translateY = DEFAULTS.TRANSLATE_Y;
      this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
      this.#updateControls();

      if (didSnapToDefault) {
        this.#prepareAnimatedZoom();
        this.#updateCanvas();
        this.#scheduleTransitionCleanup();
        this.#updateUrlState();
        return;
      }

      this.#updateCanvas();
      this.#updateUrlState();
      return;
    }

    const previousTranslateX = this.translateX;
    const previousTranslateY = this.translateY;
    this.#checkAndFixBoundaries();
    const didSnapToBoundary =
      Math.abs(this.translateX - previousTranslateX) > TRANSLATE_EPSILON ||
      Math.abs(this.translateY - previousTranslateY) > TRANSLATE_EPSILON;

    if (didSnapToBoundary) {
      this.#prepareAnimatedZoom();
      this.#updateCanvas();
      this.#scheduleTransitionCleanup();
    } else {
      this.#updateCanvas();
    }
    this.#updateUrlState();
  };

  /**
   * Ensures the canvas covers the entire viewport.
   * Translate is in screen pixels; canvas size is already zoomed.
   * @private
   */
  #checkAndFixBoundaries = () => {
    const w = this.#canvasWidth();
    const h = this.#canvasHeight();
    const vpW = window.innerWidth;
    const vpH = window.innerHeight;

    // Canvas top-left in screen space:
    const left = (vpW - w) / 2 + this.translateX;
    const top = (vpH - h) / 2 + this.translateY;
    const right = left + w;
    const bottom = top + h;

    if (left > 0) this.translateX -= left;
    if (top > 0) this.translateY -= top;
    if (right < vpW) this.translateX += vpW - right;
    if (bottom < vpH) this.translateY += vpH - bottom;
  };

  /**
   * Handles the dragging event.
   * @param {PointerEvent} e
   * @private
   */
  #dragging = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "touchmove") {
      this.canvas.style.setProperty("transition", "none");

      if (this.isPinching || e.touches.length === 2) {
        if (!this.isPinching) this.#initPinch(e);
        this.#handlePinchMove(e);
        return;
      }

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

    if (e.shiftKey && !this.isPinching) {
      this.#applyRotationDelta(e.movementX, e.movementY);
      return;
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
   * Returns the angle in degrees of the vector from t1 to t2.
   * @param {Touch} t1
   * @param {Touch} t2
   * @returns {number}
   * @private
   */
  #touchAngle = (t1, t2) =>
    Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) *
    (180 / Math.PI);

  /**
   * Initializes pinch-to-zoom and two-finger rotation state.
   * @param {TouchEvent} e
   * @private
   */
  #initPinch = (e) => {
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    this.isPinching = true;
    this.isDragging = true;
    this.pinchStartDistance = Math.hypot(
      t2.clientX - t1.clientX,
      t2.clientY - t1.clientY,
    );
    this.pinchStartZoomLevel = this.zoomLevel;
    this.pinchFocalPoint = {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
    this.pinchCurrentAngle = this.#touchAngle(t1, t2);
  };

  /**
   * Computes the target zoom level from current pinch distance and applies
   * a discrete zoom step when the level changes. Also applies continuous
   * rotation from the two-finger twist gesture.
   * @param {TouchEvent} e
   * @private
   */
  #handlePinchMove = (e) => {
    if (e.touches.length !== 2 || this.pinchStartDistance === 0) return;

    const t1 = e.touches[0];
    const t2 = e.touches[1];

    const currentDistance = Math.hypot(
      t2.clientX - t1.clientX,
      t2.clientY - t1.clientY,
    );
    const ratio = currentDistance / this.pinchStartDistance;
    const zoomDelta = Math.round(
      (Math.log(ratio) * NUM_ZOOM_STEPS) / Math.log(MAX_SCALE),
    );
    const targetLevel = Math.max(
      0,
      Math.min(NUM_ZOOM_STEPS, this.pinchStartZoomLevel + zoomDelta),
    );
    if (targetLevel !== this.zoomLevel) {
      this.#applyZoomStep(targetLevel, this.pinchFocalPoint);
    }

    const newAngle = this.#touchAngle(t1, t2);
    let angleDelta = newAngle - this.pinchCurrentAngle;
    // Normalise to (-180, 180] to avoid wrap-around jumps.
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;
    this.pinchCurrentAngle = newAngle;
    if (Math.abs(angleDelta) > 0.1) {
      this.#rotateAroundViewportCenter(angleDelta);
      this.#updateCanvas();
      this.#notifyRotationChange();
    }
  };

  /**
   * Builds a tile layer for one zoom level.
   * Tiles fill the real-size canvas (naturalWidth * scale) at integer pixels.
   * @param {number} zoom
   * @returns {{ element: HTMLDivElement, tiles: Array }}
   * @private
   */
  #buildTileLayer = (zoom) => {
    const sourceScale = ZOOM_SOURCE_SCALE[zoom] ?? zoom + 1;
    const canvasW = this.#canvasWidth();
    const canvasH = this.#canvasHeight();
    const sourceWidth = BASE_MAP_WIDTH * sourceScale;
    const sourceHeight = BASE_MAP_HEIGHT * sourceScale;
    const cols = Math.ceil(sourceWidth / TILE_SIZE);
    const rows = Math.ceil(sourceHeight / TILE_SIZE);

    const layer = document.createElement("div");
    layer.style.cssText =
      "position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:0;";
    layer.hidden = true;

    const tiles = [];

    // Compute shared integer edges for rows and columns to avoid gaps.
    const colEdges = new Array(cols + 1);
    for (let c = 0; c <= cols; c++) {
      const srcX = Math.min(c * TILE_SIZE, sourceWidth);
      colEdges[c] = Math.round((srcX / sourceWidth) * canvasW);
    }
    const rowEdges = new Array(rows + 1);
    for (let r = 0; r <= rows; r++) {
      const srcY = Math.min(r * TILE_SIZE, sourceHeight);
      rowEdges[r] = Math.round((srcY / sourceHeight) * canvasH);
    }

    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        const left = colEdges[col];
        const top = rowEdges[row];
        const width = colEdges[col + 1] - left;
        const height = rowEdges[row + 1] - top;

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
        const src = `./assets/images/map/tiles/${zoom}/${row}-${col}.jpg?v=${BUILD_VERSION}`;
        image.alt = "";
        image.loading = "lazy";
        image.decoding = "async";
        image.style.cssText =
          "display:block;width:100%;height:100%;pointer-events:none;";

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
        image.addEventListener("error", markTileReady);

        slot.appendChild(image);
        layer.appendChild(slot);
        tiles.push(tile);
      }
    }

    return { element: layer, tiles };
  };

  /**
   * Clears all cached tile layers so they can be rebuilt for a new size.
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
   * @returns {{ element: HTMLDivElement, tiles: Array }}
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

    // Only keep a previous layer for handoff if it already exists in cache.
    const hasPreviousLayer =
      previousZoom !== boundedZoom && this.tileLayers.has(previousZoom);
    this.previousTileZoom = hasPreviousLayer ? previousZoom : null;

    const visibleZooms = new Set([this.activeTileZoom]);
    if (this.previousTileZoom !== null) {
      visibleZooms.add(this.previousTileZoom);
      const previousLayer = this.tileLayers.get(this.previousTileZoom);
      previousLayer.element.hidden = false;
    }

    for (const [layerZoom, layer] of this.tileLayers.entries()) {
      layer.element.hidden = !visibleZooms.has(layerZoom);
      layer.element.style.setProperty("z-index", "-2");
    }

    activeLayer.element.hidden = false;

    const activeZIndex = this.backdropElement ? "1" : "0";

    if (this.previousTileZoom !== null) {
      const previousLayer = this.tileLayers.get(this.previousTileZoom);
      previousLayer.element.style.setProperty("z-index", "-1");
      activeLayer.element.style.setProperty("z-index", activeZIndex);
    } else {
      activeLayer.element.style.setProperty("z-index", activeZIndex);
    }

    this.#scheduleTileVisibilityUpdate();
  };

  /**
   * Updates one layer's viewport visibility and starts nearby tile loading.
   * @param {{ tiles: Array }} layer
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
   * @private
   */
  #updateTileVisibility = () => {
    const activeLayer = this.tileLayers.get(this.activeTileZoom);
    if (!activeLayer) return;

    const allVisibleTilesReady = this.#updateLayerVisibility(activeLayer, true);

    if (this.backdropElement && allVisibleTilesReady) {
      this.#removeBackdrop();
      activeLayer.element.style.setProperty("z-index", "0");
    }

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
   * @param {MouseEvent} e
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
   * @param {WheelEvent} e
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
   * Gets the percentage coordinates of the clicked point (debug mode).
   * @param {MouseEvent} e
   * @private
   */
  #getPercentageCoordinates = async (e) => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.has("debug");
    if (!debugEnabled) return;
    const { left, top, width, height } = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    await navigator.clipboard.writeText(`[${x.toFixed(2)}, ${y.toFixed(2)}]`);
  };

  /**
   * Computes the viewport center as fractional coordinates (0–1) within the canvas.
   * These are viewport-size-independent: 0.5 / 0.5 always means the map centre.
   * @returns {{x: number, y: number} | null}
   * @private
   */
  #computeMapCenterFractions = () => {
    const w = this.#canvasWidth();
    const h = this.#canvasHeight();
    if (w === 0 || h === 0) return null;
    return {
      x: 0.5 - this.translateX / w,
      y: 0.5 - this.translateY / h,
    };
  };

  /**
   * Writes the current zoom level, map center and rotation to the URL as query params.
   * Clears the params when back at the default zoom level.
   * @private
   */
  #updateUrlState = () => {
    const params = new URLSearchParams(window.location.search);
    if (this.zoomLevel === 0) {
      params.delete("z");
      params.delete("x");
      params.delete("y");
      params.delete("r");
    } else {
      const center = this.#computeMapCenterFractions();
      if (!center) return;
      params.set("z", String(this.zoomLevel));
      params.set("x", center.x.toFixed(4));
      params.set("y", center.y.toFixed(4));
      if (Math.abs(this.rotation) > 0.01) {
        params.set("r", this.rotation.toFixed(1));
      } else {
        params.delete("r");
      }
    }

    const search = params.toString();
    const url = search
      ? `${window.location.pathname}?${search}`
      : window.location.pathname;
    history.replaceState(null, "", url);
  };

  /**
   * Reads zoom, center coordinates and rotation from URL params and applies
   * them as the initial map state. Must be called after natural dimensions
   * are measured.
   * @private
   */
  #restoreStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const z = parseInt(params.get("z"), 10);
    const x = parseFloat(params.get("x"));
    const y = parseFloat(params.get("y"));

    if (!Number.isFinite(z) || z < 1 || z > NUM_ZOOM_STEPS) return;
    if (!Number.isFinite(x) || x < 0 || x > 1) return;
    if (!Number.isFinite(y) || y < 0 || y > 1) return;

    this.zoomLevel = z;
    this.scale = computeScaleForZoomLevel(z);
    this.zoom = Math.min(z, MAX_TILE_ZOOM);

    const w = this.#canvasWidth();
    const h = this.#canvasHeight();
    this.translateX = (0.5 - x) * w;
    this.translateY = (0.5 - y) * h;
    this.#checkAndFixBoundaries();

    const r = parseFloat(params.get("r"));
    if (Number.isFinite(r)) {
      this.rotation = r;
    }
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
    this.mapCompass = this.root.querySelector("map-compass");
    await this.#waitForPageLoad();
    await this.#loadPois();
    this.#measureNaturalDimensions();
    this.#restoreStateFromUrl();
    this.#applyCanvasSize();
    this.#renderTiles(this.zoom);
    this.#drawPois();
    this.#onMapLoad();
    this.#updateFontSizeRef();
    this.#renderPois();
    this.#notifyRotationChange();
    this.#updateCanvas();
    this.#updateControls();
    this.#dispatchZoomChange();

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
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
    }
    if (this.tileVisibilityRafId !== null) {
      cancelAnimationFrame(this.tileVisibilityRafId);
    }
    this.#cancelPendingTileLoad();
    this.#removeBackdrop();
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
