import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join } from "path";

const TILE_SIZE = 512;
const ZOOM_LEVELS = 8;
const INPUT_DIR = "./assets/images/map";
const OUTPUT_DIR = "./assets/images/map/tiles";
const PAPER_BG = "./assets/images/paper-background.jpg";
const JPEG_QUALITY = 85;

async function generateTilesForZoom(zoom) {
  const inputPath = join(INPUT_DIR, `map-${zoom}.jpg`);
  const { width, height } = await sharp(inputPath).metadata();

  console.log(`Zoom ${zoom}: ${width}×${height}`);

  const paperOverlay = await sharp(PAPER_BG)
    .resize(width, height, { fit: "cover" })
    .ensureAlpha(0.2)
    .png()
    .toBuffer();

  const composited = await sharp(inputPath)
    .composite([{ input: paperOverlay, blend: "multiply" }])
    .toBuffer();

  const cols = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const zoomDir = join(OUTPUT_DIR, `${zoom}`);
  await mkdir(zoomDir, { recursive: true });

  const tasks = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * TILE_SIZE;
      const top = row * TILE_SIZE;
      const tileW = Math.min(TILE_SIZE, width - left);
      const tileH = Math.min(TILE_SIZE, height - top);
      const outPath = join(zoomDir, `${row}-${col}.jpg`);

      tasks.push(
        sharp(composited)
          .extract({ left, top, width: tileW, height: tileH })
          .jpeg({ quality: JPEG_QUALITY })
          .toFile(outPath),
      );
    }
  }

  await Promise.all(tasks);
  console.log(`  → ${cols}×${rows} = ${cols * rows} tiles`);
}

async function main() {
  console.log("Generating tiles…\n");

  for (let zoom = 0; zoom < ZOOM_LEVELS; zoom++) {
    await generateTilesForZoom(zoom);
  }

  console.log("\nDone!");
}

main();
