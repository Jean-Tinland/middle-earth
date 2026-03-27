import MapTooltip from "./map-tooltip.js";

class MapButton extends HTMLButtonElement {
  #helpText = null;

  #createTooltip = () => {
    if (this.disabled) return;
    const tooltip = this.getAttribute("tooltip");
    if (!tooltip) return;
    this.#helpText = new MapTooltip(
      this,
      tooltip,
      this.getAttribute("direction"),
    );
    document.body.appendChild(this.#helpText);
  };

  #removeTooltip = () => {
    this.#helpText?.remove();
    this.#helpText = null;
  };

  connectedCallback() {
    this.addEventListener("mouseenter", this.#createTooltip);
    this.addEventListener("mouseleave", this.#removeTooltip);
    this.addEventListener("blur", this.#removeTooltip);
    this.addEventListener("click", this.#removeTooltip);
    window.addEventListener("scroll", this.#removeTooltip);
  }

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
