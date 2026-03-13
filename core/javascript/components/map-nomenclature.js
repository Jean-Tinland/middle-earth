import template from "./map-nomenclature.template.js";
import styles from "./map-nomenclature.styles.js";

export default class MapNomenclature extends HTMLElement {
  constructor() {
    super();

    this.root = this.attachShadow({ mode: "closed" });

    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  #toggle = () => {
    this.panel.hasAttribute("open") ? this.#close() : this.#open();
  };

  #open = () => {
    this.panel.setAttribute("open", "");
    this.button.setAttribute("aria-expanded", "true");
    setTimeout(() => {
      document.addEventListener("click", this.#handleOutsideClick);
      document.addEventListener("keydown", this.#handleKeyDown);
    }, 0);
  };

  #close = () => {
    this.panel.removeAttribute("open");
    this.button.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", this.#handleOutsideClick);
    document.removeEventListener("keydown", this.#handleKeyDown);
  };

  #handleOutsideClick = (e) => {
    if (e.composedPath().includes(this)) return;
    this.#close();
  };

  #handleKeyDown = (e) => {
    if (e.key === "Escape") this.#close();
  };

  connectedCallback() {
    this.button = this.root.querySelector(".nomenclature-button");
    this.panel = this.root.querySelector(".panel");
    this.button.addEventListener("click", this.#toggle);
  }

  disconnectedCallback() {
    this.button.removeEventListener("click", this.#toggle);
    document.removeEventListener("click", this.#handleOutsideClick);
    document.removeEventListener("keydown", this.#handleKeyDown);
  }
}

customElements.define("map-nomenclature", MapNomenclature);
