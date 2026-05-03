import sharp from "sharp";
import { mkdir, rm } from "fs/promises";
import { join } from "path";

const TILE_SIZE = 512;
const ZOOM_SIZES = [
  { width: 1900, height: 1300 },
  { width: 3800, height: 2600 },
  { width: 5700, height: 3900 },
  { width: 7600, height: 5200 },
  { width: 9500, height: 6500 },
  { width: 11400, height: 7800 },
  { width: 15200, height: 10400 },
  { width: 19000, height: 13000 },
  { width: 22800, height: 15600 },
];
const ZOOM_LEVELS = ZOOM_SIZES.length;
const INPUT_MAP_DIR = "./assets/images/map";
const MAP_VARIANTS = [
  {
    label: "base",
    inputPath: join(INPUT_MAP_DIR, "map.jpg"),
    outputDir: "./assets/images/map/tiles",
    legacyPrefix: "map",
  },
  {
    label: "extended",
    inputPath: join(INPUT_MAP_DIR, "map-extended.jpg"),
    outputDir: "./assets/images/map/tiles-extended",
    legacyPrefix: "map-extended",
  },
];
const JPEG_QUALITY = 100;
const WORKER_COUNT = 4;
const INPUT_PIXEL_LIMIT = 400000000;

// Each tile is small (512px); one libvips thread per tile avoids contention.
sharp.concurrency(1);

async function loadBaseMap(inputPath) {
  const buffer = Buffer.from(await Bun.file(inputPath).arrayBuffer());
  const { width, height } = await sharp(buffer, {
    limitInputPixels: INPUT_PIXEL_LIMIT,
  }).metadata();

  return { buffer, width, height };
}

function validateBaseMapSize(baseMap, inputPath) {
  const expectedMaxZoom = ZOOM_SIZES[ZOOM_LEVELS - 1];
  if (
    baseMap.width !== expectedMaxZoom.width ||
    baseMap.height !== expectedMaxZoom.height
  ) {
    throw new Error(
      `Invalid dimensions for ${inputPath}: got ${baseMap.width}x${baseMap.height}, expected ${expectedMaxZoom.width}x${expectedMaxZoom.height}.`,
    );
  }
}

async function buildZoomSource(baseMap, zoom, outputDir) {
  const targetSize = ZOOM_SIZES[zoom];
  const isMaxZoom =
    baseMap.width === targetSize.width && baseMap.height === targetSize.height;

  const buffer = isMaxZoom
    ? baseMap.buffer
    : await sharp(baseMap.buffer, {
        limitInputPixels: INPUT_PIXEL_LIMIT,
      })
        .resize(targetSize.width, targetSize.height, {
          fit: "fill",
          kernel: sharp.kernel.lanczos3,
        })
        .jpeg({ quality: JPEG_QUALITY })
        .toBuffer();

  return {
    zoom,
    buffer,
    width: targetSize.width,
    height: targetSize.height,
    outputDir,
  };
}

async function buildZoomSources(baseMap, targetZooms, outputDir) {
  const sources = [];

  for (const zoom of targetZooms) {
    sources.push(await buildZoomSource(baseMap, zoom, outputDir));
  }

  return sources;
}

async function removeLegacyZoomMaps(prefix) {
  const zoomMapPaths = Array.from({ length: ZOOM_LEVELS }, (_, zoom) =>
    join(INPUT_MAP_DIR, `${prefix}-${zoom}.jpg`),
  );

  await Promise.all(zoomMapPaths.map((path) => rm(path, { force: true })));
}

function getRowSlice(row, height) {
  const top = row * TILE_SIZE;
  const rowHeight = Math.min(TILE_SIZE, height - top);
  return { top, rowHeight };
}

async function buildRowImage(buffer, top, width, rowHeight) {
  const { data, info } = await sharp(buffer, {
    sequentialRead: true,
    limitInputPixels: INPUT_PIXEL_LIMIT,
  })
    .extract({ left: 0, top, width, height: rowHeight })
    .raw()
    .toBuffer({ resolveWithObject: true });

  return sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: info.channels,
    },
  });
}

function getTileSlice(col, width) {
  const left = col * TILE_SIZE;
  const tileWidth = Math.min(TILE_SIZE, width - left);
  return { left, tileWidth };
}

function getTileOutputPath(outputDir, zoom, row, col) {
  return join(outputDir, `${zoom}`, `${row}-${col}.jpg`);
}

async function writeTile(rowImage, left, tileWidth, rowHeight, outPath) {
  await rowImage
    .clone()
    .extract({ left, top: 0, width: tileWidth, height: rowHeight })
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(outPath);
}

async function writeRowTiles(source, row) {
  const { zoom, buffer, width, height, cols, outputDir } = source;
  const { top, rowHeight } = getRowSlice(row, height);
  const rowImage = await buildRowImage(buffer, top, width, rowHeight);

  for (let col = 0; col < cols; col++) {
    const { left, tileWidth } = getTileSlice(col, width);
    const outPath = getTileOutputPath(outputDir, zoom, row, col);
    await writeTile(rowImage, left, tileWidth, rowHeight, outPath);
  }

  return cols;
}

function getTileGrid(width, height) {
  const cols = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(height / TILE_SIZE);
  const tileCount = cols * rows;
  return { cols, rows, tileCount };
}

function logTileGrid(zoom, width, height, cols, rows, tileCount) {
  console.log(
    `Zoom ${zoom}: ${width}x${height} -> ${cols}x${rows} = ${tileCount} tiles`,
  );
}

function createRowJobs(source, rows) {
  return Array.from(
    { length: rows },
    (_, row) => () => writeRowTiles(source, row),
  );
}

function collectTileJobs(sources) {
  const jobs = [];
  let totalTiles = 0;
  let totalRows = 0;

  for (const source of sources) {
    const { zoom, width, height } = source;
    const { cols, rows, tileCount } = getTileGrid(width, height);
    source.cols = cols;
    totalRows += rows;
    totalTiles += tileCount;

    logTileGrid(zoom, width, height, cols, rows, tileCount);
    jobs.push(...createRowJobs(source, rows));
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

function getAllZoomLevels() {
  return Array.from({ length: ZOOM_LEVELS }, (_, i) => i);
}

function getVariantLabels() {
  return MAP_VARIANTS.map((variant) => variant.label);
}

function printUsageAndExit(errorMessage) {
  const variantList = getVariantLabels().join(" | ");
  console.error(errorMessage);
  console.error(
    `Usage: bun scripts/generate-tiles.js [variant] [zoom]\nVariant: ${variantList}\nZoom: integer between 0 and ${ZOOM_LEVELS - 1}`,
  );
  process.exit(1);
}

function parseZoomLevel(rawZoom) {
  const isInteger = /^\d+$/.test(rawZoom);
  if (!isInteger) {
    printUsageAndExit(
      `Invalid zoom level "${rawZoom}". Must be an integer between 0 and ${ZOOM_LEVELS - 1}.`,
    );
  }

  const zoom = Number(rawZoom);
  if (zoom < 0 || zoom >= ZOOM_LEVELS) {
    printUsageAndExit(
      `Invalid zoom level "${rawZoom}". Must be an integer between 0 and ${ZOOM_LEVELS - 1}.`,
    );
  }

  return zoom;
}

function findVariantByLabel(label) {
  return MAP_VARIANTS.find((variant) => variant.label === label);
}

function buildAllVariantsTarget() {
  return {
    targetVariants: MAP_VARIANTS,
    targetZooms: getAllZoomLevels(),
  };
}

function buildVariantTarget(variant, rawZoom) {
  const targetVariants = [variant];

  if (rawZoom === undefined) {
    return {
      targetVariants,
      targetZooms: getAllZoomLevels(),
    };
  }

  return {
    targetVariants,
    targetZooms: [parseZoomLevel(rawZoom)],
  };
}

function failInvalidVariant(rawVariant) {
  const expectedVariants = getVariantLabels().join(", ");
  printUsageAndExit(
    `Invalid variant "${rawVariant}". Expected one of: ${expectedVariants}.`,
  );
}

function resolveOneArgumentTarget(rawArg) {
  const variant = findVariantByLabel(rawArg);
  if (variant !== undefined) {
    return buildVariantTarget(variant);
  }

  return {
    targetVariants: MAP_VARIANTS,
    targetZooms: [parseZoomLevel(rawArg)],
  };
}

function resolveTwoArgumentsTarget(rawVariant, rawZoom) {
  const variant = findVariantByLabel(rawVariant);
  if (variant === undefined) {
    failInvalidVariant(rawVariant);
  }

  return buildVariantTarget(variant, rawZoom);
}

function resolveGenerationTargets() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return buildAllVariantsTarget();
  }

  if (args.length === 1) {
    return resolveOneArgumentTarget(args[0]);
  }

  if (args.length === 2) {
    const [rawVariant, rawZoom] = args;
    return resolveTwoArgumentsTarget(rawVariant, rawZoom);
  }

  if (args.length > 2) {
    printUsageAndExit(`Too many arguments: ${args.join(" ")}`);
  }

  return buildAllVariantsTarget();
}

async function ensureOutputDirectories(outputDir, targetZooms) {
  await Promise.all(
    targetZooms.map((zoom) =>
      mkdir(join(outputDir, `${zoom}`), { recursive: true }),
    ),
  );
}

async function generateTilesForVariant(variant, targetZooms) {
  console.log(
    `Generating zoom levels for ${variant.label} map from ${variant.inputPath}...\n`,
  );

  const baseMap = await loadBaseMap(variant.inputPath);
  validateBaseMapSize(baseMap, variant.inputPath);

  await ensureOutputDirectories(variant.outputDir, targetZooms);

  const sources = await buildZoomSources(
    baseMap,
    targetZooms,
    variant.outputDir,
  );

  const { jobs, totalRows, totalTiles } = collectTileJobs(sources);
  console.log(
    `\nProcessing ${totalTiles} tiles (${jobs.length} row strips, ${WORKER_COUNT} workers)...\n`,
  );

  await runWithWorkers(jobs, WORKER_COUNT, totalRows, totalTiles);
  await removeLegacyZoomMaps(variant.legacyPrefix);
}

async function main() {
  const start = performance.now();
  const { targetVariants, targetZooms } = resolveGenerationTargets();

  for (const variant of targetVariants) {
    await generateTilesForVariant(variant, targetZooms);
  }

  const elapsed = ((performance.now() - start) / 1000).toFixed(1);
  console.log(`Done in ${elapsed}s`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
