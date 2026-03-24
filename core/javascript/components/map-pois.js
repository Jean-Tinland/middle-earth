import styles from "./map-pois.styles.js";

const DEFAULT_BASE_FONT_SIZE = 16;
const ILLUSTRATION_ZOOM_THRESHOLD = 9;
const ILLUSTRATION_SIZE_MULTIPLIER = 2.5;

const TEXT_SIZE_MULTIPLIERS = Object.freeze({
  region: Object.freeze({ 1: 1.45, 2: 1.15, 3: 0.8 }),
  forest: Object.freeze({ 1: 0.95, 2: 0.8, 3: 0.65 }),
  mountain: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.45 }),
  "common-place": Object.freeze({ 1: 0.8, 2: 0.7, 3: 0.6 }),
  sea: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.55 }),
  city: Object.freeze({ 1: 0.65, 2: 0.55, 3: 0.45 }),
  river: Object.freeze({ 1: 0.75, 2: 0.65, 3: 0.55 }),
});

const CITY_DOT_SIZE_MULTIPLIERS = Object.freeze({
  1: 0.7,
  2: 0.6,
  3: 0.5,
  4: 0.4,
});

const DEFAULT_TEXT_SIZE_MULTIPLIER = 1;
const DEFAULT_CITY_DOT_SIZE_MULTIPLIER = CITY_DOT_SIZE_MULTIPLIERS[4];

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

    this.root = this.attachShadow({ mode: "open" });

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
    const { name, kind, position, size, zoom, illustration } = poi;
    const [x, y] = position;

    const el = Object.assign(document.createElement("div"), {
      className: "poi",
      hidden: true,
      style: `top: ${y}%; left: ${x}%;`,
    });
    el.dataset.kind = kind;
    el.dataset.size = size;

    let dotElement = null;

    if (kind === "city") {
      dotElement = Object.assign(document.createElement("div"), {
        className: "dot",
      });
      el.appendChild(dotElement);
    }

    let illustrationElement = null;

    if (illustration) {
      illustrationElement = Object.assign(document.createElement("img"), {
        className: "illustration",
        src: illustration,
        alt: name,
        hidden: true,
      });
      el.appendChild(illustrationElement);
    }

    const nameEl = Object.assign(document.createElement("div"), {
      className: "name",
      textContent: name,
    });
    el.appendChild(nameEl);

    return {
      element: el,
      nameElement: nameEl,
      dotElement,
      illustrationElement,
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

    if (poiElement.illustrationElement) {
      const illustrationSize = this.#roundToPixel(
        baseFontSize * ILLUSTRATION_SIZE_MULTIPLIER,
      );
      poiElement.illustrationElement.style.setProperty(
        "width",
        `${illustrationSize}px`,
      );
    }

    if (!poiElement.dotElement || poiElement.dotSizeMultiplier === null) return;

    const dotSize = this.#roundToPixel(
      baseFontSize * poiElement.dotSizeMultiplier,
    );
    poiElement.dotElement.style.setProperty("width", `${dotSize}px`);
    poiElement.dotElement.style.setProperty("height", `${dotSize}px`);
  };

  /**
   * Shows/hides POIs based on the current zoom level.
   * @param {number} zoom - The effective zoom level used to gate POI visibility.
   * @param {number} [baseFontSize] - Base font size used to compute POI sizes.
   * @param {number} [illustrationZoom] - The raw zoom level used only for illustration
   *   mode switching. Defaults to `zoom` when omitted.
   */
  render = (zoom, baseFontSize, illustrationZoom = zoom) => {
    const resolvedBaseFontSize = this.#resolveBaseFontSize(baseFontSize);
    const shouldRecalculateSizes =
      this.lastBaseFontSize !== resolvedBaseFontSize;

    for (const poiElement of this.poiElements) {
      if (shouldRecalculateSizes) {
        this.#applyPixelSizes(poiElement, resolvedBaseFontSize);
      }

      poiElement.element.hidden = poiElement.zoom > zoom;

      this.#applyIllustrationMode(poiElement, illustrationZoom);
    }

    this.lastBaseFontSize = resolvedBaseFontSize;
  };

  /**
   * Toggles between the illustration image and the traditional dot marker
   * based on the current zoom level.
   * @param {{dotElement: HTMLElement | null, illustrationElement: HTMLElement | null}} poiElement
   * @param {number} zoom
   * @private
   */
  #applyIllustrationMode = (poiElement, zoom) => {
    if (!poiElement.illustrationElement) return;

    const showIllustration = zoom >= ILLUSTRATION_ZOOM_THRESHOLD;

    if (poiElement.dotElement) {
      poiElement.dotElement.hidden = showIllustration;
    }

    poiElement.illustrationElement.hidden = !showIllustration;
  };

  /**
   * Counter-rotates all POI elements to keep labels horizontal while the map rotates.
   * Illustrations are re-rotated back so they always face up.
   * @param {number} degrees - Current map rotation in degrees.
   */
  setRotation = (degrees) => {
    for (const { element, illustrationElement } of this.poiElements) {
      element.style.setProperty(
        "transform",
        `translate(-50%, -50%) rotate(${-degrees}deg)`,
      );

      if (illustrationElement) {
        illustrationElement.style.setProperty(
          "transform",
          `rotate(${degrees}deg)`,
        );
      }
    }
  };

  connectedCallback() {}

  disconnectedCallback() {}
}

customElements.define("map-pois", MapPois);
