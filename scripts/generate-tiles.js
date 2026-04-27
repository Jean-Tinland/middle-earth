import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join } from "path";

const TILE_SIZE = 512;
const ZOOM_LEVELS = 9;
const INPUT_DIR = "./assets/images/map";
const OUTPUT_DIR = "./assets/images/map/tiles";
const JPEG_QUALITY = 95;
const WORKER_COUNT = 4;
const INPUT_PIXEL_LIMIT = 400000000;

// Each tile is small (512px); one libvips thread per tile avoids contention.
sharp.concurrency(1);

async function loadSource(zoom) {
  const path = join(INPUT_DIR, `map-${zoom}.jpg`);
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
  const { width, height } = await sharp(buffer, {
    limitInputPixels: INPUT_PIXEL_LIMIT,
  }).metadata();
  return { zoom, buffer, width, height };
}

async function writeRowTiles(source, row) {
  const { zoom, buffer, width, height, cols } = source;
  const top = row * TILE_SIZE;
  const rowHeight = Math.min(TILE_SIZE, height - top);

  const { data, info } = await sharp(buffer, {
    sequentialRead: true,
    limitInputPixels: INPUT_PIXEL_LIMIT,
  })
    .extract({ left: 0, top, width, height: rowHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rowImage = sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  });

  for (let col = 0; col < cols; col++) {
    const left = col * TILE_SIZE;
    const tileWidth = Math.min(TILE_SIZE, width - left);
    const outPath = join(OUTPUT_DIR, `${zoom}`, `${row}-${col}.jpg`);

    await rowImage
      .clone()
      .extract({ left, top: 0, width: tileWidth, height: rowHeight })
      .jpeg({ quality: JPEG_QUALITY })
      .toFile(outPath);
  }

  return cols;
}

function collectTileJobs(sources) {
  const jobs = [];
  let totalTiles = 0;
  let totalRows = 0;

  for (const source of sources) {
    const { zoom, width, height } = source;
    const cols = Math.ceil(width / TILE_SIZE);
    const rows = Math.ceil(height / TILE_SIZE);
    source.cols = cols;
    totalRows += rows;
    totalTiles += cols * rows;

    console.log(
      `Zoom ${zoom}: ${width}x${height} → ${cols}x${rows} = ${cols * rows} tiles`,
    );

    for (let row = 0; row < rows; row++) {
      jobs.push(() => writeRowTiles(source, row));
    }
  }

  return { jobs, totalRows, totalTiles };
}

function renderProgress(doneRows, totalRows, doneTiles, totalTiles) {
  const BAR_WIDTH = 32;
  const filled = Math.round((doneRows / totalRows) * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const percent = String(Math.floor((doneRows / totalRows) * 100)).padStart(3);
  process.stdout.write(`\r${bar} ${doneRows}/${totalRows} rows  ${percent}%`);
}

async function runWithWorkers(jobs, workerCount, totalRows, totalTiles) {
  let cursor = 0;
  let doneRows = 0;
  let doneTiles = 0;

  renderProgress(0, totalRows, 0, totalTiles);

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      doneTiles += await job();
      doneRows += 1;
      renderProgress(doneRows, totalRows, doneTiles, totalTiles);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  renderProgress(totalRows, totalRows, totalTiles, totalTiles);
  process.stdout.write("\n");
}

function resolveTargetZooms() {
  const arg = process.argv[2];
  if (arg === undefined)
    return Array.from({ length: ZOOM_LEVELS }, (_, i) => i);

  const zoom = parseInt(arg, 10);
  if (Number.isNaN(zoom) || zoom < 0 || zoom >= ZOOM_LEVELS) {
    console.error(
      `Invalid zoom level "${arg}". Must be an integer between 0 and ${ZOOM_LEVELS - 1}.`,
    );
    process.exit(1);
  }
  return [zoom];
}

async function main() {
  const start = performance.now();
  const targetZooms = resolveTargetZooms();

  console.log("Generating tiles...\n");

  const [sources] = await Promise.all([
    Promise.all(targetZooms.map((zoom) => loadSource(zoom))),
    Promise.all(
      targetZooms.map((zoom) =>
        mkdir(join(OUTPUT_DIR, `${zoom}`), { recursive: true }),
      ),
    ),
  ]);

  const { jobs, totalRows, totalTiles } = collectTileJobs(sources);
  console.log(
    `\nProcessing ${totalTiles} tiles (${jobs.length} row strips, ${WORKER_COUNT} workers)...\n`,
  );

  await runWithWorkers(jobs, WORKER_COUNT, totalRows, totalTiles);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
}

main();
