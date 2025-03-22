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
    this.root.innerHTML = template(this.pois);
  }

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define("map-pois", MapPois);
