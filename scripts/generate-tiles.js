import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join } from "path";

const TILE_SIZE = 512;
const ZOOM_LEVELS = 8;
const INPUT_DIR = "./assets/images/map";
const OUTPUT_DIR = "./assets/images/map/tiles";
const JPEG_QUALITY = 85;

async function generateTilesForZoom(zoom) {
  const inputPath = join(INPUT_DIR, `map-${zoom}.jpg`);
  const { width, height } = await sharp(inputPath).metadata();

  console.log(`Zoom ${zoom}: ${width}×${height}`);

  const cols = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const zoomDir = join(OUTPUT_DIR, `${zoom}`);
  await mkdir(zoomDir, { recursive: true });

  const CHUNK_SIZE = 16;

  for (let row = 0; row < rows; row++) {
    const rowTasks = [];

    for (let col = 0; col < cols; col++) {
      const left = col * TILE_SIZE;
      const top = row * TILE_SIZE;
      const tileW = Math.min(TILE_SIZE, width - left);
      const tileH = Math.min(TILE_SIZE, height - top);
      const outPath = join(zoomDir, `${row}-${col}.jpg`);

      rowTasks.push({ left, top, tileW, tileH, outPath });
    }

    for (let i = 0; i < rowTasks.length; i += CHUNK_SIZE) {
      const chunk = rowTasks.slice(i, i + CHUNK_SIZE);
      console.log(
        `  Processing row ${row + 1}/${rows}, tiles ${i + 1}-${Math.min(i + CHUNK_SIZE, rowTasks.length)}/${rowTasks.length}…`,
      );
      await Promise.all(
        chunk.map(({ left, top, tileW, tileH, outPath }) =>
          sharp(inputPath)
            .extract({ left, top, width: tileW, height: tileH })
            .jpeg({ quality: JPEG_QUALITY })
            .toFile(outPath),
        ),
      );
    }
  }

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
