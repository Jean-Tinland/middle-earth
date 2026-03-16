export default function template() {
  return /* html */ `
    <div class="canvas">
      <div class="map"></div>
      <div class="cover">
        <div class="left-cover"></div>
        <div class="right-cover"></div>
      </div>
    </div>
    <map-nomenclature></map-nomenclature>
    <map-controls></map-controls>
    <map-information></map-information>
  `;
}
