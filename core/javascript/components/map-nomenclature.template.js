import { renderIcon } from "../lib/icons.js";

export default function template() {
  return /* html */ `
    <button is="map-button" class="nomenclature-button" tooltip="Map legend" direction="right" aria-expanded="false">
      ${renderIcon("list", "icon")}
    </button>
    <div class="panel">
      <div class="panel__content">
        <section class="group group--two-col">
          <h3 class="group__title">Cities &amp; places</h3>
          <div class="group__row">
            <ul class="entries">
              <li class="entry">
                <span class="city-dot city-dot--xs" aria-hidden="true"></span>
                <span class="entry__label">Hamlet</span>
              </li>
              <li class="entry">
                <span class="city-dot city-dot--sm" aria-hidden="true"></span>
                <span class="entry__label">Village</span>
              </li>
              <li class="entry">
                <span class="city-dot city-dot--md" aria-hidden="true"></span>
                <span class="entry__label">Town</span>
              </li>
              <li class="entry">
                <span class="city-dot city-dot--lg" aria-hidden="true"></span>
                <span class="entry__label">City</span>
              </li>
            </ul>

            <ul class="entries">
              <li class="entry">
                 <span class="fortress-dot fortress-dot--xs" aria-hidden="true"></span>
                <span class="entry__label">Fort</span>
              </li>
              <li class="entry">
                <span class="fortress-dot fortress-dot--sm" aria-hidden="true"></span>
                <span class="entry__label">Stronghold</span>
              </li>
              <li class="entry">
                <span class="fortress-dot fortress-dot--md" aria-hidden="true"></span>
                <span class="entry__label">Castle</span>
              </li>
              <li class="entry">
                <span class="fortress-dot fortress-dot--lg" aria-hidden="true"></span>
                <span class="entry__label">Fortress</span>
              </li>
            </ul>
          </div>
          <div class="group__row">
            <ul class="entries">
              <li class="entry">
                <span class="text-sample text-sample--common-place" aria-hidden="true">Landmark</span>
                <span class="entry__label">Notable place</span>
              </li>
            </ul>
          </div>
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
        <section class="group">
          <h3 class="group__title">Display</h3>
          <ul class="entries">
            <li class="entry">
              <label class="preference__label">
                <input type="checkbox" id="canon-only" class="preference__checkbox" />
                <span class="preference__check" aria-hidden="true"></span>
                Canon sources only
              </label>
            </li>
            <li class="entry">
              <label class="preference__label">
                <input type="checkbox" id="show-illustrations" class="preference__checkbox" />
                <span class="preference__check" aria-hidden="true"></span>
                Show illustrations
              </label>
            </li>
          </ul>
        </section>
      </div>
    </div>
  `;
}
