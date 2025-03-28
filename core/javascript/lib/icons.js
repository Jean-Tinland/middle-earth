const icons = {
  plus: ["M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"],
  minus: ["M5 11v2h14v-2H5Z"],
  question: [
    "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5h2v2h-2v-2Zm2-1.64V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.47-1.8l-1.96-.39A3.5 3.5 0 1 1 13 13.36Z",
  ],
  tune: [
    "M6.17 18a3 3 0 0 1 5.66 0H22v2H11.83a3 3 0 0 1-5.66 0H2v-2h4.17Zm6-7a3 3 0 0 1 5.66 0H22v2h-4.17a3 3 0 0 1-5.66 0H2v-2h10.17Zm-6-7a3 3 0 0 1 5.66 0H22v2H11.83a3 3 0 0 1-5.66 0H2V4h4.17ZM9 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  ],
  close: [
    "m12 10.59 4.95-4.95 1.41 1.41L13.41 12l4.95 4.95-1.41 1.41L12 13.41l-4.95 4.95-1.41-1.41L10.59 12 5.64 7.05l1.41-1.41L12 10.59Z",
  ],
};

/**
 * Renders an SVG icon based on the provided code.
 *
 * @param {keyof icons} code - The code representing the icon to render.
 * @param {string} [className=""] - Optional CSS class to apply to the SVG element.
 * @returns {string} The HTML string representing the SVG icon.
 */
export function renderIcon(code, className = "") {
  return /* html */ `
<svg viewBox="0 0 24 24" class="${className}">
  ${renderIconPaths(code)}
</svg>
`;
}

/**
 * Renders SVG path elements based on the provided icon code.
 *
 * @param {string} code - The code representing the icon to render.
 * @returns {string} - A string containing the SVG path elements.
 */
export function renderIconPaths(code) {
  return icons[code]
    .map((path) => {
      if (typeof path === "string") {
        return /* html */ `<path d="${path}"/>`;
      } else {
        const { path: svgPath, ...props } = path;
        const attributes = Object.keys(props)
          .map((key) => {
            const prop = props[key];
            return `${key}="${prop}"`;
          })
          .join(" ");
        return /* html */ `<path ${attributes} d="${svgPath}"/>`;
      }
    })
    .join("");
}
