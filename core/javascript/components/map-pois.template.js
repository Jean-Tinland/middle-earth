export default function template(pois) {
  return pois.map(render).join("");
}

function render(poi) {
  const { name, kind, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="${kind}" data-size="${size}">
      ${renderDot(poi)}
      <div class="name">${name}</div>
    </div>
  `;
}

function renderDot(poi) {
  if (poi.kind === "city") {
    return /* html */ `
      <div class="dot"></div>
    `;
  }
  return "";
}
