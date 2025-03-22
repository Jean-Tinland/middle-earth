import { renderIcon } from "../lib/icons.js";

export default function template() {
  return /* html */ `
    <div class="controls">
      <button id="zoom-in" is="map-button" class="control" tooltip="Zoom in" direction="left">
        ${renderIcon("plus", "icon")}
      </button>
      <hr class="separator" />
      <button id="zoom-out" is="map-button" class="control" tooltip="Zoom out" direction="left" disabled="">
        ${renderIcon("minus", "icon")}
      </button>
    </div>
  `;
}
