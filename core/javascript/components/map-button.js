import MapTooltip from "./map-tooltip.js";

/**
 * @class MapButton
 * @extends {HTMLButtonElement}
 * @classdesc A custom button element that displays a tooltip on hover.
 */
class MapButton extends HTMLButtonElement {
  /**
   * Creates an instance of MapButton.
   */
  constructor() {
    super();
    this.tooltip = null;
    this.direction = null;
    this.helpText = null;
  }

  /**
   * Creates and displays the tooltip.
   * @private
   */
  #createTooltip = () => {
    this.disabled = this.getAttribute("disabled") !== null;
    if (this.disabled) return;
    this.tooltip = this.getAttribute("tooltip");
    this.direction = this.getAttribute("direction");
    if (this.tooltip === null) return;
    const tooltip = new MapTooltip(this, this.tooltip, this.direction);
    this.helpText = tooltip;
    document.body.appendChild(this.helpText);
  };

  /**
   * Removes the tooltip.
   * @private
   */
  #removeTooltip = () => {
    if (!this.tooltip || !this.helpText) return;
    try {
      this.helpText.remove();
      this.helpText = undefined;
    } catch (e) {}
  };

  /**
   * Called when the element is connected to the document's DOM.
   * Adds event listeners for tooltip creation and removal.
   */
  connectedCallback() {
    this.addEventListener("mouseenter", this.#createTooltip);
    this.addEventListener("mouseleave", this.#removeTooltip);
    this.addEventListener("blur", this.#removeTooltip);
    this.addEventListener("click", this.#removeTooltip);
    window.addEventListener("scroll", this.#removeTooltip);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   * Removes event listeners for tooltip creation and removal.
   */
  disconnectedCallback() {
    window.removeEventListener("scroll", this.#removeTooltip);
    this.removeEventListener("click", this.#removeTooltip);
    this.removeEventListener("blur", this.#removeTooltip);
    this.removeEventListener("mouseleave", this.#removeTooltip);
    this.removeEventListener("mouseenter", this.#createTooltip);
  }
}

customElements.define("map-button", MapButton, { extends: "button" });

export default MapButton;
