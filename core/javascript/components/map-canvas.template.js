export default function template() {
  return /* html */ `
    <div class="canvas">
      <div class="map"></div>
      <div class="decorations" style="display: none">
        <img class="compass-rose" src="./assets/images/compass-rose.svg" alt="Compass rose" draggable="false" />
        <img class="scale" src="./assets/images/scale.svg" alt="Scale" draggable="false" />
      </div>
      <div class="cover">
        <div class="left-cover"></div>
        <div class="right-cover"></div>
      </div>
    </div>
    <map-controls></map-controls>
    <map-information></map-information>
  `;
}
