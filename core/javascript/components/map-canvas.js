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
const MAX_SCALE = 29;
/** The minimum scale of the map. */
const MIN_SCALE = 1;
/** The accumulated deltaY required to trigger one zoom step. */
const WHEEL_THRESHOLD = 100;
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
  FONT_SIZE_REF: 16,
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
    this.pendingMovementX = 0;
    this.pendingMovementY = 0;
    this.willChangeTimeoutId = null;
    this.isDragging = false;
    this.isPinching = false;
    this.pinchStartDistance = 0;
    this.pinchStartScale = 1;
    this.canvasNaturalWidth = 0;
    this.canvasNaturalHeight = 0;

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
    this.zoom = DEFAULTS.ZOOM;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.#updateFontSizeRef();
    this.#updateControls();
    this.#enterSettledState();
  };

  /**
   * Zooms in the canvas.
   */
  zoomIn = (e) => {
    if (this.scale === MAX_SCALE) return;
    e.preventDefault();

    if (e.type !== "wheel") {
      // Leave settled state invisibly: strip physical-size overrides, restore scale
      // transform instantly (transition: none). No will-change here so the CSS
      // transition that follows runs via the software renderer — always sharp on iOS.
      this.canvas.style.setProperty("transition", "none");
      this.canvas.style.removeProperty("width");
      this.canvas.style.removeProperty("height");
      this.canvas.style.removeProperty("max-width");
      this.canvas.style.removeProperty("max-height");
      this.#updateCanvas();
      this.canvas.getBoundingClientRect(); // flush to commit transition:none
      this.canvas.style.setProperty(
        "transition",
        "transform 320ms var(--transition-easing)",
      );
    }

    this.zoom += 1;
    const scaleStep = SCALE_STEP * this.zoom;
    this.scale = Math.min(this.scale + scaleStep, MAX_SCALE);

    if (e.type === "wheel" || e.type === "dblclick") {
      this.translateX -= (e.clientX - window.innerWidth / 2) / this.scale;
      this.translateY -= (e.clientY - window.innerHeight / 2) / this.scale;
    }

    this.mapPois.render(this.zoom);
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateFontSizeRef();
    this.#updateControls();

    if (e.type !== "wheel") {
      this.#scheduleWillChangeRemoval();
    }
  };

  /**
   * Zooms out the canvas.
   */
  zoomOut = (e) => {
    if (this.scale === MIN_SCALE) return;
    e.preventDefault();

    if (e.type !== "wheel") {
      this.canvas.style.setProperty("transition", "none");
      this.canvas.style.removeProperty("width");
      this.canvas.style.removeProperty("height");
      this.canvas.style.removeProperty("max-width");
      this.canvas.style.removeProperty("max-height");
      this.#updateCanvas();
      this.canvas.getBoundingClientRect();
      this.canvas.style.setProperty(
        "transition",
        "transform 320ms var(--transition-easing)",
      );
    }

    this.zoom -= 1;
    const scaleStep = SCALE_STEP * (this.zoom + 1);
    this.scale = Math.max(this.scale - scaleStep, MIN_SCALE);
    this.#updateFontSizeRef();
    this.mapPois.render(this.zoom);
    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateControls();

    if (e.type !== "wheel") {
      this.#scheduleWillChangeRemoval();
    }
  };

  /**
   * Updates the zoom controls.
   * @private
   */
  #updateControls = () => {
    this.controls.zoomOutButton.disabled = this.scale === MIN_SCALE;
    this.controls.zoomInButton.disabled = this.scale === MAX_SCALE;
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
  };

  /**
   * Updates the font size reference.
   * @private
   */
  #updateFontSizeRef = () => {
    // The font size reference is inversely proportional to the scale.
    const divider = this.zoom === 0 ? 1.5 : 2;
    this.fontSizeRef = DEFAULTS.FONT_SIZE_REF / (this.scale / divider);
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontSizeRef.toFixed(2)}px`,
    );
  };

  /**
   * Defers the removal of will-change until after the CSS transition completes.
   * Prevents Chrome from tearing down the compositing layer mid-transition.
   * @private
   */
  #scheduleWillChangeRemoval = () => {
    clearTimeout(this.willChangeTimeoutId);
    this.willChangeTimeoutId = setTimeout(() => this.#enterSettledState(), 320);
  };

  /**
   * Stores the canvas's natural (un-zoomed) dimensions.
   * Must be called after the map has been laid out.
   * @private
   */
  #measureNaturalDimensions = () => {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.canvasNaturalWidth = width;
    this.canvasNaturalHeight = height;
  };

  /**
   * Prepares the canvas for a GPU-composited interaction (drag, pinch, wheel).
   * Strips the physical-size overrides set by #enterSettledState, adds will-change,
   * and restores the scale transform so GPU compositing works at natural dimensions.
   * @private
   */
  #enterInteractionState = () => {
    this.canvas.style.removeProperty("width");
    this.canvas.style.removeProperty("height");
    this.canvas.style.removeProperty("max-width");
    this.canvas.style.removeProperty("max-height");
    this.canvas.style.setProperty("will-change", "transform");
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontSizeRef.toFixed(2)}px`,
    );
    this.#updateCanvas();
  };

  /**
   * Sets the canvas to its physically-zoomed size so iOS Safari rasterizes the
   * inline SVG at full resolution instead of upscaling a composited texture.
   * The CSS scale transform is replaced by an equivalent translate-only transform.
   * @private
   */
  #enterSettledState = () => {
    this.canvas.style.removeProperty("transition");
    const settledX = this.translateX * this.scale;
    const settledY = this.translateY * this.scale;
    this.canvas.style.setProperty("max-width", "none");
    this.canvas.style.setProperty("max-height", "none");
    this.canvas.style.setProperty(
      "width",
      `${this.canvasNaturalWidth * this.scale}px`,
    );
    this.canvas.style.setProperty(
      "height",
      `${this.canvasNaturalHeight * this.scale}px`,
    );
    this.canvas.style.setProperty(
      "transform",
      `translate(${settledX}px, ${settledY}px)`,
    );
    // Without CSS scale(), --font-size-ref must be multiplied by scale so POIs
    // render at the same physical size as they would in the interaction state.
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${(this.fontSizeRef * this.scale).toFixed(2)}px`,
    );
    this.canvas.style.removeProperty("will-change");
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
   * Enters interaction state for all touches to keep the canvas visually consistent
   * during single-finger drags on iOS. Also detects pinch gestures.
   * @param {TouchEvent} e
   * @private
   */
  #touchStart = (e) => {
    e.preventDefault();
    this.isDragging = true;
    this.canvas.style.setProperty("transition", "none");
    this.#enterInteractionState();

    if (e.touches.length !== 2) return;

    this.isPinching = true;
    this.pinchStartDistance = this.#getPinchDistance(e.touches);
    this.pinchStartScale = this.scale;
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
    this.canvas.addEventListener("pointermove", this.#dragging);
    this.canvas.style.setProperty("cursor", "grabbing");
    this.canvas.style.setProperty("transition", "none");
    this.#enterInteractionState();
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
    this.#scheduleWillChangeRemoval();

    if (this.dragRafId !== null) {
      cancelAnimationFrame(this.dragRafId);
      this.dragRafId = null;
      this.pendingMovementX = 0;
      this.pendingMovementY = 0;
    }

    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }

    this.#checkAndFixBoundaries();
    this.#updateCanvas();

    this.previousTouch = undefined;
    this.isPinching = false;
    this.pinchStartDistance = 0;
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
      this.zoom = Math.round(
        ((this.scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * (MAX_SCALE - 1),
      );
      this.#updateFontSizeRef();
      this.mapPois.render(this.zoom);
      this.#updateCanvas();
      return;
    }

    // Touch events do not have movementX and movementY properties.
    // We calculate them using the previous touch event.
    if (e.type === "touchmove") {
      this.canvas.style.setProperty("transition", "none");

      const touch = e.touches[0];

      e.movementX = this.previousTouch
        ? touch.pageX - this.previousTouch.pageX
        : 1;
      e.movementY = this.previousTouch
        ? touch.pageY - this.previousTouch.pageY
        : 1;

      this.previousTouch = touch;
    }

    this.pendingMovementX += e.movementX;
    this.pendingMovementY += e.movementY;

    if (this.dragRafId !== null) return;

    this.dragRafId = requestAnimationFrame(() => {
      this.dragRafId = null;
      this.translateX += this.pendingMovementX / this.scale;
      this.translateY += this.pendingMovementY / this.scale;
      this.pendingMovementX = 0;
      this.pendingMovementY = 0;
      this.#updateCanvas();
    });
  };

  /**
   * Loads the SVG map and injects it inline so iOS Safari renders it as vector,
   * producing sharp output at every zoom level.
   * @private
   */
  #loadMap = async () => {
    const response = await fetch("./assets/images/map.svg");
    const svgText = await response.text();
    this.map.innerHTML = svgText;
  };

  /**
   * Loads the points of interest (POIs).
   * @private
   */
  #loadPois = async () => {
    const pois = await fetch("/assets/data/pois.json");
    const data = await pois.json();
    this.pois = data.pois;
    this.#drawPois();
  };

  /**
   * Draws the points of interest (POIs).
   * @private
   */
  #drawPois = () => {
    this.mapPois = new MapPois(this.pois);
    this.canvas.appendChild(this.mapPois);
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

    this.canvas.style.setProperty("transition", "none");
    this.#enterInteractionState();

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
      this.#scheduleWillChangeRemoval();
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
   * Called when the element is connected to the document's DOM.
   */
  async connectedCallback() {
    this.canvas = this.root.querySelector(".canvas");
    this.map = this.root.querySelector(".map");
    this.controls = this.root.querySelector("map-controls");

    await Promise.all([this.#loadMap(), this.#loadPois()]);
    this.#onMapLoad();
    this.#updateFontSizeRef();
    this.#measureNaturalDimensions();
    this.#enterSettledState();

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
    clearTimeout(this.willChangeTimeoutId);
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
