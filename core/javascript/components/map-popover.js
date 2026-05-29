import styles from "./map-popover.styles.js";
import { renderIcon } from "../lib/icons.js";

const OFFSET = 10;
const VIEWPORT_PADDING = 12;

const SEARCH_ENGINES = Object.freeze([
  {
    label: "LOTR Wiki",
    sources: ["Canon"],
    buildUrl: (encoded) =>
      `https://lotr.fandom.com/wiki/Special:Search?query=${encoded}&scope=internal&navigationSearch=true`,
  },
  {
    label: "Tolkien Gateway",
    sources: ["Canon"],
    buildUrl: (encoded) =>
      `https://tolkiengateway.net/w/index.php?fulltext=1&search=${encoded}&title=Special:Search&ns0=1`,
  },
  {
    label: "Notion Club Archives",
    sources: ["Canon", "MERP"],
    buildUrl: (encoded) =>
      `https://notionclubarchives.fandom.com/wiki/Special:Search?query=${encoded}&scope=internal&navigationSearch=true`,
  },
]);

const KINDS_LABELS = Object.freeze({
  region: "Region",
  forest: "Forest",
  mountain: "Mountain",
  "common-place": "Common Place",
  sea: "Sea",
  river: "River",
  city: "City",
  fortress: "Fortress",
  hamlet: "Hamlet",
});

export default class MapPopover extends HTMLElement {
  #clickX;
  #clickY;

  /** @type {boolean} Whether this popover has started closing. */
  isClosed = false;

  /**
   * @param {string} name - The POI name.
   * @param {string} kind - The POI kind (e.g. "city", "forest").
   * @param {string} source - The POI source (e.g. "Canon").
   * @param {number} clickX - Viewport X coordinate of the originating click.
   * @param {number} clickY - Viewport Y coordinate of the originating click.
   */
  constructor(name, kind, source, clickX, clickY) {
    super();

    this.#clickX = clickX;
    this.#clickY = clickY;

    this.root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];

    this.root.innerHTML = this.#buildTemplate(name, kind, source);
  }

  #buildSearchLinks = (name, source) => {
    const encoded = encodeURIComponent(name);
    const filteredEngines = SEARCH_ENGINES.filter(({ sources }) =>
      sources.includes(source),
    );
    return filteredEngines
      .map(({ label, buildUrl }, index) => {
        const separator = index < filteredEngines.length - 1 ? ",&nbsp;" : "";
        return `<a href="${buildUrl(encoded)}" class="search-link" target="_blank" rel="noopener noreferrer">${label}</a>${separator}`;
      })
      .join("");
  };

  #buildTemplate = (name, kind, source) => /* html */ `
    <div class="popover">
      <button class="close-button" aria-label="Close">
        ${renderIcon("close", "close-button-icon")}
      </button>
      <div class="name">${name} <span class="kind">(${KINDS_LABELS[kind] || kind})</span></div>
      <div class="source">Source: ${source}</div>
      <div class="search-label">Search on: ${this.#buildSearchLinks(name, source)}</div>
    </div>
  `;

  #position = () => {
    const { width, height } = this.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = this.#clickX - width / 2;
    let top = this.#clickY + OFFSET;

    if (left + width > vw - VIEWPORT_PADDING)
      left = vw - VIEWPORT_PADDING - width;
    if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

    if (top + height > vh - VIEWPORT_PADDING)
      top = this.#clickY - height - OFFSET;
    if (top < VIEWPORT_PADDING) top = VIEWPORT_PADDING;

    this.style.left = `${left}px`;
    this.style.top = `${top}px`;
  };

  close = () => {
    if (this.isClosed) return;
    this.isClosed = true;
    this.setAttribute("closing", "");
    setTimeout(() => this.remove(), 200);
  };

  #handleDocumentClick = (e) => {
    if (e.composedPath().includes(this)) return;
    this.close();
  };

  #handleKeyDown = (e) => {
    if (e.key === "Escape") this.close();
  };

  connectedCallback() {
    this.root
      .querySelector(".close-button")
      .addEventListener("click", this.close);
    document.addEventListener("keydown", this.#handleKeyDown);
    requestAnimationFrame(() => {
      this.#position();
      document.addEventListener("click", this.#handleDocumentClick);
    });
  }

  disconnectedCallback() {
    document.removeEventListener("click", this.#handleDocumentClick);
    document.removeEventListener("keydown", this.#handleKeyDown);
  }
}

customElements.define("map-popover", MapPopover);
