import styles from "./map-tooltip.styles.js";

const OFFSET = 4;

export default class MapTooltip extends HTMLElement {
  constructor(anchor, tooltip, direction) {
    super();
    this.anchor = anchor;
    this.tooltip = tooltip;
    this.direction = direction;

    this.root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = this.tooltip;
  }

  #setPosition = () => {
    const ab = this.anchor.getBoundingClientRect();
    const { width, height } = this.getBoundingClientRect();
    const defaultX = ab.x + ab.width / 2 - width / 2;
    const defaultY = ab.y + ab.height + OFFSET;
    const anchorMidY = ab.y + ab.height / 2 - height / 2;

    let left, top;

    if (this.direction === "right" || defaultX < 0) {
      left = ab.x + ab.width + OFFSET;
      top = anchorMidY;
    } else if (
      this.direction === "left" ||
      defaultX + width > window.innerWidth
    ) {
      left = ab.x - width - OFFSET;
      top = anchorMidY;
    } else if (
      this.direction === "top" ||
      defaultY + height > window.innerHeight
    ) {
      left = defaultX;
      top = ab.y - height - OFFSET;
    } else {
      left = defaultX;
      top = defaultY;
    }

    this.style.setProperty("left", `${window.scrollX + left}px`);
    this.style.setProperty("top", `${window.scrollY + top}px`);
  };

  connectedCallback() {
    this.#setPosition();
    this.timeout = setTimeout(() => this.remove(), 10000);
  }

  disconnectedCallback() {
    clearTimeout(this.timeout);
  }
}

customElements.define("map-tooltip", MapTooltip);
