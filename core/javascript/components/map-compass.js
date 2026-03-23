import styles from "./map-compass.styles.js";

/**
 * A compass rose button that reflects the current map rotation.
 * Clicking resets the map to north while preserving zoom and position.
 *
 * @extends HTMLElement
 */
export default class MapCompass extends HTMLElement {
  #rotation = 0;
  #roseElement = null;
  #buttonElement = null;

  constructor() {
    super();

    this.root = this.attachShadow({ mode: "open" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];

    this.root.innerHTML = /* html */ `
      <button is="map-button" class="compass" aria-label="Reset map to north" tooltip='Use "Shift" + drag to rotate'">
        <svg class="rose" viewBox="0 0 24 24" aria-hidden="true">
          <polygon class="north" points="12,3 14.5,13 12,11 9.5,13" />
          <polygon class="south" points="12,21 14.5,13 12,15 9.5,13" />
          <circle class="center-dot" cx="12" cy="12" r="1.5" />
        </svg>
      </button>
    `;
  }

  /**
   * Updates the compass needle to reflect the current map rotation.
   * @param {number} degrees - Current map rotation in degrees.
   */
  setRotation = (degrees) => {
    this.#rotation = degrees;
    if (!this.#roseElement) return;
    this.#roseElement.style.setProperty(
      "transform",
      `rotate(${-this.#rotation}deg)`,
    );
  };

  #handleClick = () => {
    const canvas = document.querySelector("map-canvas");
    canvas?.resetRotation();
  };

  connectedCallback() {
    this.#buttonElement = this.root.querySelector(".compass");
    this.#roseElement = this.root.querySelector(".rose");
    this.#buttonElement.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback() {
    this.#buttonElement?.removeEventListener("click", this.#handleClick);
  }
}

customElements.define("map-compass", MapCompass);
