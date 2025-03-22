const icons = {
  plus: ["M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2h6Z"],
  minus: ["M5 11v2h14v-2H5Z"],
  information: [
    "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM11 7h2v2h-2V7Zm0 4h2v6h-2v-6Z",
  ],
  question: [
    "M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Zm0-2a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-1-5h2v2h-2v-2Zm2-1.64V14h-2v-1.5a1 1 0 0 1 1-1 1.5 1.5 0 1 0-1.47-1.8l-1.96-.39A3.5 3.5 0 1 1 13 13.36Z",
  ],
  tune: [
    "M6.17 18a3 3 0 0 1 5.66 0H22v2H11.83a3 3 0 0 1-5.66 0H2v-2h4.17Zm6-7a3 3 0 0 1 5.66 0H22v2h-4.17a3 3 0 0 1-5.66 0H2v-2h10.17Zm-6-7a3 3 0 0 1 5.66 0H22v2H11.83a3 3 0 0 1-5.66 0H2V4h4.17ZM9 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-6 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  ],
  loader: [
    "M10.7 3V1.4a1.3 1.3 0 012.6 0V3c0 .7-.6 1.3-1.3 1.3-.7 0-1.3-.6-1.3-1.3zM10.7 22.7V21a1.3 1.3 0 012.6 0v1.8c0 .7-.6 1.3-1.3 1.3-.7 0-1.3-.6-1.3-1.3zM17.4 6.6c-.5-.5-.5-1.3 0-1.8l1.3-1.3a1.3 1.3 0 111.8 1.8l-1.3 1.3a1.3 1.3 0 01-1.8 0zM3.5 20.5c-.5-.5-.5-1.3 0-1.8l1.3-1.3a1.3 1.3 0 011.8 1.8l-1.3 1.3a1.3 1.3 0 01-1.8 0zM21 13.3a1.3 1.3 0 110-2.6h1.7c.7 0 1.3.6 1.3 1.3 0 .7-.6 1.3-1.3 1.3H21zM1.3 13.3a1.3 1.3 0 110-2.6H3a1.3 1.3 0 010 2.6H1.3zM18.7 20.5l-1.3-1.3a1.3 1.3 0 011.8-1.8l1.3 1.3a1.3 1.3 0 01-1 2.2l-.8-.4zM4.8 6.6L3.5 5.3a1.3 1.3 0 011.8-1.8l1.3 1.3a1.3 1.3 0 01-1.8 1.8z",
  ],
  grid: [
    "M21 3a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h18ZM11 13H4v6h7v-6Zm9 0h-7v6h7v-6Zm-9-8H4v6h7V5Zm9 0h-7v6h7V5Z",
  ],
  enter_key: [
    {
      path: "M1 2.96C1 1.88 1.9 1 3 1h18c1.1 0 2 .88 2 1.96v18.08c0 1.08-.9 1.96-2 1.96H3c-1.1 0-2-.88-2-1.96V2.96Zm20 0H3v18.08h18V2.96Z",
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
    },
    {
      path: "M10.45 6.87c0-.4.34-.74.75-.74H15c.97 0 1.75.77 1.75 1.71v4.65c0 .94-.78 1.71-1.75 1.71H9.45l.76 1.04c.24.33.16.79-.18 1.02A.76.76 0 0 1 9 16.1l-1.91-2.62 1.9-2.63c.25-.33.72-.4 1.05-.17.34.23.42.7.18 1.02l-.76 1.04H15c.14 0 .25-.1.25-.24V7.84A.25.25 0 0 0 15 7.6h-3.8a.74.74 0 0 1-.75-.73Z",
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
    },
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
