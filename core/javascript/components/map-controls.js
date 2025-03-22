import template from "./map-controls.template.js";
import styles from "./map-controls.styles.js";

/**
 * @class MapControls
 * @extends HTMLElement
 * @classdesc Custom element that provides map control buttons for zooming in and out.
 */
export default class MapControls extends HTMLElement {
  /**
   * Creates an instance of MapControls.
   * Attaches a shadow DOM and applies styles and template.
   */

  constructor() {
    super();

    this.root = this.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  /**
   * Called when the element is connected to the document's DOM.
   * Initializes buttons and adds event listeners for zooming in and out.
   */
  connectedCallback() {
    this.zoomInButton = this.root.querySelector("#zoom-in");
    this.zoomOutButton = this.root.querySelector("#zoom-out");

    this.canvas = document.querySelector("map-canvas");

    this.zoomInButton.addEventListener("click", this.canvas.zoomIn);
    this.zoomOutButton.addEventListener("click", this.canvas.zoomOut);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   * Removes event listeners for zooming in and out.
   */
  disconnectedCallback() {
    this.zoomOutButton.removeEventListener("click", this.canvas.zoomOut);
    this.zoomInButton.removeEventListener("click", this.canvas.zoomIn);
  }
}

customElements.define("map-controls", MapControls);
