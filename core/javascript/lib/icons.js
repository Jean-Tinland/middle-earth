const icons = {
  plus: ["M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"],
  minus: ["M5 11v2h14v-2H5Z"],
  list: [
    "M11 4h10v2H11zm0 4h6v2h-6zm0 6h10v2H11zm0 4h6v2h-6zM3 4h6v6H3zm2 2v2h2V6zm-2 8h6v6H3zm2 2v2h2v-2z",
  ],
  question: [
    "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5h2v2h-2v-2Zm2-1.64V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.47-1.8l-1.96-.39A3.5 3.5 0 1 1 13 13.36Z",
  ],
  close: [
    "m12 10.59 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41L12 10.59Z",
  ],
};

export function renderIcon(code, className = "") {
  const paths = icons[code].map((d) => `<path d="${d}"/>`).join("");
  return `<svg viewBox="0 0 24 24" class="${className}">${paths}</svg>`;
}
