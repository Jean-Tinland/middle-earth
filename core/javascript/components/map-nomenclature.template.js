import { renderIcon } from "../lib/icons.js";

export default function template() {
  return /* html */ `
    <button is="map-button" class="nomenclature-button" tooltip="Map legend" direction="right" aria-expanded="false">
      ${renderIcon("list", "icon")}
    </button>
    <div class="panel">
      <div class="panel__header">
        <h2 class="panel__title">Map legend</h2>
      </div>
      <div class="panel__content">
        <section class="group">
          <h3 class="group__title">Cities &amp; places</h3>
          <ul class="entries">
            <li class="entry">
              <span class="city-dot city-dot--sm" aria-hidden="true"></span>
              <span class="entry__label">Village / hamlet</span>
            </li>
            <li class="entry">
              <span class="city-dot city-dot--md" aria-hidden="true"></span>
              <span class="entry__label">Town / city</span>
            </li>
            <li class="entry">
              <span class="city-dot city-dot--lg" aria-hidden="true"></span>
              <span class="entry__label">Capital / fortress</span>
            </li>
            <li class="entry">
              <span class="text-sample text-sample--common-place" aria-hidden="true">Landmark</span>
              <span class="entry__label">Notable place</span>
            </li>
          </ul>
        </section>
        <section class="group">
          <h3 class="group__title">Lands &amp; areas</h3>
          <ul class="entries">
            <li class="entry">
              <span class="text-sample text-sample--region" aria-hidden="true">ERIADOR</span>
              <span class="entry__label">Region</span>
            </li>
            <li class="entry">
              <span class="text-sample text-sample--forest" aria-hidden="true">OLD FOREST</span>
              <span class="entry__label">Forest</span>
            </li>
            <li class="entry">
              <span class="text-sample text-sample--mountain" aria-hidden="true">MOUNTAINS</span>
              <span class="entry__label">Mountain range</span>
            </li>
          </ul>
        </section>
        <section class="group">
          <h3 class="group__title">Waters</h3>
          <ul class="entries">
            <li class="entry">
              <span class="text-sample text-sample--sea" aria-hidden="true">SEA OF RHÛN</span>
              <span class="entry__label">Sea / lake</span>
            </li>
            <li class="entry">
              <span class="text-sample text-sample--river" aria-hidden="true">Anduin</span>
              <span class="entry__label">River</span>
            </li>
          </ul>
        </section>
      </div>
    </div>
  `;
}
