export const SOULDOLL_SPRITE_SIZE = 512;
export const SOULDOLL_MAX_SHEET_ID = 52;

const PAD_X = 6;
const PAD_TOP = 6;
const PAD_BOTTOM = 1;
const ALPHA_SCAN_THRESHOLD = 12;
const ALPHA_CLEAN_THRESHOLD = 16;

// Crypt ink (#14101C) for zero-alpha pixels to avoid bright fringe during mipmap/linear filtering
const TRANSPARENT_R = 20;
const TRANSPARENT_G = 16;
const TRANSPARENT_B = 28;

export interface SpriteBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

export interface SoulDollTorsoAnchor {
  torsoX: number;
  bustY: number;
  charHeight: number;
}

export interface NormalizedSoulDollPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
  frontAnchor: SoulDollTorsoAnchor;
  backAnchor: SoulDollTorsoAnchor;
}

export interface NormalizedWildSoul {
  canvas: HTMLCanvasElement;
  anchor: SoulDollTorsoAnchor;
}

export function getSoulDollSheetId(speciesId: number): number {
  const clamped = Math.max(1, Math.min(SOULDOLL_MAX_SHEET_ID, Math.floor(speciesId)));
  return clamped;
}

export function getSoulDollSheetUrl(speciesId: number): string {
  const num = String(getSoulDollSheetId(speciesId)).padStart(2, '0');
  return `/assets/souldolls/${num}.webp`;
}

export function findRegionAlphaBounds(
  data: Uint8ClampedArray,
  imgWidth: number,
  imgHeight: number,
  startX: number,
  endX: number,
  alphaThreshold = ALPHA_SCAN_THRESHOLD
): SpriteBounds | null {
  let x0 = endX;
  let y0 = imgHeight;
  let x1 = -1;
  let y1 = -1;

  for (let y = 0; y < imgHeight; y++) {
    const rowOffset = y * imgWidth;
    for (let x = startX; x < endX; x++) {
      const a = data[(rowOffset + x) * 4 + 3];
      if (a > alphaThreshold) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }

  if (x1 < x0 || y1 < y0) return null;
  return {
    x0,
    y0,
    x1,
    y1,
    w: x1 - x0 + 1,
    h: y1 - y0 + 1,
  };
}

export function detectSoulDollTorsoAnchor(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
  drawH: number
): SoulDollTorsoAnchor {
  const charHeight = Math.max(0.35, Math.min(0.99, drawH / Math.max(1, height)));
  let yBottom = Math.min(height - 1, height - PAD_BOTTOM - 1);
  outer: for (let y = height - 1; y >= 0; y--) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (rgba[(rowOffset + x) * 4 + 3] > 128) {
        yBottom = y;
        break outer;
      }
    }
  }

  // 1. Locate head core centerline (charY 0.76..0.88): free of swinging weapons, censers, skirts, and wings
  let headSum = 0;
  let headRows = 0;
  for (let cy = 0.76; cy <= 0.88; cy += 0.025) {
    const y = Math.max(0, Math.min(height - 1, Math.round(yBottom - cy * drawH)));
    const rowOffset = y * width;
    let curStart = -1;
    let bestStart = -1;
    let bestEnd = -1;
    for (let x = 0; x <= width; x++) {
      const op = x < width && rgba[(rowOffset + x) * 4 + 3] > 128;
      if (op) {
        if (curStart < 0) curStart = x;
      } else if (curStart >= 0) {
        const s = curStart / width;
        const e = x / width;
        if (bestStart < 0 || e - s > bestEnd - bestStart) {
          bestStart = s;
          bestEnd = e;
        }
        curStart = -1;
      }
    }
    if (bestStart >= 0) {
      headSum += (bestStart + bestEnd) * 0.5;
      headRows += 1;
    }
  }
  const headX = headRows > 0 ? headSum / headRows : 0.5;

  // 2. Locate neck/chin notch within +-18% of headX (64%..76% charY) for true spine X and bustY
  const nxMin = Math.max(0, Math.floor((headX - 0.18) * width));
  const nxMax = Math.min(width - 1, Math.ceil((headX + 0.18) * width));
  const corridorW = Math.max(1, nxMax - nxMin + 1);
  let minSpan = 999;
  let neckCy = 0.725;
  let neckMid = headX;
  for (let cy = 0.64; cy <= 0.76; cy += 0.015) {
    const y = Math.max(0, Math.min(height - 1, Math.round(yBottom - cy * drawH)));
    const rowOffset = y * width;
    let cnt = 0;
    let xSum = 0;
    for (let x = nxMin; x <= nxMax; x++) {
      if (rgba[(rowOffset + x) * 4 + 3] > 128) {
        cnt += 1;
        xSum += (x + 0.5) / width;
      }
    }
    const span = cnt / corridorW;
    if (span > 0.18 && span < minSpan) {
      minSpan = span;
      neckCy = cy;
      neckMid = xSum / cnt;
    }
  }
  const spineX = neckMid;

  // 3. Find contiguous torso run at chest height (59%..67% charY) tightly bounded around spineX
  let sumMid = 0;
  let coreRows = 0;
  for (let cy = 0.59; cy <= 0.67; cy += 0.02) {
    const y = Math.max(0, Math.min(height - 1, Math.round(yBottom - cy * drawH)));
    const rowOffset = y * width;
    let curStart = -1;
    let bestStart = -1;
    let bestEnd = -1;
    for (let x = 0; x <= width; x++) {
      const op = x < width && rgba[(rowOffset + x) * 4 + 3] > 128;
      if (op) {
        if (curStart < 0) curStart = x;
      } else if (curStart >= 0) {
        const rawS = curStart / width;
        const rawE = x / width;
        const overlapsSpine = rawE >= spineX - 0.10 && rawS <= spineX + 0.10;
        const s = Math.max(rawS, spineX - 0.15);
        const e = Math.min(rawE, spineX + 0.15);
        if (overlapsSpine && e > s && (bestStart < 0 || e - s > bestEnd - bestStart)) {
          bestStart = s;
          bestEnd = e;
        }
        curStart = -1;
      }
    }
    if (bestStart >= 0) {
      sumMid += (bestStart + bestEnd) * 0.5;
      coreRows += 1;
    }
  }
  const coreMid = coreRows > 0 ? sumMid / coreRows : spineX;
  const torsoX = Math.max(
    0.39,
    Math.min(0.61, Math.max(spineX - 0.035, Math.min(coreMid, spineX + 0.035)))
  );

  // Bust sits just below the neck/collarbone notch
  const bustY = Math.max(0.595, Math.min(0.66, neckCy - 0.085));

  return { torsoX, bustY, charHeight };
}

function renderNormalizedHalf(
  source: HTMLCanvasElement,
  bounds: SpriteBounds,
  scale: number,
  targetSize: number
): { canvas: HTMLCanvasElement; anchor: SoulDollTorsoAnchor } {
  const out = document.createElement('canvas');
  out.width = targetSize;
  out.height = targetSize;
  const ctx = out.getContext('2d');
  if (!ctx) {
    return {
      canvas: out,
      anchor: { torsoX: 0.5, bustY: 0.635, charHeight: 0.96 },
    };
  }

  const drawW = Math.max(1, Math.round(bounds.w * scale));
  const drawH = Math.max(1, Math.round(bounds.h * scale));
  const dx = Math.round((targetSize - drawW) * 0.5);
  const dy = targetSize - PAD_BOTTOM - drawH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.drawImage(
    source,
    bounds.x0,
    bounds.y0,
    bounds.w,
    bounds.h,
    dx,
    dy,
    drawW,
    drawH
  );

  // Clean low-alpha fringe and set transparent pixel RGB to dark ink
  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < ALPHA_CLEAN_THRESHOLD) {
      px[i] = TRANSPARENT_R;
      px[i + 1] = TRANSPARENT_G;
      px[i + 2] = TRANSPARENT_B;
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const anchor = detectSoulDollTorsoAnchor(px, targetSize, targetSize, drawH);
  return { canvas: out, anchor };
}

export function extractAndNormalizeSoulDollPair(
  image: HTMLImageElement,
  targetSize = SOULDOLL_SPRITE_SIZE
): NormalizedSoulDollPair | null {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (w < 4 || h < 2) return null;

  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sCtx = scratch.getContext('2d');
  if (!sCtx) return null;

  sCtx.clearRect(0, 0, w, h);
  sCtx.drawImage(image, 0, 0);
  const { data } = sCtx.getImageData(0, 0, w, h);

  const halfW = Math.floor(w / 2);
  const frontBounds = findRegionAlphaBounds(data, w, h, 0, halfW) ?? {
    x0: 0,
    y0: 0,
    x1: halfW - 1,
    y1: h - 1,
    w: halfW,
    h,
  };
  const backBounds = findRegionAlphaBounds(data, w, h, halfW, w) ?? {
    x0: halfW,
    y0: 0,
    x1: w - 1,
    y1: h - 1,
    w: w - halfW,
    h,
  };

  const availW = Math.max(16, targetSize - PAD_X * 2);
  const availH = Math.max(16, targetSize - PAD_TOP - PAD_BOTTOM);
  const maxW = Math.max(1, frontBounds.w, backBounds.w);
  const maxH = Math.max(1, frontBounds.h, backBounds.h);
  const unifiedScale = Math.min(availW / maxW, availH / maxH);

  const frontHalf = renderNormalizedHalf(scratch, frontBounds, unifiedScale, targetSize);
  const backHalf = renderNormalizedHalf(scratch, backBounds, unifiedScale, targetSize);

  return {
    front: frontHalf.canvas,
    back: backHalf.canvas,
    frontAnchor: frontHalf.anchor,
    backAnchor: backHalf.anchor,
  };
}

export function normalizeWildSoulImage(
  image: HTMLImageElement,
  targetSize = SOULDOLL_SPRITE_SIZE
): NormalizedWildSoul | null {
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  if (w < 4 || h < 4) return null;

  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sCtx = scratch.getContext('2d');
  if (!sCtx) return null;

  sCtx.clearRect(0, 0, w, h);
  sCtx.drawImage(image, 0, 0);
  const { data } = sCtx.getImageData(0, 0, w, h);

  const bounds = findRegionAlphaBounds(data, w, h, 0, w) ?? {
    x0: 0,
    y0: 0,
    x1: w - 1,
    y1: h - 1,
    w,
    h,
  };

  const wildPadX = 8;
  const wildPadTop = 8;
  const wildPadBottom = 16;
  const availW = Math.max(16, targetSize - wildPadX * 2);
  const availH = Math.max(16, targetSize - wildPadTop - wildPadBottom);
  const scale = Math.min(availW / Math.max(1, bounds.w), availH / Math.max(1, bounds.h));

  const out = document.createElement('canvas');
  out.width = targetSize;
  out.height = targetSize;
  const ctx = out.getContext('2d');
  if (!ctx) {
    return {
      canvas: out,
      anchor: { torsoX: 0.5, bustY: 0.635, charHeight: 0.92 },
    };
  }

  const drawW = Math.max(1, Math.round(bounds.w * scale));
  const drawH = Math.max(1, Math.round(bounds.h * scale));
  const dx = Math.round((targetSize - drawW) * 0.5);
  const dy = targetSize - wildPadBottom - drawH;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, targetSize, targetSize);
  ctx.drawImage(scratch, bounds.x0, bounds.y0, bounds.w, bounds.h, dx, dy, drawW, drawH);

  const imgData = ctx.getImageData(0, 0, targetSize, targetSize);
  const px = imgData.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < ALPHA_CLEAN_THRESHOLD) {
      px[i] = TRANSPARENT_R;
      px[i + 1] = TRANSPARENT_G;
      px[i + 2] = TRANSPARENT_B;
      px[i + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  const anchor = detectSoulDollTorsoAnchor(px, targetSize, targetSize, drawH);
  return { canvas: out, anchor };
}
