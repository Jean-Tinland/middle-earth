import template from "./map-pois.template.js";
import styles from "./map-pois.styles.js";

/**
 * Represents a custom HTML element for map points of interest.
 * @extends HTMLElement
 */
export default class MapPois extends HTMLElement {
  /**
   * Creates an instance of MapPois.
   * @param {Array} pois - The points of interest to display on the map.
   */
  constructor(pois) {
    super();

    this.pois = pois;

    this.root = this.attachShadow({ mode: "closed" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template(this.#getDisplayedPois(0));
  }

  /**
   * Renders the points of interest on the map.
   * @param {number} zoom - The zoom level of the map.
   */
  render = (zoom) => {
    const displayedPois = this.#getDisplayedPois(zoom);
    this.root.innerHTML = template(displayedPois);
  };

  /**
   * Gets the points of interest to display on the map.
   * @param {number} zoom - The zoom level of the map.
   * @private
   */
  #getDisplayedPois = (zoom) => {
    return this.pois.filter((poi) => poi.zoom <= zoom);
  };

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define("map-pois", MapPois);
