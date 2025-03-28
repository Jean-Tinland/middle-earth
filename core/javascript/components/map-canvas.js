import "./map-button.js";
import "./map-controls.js";
import "./map-information.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";

/** The step for scaling the map. */
const SCALE_STEP = 1;
/** The maximum scale of the map. */
const MAX_SCALE = 8;
/** The minimum scale of the map. */
const MIN_SCALE = 1;
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
  FONT_SIZE_REF: 1,
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
    this.wheelDisabled = false;

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
    this.canvas.style.removeProperty("transform");
    this.fontSizeRef = DEFAULTS.FONT_SIZE_REF;
    this.zoom = DEFAULTS.ZOOM;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch = DEFAULTS.PREVIOUS_TOUCH;
    this.#updateControls();
  };

  /**
   * Zooms in the canvas.
   */
  zoomIn = (e) => {
    if (this.scale === MAX_SCALE) return;
    e.preventDefault();
    this.scale = Math.min(this.scale + SCALE_STEP, MAX_SCALE);
    this.zoom += 1;

    if (e.type === "wheel" || e.type === "dblclick") {
      this.translateX -= (e.clientX - window.innerWidth / 2) / this.scale;
      this.translateY -= (e.clientY - window.innerHeight / 2) / this.scale;
    }

    this.mapPois.render(this.zoom);
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateFontSizeRef();
    this.#updateControls();
  };

  /**
   * Zooms out the canvas.
   */
  zoomOut = (e) => {
    if (this.scale === MIN_SCALE) return;
    e.preventDefault();
    this.scale = Math.max(this.scale - SCALE_STEP, MIN_SCALE);
    this.zoom -= 1;
    this.#updateFontSizeRef();
    this.mapPois.render(this.zoom);
    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }
    this.#checkAndFixBoundaries();
    this.#updateCanvas();
    this.#updateControls();
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
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
    );
  };

  /**
   * Updates the font size reference.
   * @private
   */
  #updateFontSizeRef = () => {
    // The font size reference is inversely proportional to the scale.
    // `cqw` unit is used to make the font size relative to the canvas width.
    const divider = this.zoom === 0 ? 1.5 : 3;
    this.fontSizeRef = DEFAULTS.FONT_SIZE_REF / (this.scale / divider);
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontSizeRef.toFixed(2)}cqw`
    );
  };

  /**
   * Handles the start of a drag event.
   * @param {PointerEvent} e - The pointer event.
   * @private
   */
  #dragStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
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
    e.preventDefault();
    e.stopPropagation();
    this.canvas.removeEventListener("pointermove", this.#dragging);
    this.canvas.style.removeProperty("cursor");
    this.canvas.style.removeProperty("transition");

    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }

    this.#checkAndFixBoundaries();
    this.#updateCanvas();

    this.previousTouch = undefined;
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

    const { movementX, movementY } = e;
    this.translateX += movementX / this.scale;
    this.translateY += movementY / this.scale;

    this.#updateCanvas();
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
    if (this.wheelDisabled) return;
    if (e.deltaY > 0) {
      this.zoomOut(e);
    } else {
      this.zoomIn(e);
    }
    this.wheelDisabled = true;
    setTimeout(() => (this.wheelDisabled = false), 320);
  };

  /**
   * Gets the percentage coordinates of the clicked point.
   * @param {MouseEvent} e - The mouse event.
   * @private
   */
  #getPercentageCoordinates = async (e) => {
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

    this.map.addEventListener("load", this.#onMapLoad);

    await this.#loadPois();
    this.#updateFontSizeRef();

    this.canvas.addEventListener("dblclick", this.#handleCanvasDoubleClick);
    this.canvas.addEventListener("mousedown", this.#dragStart);
    this.canvas.addEventListener("mouseup", this.#dragEnd);
    this.canvas.addEventListener("touchmove", this.#dragging);
    this.canvas.addEventListener("touchend", this.#dragEnd);
    this.canvas.addEventListener("click", this.#getPercentageCoordinates);
    window.addEventListener("wheel", this.#handleMouseWheel);
    window.addEventListener("mouseout", this.#dragEnd);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   */
  disconnectedCallback() {
    window.removeEventListener("mouseout", this.#dragEnd);
    window.removeEventListener("wheel", this.#handleMouseWheel);
    this.canvas.removeEventListener("click", this.#getPercentageCoordinates);
    this.canvas.removeEventListener("touchend", this.#dragEnd);
    this.canvas.removeEventListener("touchmove", this.#dragging);
    this.canvas.removeEventListener("mouseup", this.#dragEnd);
    this.canvas.removeEventListener("mousedown", this.#dragStart);
    this.canvas.removeEventListener("dblclick", this.#handleCanvasDoubleClick);

    this.map.removeEventListener("load", this.#onMapLoad);
  }
}

customElements.define("map-canvas", MapCanvas);
