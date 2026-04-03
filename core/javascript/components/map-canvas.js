import "./map-button.js";
import "./map-compass.js";
import "./map-controls.js";
import "./map-information.js";
import "./map-nomenclature.js";
import "./map-scale.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";
import TileManager, { MAX_TILE_ZOOM } from "../lib/tile-manager.js";

/** The number of discrete zoom steps available. */
const NUM_ZOOM_STEPS = 25;
/** The maximum scale multiplier at the final zoom step. */
const MAX_SCALE = 20;
/** Extra zoom steps granted on touch-primary (mobile) devices. */
const MOBILE_EXTRA_ZOOM_STEPS = 8;
/** Maximum scale multiplier on touch-primary (mobile) devices. */
const MOBILE_MAX_SCALE = 40;
/** The accumulated deltaY required to trigger one zoom step. */
const WHEEL_THRESHOLD = 100;
/** Base map width used for layout coordinates. */
const BASE_MAP_WIDTH = 1800;
/** Base map height used for layout coordinates. */
const BASE_MAP_HEIGHT = 1300;
/** Minimum font scale applied on narrow portrait viewports. */
const PORTRAIT_MIN_FONT_SCALE = 0.65;
/** Effective font scale cap so size stays constant once scale reaches 9+. */
const FONT_SCALE_LOCK_THRESHOLD = 8;
const POI_ZOOM_REFERENCE_HEIGHT = 900;
/** Duration of animated zoom transitions in milliseconds. */
const ZOOM_TRANSITION_MS = 120;
/** Small threshold used when comparing floating-point translate values. */
const TRANSLATE_EPSILON = 0.01;
/** Milliseconds of zoom inactivity before tile loading begins when zooming in. */
const TILE_LOAD_DEBOUNCE_MS = 600;
/** Milliseconds of zoom inactivity before tile loading begins when zooming out. */
const TILE_LOAD_DEBOUNCE_ZOOM_OUT_MS = 150;
/** Degrees of map rotation applied per horizontal pixel during shift-drag. */
const ROTATION_SPEED = 0.3;
const PINCH_ROTATE_ENGAGE_DEG = 7;

/**
 * Maps a discrete zoom level to a tile zoom index (0–MAX_TILE_ZOOM).
 * Spreads the 8 available tile layers evenly across all zoom steps.
 * @param {number} zoomLevel - Integer from 0 to numZoomSteps.
 * @param {number} numZoomSteps - Total discrete zoom steps for this device.
 * @returns {number}
 */
const computeTileZoom = (zoomLevel, numZoomSteps) =>
  Math.min(
    MAX_TILE_ZOOM,
    Math.round((zoomLevel * MAX_TILE_ZOOM) / numZoomSteps),
  );

/**
 * Maps a discrete zoom level to a scale multiplier.
 * Uses an exponential curve so each step increases scale more than the last.
 * @param {number} zoomLevel - Integer from 0 to numZoomSteps.
 * @param {number} [numZoomSteps] - Total discrete zoom steps for this device.
 * @param {number} [maxScale] - Maximum scale multiplier for this device.
 * @returns {number}
 */
const computeScaleForZoomLevel = (
  zoomLevel,
  numZoomSteps = NUM_ZOOM_STEPS,
  maxScale = MAX_SCALE,
) => {
  if (zoomLevel <= 0) return 1;
  if (zoomLevel >= numZoomSteps) return maxScale;
  return Math.pow(maxScale, zoomLevel / numZoomSteps);
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
    this.wheelDeltaAccumulator = 0;
    this.dragRafId = null;
    this.resizeRafId = null;
    this.transitionTimeoutId = null;
    this.urlStateTimeoutId = null;
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.isDragging = false;
    this.canvasNaturalWidth = 0;
    this.canvasNaturalHeight = 0;
    this.tileManager = null;
    this.maxPoiZoom = 0;
    this.numZoomSteps = NUM_ZOOM_STEPS;
    this.maxZoomScale = MAX_SCALE;
    this.mapCompass = null;
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartZoomLevel = 0;
    this.pinchFocalPoint = null;
    this.pinchCurrentAngle = 0;
    this.pinchRotationEngaged = false;
    this.pinchCumulativeAngleDelta = 0;

    this.root = this.attachShadow({ mode: "open" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  #canvasWidth = () => Math.round(this.canvasNaturalWidth * this.scale);

  #canvasHeight = () => Math.round(this.canvasNaturalHeight * this.scale);

  #syncTileManagerSize = () => {
    if (!this.tileManager) return;
    this.tileManager.canvasWidth = this.#canvasWidth();
    this.tileManager.canvasHeight = this.#canvasHeight();
  };

  #reset = () => {
    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.tileManager.cancelPendingLoad();
    this.canvas.style.removeProperty("transition");
    this.tileManager.removeBackdrop();
    this.zoomLevel = DEFAULTS.ZOOM_LEVEL;
    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.rotation = DEFAULTS.ROTATION;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.#applyCanvasSize();
    this.#syncTileManagerSize();
    this.tileManager.resetLayers();
    this.#updateFontSizeRef();
    this.tileManager.renderTiles(this.zoom);
    this.#renderPois();
    this.#updateControls();
    this.#updateCanvas();
    this.#updateUrlState();
    this.#dispatchZoomChange();
    this.#notifyRotationChange();
  };

  #computePoiZoomOffset = () => {
    const referenceNaturalWidth = Math.floor(
      BASE_MAP_WIDTH * (POI_ZOOM_REFERENCE_HEIGHT / BASE_MAP_HEIGHT),
    );
    if (this.canvasNaturalWidth >= referenceNaturalWidth) return 0;
    const rawOffset = Math.floor(
      (this.numZoomSteps *
        Math.log(referenceNaturalWidth / this.canvasNaturalWidth)) /
        Math.log(this.maxZoomScale),
    );
    const maxAllowedOffset = Math.max(
      0,
      this.numZoomSteps - 1 - this.maxPoiZoom,
    );
    return Math.min(rawOffset, maxAllowedOffset);
  };

  #computePoiFontSizeRef = () => {
    if (this.scale <= MAX_SCALE) return this.fontSizeRef;
    return this.fontSizeRef * (MAX_SCALE / this.scale);
  };

  #renderPois = () => {
    if (!this.mapPois) return;
    const effectivePoiZoomLevel = Math.max(
      0,
      this.zoomLevel - this.#computePoiZoomOffset(),
    );
    this.mapPois.render(
      effectivePoiZoomLevel,
      this.#computePoiFontSizeRef(),
      this.zoomLevel,
    );
  };

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

  #prepareAnimatedZoom = () => {
    clearTimeout(this.transitionTimeoutId);
    this.canvas.style.setProperty("transition", "none");
    this.canvas.getBoundingClientRect();
    this.canvas.style.setProperty(
      "transition",
      `transform ${ZOOM_TRANSITION_MS}ms var(--transition-easing)`,
    );
  };

  #scheduleTransitionCleanup = () => {
    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = setTimeout(() => {
      this.canvas.style.removeProperty("transition");
      this.tileManager.checkLayerHandoff();
      this.transitionTimeoutId = null;
    }, ZOOM_TRANSITION_MS);
  };

  #animateZoomTransition = (oldScale, oldTranslateX, oldTranslateY) => {
    const fromScaleFactor = oldScale / this.scale;

    this.canvas.style.setProperty(
      "transform",
      `translate(${oldTranslateX}px, ${oldTranslateY}px) rotate(${this.rotation}deg) scale(${fromScaleFactor})`,
    );

    this.canvas.getBoundingClientRect();

    this.canvas.style.setProperty(
      "transition",
      `transform ${ZOOM_TRANSITION_MS}ms var(--transition-easing)`,
    );
    this.#updateCanvas();
    this.#scheduleTransitionCleanup();
  };

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

  #applyZoomStep = (targetLevel, focalPoint, animate = false) => {
    const oldScale = this.scale;
    const oldTranslateX = this.translateX;
    const oldTranslateY = this.translateY;
    const oldW = this.#canvasWidth();
    const oldH = this.#canvasHeight();
    const previousZoomLevel = this.zoomLevel;

    this.zoomLevel = Math.max(0, Math.min(targetLevel, this.numZoomSteps));
    this.scale = computeScaleForZoomLevel(
      this.zoomLevel,
      this.numZoomSteps,
      this.maxZoomScale,
    );
    this.zoom = computeTileZoom(this.zoomLevel, this.numZoomSteps);

    this.#applyCanvasSize();
    this.#syncTileManagerSize();
    this.tileManager.installBackdrop(oldW, oldH, this.#canvasWidth());
    this.tileManager.resetLayers();
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

    if (animate) {
      this.#animateZoomTransition(oldScale, oldTranslateX, oldTranslateY);
    } else {
      this.#updateCanvas();
    }
    this.#updateControls();
    this.#updateUrlState();
    this.#dispatchZoomChange();
    this.tileManager.scheduleTileLoad(
      this.zoom,
      targetLevel < previousZoomLevel
        ? TILE_LOAD_DEBOUNCE_ZOOM_OUT_MS
        : TILE_LOAD_DEBOUNCE_MS,
    );
  };

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

  zoomIn = (e) => {
    if (this.zoomLevel >= this.numZoomSteps) return;
    e.preventDefault();

    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.canvas.style.removeProperty("transition");

    this.#applyZoomStep(this.zoomLevel + 1, this.#getZoomFocalPoint(e), true);
  };

  zoomOut = (e) => {
    if (this.zoomLevel <= 0) return;
    e.preventDefault();

    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.canvas.style.removeProperty("transition");

    this.#applyZoomStep(this.zoomLevel - 1, this.#getZoomFocalPoint(e), true);
  };

  #updateControls = () => {
    if (!this.controls?.zoomInButton || !this.controls?.zoomOutButton) return;

    this.controls.zoomOutButton.disabled = this.zoomLevel === 0;
    this.controls.zoomInButton.disabled = this.zoomLevel === this.numZoomSteps;
  };

  #updateCanvas = () => {
    this.canvas.style.setProperty(
      "transform",
      `translate(${this.translateX}px, ${this.translateY}px) rotate(${this.rotation}deg)`,
    );
  };

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

  #applyRotationDelta = (movementX, movementY) => {
    this.#rotateAroundViewportCenter((movementY - movementX) * ROTATION_SPEED);
    this.#updateCanvas();
    this.#notifyRotationChange();
  };

  #notifyRotationChange = () => {
    this.mapCompass?.setRotation(this.rotation);
    this.mapPois?.setRotation(this.rotation);
  };

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

  #computePortraitFontScalar = () => {
    const aspectRatio = window.innerWidth / window.innerHeight;
    return Math.max(PORTRAIT_MIN_FONT_SCALE, Math.min(1, aspectRatio));
  };

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

  #handleResize = () => {
    if (this.resizeRafId !== null) return;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      this.tileManager.cancelPendingLoad();
      const previousWidth = this.canvasNaturalWidth;
      const previousHeight = this.canvasNaturalHeight;
      this.#measureNaturalDimensions();
      const didNaturalSizeChange =
        previousWidth !== this.canvasNaturalWidth ||
        previousHeight !== this.canvasNaturalHeight;

      if (didNaturalSizeChange) {
        this.tileManager.removeBackdrop();
        this.tileManager.resetLayers();
      }

      this.#applyCanvasSize();
      this.#syncTileManagerSize();
      this.tileManager.renderTiles(this.zoom);
      if (this.zoomLevel === 0) {
        return this.#reset();
      }
      this.#checkAndFixBoundaries();
      this.#updateCanvas();
      this.#dispatchZoomChange();
    });
  };

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
    if (this.previousTouch) {
      this.previousTouch.clientX = touch.clientX;
      this.previousTouch.clientY = touch.clientY;
    } else {
      this.previousTouch = { clientX: touch.clientX, clientY: touch.clientY };
    }
  };

  #applyPendingDrag = () => {
    if (this.pendingMovementX === 0 && this.pendingMovementY === 0) return;

    this.translateX += this.pendingMovementX;
    this.translateY += this.pendingMovementY;
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.#updateCanvas();
  };

  #dragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging = true;
    clearTimeout(this.transitionTimeoutId);
    this.canvas.addEventListener("pointermove", this.#dragging);
    this.canvas.style.setProperty("cursor", "grabbing");
    this.canvas.style.setProperty("transition", "none");
  };

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

      if (this.previousTouch) {
        this.previousTouch.clientX = touch.clientX;
        this.previousTouch.clientY = touch.clientY;
      } else {
        this.previousTouch = { clientX: touch.clientX, clientY: touch.clientY };
      }
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

  #touchAngle = (t1, t2) =>
    Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX) *
    (180 / Math.PI);

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
    this.pinchRotationEngaged = false;
    this.pinchCumulativeAngleDelta = 0;
  };

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
      (Math.log(ratio) * this.numZoomSteps) / Math.log(this.maxZoomScale),
    );
    const targetLevel = Math.max(
      0,
      Math.min(this.numZoomSteps, this.pinchStartZoomLevel + zoomDelta),
    );
    const didZoom = targetLevel !== this.zoomLevel;
    if (didZoom) {
      this.#applyZoomStep(targetLevel, this.pinchFocalPoint);
    }

    const newAngle = this.#touchAngle(t1, t2);
    let angleDelta = newAngle - this.pinchCurrentAngle;
    // Normalise to (-180, 180) to avoid wrap-around jumps.
    if (angleDelta > 180) angleDelta -= 360;
    if (angleDelta < -180) angleDelta += 360;
    this.pinchCurrentAngle = newAngle;

    if (!this.pinchRotationEngaged) {
      // Reset accumulator whenever scale is actively changing so that
      // incidental twist during a zoom gesture never triggers rotation.
      if (didZoom) {
        this.pinchCumulativeAngleDelta = 0;
      } else {
        this.pinchCumulativeAngleDelta += angleDelta;
        if (
          Math.abs(this.pinchCumulativeAngleDelta) >= PINCH_ROTATE_ENGAGE_DEG
        ) {
          this.pinchRotationEngaged = true;
          this.#rotateAroundViewportCenter(this.pinchCumulativeAngleDelta);
          this.#updateCanvas();
          this.#notifyRotationChange();
        }
      }
    } else if (Math.abs(angleDelta) > 0.1) {
      this.#rotateAroundViewportCenter(angleDelta);
      this.#updateCanvas();
      this.#notifyRotationChange();
    }
  };

  #loadPois = async () => {
    const pois = await fetch("/assets/data/pois.json");
    const data = await pois.json();
    this.pois = data.pois;
    this.maxPoiZoom = this.pois.reduce(
      (max, p) => (p.zoom > max ? p.zoom : max),
      0,
    );
  };

  #drawPois = () => {
    this.mapPois = new MapPois(this.pois);
    this.map.appendChild(this.mapPois);
  };

  #onMapLoad = () => {
    this.setAttribute("ready", "");
  };

  #handleCanvasDoubleClick = (e) => {
    if (e.shiftKey) {
      this.zoomOut(e);
    } else {
      this.zoomIn(e);
    }
  };

  #handleMouseWheel = (e) => {
    this.wheelDeltaAccumulator += e.deltaY;

    if (Math.abs(this.wheelDeltaAccumulator) < WHEEL_THRESHOLD) return;

    const steps = Math.trunc(this.wheelDeltaAccumulator / WHEEL_THRESHOLD);
    this.wheelDeltaAccumulator -= steps * WHEEL_THRESHOLD;

    clearTimeout(this.transitionTimeoutId);
    this.transitionTimeoutId = null;
    this.canvas.style.removeProperty("transition");

    if (steps > 0) {
      this.zoomOut(e);
    } else {
      this.zoomIn(e);
    }
  };

  #getPercentageCoordinates = async (e) => {
    const params = new URLSearchParams(window.location.search);
    const debugEnabled = params.has("debug");
    if (!debugEnabled) return;
    const { left, top, width, height } = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    await navigator.clipboard.writeText(`[${x.toFixed(2)}, ${y.toFixed(2)}]`);
  };

  #computeMapCenterFractions = () => {
    const w = this.#canvasWidth();
    const h = this.#canvasHeight();
    if (w === 0 || h === 0) return null;
    return {
      x: 0.5 - this.translateX / w,
      y: 0.5 - this.translateY / h,
    };
  };

  #updateUrlState = () => {
    clearTimeout(this.urlStateTimeoutId);
    this.urlStateTimeoutId = setTimeout(this.#commitUrlState, 400);
  };

  #commitUrlState = () => {
    this.urlStateTimeoutId = null;
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

  #restoreStateFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    const z = parseInt(params.get("z"), 10);
    const x = parseFloat(params.get("x"));
    const y = parseFloat(params.get("y"));

    if (!Number.isFinite(z) || z < 1 || z > this.numZoomSteps) return;
    if (!Number.isFinite(x) || x < 0 || x > 1) return;
    if (!Number.isFinite(y) || y < 0 || y > 1) return;

    this.zoomLevel = z;
    this.scale = computeScaleForZoomLevel(
      z,
      this.numZoomSteps,
      this.maxZoomScale,
    );
    this.zoom = computeTileZoom(this.zoomLevel, this.numZoomSteps);

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

  #waitForPageLoad = async () => {
    if (document.readyState === "complete") return;
    await new Promise((resolve) => {
      window.addEventListener("load", resolve, { once: true });
    });
  };

  async connectedCallback() {
    this.canvas = this.root.querySelector(".canvas");
    this.map = this.root.querySelector(".map");
    this.controls = this.root.querySelector("map-controls");
    this.mapCompass = this.root.querySelector("map-compass");
    if (window.matchMedia("(pointer: coarse)").matches) {
      this.numZoomSteps = NUM_ZOOM_STEPS + MOBILE_EXTRA_ZOOM_STEPS;
      this.maxZoomScale = MOBILE_MAX_SCALE;
    }
    await this.#waitForPageLoad();
    await this.#loadPois();
    this.#measureNaturalDimensions();
    this.tileManager = new TileManager(
      this.map,
      BASE_MAP_WIDTH,
      BASE_MAP_HEIGHT,
      window.matchMedia("(pointer: coarse)").matches,
    );
    this.#restoreStateFromUrl();
    this.#applyCanvasSize();
    this.#syncTileManagerSize();
    this.tileManager.renderTiles(this.zoom);
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

  disconnectedCallback() {
    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
    }
    clearTimeout(this.transitionTimeoutId);
    clearTimeout(this.urlStateTimeoutId);
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
    }
    this.tileManager?.destroy();
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
