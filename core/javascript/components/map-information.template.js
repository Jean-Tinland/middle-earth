import { renderIcon } from "../lib/icons.js";

export default function template() {
  return /* html */ `
    <button is="map-button" class="information" tooltip="Information & credits" direction="left">
        ${renderIcon("question", "icon")}
      </button>
    `;
}

export const content = /* html */ `
  <style>
    * {
      line-height: 1.6;
    }
    p {
      margin: 0;
    }
    h2 {
      margin: 14px 0 10px 0;
    }
    ul {
      margin: 10px;
      padding: 0 0 0 15px;
    }
    a {
      color: var(--black);
    }
  </style>
  <div class="content">
    <div class="description">
      <p>
        This project aims to provide an <b>interactive map of Middle-Earth</b> as <b>imaged by J.R.R. Tolkien</b> in his books.
        <br />
        All points of interest were collected on various representation of Middle-Earth existing maps.
      </p>
    </div>
    <div class="credits">
      <h2>Credits</h2>
      <ul>
        <li>
          Map drawn by myself from existing Middle-Earth maps in Figma with custom terrain & landmark elements
        </li>
        <li>
          Button's icons: extracted from <a href="https://remixicon.com/" target="_blank" rel="nofollow noopener">Remix Icon collection</a>
        </li>
        <li>
          Favicon: <a href="https://icons8.com/icon/20169/one-ring" target="_blank" rel="nofollow noopener">One Ring</a> icon by <a target="_blank" ref="nofollow noopener" href="https://icons8.com">Icons8</a>
        </li>
        <li>
          Map texture overlay: <a href="https://www.freepik.com/free-ai-image/wooden-floor-background_4100933.htm#fromView=keyword&page=1&position=0&uuid=cb06f3fd-0006-4ddd-93a7-8622848f46be&query=Old+Map+Texture" target="_blank" rel="nofollow noopener">Image by rawpixel.com on Freepik</a>
        </li>
        <li>
          Compass rose (modified): <a href="https://www.freepik.com/free-vector/hand-drawn-map-compass-background_1582142.htm#fromView=search&page=1&position=23&uuid=90506e90-3cbb-4891-bf73-4316a0f28b13&query=compass+rose" target="_blank" rel="nofollow noopener">Image by freepik</a>
        </li>
      </ul>
    </div>
    <div class="source">
      <h2>Source</h2>
      <p>
        <b>Source code is available on github <a href="https://github.com/Jean-Tinland/middle-earth/" target="_blank">here</a></b>.
        <br />
        Feel free to open issue or contribute if you'd like anything fixed or added.
      </p>
    </div>
  </div>
`;
