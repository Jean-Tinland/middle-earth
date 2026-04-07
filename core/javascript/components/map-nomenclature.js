import template from "./map-nomenclature.template.js";
import styles from "./map-nomenclature.styles.js";

const STORAGE_KEY_CANON_ONLY = "map-canon-only";
const STORAGE_KEY_ILLUSTRATIONS = "map-illustrations";

export default class MapNomenclature extends HTMLElement {
  constructor() {
    super();

    this.root = this.attachShadow({ mode: "open" });

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

  #handleCanonOnlyChange = (e) => {
    const canonOnly = e.target.checked;
    localStorage.setItem(STORAGE_KEY_CANON_ONLY, String(canonOnly));
    this.dispatchEvent(
      new CustomEvent("poi-canon-only-change", {
        bubbles: true,
        composed: true,
        detail: { canonOnly },
      }),
    );
  };

  #handleIllustrationsChange = (e) => {
    const illustrationsEnabled = e.target.checked;
    localStorage.setItem(
      STORAGE_KEY_ILLUSTRATIONS,
      String(illustrationsEnabled),
    );
    this.dispatchEvent(
      new CustomEvent("poi-illustrations-change", {
        bubbles: true,
        composed: true,
        detail: { illustrationsEnabled },
      }),
    );
  };

  connectedCallback() {
    this.button = this.root.querySelector(".nomenclature-button");
    this.panel = this.root.querySelector(".panel");
    this.canonOnlyCheckbox = this.root.querySelector("#canon-only");
    this.illustrationsCheckbox = this.root.querySelector("#show-illustrations");

    this.canonOnlyCheckbox.checked =
      localStorage.getItem(STORAGE_KEY_CANON_ONLY) === "true";
    this.illustrationsCheckbox.checked =
      localStorage.getItem(STORAGE_KEY_ILLUSTRATIONS) !== "false";

    this.button.addEventListener("click", this.#toggle);
    this.canonOnlyCheckbox.addEventListener(
      "change",
      this.#handleCanonOnlyChange,
    );
    this.illustrationsCheckbox.addEventListener(
      "change",
      this.#handleIllustrationsChange,
    );
  }

  disconnectedCallback() {
    this.button.removeEventListener("click", this.#toggle);
    this.canonOnlyCheckbox?.removeEventListener(
      "change",
      this.#handleCanonOnlyChange,
    );
    this.illustrationsCheckbox?.removeEventListener(
      "change",
      this.#handleIllustrationsChange,
    );
    document.removeEventListener("click", this.#handleOutsideClick);
    document.removeEventListener("keydown", this.#handleKeyDown);
  }
}

customElements.define("map-nomenclature", MapNomenclature);
