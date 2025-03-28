import { renderIcon } from "../lib/icons.js";

export default function template() {
  return /* html */ `
    <div class="backdrop"></div>
    <div class="modal">
      <div class="modal__header">
        <button is="map-button" tooltip="Close" direction="left" class="modal__close-button">
          ${renderIcon("close", "modal__close-button-icon")}
        </button>
        <div class="modal__title"></div>
      </div>
      <div class="modal__content"></div>
    </div>
    `;
}
