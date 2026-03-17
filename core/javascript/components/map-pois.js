import styles from "./map-pois.styles.js";

const DEFAULT_BASE_FONT_SIZE = 16;

const TEXT_SIZE_MULTIPLIERS = Object.freeze({
  region: Object.freeze({ 1: 0.55, 2: 0.7, 3: 0.85 }),
  forest: Object.freeze({ 1: 0.35, 2: 0.45, 3: 0.55 }),
  mountain: Object.freeze({ 1: 0.45, 2: 0.45, 3: 0.55 }),
  "common-place": Object.freeze({ 1: 0.55, 2: 0.65, 3: 0.75 }),
  sea: Object.freeze({ 1: 0.55, 2: 0.5, 3: 0.6 }),
  city: Object.freeze({ 1: 0.45, 2: 0.55, 3: 0.65 }),
  river: Object.freeze({ 1: 0.55, 2: 0.65, 3: 0.75 }),
});

const CITY_DOT_SIZE_MULTIPLIERS = Object.freeze({
  1: 0.4,
  2: 0.5,
  3: 0.6,
  4: 0.7,
});

const DEFAULT_TEXT_SIZE_MULTIPLIER = 1;
const DEFAULT_CITY_DOT_SIZE_MULTIPLIER = CITY_DOT_SIZE_MULTIPLIERS[1];

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
    this.lastBaseFontSize = null;

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
      const poiElement = this.#createPoiElement(poi);
      this.poiElements.push(poiElement);
      fragment.appendChild(poiElement.element);
    }

    this.root.appendChild(fragment);
  };

  /**
   * Creates a single POI DOM element.
   * @param {Object} poi - The point of interest data.
   * @returns {{
   *   element: HTMLElement,
   *   nameElement: HTMLElement,
   *   dotElement: HTMLElement | null,
   *   zoom: number,
   *   textSizeMultiplier: number,
   *   dotSizeMultiplier: number | null
   * }}
   * @private
   */
  #createPoiElement = (poi) => {
    const { name, kind, position, size, zoom, shadow } = poi;
    const [x, y] = position;

    const el = document.createElement("div");
    el.className = "poi";
    el.style.cssText = `top: ${y}%; left: ${x}%;`;
    if (shadow) {
      el.dataset.shadow = "";
    }
    el.dataset.kind = kind;
    el.dataset.size = size;
    el.hidden = true;

    let dotElement = null;

    if (kind === "city") {
      dotElement = document.createElement("div");
      dotElement.className = "dot";
      el.appendChild(dotElement);
    }

    const nameEl = document.createElement("div");
    nameEl.className = "name";
    nameEl.textContent = name;
    el.appendChild(nameEl);

    return {
      element: el,
      nameElement: nameEl,
      dotElement,
      zoom,
      textSizeMultiplier: this.#getTextSizeMultiplier(kind, size),
      dotSizeMultiplier:
        kind === "city" ? this.#getCityDotSizeMultiplier(size) : null,
    };
  };

  /**
   * Returns the text size multiplier for one POI.
   * @param {string} kind
   * @param {number} size
   * @returns {number}
   * @private
   */
  #getTextSizeMultiplier = (kind, size) => {
    const multipliersByKind = TEXT_SIZE_MULTIPLIERS[kind];
    return multipliersByKind?.[size] ?? DEFAULT_TEXT_SIZE_MULTIPLIER;
  };

  /**
   * Returns the city dot size multiplier for one POI.
   * @param {number} size
   * @returns {number}
   * @private
   */
  #getCityDotSizeMultiplier = (size) => {
    return CITY_DOT_SIZE_MULTIPLIERS[size] ?? DEFAULT_CITY_DOT_SIZE_MULTIPLIER;
  };

  /**
   * Rounds a value to the closest integer pixel.
   * @param {number} value
   * @returns {number}
   * @private
   */
  #roundToPixel = (value) => {
    return Math.max(1, Math.round(value));
  };

  /**
   * Rounds a value to the closest quarter pixel.
   * @param {number} value
   * @returns {number}
   * @private
   */
  #roundToQuarterPixel = (value) => {
    const rounded = Math.round(value * 4) / 4;
    return Math.max(0.25, rounded);
  };

  /**
   * Returns a text-shadow offset that can fade to 0 for tiny labels.
   * @param {number} baseFontSize
   * @returns {number}
   * @private
   */
  #getTextShadowOffset = (baseFontSize) => {
    const rawOffset = baseFontSize * 0.012;

    if (rawOffset < 0.2) return 0;

    return Math.round(rawOffset * 10) / 10;
  };

  /**
   * Resolves the base font size in pixels.
   * @param {number | undefined} baseFontSize
   * @returns {number}
   * @private
   */
  #resolveBaseFontSize = (baseFontSize) => {
    if (Number.isFinite(baseFontSize) && baseFontSize > 0) return baseFontSize;

    const inheritedFontSize = Number.parseFloat(
      getComputedStyle(this).getPropertyValue("--font-size-ref"),
    );

    if (Number.isFinite(inheritedFontSize) && inheritedFontSize > 0) {
      return inheritedFontSize;
    }

    return DEFAULT_BASE_FONT_SIZE;
  };

  /**
   * Applies computed pixel sizes to one POI.
   * @param {{
   *   element: HTMLElement,
   *   nameElement: HTMLElement,
   *   dotElement: HTMLElement | null,
   *   textSizeMultiplier: number,
   *   dotSizeMultiplier: number | null
   * }} poiElement
   * @param {number} baseFontSize
   * @private
   */
  #applyPixelSizes = (poiElement, baseFontSize) => {
    const textSize = this.#roundToPixel(
      baseFontSize * poiElement.textSizeMultiplier,
    );
    poiElement.nameElement.style.setProperty("font-size", `${textSize}px`);

    if (!poiElement.dotElement || poiElement.dotSizeMultiplier === null) return;

    const dotSize = this.#roundToPixel(
      baseFontSize * poiElement.dotSizeMultiplier,
    );
    poiElement.dotElement.style.setProperty("width", `${dotSize}px`);
    poiElement.dotElement.style.setProperty("height", `${dotSize}px`);
  };

  /**
   * Shows/hides POIs based on the current zoom level.
   * @param {number} zoom - The zoom level of the map.
   * @param {number} [baseFontSize] - Base font size used to compute POI sizes.
   */
  render = (zoom, baseFontSize) => {
    const resolvedBaseFontSize = this.#resolveBaseFontSize(baseFontSize);
    const shouldRecalculateSizes =
      this.lastBaseFontSize !== resolvedBaseFontSize;

    for (const poiElement of this.poiElements) {
      if (shouldRecalculateSizes) {
        this.#applyPixelSizes(poiElement, resolvedBaseFontSize);
      }

      poiElement.element.hidden = poiElement.zoom > zoom;
    }

    this.lastBaseFontSize = resolvedBaseFontSize;
  };

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define("map-pois", MapPois);
