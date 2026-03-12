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
    this.poiElements = [];

    this.root = this.attachShadow({ mode: "closed" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];

    this.#buildPois();
    this.render(0);
  }

  /**
   * Creates all POI DOM elements once upfront.
   * @private
   */
  #buildPois = () => {
    const fragment = document.createDocumentFragment();

    for (const poi of this.pois) {
      const el = this.#createPoiElement(poi);
      this.poiElements.push({ element: el, zoom: poi.zoom });
      fragment.appendChild(el);
    }

    this.root.appendChild(fragment);
  };

  /**
   * Creates a single POI DOM element.
   * @param {Object} poi - The point of interest data.
   * @returns {HTMLElement}
   * @private
   */
  #createPoiElement = (poi) => {
    const { name, kind, position, size } = poi;
    const [x, y] = position;

    const el = document.createElement("div");
    el.className = "poi";
    el.style.cssText = `top: ${y}%; left: ${x}%;`;
    el.dataset.kind = kind;
    el.dataset.size = size;
    el.hidden = true;

    if (kind === "city") {
      const dot = document.createElement("div");
      dot.className = "dot";
      el.appendChild(dot);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = name;
    el.appendChild(nameEl);

    return el;
  };

  /**
   * Shows/hides POIs based on the current zoom level.
   * @param {number} zoom - The zoom level of the map.
   */
  render = (zoom) => {
    for (const { element, zoom: poiZoom } of this.poiElements) {
      element.hidden = poiZoom > zoom;
    }
  };

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define("map-pois", MapPois);
