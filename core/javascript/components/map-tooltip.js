import styles from "./map-tooltip.styles.js";

const OFFSET = 4;

/**
 * Represents a tooltip that can be displayed on a map.
 * @extends HTMLElement
 */
export default class MapTooltip extends HTMLElement {
  /**
   * Creates an instance of MapTooltip.
   * @param {HTMLElement} anchor - The element to which the tooltip is anchored.
   * @param {string} tooltip - The content of the tooltip.
   * @param {string} direction - The preferred direction of the tooltip (top, right, bottom, left).
   */
  constructor(anchor, tooltip, direction) {
    super();
    this.anchor = anchor;
    this.tooltip = tooltip;
    this.direction = direction;

    this.root = this.attachShadow({ mode: "closed" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = this.tooltip;
  }

  /**
   * Sets the position of the tooltip based on the anchor element and direction.
   * @private
   */
  #setPosition = () => {
    this.anchorBounds = this.anchor.getBoundingClientRect();
    const { width, height } = this.getBoundingClientRect();
    const defaultY = this.anchorBounds.y + this.anchorBounds.height + OFFSET;
    const defaultX =
      this.anchorBounds.x + this.anchorBounds.width / 2 - width / 2;

    const onRight = this.direction === "right" || defaultX < 0;
    const onLeft =
      this.direction === "left" || defaultX + width > window.innerWidth;
    const onTop =
      this.direction === "top" || defaultY + height > window.innerHeight;

    const anchorHalfHeight = this.anchorBounds.height / 2;

    if (onRight) {
      const left =
        window.scrollX + this.anchorBounds.x + this.anchorBounds.width + OFFSET;
      const top =
        window.scrollY + this.anchorBounds.y + anchorHalfHeight - height / 2;

      this.style.setProperty("left", `${left}px`);
      this.style.setProperty("top", `${top}px`);
    } else if (onLeft) {
      const left = window.scrollX + this.anchorBounds.x - width - OFFSET;
      const top =
        window.scrollY + this.anchorBounds.y + anchorHalfHeight - height / 2;

      this.style.setProperty("left", `${left}px`);
      this.style.setProperty("top", `${top}px`);
    } else if (onTop) {
      const left = window.scrollX + defaultX;
      const top = window.scrollY + this.anchorBounds.y - height - OFFSET;

      this.style.setProperty("left", `${left}px`);
      this.style.setProperty("top", `${top}px`);
    } else {
      this.style.setProperty("left", `${window.scrollX + defaultX}px`);
      this.style.setProperty("top", `${window.scrollY + defaultY}px`);
    }
  };

  /**
   * Called when the element is connected to the document's DOM.
   * Sets the position of the tooltip and starts a timeout to remove it after 10 seconds.
   */
  connectedCallback() {
    this.#setPosition();
    this.timeout = setTimeout(() => this.remove(), 10000);
  }

  /**
   * Called when the element is disconnected from the document's DOM.
   * Clears the timeout to prevent the tooltip from being removed.
   */
  disconnectedCallback() {
    clearTimeout(this.timeout);
  }
}

customElements.define("map-tooltip", MapTooltip);
