import sharp from "sharp";
import { mkdir } from "fs/promises";
import { join } from "path";

const TILE_SIZE = 512;
const ZOOM_LEVELS = 8;
const INPUT_DIR = "./assets/images/map";
const OUTPUT_DIR = "./assets/images/map/tiles";
const JPEG_QUALITY = 85;
const WORKER_COUNT = navigator.hardwareConcurrency || 8;

// Each tile is small (512px); one libvips thread per tile avoids contention.
sharp.concurrency(1);

async function loadSource(zoom) {
  const path = join(INPUT_DIR, `map-${zoom}.jpg`);
  const buffer = Buffer.from(await Bun.file(path).arrayBuffer());
  const { width, height } = await sharp(buffer).metadata();
  return { zoom, buffer, width, height };
}

function collectTileJobs(sources) {
  const jobs = [];

  for (const { zoom, buffer, width, height } of sources) {
    const cols = Math.ceil(width / TILE_SIZE);
    const rows = Math.ceil(height / TILE_SIZE);

    console.log(
      `Zoom ${zoom}: ${width}x${height} → ${cols}x${rows} = ${cols * rows} tiles`,
    );

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const left = col * TILE_SIZE;
        const top = row * TILE_SIZE;
        const tileWidth = Math.min(TILE_SIZE, width - left);
        const tileHeight = Math.min(TILE_SIZE, height - top);
        const outPath = join(OUTPUT_DIR, `${zoom}`, `${row}-${col}.jpg`);

        jobs.push(() =>
          sharp(buffer, { sequentialRead: false })
            .extract({ left, top, width: tileWidth, height: tileHeight })
            .jpeg({ quality: JPEG_QUALITY })
            .toFile(outPath),
        );
      }
    }
  }

  return jobs;
}

function renderProgress(done, total) {
  const BAR_WIDTH = 32;
  const filled = Math.round((done / total) * BAR_WIDTH);
  const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
  const percent = String(Math.floor((done / total) * 100)).padStart(3);
  process.stdout.write(`\r${bar} ${done}/${total}  ${percent}%`);
}

async function runWithWorkers(jobs, workerCount) {
  let cursor = 0;
  let done = 0;

  renderProgress(0, jobs.length);

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await job();
      renderProgress(++done, jobs.length);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, worker));
  process.stdout.write("\n");
}

async function main() {
  const start = performance.now();
  console.log("Generating tiles...\n");

  const [sources] = await Promise.all([
    Promise.all(
      Array.from({ length: ZOOM_LEVELS }, (_, zoom) => loadSource(zoom)),
    ),
    Promise.all(
      Array.from({ length: ZOOM_LEVELS }, (_, zoom) =>
        mkdir(join(OUTPUT_DIR, `${zoom}`), { recursive: true }),
      ),
    ),
  ]);

  const jobs = collectTileJobs(sources);
  console.log(
    `\nProcessing ${jobs.length} tiles (${WORKER_COUNT} workers)...\n`,
  );

  await runWithWorkers(jobs, WORKER_COUNT);

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
}

main();
