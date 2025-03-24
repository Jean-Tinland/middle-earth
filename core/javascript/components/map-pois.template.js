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
        case "common-place": {
          return renderCommonPlace(poi);
        }
        case "sea": {
          return renderSea(poi);
        }
        case "city": {
          return renderCity(poi);
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

function renderCommonPlace(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="common-place" data-size="${size}">
      <div class="name">${name}</div>
    </div>
  `;
}

function renderSea(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="sea" data-size="${size}">
      <div class="name">${name}</div>
    </div>
  `;
}

function renderCity(poi) {
  const { name, position, size } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="city" data-size="${size}">
      <div class="dot"></div>
      <div class="name">${name}</div>
    </div>
  `;
}
