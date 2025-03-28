import template, { content } from "./map-information.template.js";
import styles from "./map-information.styles.js";
import MapModal from "./map-modal.js";

/**
 * Represents a custom HTML element for map points of interest.
 * @extends HTMLElement
 */
export default class MapInformation extends HTMLElement {
  /**
   * Creates an instance of MapInformation.
   */
  constructor() {
    super();

    this.root = this.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  #openModal = () => {
    const modal = new MapModal({
      icon: "question",
      title: "Information & credits",
      content,
    });
    document.body.appendChild(modal);
  };

  connectedCallback() {
    this.button = this.root.querySelector(".information");

    this.button.addEventListener("click", this.#openModal);
  }

  disconnectedCallback() {
    this.button.removeEventListener("click", this.#openModal);
  }
}

customElements.define("map-information", MapInformation);
