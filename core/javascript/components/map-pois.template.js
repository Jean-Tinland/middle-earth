export default function template(pois) {
  return pois
    .map((poi) => {
      switch (poi.kind) {
        case "region": {
          return renderRegion(poi);
        }
        case "forest": {
          return renderForest(poi);
        }
        case "mountain": {
          return renderMountain(poi);
        }
        default: {
          return "";
        }
      }
    })
    .join("");
}

function renderRegion(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="region" data-size="${size}">
      <div class="name">${name}</div>
    </div>
  `;
}

function renderForest(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="forest" data-size="${size}">
      <div class="name">${name}</div>
    </div>
  `;
}

function renderMountain(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="mountain" data-size="${size}">
      <div class="name">${name}</div>
    </div>
  `;
}
