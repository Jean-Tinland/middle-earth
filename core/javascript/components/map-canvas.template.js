export default function template() {
  return /* html */ `
    <div class="canvas">
      <object class="map" data="./assets/images/map.svg" type="image/svg+xml"></object>
      <img class="compass-rose" src="./assets/images/compass-rose.svg" alt="Compass rose" draggable="false" style="display: none" />
      <div class="cover">
        <div class="left-cover"></div>
        <div class="right-cover"></div>
      </div>
    </div>
    <map-controls></map-controls>
  `;
}
