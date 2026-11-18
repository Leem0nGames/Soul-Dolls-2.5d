#!/usr/bin/env node
/**
 * Inspects or processes a spritesheet image (PNG/WebP/JPG), strips solid/chroma backgrounds
 * (grey, green screen, white, black, or auto-detected corner color) with anti-halo despill/smoothing,
 * and saves an optimized transparent WebP ready for SoulDolls battle animations.
 *
 * Usage:
 *   Inspect only:
 *     node scripts/image-to-spritesheet.mjs --input public/assets/aistudio/foo.png --cols 4 --rows 5 --inspect
 *
 *   Process & convert to WebP:
 *     node scripts/image-to-spritesheet.mjs \
 *       --input public/assets/aistudio/1000091594_spritesheet_2be7af80.png \
 *       --output public/assets/attacks/physical_attack_15.webp \
 *       --cols 4 --rows 5 --totalFrames 20 --chroma grey
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k.startsWith('--')) {
      const key = k.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      args[key] = val;
    }
  }
  return args;
}

function sampleCornerBackground(data, width, height) {
  const points = [
    [4, 4],
    [Math.max(0, width - 5), 4],
    [4, Math.max(0, height - 5)],
    [20, 20],
    [Math.max(0, width - 21), 20],
  ];
  for (const [x, y] of points) {
    const idx = (y * width + x) * 4;
    if (data[idx + 3] > 200) {
      return [data[idx], data[idx + 1], data[idx + 2]];
    }
  }
  return null;
}

function stripColorKey(data, targetRgb, hardDist = 8, softDist = 26, maxChromaSpread = 8) {
  const [tr, tg, tb] = targetRgb;
  let removed = 0;
  let smoothed = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.hypot(r - tr, g - tg, b - tb);
    const spread = Math.max(Math.abs(r - tr), Math.abs(g - tg), Math.abs(b - tb));

    if (dist <= hardDist && spread <= maxChromaSpread) {
      data[i + 3] = 0;
      removed++;
    } else if (dist <= softDist) {
      const t = (dist - hardDist) / (softDist - hardDist);
      const alpha = t * t * (3 - 2 * t);
      if (alpha <= 0.05) {
        data[i + 3] = 0;
        removed++;
      } else {
        const inv = 1 - alpha;
        data[i] = Math.max(0, Math.min(255, Math.round((r - inv * tr) / alpha)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round((g - inv * tg) / alpha)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round((b - inv * tb) / alpha)));
        data[i + 3] = Math.round(data[i + 3] * alpha);
        smoothed++;
      }
    }
  }
  return { removed, smoothed };
}

function stripGreenKey(data, tolerance = 52, despill = 0.7) {
  const minDelta = Math.max(12, 95 - tolerance);
  const edgeBand = Math.max(12, tolerance * 0.45);
  let removed = 0;
  let smoothed = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxRB = Math.max(r, b);
    const excess = g - maxRB;

    if (excess > minDelta && g > 70) {
      if (excess > minDelta + edgeBand) {
        data[i + 3] = 0;
        removed++;
      } else {
        const t = 1 - (excess - minDelta) / edgeBand;
        data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, t)));
        smoothed++;
      }
    }
    if (data[i + 3] > 0 && despill > 0 && g > maxRB) {
      data[i + 1] = Math.round(maxRB + (g - maxRB) * (1 - despill));
    }
  }
  return { removed, smoothed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  if (!input) {
    console.error('Missing --input <path>');
    process.exit(1);
  }

  const cols = Number(args.cols ?? 4);
  const rows = Number(args.rows ?? 5);
  const totalFrames = Number(args.totalFrames ?? cols * rows);
  const chroma = args.chroma ?? 'auto';
  const inspectOnly = args.inspect === 'true';

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width;
  const height = info.height;
  const cellW = Math.round(width / cols);
  const cellH = Math.round(height / rows);

  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) transparentCount++;
  }
  const sampledRgb = sampleCornerBackground(data, width, height);

  if (inspectOnly) {
    console.log(
      JSON.stringify(
        {
          input,
          width,
          height,
          cols,
          rows,
          cellW,
          cellH,
          aspectRatio: `${cellW} / ${cellH}`,
          totalFrames,
          transparentPct: Number(((transparentCount / (width * height)) * 100).toFixed(2)),
          sampledCornerRgb: sampledRgb,
        },
        null,
        2
      )
    );
    return;
  }

  const output = args.output;
  if (!output) {
    console.error('Missing --output <path> (or pass --inspect)');
    process.exit(1);
  }

  let stats = { removed: 0, smoothed: 0 };
  if (chroma === 'green') {
    const tol = Number(args.tolerance ?? 52);
    const despill = Number(args.despill ?? 0.7);
    stats = stripGreenKey(data, tol, despill);
  } else if (chroma === 'grey') {
    const tol = Number(args.tolerance ?? 8);
    stats = stripColorKey(data, [180, 180, 180], tol, tol + 20, tol + 2);
  } else if (chroma === 'white') {
    const tol = Number(args.tolerance ?? 12);
    stats = stripColorKey(data, [255, 255, 255], tol, tol + 22, tol + 4);
  } else if (chroma === 'black') {
    const tol = Number(args.tolerance ?? 10);
    stats = stripColorKey(data, [0, 0, 0], tol, tol + 20, tol + 4);
  } else if (chroma === 'auto' && sampledRgb) {
    const [sr, sg, sb] = sampledRgb;
    if (sg - Math.max(sr, sb) > 40 && sg > 100) {
      stats = stripGreenKey(data, Number(args.tolerance ?? 52), Number(args.despill ?? 0.7));
    } else {
      const tol = Number(args.tolerance ?? 8);
      stats = stripColorKey(data, sampledRgb, tol, tol + 20, tol + 2);
    }
  }

  let finalBuffer = await sharp(data, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();
  let outWidth = width;
  let outHeight = height;

  if (args.trim === 'true') {
    const trimmed = sharp(finalBuffer).trim({ threshold: 10 });
    const meta = await trimmed.toBuffer({ resolveWithObject: true });
    finalBuffer = meta.data;
    outWidth = meta.info.width;
    outHeight = meta.info.height;
  }

  const maxWidth = Number(args.maxWidth ?? 0);
  if (maxWidth > 0 && outWidth > maxWidth) {
    const resized = sharp(finalBuffer).resize({ width: maxWidth, kernel: 'lanczos3' });
    const meta = await resized.toBuffer({ resolveWithObject: true });
    finalBuffer = meta.data;
    outWidth = meta.info.width;
    outHeight = meta.info.height;
  }

  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(finalBuffer)
    .webp({ quality: 94, effort: 5 })
    .toFile(output);

  console.log(
    JSON.stringify(
      {
        output,
        width,
        height,
        cols,
        rows,
        cellW,
        cellH,
        totalFrames,
        aspectRatio: `${cellW} / ${cellH}`,
        suggestedImpactFrame: Math.floor(totalFrames * 0.45),
        chromaApplied: chroma,
        stats,
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
