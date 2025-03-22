export default function template(pois) {
  return pois
    .map((poi) => {
      console.log(poi);
      if (poi.kind === "region") {
        return renderRegion(poi);
      }
      if (poi.kind === "sub-region") {
        return renderSubRegion(poi);
      }
      return "";
    })
    .join("");
}

function renderRegion(poi) {
  const { name, position } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="region">
      <div class="name">${name}</div>
    </div>
  `;
}

function renderSubRegion(poi) {
  const { name, position } = poi;
  const [x, y] = position;
  return /* html */ `
    <div class="poi" style="top: ${y}%; left: ${x}%;" data-kind="sub-region">
      <div class="name">${name}</div>
    </div>
  `;
}
