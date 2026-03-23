import template from "./map-scale.template.js";
import styles from "./map-scale.styles.js";

/** Total real-world width the base map represents, in leagues. */
const MAP_WIDTH_LEAGUES = 2000;

/** Number of alternating bar segments in the scale indicator. */
const SEGMENT_COUNT = 4;

/** Nice round values to use as the total bar distance (in leagues). */
const NICE_DISTANCES = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

/** Target pixel width for the scale bar on screen. */
const TARGET_BAR_PX = 120;

/**
 * Rounds a distance to the nearest value in NICE_DISTANCES.
 * @param {number} raw - The raw distance to round.
 * @returns {number}
 */
const pickNiceDistance = (raw) => {
  let best = NICE_DISTANCES[0];
  for (const candidate of NICE_DISTANCES) {
    if (Math.abs(candidate - raw) < Math.abs(best - raw)) best = candidate;
  }
  return best;
};

/**
 * Displays a dynamic scale bar that reflects the current map zoom level.
 * Listens to `zoom-change` events dispatched by `map-canvas`.
 *
 * @extends HTMLElement
 */
export default class MapScale extends HTMLElement {
  constructor() {
    super();

    this.root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  /**
   * Computes the bar pixel width and labeled distance for the current canvas size.
   * @param {number} canvasNaturalWidth - Canvas width at scale 1.
   * @param {number} scale - Current zoom scale multiplier.
   * @returns {{ barPx: number, distance: number }}
   * @private
   */
  #computeScaleBar = (canvasNaturalWidth, scale) => {
    const leaguesPerPx = MAP_WIDTH_LEAGUES / (canvasNaturalWidth * scale);
    const rawDistance = TARGET_BAR_PX * leaguesPerPx;
    const distance = pickNiceDistance(rawDistance);
    const barPx = distance / leaguesPerPx;
    return { barPx, distance };
  };

  /**
   * Rebuilds the bar segments and distance labels.
   * @param {number} barPx - Total bar width in screen pixels.
   * @param {number} distance - Total distance represented by the bar.
   * @private
   */
  #renderBar = (barPx, distance) => {
    const segmentPx = barPx / SEGMENT_COUNT;
    const segmentDistance = distance / SEGMENT_COUNT;

    this.barRow.style.setProperty("width", `${barPx}px`);

    this.barRow.innerHTML = Array.from(
      { length: SEGMENT_COUNT },
      () => `<div class="bar" style="width:${segmentPx}px"></div>`,
    ).join("");

    const labelValues = Array.from(
      { length: SEGMENT_COUNT + 1 },
      (_, i) => i * segmentDistance,
    );
    this.labelsRow.style.setProperty("width", `${barPx}px`);
    this.labelsRow.innerHTML = labelValues
      .map((v) => `<span class="label">${v}</span>`)
      .join("");
  };

  /**
   * Handles zoom-change events from map-canvas.
   * @param {CustomEvent} e
   * @private
   */
  #onZoomChange = (e) => {
    const { canvasNaturalWidth, scale } = e.detail;
    const { barPx, distance } = this.#computeScaleBar(
      canvasNaturalWidth,
      scale,
    );
    this.#renderBar(barPx, distance);
  };

  connectedCallback() {
    this.barRow = this.root.querySelector(".bar-row");
    this.labelsRow = this.root.querySelector(".labels");

    this.canvas = document.querySelector("map-canvas");
    this.canvas.addEventListener("zoom-change", this.#onZoomChange);
  }

  disconnectedCallback() {
    this.canvas.removeEventListener("zoom-change", this.#onZoomChange);
  }
}

customElements.define("map-scale", MapScale);
