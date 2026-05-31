import styles from "./map-pois.styles.js";
import MapPopover from "./map-popover.js";

const BASE_FONT = 16;
const ILLUST_ZOOM = 13;
const ILLUST_MULT = 1.6;

const TEXT_MULT = Object.freeze({
  region: Object.freeze({ 1: 1.45, 2: 1.15, 3: 0.8, 4: 0.7 }),
  forest: Object.freeze({ 1: 0.95, 2: 0.8, 3: 0.65, 4: 0.55 }),
  mountain: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.45, 4: 0.4 }),
  "common-place": Object.freeze({ 1: 0.8, 2: 0.7, 3: 0.6, 4: 0.5 }),
  sea: Object.freeze({ 1: 0.8, 2: 0.7, 3: 0.55, 4: 0.45 }),
  city: Object.freeze({ 1: 0.65, 2: 0.55, 3: 0.45, 4: 0.4 }),
  fortress: Object.freeze({ 1: 0.65, 2: 0.55, 3: 0.45, 4: 0.4 }),
  hamlet: Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.4, 4: 0.4 }),
  river: Object.freeze({ 1: 0.75, 2: 0.65, 3: 0.55 }),
});

const DOT_MULT = Object.freeze({ 1: 0.6, 2: 0.5, 3: 0.4, 4: 0.3 });

/**
 * Memory-optimised POI renderer.
 *
 * Design goals:
 * - SoA (Structure of Arrays) layout: per-POI data stored in parallel typed
 *   arrays instead of per-POI objects. This reduces GC pressure from hundreds
 *   of small objects and keeps hot iteration paths cache-friendly.
 * - Minimal DOM touches: only toggle `hidden` and style properties on actual
 *   visibility/size changes.
 * - Single shared popover instance.
 */
export default class MapPois extends HTMLElement {
  #version = document.documentElement.dataset.buildVersion || "0";

  /** @type {HTMLElement[]} POI root divs */
  #els;
  /** @type {HTMLElement[]} Name divs */
  #names;
  /** @type {(HTMLElement|null)[]} Dot divs (cities/hamlets only) */
  #dots;
  /** @type {(HTMLImageElement|null)[]} Illustration images */
  #illusts;
  /** @type {Float32Array} Text size multiplier per POI */
  #textMult;
  /** @type {Float32Array} Dot size multiplier per POI (0 if none) */
  #dotMult;
  /** @type {Uint8Array} Flags: bit0=isCanon, bit1=hasIllustration */
  #flags;
  /** @type {string[]} POI names */
  #poiNames;
  /** @type {string[]} POI kinds */
  #poiKinds;
  /** @type {string[]} POI custom kind labels (if any) */
  #poiCustomKindLabels;
  /** @type {number[]} POI sizes */
  #poiSizes;
  /** @type {string[]} POI sources */
  #poiSources;

  /** @type {Map<number, number[]>} zoom → array of indices */
  #buckets = new Map();
  /** @type {number[]} Sorted zoom thresholds */
  #thresholds = [];
  /** @type {number[]} Indices of POIs with illustrations */
  #illustIndices = [];

  #lastZoom = -1;
  #lastFont = -1;
  #lastIllustMode = false;
  #lastCanon = false;
  #canonOnly = false;
  #illustEnabled = true;
  #curZoom = 0;
  #curFont = 0;
  #curIllustZoom = 0;

  /** @type {MapPopover|null} */
  #popover = null;
  /** @type {HTMLElement|null} */
  #popoverAnchor = null;

  // Bit flags
  static #CANON = 1;
  static #HAS_ILLUST = 2;

  constructor(pois) {
    super();
    this.root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];

    this.#build(pois);
    this.render(0);
  }

  #build(pois) {
    const n = pois.length;
    this.#els = new Array(n);
    this.#names = new Array(n);
    this.#dots = new Array(n);
    this.#illusts = new Array(n);
    this.#textMult = new Float32Array(n);
    this.#dotMult = new Float32Array(n);
    this.#flags = new Uint8Array(n);
    this.#poiNames = new Array(n);
    this.#poiKinds = new Array(n);
    this.#poiCustomKindLabels = new Array(n);
    this.#poiSizes = new Array(n);
    this.#poiSources = new Array(n);

    const frag = document.createDocumentFragment();

    for (let i = 0; i < n; i++) {
      const p = pois[i];
      const {
        name,
        kind,
        position,
        size,
        zoom,
        illustration,
        source,
        customKindLabel,
      } = p;

      this.#poiNames[i] = name;
      this.#poiKinds[i] = kind;
      this.#poiCustomKindLabels[i] = customKindLabel;
      this.#poiSizes[i] = size;
      this.#poiSources[i] = source;
      this.#textMult[i] = TEXT_MULT[kind]?.[size] ?? 1;
      this.#dotMult[i] =
        kind === "city" || kind === "hamlet" || kind === "fortress"
          ? (DOT_MULT[size] ?? 0.3)
          : 0;

      let flags = 0;
      if (source === "Canon") flags |= MapPois.#CANON;
      if (illustration) flags |= MapPois.#HAS_ILLUST;
      this.#flags[i] = flags;

      // DOM
      const el = document.createElement("div");
      el.className = "poi";
      el.hidden = true;
      el.style.cssText = `top:${position[1]}%;left:${position[0]}%;`;
      el.dataset.kind = kind;
      el.dataset.size = size;

      let dot = null;
      if (kind === "city" || kind === "hamlet" || kind === "fortress") {
        dot = document.createElement("div");
        dot.className = "dot";
        el.appendChild(dot);
      }
      this.#dots[i] = dot;

      let illust = null;
      if (illustration) {
        illust = document.createElement("img");
        illust.className = "illustration";
        illust.src = `${illustration}?v=${this.#version}`;
        illust.alt = name;
        illust.hidden = true;
        illust.loading = "lazy";
        el.appendChild(illust);
        this.#illustIndices.push(i);
      }
      this.#illusts[i] = illust;

      const nameEl = document.createElement("div");
      nameEl.className = "name";
      nameEl.textContent = name;
      el.appendChild(nameEl);
      this.#names[i] = nameEl;
      this.#els[i] = el;

      // Bucket
      let bucket = this.#buckets.get(zoom);
      if (bucket) {
        bucket.push(i);
      } else {
        this.#buckets.set(zoom, [i]);
      }

      frag.appendChild(el);
    }

    this.#thresholds = [...this.#buckets.keys()].sort((a, b) => a - b);

    // Delegated click handler: one listener for all POIs
    this.root.appendChild(frag);
    this.root.addEventListener("click", this.#onClick);
  }

  #onClick = (e) => {
    const poiEl = e.target.closest(".poi");
    if (!poiEl) return;

    // Find index: we search the array since clicks are infrequent
    const idx = this.#els.indexOf(poiEl);
    if (idx < 0) return;

    this.#openPopover(idx, e);
  };

  #openPopover(idx, event) {
    if (this.#popover && !this.#popover.isClosed) {
      const same = this.#popoverAnchor === this.#els[idx];
      this.#popover.close();
      this.#popover = null;
      this.#popoverAnchor = null;
      if (same) return;
    }

    const el = this.#els[idx];
    const rect = el.getBoundingClientRect();
    const fx = rect.left + rect.width / 2;
    const fy = rect.top + rect.height / 2;
    const usePtr =
      Number.isFinite(event?.clientX) &&
      Number.isFinite(event?.clientY) &&
      event.detail > 0;
    const cx = usePtr ? event.clientX : fx;
    const cy = usePtr ? event.clientY : fy;

    const pop = new MapPopover(
      this.#poiNames[idx],
      this.#poiKinds[idx],
      this.#poiCustomKindLabels[idx],
      this.#poiSizes[idx],
      this.#poiSources[idx],
      cx,
      cy,
    );
    document.body.appendChild(pop);
    this.#popover = pop;
    this.#popoverAnchor = el;
  }

  #px = (v) => Math.max(1, Math.round(v));

  #resolveFont(raw) {
    if (Number.isFinite(raw) && raw > 0) return raw;
    const css = Number.parseFloat(
      getComputedStyle(this).getPropertyValue("--font-size-ref"),
    );
    return Number.isFinite(css) && css > 0 ? css : BASE_FONT;
  }

  #applySizes(idx, font) {
    const ts = this.#px(font * this.#textMult[idx]);
    this.#names[idx].style.fontSize = `${ts}px`;

    const ill = this.#illusts[idx];
    if (ill) ill.style.width = `${this.#px(font * ILLUST_MULT)}px`;

    if (this.#dotMult[idx] > 0) {
      const ds = this.#px(font * this.#dotMult[idx]);
      const dot = this.#dots[idx];
      dot.style.width = `${ds}px`;
      dot.style.height = `${ds}px`;
    }
  }

  #applyIllustMode(idx, show) {
    if (this.#dots[idx]) this.#dots[idx].hidden = show;
    this.#illusts[idx].hidden = !show;
  }

  render(zoom, baseFontSize, illustrationZoom = zoom) {
    const font = this.#resolveFont(baseFontSize);
    const sizeDirty = this.#lastFont !== font;
    const illustMode = this.#illustEnabled && illustrationZoom >= ILLUST_ZOOM;
    const illustChanged = illustMode !== this.#lastIllustMode;
    const canonDirty = this.#canonOnly !== this.#lastCanon;
    const prevZoom = this.#lastZoom;

    for (let t = 0, tlen = this.#thresholds.length; t < tlen; t++) {
      const thresh = this.#thresholds[t];
      const wasVis = thresh <= prevZoom;
      const isVis = thresh <= zoom;
      if (isVis === wasVis && !(isVis && (sizeDirty || canonDirty))) continue;

      const bucket = this.#buckets.get(thresh);
      for (let b = 0, blen = bucket.length; b < blen; b++) {
        const idx = bucket[b];
        const f = this.#flags[idx];
        const okNow = !this.#canonOnly || f & MapPois.#CANON;
        const okBefore = !this.#lastCanon || f & MapPois.#CANON;
        const show = isVis && okNow;
        const wasShowing = wasVis && okBefore;

        if (show && !wasShowing) {
          this.#applySizes(idx, font);
          if (f & MapPois.#HAS_ILLUST) this.#applyIllustMode(idx, illustMode);
          this.#els[idx].hidden = false;
        } else if (!show && wasShowing) {
          this.#els[idx].hidden = true;
        } else if (show && sizeDirty) {
          this.#applySizes(idx, font);
        }
      }
    }

    if (illustChanged) {
      for (let i = 0, ilen = this.#illustIndices.length; i < ilen; i++) {
        const idx = this.#illustIndices[i];
        if (!this.#els[idx].hidden) this.#applyIllustMode(idx, illustMode);
      }
    }

    this.#lastFont = font;
    this.#lastZoom = zoom;
    this.#lastIllustMode = illustMode;
    this.#lastCanon = this.#canonOnly;
    this.#curZoom = zoom;
    this.#curFont = baseFontSize;
    this.#curIllustZoom = illustrationZoom;
  }

  setCanonOnly(v) {
    if (this.#canonOnly === v) return;
    this.#canonOnly = v;
    this.render(this.#curZoom, this.#curFont, this.#curIllustZoom);
  }

  setIllustrationsEnabled(v) {
    if (this.#illustEnabled === v) return;
    this.#illustEnabled = v;
    this.render(this.#curZoom, this.#curFont, this.#curIllustZoom);
  }

  setRotation(degrees) {
    this.style.setProperty("--poi-rotation", `${-degrees}deg`);
    this.style.setProperty("--illustration-rotation", `${degrees}deg`);
  }
}

customElements.define("map-pois", MapPois);
