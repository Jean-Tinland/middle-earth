export default function template() {
  return /* html */ `
    <div class="canvas">
      <div class="map"></div>
    </div>
    <div class="cover">
      <div class="left-cover"></div>
      <div class="right-cover"></div>
    </div>
    <map-nomenclature></map-nomenclature>
    <map-scale></map-scale>
    <map-controls></map-controls>
    <map-compass></map-compass>
    <map-information></map-information>
  `;
}
