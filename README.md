# Middle-Earth interactive map

This project aims to provide an **interactive map of Middle-Earth** during the Third Age as **imagined by J.R.R. Tolkien** in his books.
All points of interest were collected on various representations of existing Middle-Earth maps.

[Open Middle-Earth map](https://middle-earth.jeantinland.com).

![Middle-Earth interactive map](./assets/images/preview.png)

## Credits

- Map drawn in Figma with custom terrain & landmark elements.
- Button's icons: extracted from [Remix Icon collection](https://remixicon.com/).
- Favicon: [One Ring](https://icons8.com/icon/20169/one-ring) icon by [Icons8](https://icons8.com).
- Map texture overlay: [Image by rawpixel.com on Freepik](https://www.freepik.com/free-ai-image/wooden-floor-background_4100933.htm#fromView=keyword&page=1&position=0&uuid=cb06f3fd-0006-4ddd-93a7-8622848f46be&query=Old+Map+Texture).
- Compass rose (modified): [Image by freepik](https://www.freepik.com/free-vector/hand-drawn-map-compass-background_1582142.htm#fromView=search&page=1&position=23&uuid=90506e90-3cbb-4891-bf73-4316a0f28b13&query=compass+rose).
- Fonts: [Aniron](https://www.dafont.com/aniron.font) and [EB Garamond](https://fonts.google.com/specimen/EB+Garamond)

## Contribute

Feel free to open an issue or contribute if you'd like anything fixed or added.

## Development

This project includes [serve](https://www.npmjs.com/package/serve) and [live-server](https://www.npmjs.com/package/live-server) as dev dependencies to serve the map locally.

### Setup

First, install the project dependencies:

```shell
npm install
```

### Running the Server Locally

You can run the development server using either `serve` or `live-server`:

```shell
# with serve
npx serve .

# or with live-server
npx live-server .
```

The server will start and you can access the map by opening the URL shown in your terminal : `http://localhost:3000`.

### Generating Map Tiles

To generate map tiles from the source images, run:

```shell
npm run generate-tiles
```

This script uses [sharp](https://sharp.pixelplumbing.com/) to process map images at different zoom levels, split them into tiles of 512x512 pixels, and apply a paper texture overlay.
