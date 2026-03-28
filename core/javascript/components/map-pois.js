import styles from "./map-pois.styles.js";

const DEFAULT_BASE_FONT_SIZE = 16;
const ILLUSTRATION_ZOOM_THRESHOLD = 13;
const ILLUSTRATION_SIZE_MULTIPLIER = 2;

const TEXT_SIZE_MULTIPLIERS = Object.freeze({
  region: Object.freeze({ 1: 1.45, 2: 1.15, 3: 0.8, 4: 0.7 }),
  forest: Object.freeze({ 1: 0.95, 2: 0.8, 3: 0.65, 4: 0.55 }),
  mountain: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.45, 4: 0.4 }),
  "common-place": Object.freeze({ 1: 0.8, 2: 0.7, 3: 0.6, 4: 0.5 }),
  sea: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.55, 4: 0.45 }),
  city: Object.freeze({ 1: 0.65, 2: 0.55, 3: 0.45, 4: 0.4 }),
  hamlet: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.4, 4: 0.4 }),
  river: Object.freeze({ 1: 0.75, 2: 0.65, 3: 0.55 }),
});

const CITY_DOT_SIZE_MULTIPLIERS = Object.freeze({
  1: 0.6,
  2: 0.5,
  3: 0.4,
  4: 0.3,
});

const DEFAULT_TEXT_SIZE_MULTIPLIER = 1;
const DEFAULT_CITY_DOT_SIZE_MULTIPLIER = CITY_DOT_SIZE_MULTIPLIERS[4];

/**
 * Represents a custom HTML element for map points of interest.
 * @extends HTMLElement
 */
export default class MapPois extends HTMLElement {
  /** @type {string} The build version of the application. */
  #buildVersion = document.documentElement.dataset.buildVersion || "0";
  /** @type {Map<number, Array>} POI elements grouped by their zoom-appearance threshold. */
  #poisByZoom = new Map();
  /** @type {number[]} Zoom thresholds in ascending order. */
  #sortedThresholds = [];
  /** @type {Array} POI elements that have an illustration image. */
  #illustrationPois = [];
  /** @type {number} Zoom level from the most recent render call; -1 before first render. */
  #lastZoom = -1;
  /** @type {boolean | null} Illustration mode from the most recent render call. */
  #lastIllustrationMode = null;

  /**
   * Creates an instance of MapPois.
   * @param {Array} pois - The points of interest to display on the map.
   */
  constructor(pois) {
    super();

    this.lastBaseFontSize = null;

    this.root = this.attachShadow({ mode: "open" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];

    this.#buildPois(pois);
    this.render(0);
  }

  /**
   * Creates all POI DOM elements once upfront and indexes them by zoom threshold.
   * @param {Array} pois
   * @private
   */
  #buildPois = (pois) => {
    const fragment = document.createDocumentFragment();

    for (const poi of pois) {
      const poiElement = this.#createPoiElement(poi);

      const bucket = this.#poisByZoom.get(poi.zoom);
      if (bucket) {
        bucket.push(poiElement);
      } else {
        this.#poisByZoom.set(poi.zoom, [poiElement]);
      }

      if (poiElement.illustrationElement) {
        this.#illustrationPois.push(poiElement);
      }

      fragment.appendChild(poiElement.element);
    }

    this.#sortedThresholds = [...this.#poisByZoom.keys()].sort((a, b) => a - b);
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

    if (kind === "city" || kind === "hamlet") {
      dotElement = Object.assign(document.createElement("div"), {
        className: "dot",
      });
      el.appendChild(dotElement);
    }

    let illustrationElement = null;

    if (illustration) {
      illustrationElement = Object.assign(document.createElement("img"), {
        className: "illustration",
        src: `${illustration}?v=${this.#buildVersion}`,
        alt: name,
        hidden: true,
        loading: "lazy",
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
        kind === "city" || kind === "hamlet"
          ? this.#getCityDotSizeMultiplier(size)
          : null,
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
   * Shows/hides POIs based on the current zoom level, only touching the DOM
   * for buckets that cross a visibility threshold, and only updating sizes
   * for visible POIs when the base font size changes.
   * @param {number} zoom - The effective zoom level used to gate POI visibility.
   * @param {number} [baseFontSize] - Base font size used to compute POI sizes.
   * @param {number} [illustrationZoom] - The raw zoom level used only for illustration
   *   mode switching. Defaults to `zoom` when omitted.
   */
  render = (zoom, baseFontSize, illustrationZoom = zoom) => {
    const resolvedBaseFontSize = this.#resolveBaseFontSize(baseFontSize);
    const sizesDirty = this.lastBaseFontSize !== resolvedBaseFontSize;
    const illustrationMode = illustrationZoom >= ILLUSTRATION_ZOOM_THRESHOLD;
    const illustrationChanged = illustrationMode !== this.#lastIllustrationMode;
    const lastZoom = this.#lastZoom;

    for (const threshold of this.#sortedThresholds) {
      const wasVisible = threshold <= lastZoom;
      const isVisible = threshold <= zoom;

      if (isVisible && !wasVisible) {
        // Bucket just came into view — size and show its POIs.
        for (const poi of this.#poisByZoom.get(threshold)) {
          this.#applyPixelSizes(poi, resolvedBaseFontSize);
          if (poi.illustrationElement) {
            this.#applyIllustrationMode(poi, illustrationMode);
          }
          poi.element.hidden = false;
        }
      } else if (!isVisible && wasVisible) {
        // Bucket just left view — hide its POIs.
        for (const poi of this.#poisByZoom.get(threshold)) {
          poi.element.hidden = true;
        }
      } else if (isVisible && sizesDirty) {
        // Already visible — update sizes only.
        for (const poi of this.#poisByZoom.get(threshold)) {
          this.#applyPixelSizes(poi, resolvedBaseFontSize);
        }
      }
    }

    // Update illustration mode for visible illustration POIs when threshold is crossed.
    if (illustrationChanged) {
      for (const poi of this.#illustrationPois) {
        if (!poi.element.hidden) {
          this.#applyIllustrationMode(poi, illustrationMode);
        }
      }
    }

    this.lastBaseFontSize = resolvedBaseFontSize;
    this.#lastZoom = zoom;
    this.#lastIllustrationMode = illustrationMode;
  };

  /**
   * Toggles between the illustration image and the dot marker.
   * Only called for POIs that have an illustration element.
   * @param {{dotElement: HTMLElement | null, illustrationElement: HTMLElement}} poiElement
   * @param {boolean} show - Whether the illustration should be shown.
   * @private
   */
  #applyIllustrationMode = (poiElement, show) => {
    if (poiElement.dotElement) {
      poiElement.dotElement.hidden = show;
    }
    poiElement.illustrationElement.hidden = !show;
  };

  /**
   * Counter-rotates all POI labels to keep them horizontal while the map rotates.
   * Sets CSS custom properties on the host so all POIs update in a single paint.
   * @param {number} degrees - Current map rotation in degrees.
   */
  setRotation = (degrees) => {
    this.style.setProperty("--poi-rotation", `${-degrees}deg`);
    this.style.setProperty("--illustration-rotation", `${degrees}deg`);
  };
}

customElements.define("map-pois", MapPois);
