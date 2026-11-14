export const SOULDOLL_SPRITE_SIZE = 256;
export const SOULDOLL_MAX_SHEET_ID = 52;

const PAD_X = 6;
const PAD_TOP = 6;
const PAD_BOTTOM = 4;
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

export interface NormalizedSoulDollPair {
  front: HTMLCanvasElement;
  back: HTMLCanvasElement;
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

function renderNormalizedHalf(
  source: HTMLCanvasElement,
  bounds: SpriteBounds,
  scale: number,
  targetSize: number
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetSize;
  out.height = targetSize;
  const ctx = out.getContext('2d');
  if (!ctx) return out;

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
  return out;
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

  return {
    front: renderNormalizedHalf(scratch, frontBounds, unifiedScale, targetSize),
    back: renderNormalizedHalf(scratch, backBounds, unifiedScale, targetSize),
  };
}
