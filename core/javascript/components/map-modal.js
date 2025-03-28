import template from "./map-modal.template.js";
import styles from "./map-modal.styles.js";
import { renderIcon } from "../lib/icons.js";

const FOCUSABLE_ELEMENTS =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default class MapModal extends HTMLElement {
  constructor(options) {
    super();

    this.defaults = {
      width: undefined,
      height: undefined,
      icon: "",
      title: "",
      content: "",
      backdrop: false,
      closeButton: true,
    };

    this.options = Object.assign({}, this.defaults, options);

    this.root = this.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  close = () => {
    if (typeof this.options.onClose === "function") {
      this.options.onClose();
    }
    this.setAttribute("closing", "");
    setTimeout(() => {
      this.remove();
    }, 220);
  };

  #renderModalContent = () => {
    const title = this.options.icon.length
      ? `${renderIcon(this.options.icon, "modal__title-icon")} ${
          this.options.title
        }`
      : this.options.title;
    this.modalTitle.innerHTML = title;

    if (this.options.width) {
      this.modal.style.width = `${this.options.width}px`;
    }
    if (this.options.height) {
      this.modal.style.minHeight = `${this.options.height}px`;
    }
    typeof this.options.content === "object"
      ? this.modalContent.appendChild(this.options.content)
      : (this.modalContent.innerHTML = this.options.content);
  };

  #handleKeyPress = (e) => {
    if (e.key !== "Escape") return;
    const allModals = document.querySelectorAll("cms-modal");
    const isLastModal = allModals[allModals.length - 1];
    if (this !== isLastModal) return;
    this.close();
  };

  #focusModal = () => {
    document.activeElement.blur();
    const hasAutofocusElement = Boolean(this.root.querySelector("[autofocus]"));
    if (!hasAutofocusElement) {
      let elementToFocus = this.root.querySelector("[autofocus]");
      if (!elementToFocus) {
        [elementToFocus] = this.root.querySelectorAll(FOCUSABLE_ELEMENTS);
      }
      if (elementToFocus) {
        elementToFocus.focus();
      }
    }
  };

  #handleFocus = (e) => {
    const isTabPressed = e.key === "Tab" || e.keyCode === 9;
    if (!isTabPressed) return;

    if (e.shiftKey) {
      if (this.root.activeElement === this.firstFocusableElement) {
        this.lastFocusableElement.focus();
        e.preventDefault();
      }
    } else {
      if (this.root.activeElement === this.lastFocusableElement) {
        this.firstFocusableElement.focus();
        e.preventDefault();
      }
    }
  };

  connectedCallback() {
    this.modal = this.root.querySelector(".modal");
    this.closeButton = this.root.querySelector(".modal__close-button");
    this.backdrop = this.root.querySelector(".backdrop");
    this.modalTitle = this.root.querySelector(".modal__title");
    this.modalContent = this.root.querySelector(".modal__content");
    this.modalButtons = this.root.querySelector(".modal__buttons");

    document.body.style.setProperty("overflow", "hidden");

    this.#renderModalContent();

    this.focusableContent = this.root.querySelectorAll(FOCUSABLE_ELEMENTS);
    this.firstFocusableElement = this.focusableContent[0];
    this.lastFocusableElement =
      this.focusableContent[this.focusableContent.length - 1];

    this.options.closeButton
      ? this.closeButton.addEventListener("click", this.close)
      : this.closeButton.remove();

    if (this.options.backdrop) {
      this.backdrop.addEventListener("click", this.close);
    }

    document.addEventListener("keydown", this.#handleKeyPress);
    this.root.addEventListener("keydown", this.#handleFocus);

    this.#focusModal();
  }

  disconnectedCallback() {
    this.root.removeEventListener("keydown", this.#handleFocus);
    document.removeEventListener("keydown", this.#handleKeyPress);

    if (this.options.backdrop) {
      this.backdrop.removeEventListener("click", this.close);
    }
    if (this.options.closeButton) {
      this.closeButton.removeEventListener("click", this.close);
    }

    const otherModals = document.querySelectorAll("cms-modal");
    if (otherModals.length === 0) {
      document.body.style.removeProperty("overflow");
    }
  }
}

customElements.define("map-modal", MapModal);
