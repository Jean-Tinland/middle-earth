import "./map-button.js";
import "./map-controls.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";

const SCALE_STEP = 1;
const MAX_SCALE = 6;
const MIN_SCALE = 1;
const DEFAULTS = Object.freeze({
  FONT_SIZE_REF: 1.5,
  SCALE: 1,
  ZOOM: 0,
  TRANSLATE_X: 0,
  TRANSLATE_Y: 0,
});

/**
 * Represents a custom HTML element for a map canvas with zoom and drag functionalities.
 * @extends HTMLElement
 */
export default class MapCanvas extends HTMLElement {
  /**
   * Creates an instance of MapCanvas.
   */
  constructor() {
    super();

    this.fontSizeRef = DEFAULTS.FONT_SIZE_REF;
    this.zoom = DEFAULTS.ZOOM;
    this.scale = DEFAULTS.SCALE;
    this.translateX = DEFAULTS.TRANSLATE_X;
    this.translateY = DEFAULTS.TRANSLATE_Y;
    this.previousTouch;

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
    this.controls.zoomOutButton.disabled = this.scale === MIN_SCALE;
    this.controls.zoomInButton.disabled = false;
    this.canvas.style.setProperty("--font-size-ref", `${this.fontSizeRef}vw`);
    this.previousTouch = undefined;
  };

  /**
   * Zooms in the canvas.
   */
  zoomIn = () => {
    this.scale = Math.min(this.scale + SCALE_STEP, MAX_SCALE);
    this.zoom += 1;
    this.controls.zoomInButton.disabled = this.scale === MAX_SCALE;
    this.controls.zoomOutButton.disabled = false;
    this.canvas.style.setProperty(
      "transform",
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
    );
    this.fontSizeRef = 1 / (this.scale / 3);
    this.canvas.style.setProperty("--font-size-ref", `${this.fontSizeRef}vw`);
  };

  /**
   * Zooms out the canvas.
   */
  zoomOut = () => {
    this.scale = Math.max(this.scale - SCALE_STEP, MIN_SCALE);
    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }
    this.zoom -= 1;
    this.controls.zoomOutButton.disabled = this.scale === MIN_SCALE;
    this.controls.zoomInButton.disabled = false;
    this.canvas.style.setProperty(
      "transform",
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
    );
    this.fontSizeRef = 1 / (this.scale / 3);
    this.canvas.style.setProperty("--font-size-ref", `${this.fontSizeRef}vw`);
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
    this.canvas.style.setProperty(
      "transition",
      "transform 320ms var(--transition-easing)"
    );
    setTimeout(() => {
      this.canvas.style.removeProperty("transition");
    }, 320);

    const canvasBounds = this.canvas.getBoundingClientRect();
    const bodyBounds = document.body.getBoundingClientRect();

    if (this.scale === MIN_SCALE) {
      return this.#reset();
    }

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

    this.canvas.style.setProperty(
      "transform",
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
    );

    this.previousTouch = undefined;
  };

  /**
   * Handles the dragging event.
   * @param {PointerEvent} e - The pointer event.
   * @private
   */
  #dragging = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "touchmove") {
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

    this.canvas.style.setProperty(
      "transform",
      `scale(${this.scale}) translate(${this.translateX}px, ${this.translateY}px)`
    );
  };

  /**
   * Loads the map SVG.
   * @private
   * @returns {Promise<void>}
   */
  #loadMap = async () => {
    const map = await fetch("/assets/images/map.svg");
    const text = await map.text();
    this.map.innerHTML = text;
    this.setAttribute("ready", "");
  };

  /**
   * Loads the points of interest (POIs).
   * @private
   * @returns {Promise<void>}
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
    const pois = new MapPois(this.pois);
    this.canvas.appendChild(pois);
  };

  /**
   * Called when the element is connected to the document's DOM.
   * @returns {Promise<void>}
   */
  async connectedCallback() {
    this.canvas = this.root.querySelector(".canvas");
    this.map = this.root.querySelector(".map");
    this.controls = this.root.querySelector("map-controls");

    this.canvas.style.setProperty("--font-size-ref", `${this.fontSizeRef}vw`);

    await Promise.all([this.#loadMap(), this.#loadPois()]);

    this.canvas.addEventListener("dblclick", this.zoomIn);
    this.canvas.addEventListener("mousedown", this.#dragStart);
    this.canvas.addEventListener("mouseup", this.#dragEnd);
    this.canvas.addEventListener("touchmove", this.#dragging);
    this.canvas.addEventListener("touchend", this.#dragEnd);
    window.addEventListener("mouseout", this.#dragEnd);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   */
  disconnectedCallback() {
    window.removeEventListener("mouseout", this.#dragEnd);
    this.canvas.removeEventListener("touchend", this.#dragEnd);
    this.canvas.removeEventListener("touchmove", this.#dragging);
    this.canvas.removeEventListener("mouseup", this.#dragEnd);
    this.canvas.removeEventListener("mousedown", this.#dragStart);
    this.canvas.removeEventListener("dblclick", this.zoomIn);
  }
}

customElements.define("map-canvas", MapCanvas);
