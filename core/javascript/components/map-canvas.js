import "./map-button.js";
import "./map-compass.js";
import "./map-controls.js";
import "./map-information.js";
import "./map-nomenclature.js";
import "./map-scale.js";
import MapPois from "./map-pois.js";
import template from "./map-canvas.template.js";
import styles from "./map-canvas.styles.js";
import TileManager, { MAX_TILE_ZOOM } from "../lib/tile-manager.js";

const BASE_W = 1900;
const BASE_H = 1300;
const ZOOM_STEPS = 26;
const MAX_SCALE = 24;
const MOBILE_EXTRA_STEPS = 9;
const MOBILE_MAX_SCALE = 48;
const WHEEL_THRESHOLD = 100;
const ZOOM_MS = 120;
const TILE_DEBOUNCE_IN = 600;
const TILE_DEBOUNCE_OUT = 150;
const ROTATION_SPEED = 0.3;
const PINCH_ENGAGE_DEG = 7;
const TX_EPS = 0.01;
const FONT_BASE = 12;
const FONT_LOCK = 8;
const PORTRAIT_FONT_MIN = 0.65;
const POI_REF_H = 900;
const URL_DEBOUNCE = 400;
const STORAGE_KEY_CANON_ONLY = "map-canon-only";
const STORAGE_KEY_ILLUSTRATIONS = "map-illustrations";

const tileZoomFor = (level, steps) =>
  Math.min(MAX_TILE_ZOOM, Math.round((level * MAX_TILE_ZOOM) / steps));

const scaleFor = (level, steps = ZOOM_STEPS, max = MAX_SCALE) => {
  if (level <= 0) return 1;
  if (level >= steps) return max;
  return max ** (level / steps);
};

export default class MapCanvas extends HTMLElement {
  constructor() {
    super();

    // Zoom state
    this.zoomLevel = 0;
    this.zoom = 0;
    this.scale = 1;
    this.rotation = 0;

    // Pan state
    this.tx = 0;
    this.ty = 0;

    // Sizing
    this.natW = 0;
    this.natH = 0;

    // Steps/scale (overridden for mobile)
    this.steps = ZOOM_STEPS;
    this.maxScale = MAX_SCALE;

    // Font
    this.fontRef = FONT_BASE;

    // Touch tracking
    /** @type {{x:number,y:number}|null} */
    this.prevTouch = null;
    this.touchMoved = false;
    this.dragging = false;
    this.mouseMoved = false;
    this.suppressPoiClick = false;

    // Pinch state
    this.pinching = false;
    this.pinchDist = 0;
    this.pinchLevel = 0;
    /** @type {{x:number,y:number}|null} */
    this.pinchFocal = null;
    this.pinchAngle = 0;
    this.pinchRotating = false;
    this.pinchAngleDelta = 0;

    // Wheel
    this.wheelAcc = 0;

    // RAF/timer IDs
    this.dragRaf = 0;
    this.resizeRaf = 0;
    this.transTimer = 0;
    this.urlTimer = 0;

    // Pending drag deltas
    this.pdx = 0;
    this.pdy = 0;

    // References
    /** @type {TileManager|null} */
    this.tiles = null;
    /** @type {MapPois|null} */
    this.mapPois = null;
    this.maxPoiZoom = 0;
    /** @type {HTMLElement|null} */
    this.mapCompass = null;

    // Shadow DOM
    this.root = this.attachShadow({ mode: "open" });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
    this.root.adoptedStyleSheets = [sheet];
    this.root.innerHTML = template();
  }

  #cw = () => Math.round(this.natW * this.scale);
  #ch = () => Math.round(this.natH * this.scale);

  #syncTileSize = () => {
    if (!this.tiles) return;
    this.tiles.canvasWidth = this.#cw();
    this.tiles.canvasHeight = this.#ch();
  };

  #measure = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const fit = Math.min(vw / BASE_W, vh / BASE_H);
    this.natW = Math.max(1, Math.floor(BASE_W * fit));
    this.natH = Math.max(1, Math.floor(BASE_H * fit));
  };

  #applySize = () => {
    const w = this.#cw();
    const h = this.#ch();
    const cs = this.canvas.style;
    cs.maxWidth = "none";
    cs.maxHeight = "none";
    cs.width = `${w}px`;
    cs.height = `${h}px`;
    const ms = this.map.style;
    ms.width = `${w}px`;
    ms.height = `${h}px`;
  };

  #applyTransform = () => {
    this.canvas.style.transform = `translate(${this.tx}px,${this.ty}px) rotate(${this.rotation}deg)`;
  };

  #clampBounds = () => {
    const w = this.#cw();
    const h = this.#ch();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const l = (vw - w) / 2 + this.tx;
    const t = (vh - h) / 2 + this.ty;
    if (l > 0) this.tx -= l;
    if (t > 0) this.ty -= t;
    if (l + w < vw) this.tx += vw - (l + w);
    if (t + h < vh) this.ty += vh - (t + h);
  };

  #portraitScalar = () => {
    const ar = window.innerWidth / window.innerHeight;
    return Math.max(PORTRAIT_FONT_MIN, Math.min(1, ar));
  };

  #updateFont = () => {
    const div = this.zoom === 0 ? 1.5 : 2;
    const eff = Math.min(this.scale, FONT_LOCK);
    this.fontRef =
      (FONT_BASE / (eff / div)) * this.scale * this.#portraitScalar();
    this.canvas.style.setProperty(
      "--font-size-ref",
      `${this.fontRef.toFixed(2)}px`,
    );
  };

  #poiZoomOffset = () => {
    const refW = Math.floor(BASE_W * (POI_REF_H / BASE_H));
    if (this.natW >= refW) return 0;
    const raw = Math.floor(
      (this.steps * Math.log(refW / this.natW)) / Math.log(this.maxScale),
    );
    const cap = Math.max(0, this.steps - 1 - this.maxPoiZoom);
    return Math.min(raw, cap);
  };

  #poiFont = () =>
    this.scale <= MAX_SCALE
      ? this.fontRef
      : this.fontRef * (MAX_SCALE / this.scale);

  #renderPois = () => {
    if (!this.mapPois) return;
    const eff = Math.max(0, this.zoomLevel - this.#poiZoomOffset());
    this.mapPois.render(eff, this.#poiFont(), this.zoomLevel);
  };

  #updateControls = () => {
    const c = this.controls;
    if (!c?.zoomInButton || !c?.zoomOutButton) return;
    c.zoomOutButton.disabled = this.zoomLevel === 0;
    c.zoomInButton.disabled = this.zoomLevel === this.steps;
  };

  #rotateAroundCenter = (deg) => {
    const rad = (deg * Math.PI) / 180;
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    const ox = this.tx;
    const oy = this.ty;
    this.tx = ox * c - oy * s;
    this.ty = ox * s + oy * c;
    this.rotation += deg;
  };

  #notifyRotation = () => {
    this.mapCompass?.setRotation(this.rotation);
    this.mapPois?.setRotation(this.rotation);
  };

  resetRotation = () => {
    let n = ((this.rotation % 360) + 360) % 360;
    if (n > 180) n -= 360;
    if (Math.abs(n) < 0.01) return;

    this.rotation = n;
    this.canvas.style.transition = "none";
    this.canvas.getBoundingClientRect();
    this.#applyTransform();

    this.#prepTransition();
    this.#rotateAroundCenter(-n);
    this.rotation = 0;
    this.#applyTransform();
    this.#scheduleTransCleanup();
    this.#scheduleUrlUpdate();
    this.#notifyRotation();
  };

  #prepTransition = () => {
    clearTimeout(this.transTimer);
    this.canvas.style.transition = "none";
    this.canvas.getBoundingClientRect(); // force reflow
    this.canvas.style.transition = `transform ${ZOOM_MS}ms var(--transition-easing)`;
  };

  #scheduleTransCleanup = () => {
    clearTimeout(this.transTimer);
    this.transTimer = setTimeout(() => {
      this.canvas.style.removeProperty("transition");
      this.tiles?.checkLayerHandoff();
      this.transTimer = 0;
    }, ZOOM_MS);
  };

  #adjustTranslate = (oldScale, focal) => {
    const vpx = window.innerWidth / 2;
    const vpy = window.innerHeight / 2;
    const ow = Math.round(this.natW * oldScale);
    const oh = Math.round(this.natH * oldScale);
    const nw = this.#cw();
    const nh = this.#ch();

    const mx = focal.x - (vpx + this.tx - ow / 2);
    const my = focal.y - (vpy + this.ty - oh / 2);
    const nmx = (mx / ow) * nw;
    const nmy = (my / oh) * nh;

    this.tx += mx - nmx + (nw - ow) / 2;
    this.ty += my - nmy + (nh - oh) / 2;
  };

  #applyZoom = (target, focal, animate = false) => {
    const oldScale = this.scale;
    const oldTx = this.tx;
    const oldTy = this.ty;
    const oldW = this.#cw();
    const oldH = this.#ch();
    const prevLevel = this.zoomLevel;
    const prevTileZoom = this.zoom;

    this.zoomLevel = Math.max(0, Math.min(target, this.steps));
    this.scale = scaleFor(this.zoomLevel, this.steps, this.maxScale);
    this.zoom = tileZoomFor(this.zoomLevel, this.steps);

    this.#applySize();
    this.#syncTileSize();

    const tileZoomChanged = this.zoom !== prevTileZoom;

    if (tileZoomChanged) {
      this.tiles.installBackdrop(oldW, oldH, this.#cw());
      this.tiles.resetLayers();
    } else if (!this.tiles.resizeActiveLayer()) {
      // No active layer (e.g. stolen for backdrop during rapid zoom):
      // just rescale the existing backdrop if present.
      if (this.tiles.hasBackdrop) {
        this.tiles.installBackdrop(oldW, oldH, this.#cw());
      }
    }

    this.#adjustTranslate(oldScale, focal);
    this.#updateFont();
    this.#renderPois();

    if (this.zoomLevel === 0) {
      this.tx = 0;
      this.ty = 0;
      this.prevTouch = null;
    } else {
      this.#clampBounds();
    }

    if (animate) {
      // Set old transform, then transition to new
      const sf = oldScale / this.scale;
      this.canvas.style.transform = `translate(${oldTx}px,${oldTy}px) rotate(${this.rotation}deg) scale(${sf})`;
      this.canvas.getBoundingClientRect();
      this.canvas.style.transition = `transform ${ZOOM_MS}ms var(--transition-easing)`;
      this.#applyTransform();
      this.#scheduleTransCleanup();
    } else {
      this.#applyTransform();
    }

    this.#updateControls();
    this.#scheduleUrlUpdate();
    this.#dispatchZoom();

    if (tileZoomChanged || this.tiles.activeTileZoom !== this.zoom) {
      this.tiles.scheduleTileLoad(
        this.zoom,
        target < prevLevel ? TILE_DEBOUNCE_OUT : TILE_DEBOUNCE_IN,
      );
    }
  };

  #focal = (e) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    if (!e || e.type === "click") return { x: cx, y: cy };
    if (Number.isFinite(e.clientX) && Number.isFinite(e.clientY))
      return { x: e.clientX, y: e.clientY };
    return { x: cx, y: cy };
  };

  zoomIn = (e) => {
    if (this.zoomLevel >= this.steps) return;
    e.preventDefault();
    clearTimeout(this.transTimer);
    this.transTimer = 0;
    this.canvas.style.removeProperty("transition");
    this.#applyZoom(this.zoomLevel + 1, this.#focal(e), true);
  };

  zoomOut = (e) => {
    if (this.zoomLevel <= 0) return;
    e.preventDefault();
    clearTimeout(this.transTimer);
    this.transTimer = 0;
    this.canvas.style.removeProperty("transition");
    this.#applyZoom(this.zoomLevel - 1, this.#focal(e), true);
  };

  #dispatchZoom = () => {
    this.dispatchEvent(
      new CustomEvent("zoom-change", {
        bubbles: false,
        detail: { canvasNaturalWidth: this.natW, scale: this.scale },
      }),
    );
  };

  #reset = () => {
    clearTimeout(this.transTimer);
    this.transTimer = 0;
    this.tiles.cancelPendingLoad();
    this.canvas.style.removeProperty("transition");
    this.tiles.removeBackdrop();

    this.zoomLevel = 0;
    this.zoom = 0;
    this.scale = 1;
    this.rotation = 0;
    this.tx = 0;
    this.ty = 0;
    this.prevTouch = null;

    this.#applySize();
    this.#syncTileSize();
    this.tiles.resetLayers();
    this.#updateFont();
    this.tiles.renderTiles(0);
    this.#renderPois();
    this.#updateControls();
    this.#applyTransform();
    this.#scheduleUrlUpdate();
    this.#dispatchZoom();
    this.#notifyRotation();
  };

  #flushDrag = () => {
    if (this.pdx === 0 && this.pdy === 0) return;
    this.tx += this.pdx;
    this.ty += this.pdy;
    this.pdx = 0;
    this.pdy = 0;
    this.#applyTransform();
  };

  #onMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.dragging = true;
    this.mouseMoved = false;
    this.suppressPoiClick = false;
    clearTimeout(this.transTimer);
    this.canvas.addEventListener("pointermove", this.#onDrag);
    this.canvas.style.cursor = "grabbing";
    this.canvas.style.transition = "none";
  };

  #onCanvasClickCapture = (e) => {
    if (!this.suppressPoiClick) return;
    this.suppressPoiClick = false;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  #onMouseUp = (e) => {
    if (!this.dragging) return;
    this.dragging = false;
    const wasPinch = this.pinching;
    this.pinching = false;
    const isTouch = e.type === "touchend";
    const isMouseUp = e.type === "mouseup";
    if (isMouseUp) {
      this.suppressPoiClick = this.mouseMoved;
      this.mouseMoved = false;
    }
    if (!isTouch || this.touchMoved || wasPinch) {
      e.preventDefault();
      e.stopPropagation();
    }

    this.canvas.removeEventListener("pointermove", this.#onDrag);
    this.canvas.style.removeProperty("cursor");
    this.canvas.style.removeProperty("transition");

    if (this.dragRaf) {
      cancelAnimationFrame(this.dragRaf);
      this.dragRaf = 0;
      this.pdx = 0;
      this.pdy = 0;
    }

    this.prevTouch = null;
    this.touchMoved = false;

    if (this.zoomLevel === 0) {
      const snapped = Math.abs(this.tx) > TX_EPS || Math.abs(this.ty) > TX_EPS;
      this.tx = 0;
      this.ty = 0;
      this.#updateControls();
      if (snapped) {
        this.#prepTransition();
        this.#applyTransform();
        this.#scheduleTransCleanup();
      } else {
        this.#applyTransform();
      }
      this.#scheduleUrlUpdate();
      return;
    }

    const otx = this.tx;
    const oty = this.ty;
    this.#clampBounds();
    if (Math.abs(this.tx - otx) > TX_EPS || Math.abs(this.ty - oty) > TX_EPS) {
      this.#prepTransition();
      this.#applyTransform();
      this.#scheduleTransCleanup();
    } else {
      this.#applyTransform();
    }
    this.#scheduleUrlUpdate();
  };

  #onDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "touchmove") {
      this.canvas.style.transition = "none";

      if (this.pinching || e.touches.length === 2) {
        if (!this.pinching) this.#initPinch(e);
        this.touchMoved = true;
        this.#pinchMove(e);
        return;
      }

      const t = e.touches[0];
      e.movementX = this.prevTouch ? t.clientX - this.prevTouch.x : 0;
      e.movementY = this.prevTouch ? t.clientY - this.prevTouch.y : 0;

      if (e.movementX !== 0 || e.movementY !== 0) this.touchMoved = true;

      if (this.prevTouch) {
        this.prevTouch.x = t.clientX;
        this.prevTouch.y = t.clientY;
      } else {
        this.prevTouch = { x: t.clientX, y: t.clientY };
      }
    }

    if (e.type !== "touchmove" && (e.movementX !== 0 || e.movementY !== 0)) {
      this.mouseMoved = true;
    }

    if (e.shiftKey && !this.pinching) {
      this.#rotateAroundCenter((e.movementY - e.movementX) * ROTATION_SPEED);
      this.#applyTransform();
      this.#notifyRotation();
      return;
    }

    this.pdx += e.movementX;
    this.pdy += e.movementY;

    if (this.dragRaf) return;
    this.#flushDrag();
    this.dragRaf = requestAnimationFrame(() => {
      this.dragRaf = 0;
      this.#flushDrag();
    });
  };

  #onTouchStart = (e) => {
    clearTimeout(this.transTimer);
    this.canvas.style.transition = "none";
    this.suppressPoiClick = false;

    if (e.touches.length === 2) {
      e.preventDefault();
      this.touchMoved = true;
      this.dragging = false;
      this.prevTouch = null;
      this.#initPinch(e);
      return;
    }

    if (e.touches.length !== 1) return;
    this.touchMoved = false;
    this.pinching = false;
    this.dragging = true;
    const t = e.touches[0];
    if (this.prevTouch) {
      this.prevTouch.x = t.clientX;
      this.prevTouch.y = t.clientY;
    } else {
      this.prevTouch = { x: t.clientX, y: t.clientY };
    }
  };

  #touchAngle = (a, b) =>
    Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * (180 / Math.PI);

  #initPinch = (e) => {
    const a = e.touches[0];
    const b = e.touches[1];
    this.pinching = true;
    this.dragging = true;
    this.pinchDist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    this.pinchLevel = this.zoomLevel;
    this.pinchFocal = {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
    };
    this.pinchAngle = this.#touchAngle(a, b);
    this.pinchRotating = false;
    this.pinchAngleDelta = 0;
  };

  #pinchMove = (e) => {
    if (e.touches.length !== 2 || this.pinchDist === 0) return;
    const a = e.touches[0];
    const b = e.touches[1];

    const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    const ratio = dist / this.pinchDist;
    const delta = Math.round(
      (Math.log(ratio) * this.steps) / Math.log(this.maxScale),
    );
    const target = Math.max(0, Math.min(this.steps, this.pinchLevel + delta));
    const zoomed = target !== this.zoomLevel;
    if (zoomed) this.#applyZoom(target, this.pinchFocal);

    const ang = this.#touchAngle(a, b);
    let adelta = ang - this.pinchAngle;
    if (adelta > 180) adelta -= 360;
    if (adelta < -180) adelta += 360;
    this.pinchAngle = ang;

    if (!this.pinchRotating) {
      if (zoomed) {
        this.pinchAngleDelta = 0;
      } else {
        this.pinchAngleDelta += adelta;
        if (Math.abs(this.pinchAngleDelta) >= PINCH_ENGAGE_DEG) {
          this.pinchRotating = true;
          this.#rotateAroundCenter(this.pinchAngleDelta);
          this.#applyTransform();
          this.#notifyRotation();
        }
      }
    } else if (Math.abs(adelta) > 0.1) {
      this.#rotateAroundCenter(adelta);
      this.#applyTransform();
      this.#notifyRotation();
    }
  };

  #onWheel = (e) => {
    this.wheelAcc += e.deltaY;
    if (Math.abs(this.wheelAcc) < WHEEL_THRESHOLD) return;
    const steps = Math.trunc(this.wheelAcc / WHEEL_THRESHOLD);
    this.wheelAcc -= steps * WHEEL_THRESHOLD;
    clearTimeout(this.transTimer);
    this.transTimer = 0;
    this.canvas.style.removeProperty("transition");
    if (steps > 0) this.zoomOut(e);
    else this.zoomIn(e);
  };

  #onDblClick = (e) => {
    if (e.shiftKey) this.zoomOut(e);
    else this.zoomIn(e);
  };

  #onResize = () => {
    if (this.resizeRaf) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = 0;
      this.tiles.cancelPendingLoad();
      const pw = this.natW;
      const ph = this.natH;
      this.#measure();
      if (pw !== this.natW || ph !== this.natH) {
        this.tiles.removeBackdrop();
        this.tiles.resetLayers();
      }
      this.#applySize();
      this.#syncTileSize();
      this.tiles.renderTiles(this.zoom);
      if (this.zoomLevel === 0) return this.#reset();
      this.#clampBounds();
      this.#applyTransform();
      this.#dispatchZoom();
    });
  };

  #centerFractions = () => {
    const w = this.#cw();
    const h = this.#ch();
    if (w === 0 || h === 0) return null;
    return { x: 0.5 - this.tx / w, y: 0.5 - this.ty / h };
  };

  #scheduleUrlUpdate = () => {
    clearTimeout(this.urlTimer);
    this.urlTimer = setTimeout(this.#commitUrl, URL_DEBOUNCE);
  };

  #commitUrl = () => {
    this.urlTimer = 0;
    const p = new URLSearchParams(window.location.search);
    if (this.zoomLevel === 0) {
      p.delete("z");
      p.delete("x");
      p.delete("y");
      p.delete("r");
    } else {
      const c = this.#centerFractions();
      if (!c) return;
      p.set("z", String(this.zoomLevel));
      p.set("x", c.x.toFixed(4));
      p.set("y", c.y.toFixed(4));
      if (Math.abs(this.rotation) > 0.01) p.set("r", this.rotation.toFixed(1));
      else p.delete("r");
    }
    const s = p.toString();
    history.replaceState(
      null,
      "",
      s ? `${window.location.pathname}?${s}` : window.location.pathname,
    );
  };

  #restoreUrl = () => {
    const p = new URLSearchParams(window.location.search);
    const z = parseInt(p.get("z"), 10);
    const x = parseFloat(p.get("x"));
    const y = parseFloat(p.get("y"));
    if (!Number.isFinite(z) || z < 1 || z > this.steps) return;
    if (!Number.isFinite(x) || x < 0 || x > 1) return;
    if (!Number.isFinite(y) || y < 0 || y > 1) return;

    this.zoomLevel = z;
    this.scale = scaleFor(z, this.steps, this.maxScale);
    this.zoom = tileZoomFor(this.zoomLevel, this.steps);
    this.tx = (0.5 - x) * this.#cw();
    this.ty = (0.5 - y) * this.#ch();
    this.#clampBounds();

    const r = parseFloat(p.get("r"));
    if (Number.isFinite(r)) this.rotation = r;
  };

  #onDebugClick = async (e) => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    await navigator.clipboard.writeText(`[${x.toFixed(2)}, ${y.toFixed(2)}]`);
  };

  #applyPoiPrefs = () => {
    const canon = localStorage.getItem(STORAGE_KEY_CANON_ONLY) === "true";
    const illust = localStorage.getItem(STORAGE_KEY_ILLUSTRATIONS) !== "false";
    this.tiles?.setCanonOnly(canon, this.zoom);
    this.mapPois.setCanonOnly(canon);
    this.mapPois.setIllustrationsEnabled(illust);
  };

  #onCanonChange = (e) => {
    const canonOnly = e.detail.canonOnly;
    this.tiles?.setCanonOnly(canonOnly, this.zoom);
    this.mapPois?.setCanonOnly(canonOnly);
  };
  #onIllustChange = (e) =>
    this.mapPois?.setIllustrationsEnabled(e.detail.illustrationsEnabled);

  async connectedCallback() {
    this.canvas = this.root.querySelector(".canvas");
    this.map = this.root.querySelector(".map");
    this.controls = this.root.querySelector("map-controls");
    this.mapCompass = this.root.querySelector("map-compass");
    const isCoarse = window.matchMedia("(pointer: coarse)").matches;

    if (isCoarse) {
      this.steps = ZOOM_STEPS + MOBILE_EXTRA_STEPS;
      this.maxScale = MOBILE_MAX_SCALE;
    }

    // Wait for full page load
    if (document.readyState !== "complete") {
      await new Promise((r) =>
        window.addEventListener("load", r, { once: true }),
      );
    }

    // Load POIs
    const buildVersion = document.documentElement.dataset.buildVersion;
    const endpoint = `/assets/data/pois.json?v=${buildVersion}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    const pois = data.pois;
    this.maxPoiZoom = 0;
    for (let i = 0; i < pois.length; i++) {
      if (pois[i].zoom > this.maxPoiZoom) this.maxPoiZoom = pois[i].zoom;
    }

    this.#measure();
    const canonOnly = localStorage.getItem(STORAGE_KEY_CANON_ONLY) === "true";
    this.tiles = new TileManager(this.map, BASE_W, BASE_H, isCoarse, canonOnly);

    this.#restoreUrl();
    this.#applySize();
    this.#syncTileSize();
    this.tiles.renderTiles(this.zoom);

    // Draw POIs
    this.mapPois = new MapPois(pois);
    this.map.appendChild(this.mapPois);
    this.#applyPoiPrefs();

    this.setAttribute("ready", "");
    this.#updateFont();
    this.#renderPois();
    this.#notifyRotation();
    this.#applyTransform();
    this.#updateControls();
    this.#dispatchZoom();

    // Event listeners
    this.canvas.addEventListener("dblclick", this.#onDblClick);
    this.canvas.addEventListener("click", this.#onCanvasClickCapture, true);
    this.canvas.addEventListener("mousedown", this.#onMouseDown);
    this.canvas.addEventListener("mouseup", this.#onMouseUp);
    this.canvas.addEventListener("touchstart", this.#onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.#onDrag, { passive: false });
    this.canvas.addEventListener("touchend", this.#onMouseUp, {
      passive: false,
    });
    this.canvas.addEventListener("click", this.#onDebugClick);
    window.addEventListener("wheel", this.#onWheel);
    window.addEventListener("mouseout", this.#onMouseUp);
    window.addEventListener("resize", this.#onResize);
    this.root.addEventListener("poi-canon-only-change", this.#onCanonChange);
    this.root.addEventListener(
      "poi-illustrations-change",
      this.#onIllustChange,
    );
  }

  disconnectedCallback() {
    if (this.dragRaf) cancelAnimationFrame(this.dragRaf);
    clearTimeout(this.transTimer);
    clearTimeout(this.urlTimer);
    if (this.resizeRaf) cancelAnimationFrame(this.resizeRaf);
    this.tiles?.destroy();

    window.removeEventListener("resize", this.#onResize);
    window.removeEventListener("mouseout", this.#onMouseUp);
    window.removeEventListener("wheel", this.#onWheel);
    this.canvas.removeEventListener("click", this.#onCanvasClickCapture, true);
    this.canvas.removeEventListener("click", this.#onDebugClick);
    this.root.removeEventListener("poi-canon-only-change", this.#onCanonChange);
    this.root.removeEventListener(
      "poi-illustrations-change",
      this.#onIllustChange,
    );
    this.canvas.removeEventListener("touchend", this.#onMouseUp);
    this.canvas.removeEventListener("touchmove", this.#onDrag);
    this.canvas.removeEventListener("touchstart", this.#onTouchStart);
    this.canvas.removeEventListener("mouseup", this.#onMouseUp);
    this.canvas.removeEventListener("mousedown", this.#onMouseDown);
    this.canvas.removeEventListener("dblclick", this.#onDblClick);
  }
}

customElements.define("map-canvas", MapCanvas);
