#!/usr/bin/env node
/**
 * Splits a dual SoulDoll vertical sheet (top: unbodied wild soul illustration,
 * bottom: pixel-art follower pet) on a chroma/solid background into two clean
 * transparent WebP assets:
 *   - public/assets/souls/<XX>.webp      (512x512 normalized wild soul)
 *   - public/assets/followers/<XX>.webp  (tightly cropped pixel-art pet)
 *
 * Usage:
 *   node scripts/soul-sheet-to-assets.mjs \
 *     --input public/assets/aistudio/818944007_1794972743245373_5b1a5cb3.jpg \
 *     --id 1 --chroma green
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

function stripGreenKey(data, tolerance = 52, despill = 0.72) {
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
    if (data[i + 3] < 16) {
      data[i] = 20;
      data[i + 1] = 16;
      data[i + 2] = 28;
      data[i + 3] = 0;
    }
  }
  return { removed, smoothed };
}

function stripSolidColorKey(data, targetRgb, hardDist = 10, softDist = 30, maxSpread = 12) {
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
    if (dist <= hardDist && spread <= maxSpread) {
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
    if (data[i + 3] < 16) {
      data[i] = 20;
      data[i + 1] = 16;
      data[i + 2] = 28;
      data[i + 3] = 0;
    }
  }
  return { removed, smoothed };
}

function findVerticalSegments(data, width, height) {
  const segments = [];
  let inSeg = false;
  let segStart = 0;
  for (let y = 0; y < height; y++) {
    let opaqueCount = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(rowOffset + x) * 4 + 3] > 24) {
        opaqueCount++;
      }
    }
    if (opaqueCount > 2 && !inSeg) {
      inSeg = true;
      segStart = y;
    } else if (opaqueCount <= 2 && inSeg) {
      if (y - segStart >= 16) {
        segments.push({ y0: segStart, y1: y - 1 });
      }
      inSeg = false;
    }
  }
  if (inSeg && height - segStart >= 16) {
    segments.push({ y0: segStart, y1: height - 1 });
  }
  // Merge tiny vertical gaps (< 20px) caused by detached floating particles
  const merged = [];
  for (const seg of segments) {
    const prev = merged[merged.length - 1];
    if (prev && seg.y0 - prev.y1 < 20) {
      prev.y1 = seg.y1;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

function findBoundsInRowRange(data, width, y0, y1) {
  let x0 = width;
  let minY = y1;
  let x1 = -1;
  let maxY = -1;
  for (let y = y0; y <= y1; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(rowOffset + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (x1 < x0 || maxY < minY) return null;
  return { x0, y0: minY, x1, y1: maxY, w: x1 - x0 + 1, h: maxY - minY + 1 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input;
  const idNum = Number(args.id ?? 1);
  if (!input || Number.isNaN(idNum) || idNum < 1) {
    console.error('Usage: node scripts/soul-sheet-to-assets.mjs --input <path> --id <speciesId>');
    process.exit(1);
  }
  const padId = String(Math.floor(idNum)).padStart(2, '0');
  const chroma = args.chroma ?? 'green';
  const soulOut = args.soulOut ?? `public/assets/souls/${padId}.webp`;
  const followerOut = args.followerOut ?? `public/assets/followers/${padId}.webp`;

  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const width = info.width;
  const height = info.height;

  if (chroma === 'green') {
    stripGreenKey(data, Number(args.tolerance ?? 52), Number(args.despill ?? 0.72));
  } else if (chroma === 'grey') {
    stripSolidColorKey(data, [180, 180, 180]);
  } else if (chroma === 'white') {
    stripSolidColorKey(data, [255, 255, 255], 12, 34, 14);
  } else if (chroma === 'black') {
    stripSolidColorKey(data, [0, 0, 0], 10, 28, 14);
  }

  const segments = findVerticalSegments(data, width, height);
  let topRange = segments[0] ?? { y0: 0, y1: Math.floor(height * 0.62) };
  let bottomRange = segments[segments.length - 1] ?? { y0: Math.floor(height * 0.62), y1: height - 1 };
  if (segments.length === 1) {
    const mid = Math.floor((topRange.y0 + topRange.y1) * 0.58);
    topRange = { y0: segments[0].y0, y1: mid };
    bottomRange = { y0: mid + 1, y1: segments[0].y1 };
  }

  const topBounds = findBoundsInRowRange(data, width, topRange.y0, topRange.y1);
  const bottomBounds = findBoundsInRowRange(data, width, bottomRange.y0, bottomRange.y1);
  if (!topBounds || !bottomBounds) {
    console.error('Could not locate both top wild soul and bottom pixel pet regions.');
    process.exit(1);
  }

  const cleanRgbaPng = await sharp(data, { raw: { width, height, channels: 4 } }).png().toBuffer();

  // 1. Normalize Wild Soul (top) onto 512x512 canvas with slight ethereal hover clearance at bottom
  const targetSize = 512;
  const padX = 8;
  const padTop = 8;
  const padBottom = 16;
  const availW = targetSize - padX * 2;
  const availH = targetSize - padTop - padBottom;
  const scale = Math.min(availW / topBounds.w, availH / topBounds.h);
  const drawW = Math.max(1, Math.round(topBounds.w * scale));
  const drawH = Math.max(1, Math.round(topBounds.h * scale));
  const dx = Math.round((targetSize - drawW) * 0.5);
  const dy = targetSize - padBottom - drawH;

  const soulExtracted = await sharp(cleanRgbaPng)
    .extract({ left: topBounds.x0, top: topBounds.y0, width: topBounds.w, height: topBounds.h })
    .resize(drawW, drawH, { kernel: 'lanczos3' })
    .toBuffer();

  fs.mkdirSync(path.dirname(soulOut), { recursive: true });
  await sharp({
    create: {
      width: targetSize,
      height: targetSize,
      channels: 4,
      background: { r: 20, g: 16, b: 28, alpha: 0 },
    },
  })
    .composite([{ input: soulExtracted, left: dx, top: dy }])
    .webp({ quality: 94, effort: 5 })
    .toFile(soulOut);

  // 2. Crop Pixel-Art Follower Pet (bottom) tightly with 4px clean padding
  const petPad = 4;
  fs.mkdirSync(path.dirname(followerOut), { recursive: true });
  await sharp(cleanRgbaPng)
    .extract({
      left: bottomBounds.x0,
      top: bottomBounds.y0,
      width: bottomBounds.w,
      height: bottomBounds.h,
    })
    .extend({
      top: petPad,
      bottom: petPad,
      left: petPad,
      right: petPad,
      background: { r: 20, g: 16, b: 28, alpha: 0 },
    })
    .webp({ lossless: true, effort: 5 })
    .toFile(followerOut);

  console.log(
    JSON.stringify(
      {
        speciesId: idNum,
        soulOut,
        soulSize: `${targetSize}x${targetSize}`,
        soulBounds: topBounds,
        followerOut,
        followerSize: `${bottomBounds.w + petPad * 2}x${bottomBounds.h + petPad * 2}`,
        followerBounds: bottomBounds,
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
