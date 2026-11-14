import type { TileLegendEntry } from '../../domain/types.ts';

export const DEFAULT_LEGEND: Record<string, TileLegendEntry> = {
  '.': { tile: 'grass', solid: false },
  ',': { tile: 'dirt', solid: false },
  '=': { tile: 'cobble', solid: false },
  '_': { tile: 'stone', solid: false },
  's': { tile: 'sand', solid: false },
  '~': { tile: 'water', solid: true },
  'B': { tile: 'bridge', solid: false },
  '^': { tile: 'stairs', solid: false, ramp: true },
  '"': { tile: 'tall_grass', solid: false, encounter: true },
  '*': { tile: 'flowers', solid: false },
  'c': { tile: 'cave_floor', solid: false },
  '%': { tile: 'cave_floor', solid: false, encounter: true },
  'A': { tile: 'arena_floor', solid: false },
  'w': { tile: 'snow', solid: false },
  '#': { tile: 'stone', solid: true },
};

export interface ZoneCanvas {
  width: number;
  height: number;
  tiles: string[][];
  heights: number[][];
}

export function createZoneCanvas(
  width: number,
  height: number,
  baseTile = '.',
  baseHeight = 1
): ZoneCanvas {
  const tiles = Array.from({ length: height }, () =>
    new Array<string>(width).fill(baseTile)
  );
  const heights = Array.from({ length: height }, () =>
    new Array<number>(width).fill(baseHeight)
  );
  return { width, height, tiles, heights };
}

export function fillRect(
  z: ZoneCanvas,
  x0: number,
  y0: number,
  w: number,
  h: number,
  tile?: string,
  heightVal?: number
): void {
  const xEnd = Math.min(z.width, x0 + w);
  const yEnd = Math.min(z.height, y0 + h);
  for (let y = Math.max(0, y0); y < yEnd; y++) {
    for (let x = Math.max(0, x0); x < xEnd; x++) {
      if (tile !== undefined) z.tiles[y][x] = tile;
      if (heightVal !== undefined) z.heights[y][x] = Math.max(0, Math.min(9, Math.round(heightVal)));
    }
  }
}

export function addHill(
  z: ZoneCanvas,
  cx: number,
  cy: number,
  radius: number,
  peakDelta: number,
  tile?: string
): void {
  const r2 = radius * radius;
  for (let y = Math.max(0, Math.floor(cy - radius)); y <= Math.min(z.height - 1, Math.ceil(cy + radius)); y++) {
    for (let x = Math.max(0, Math.floor(cx - radius)); x <= Math.min(z.width - 1, Math.ceil(cx + radius)); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 <= r2) {
        const falloff = 1 - Math.sqrt(d2) / radius;
        const nextH = z.heights[y][x] + Math.round(peakDelta * falloff);
        z.heights[y][x] = Math.max(0, Math.min(9, nextH));
        if (tile !== undefined && falloff > 0.35) {
          z.tiles[y][x] = tile;
        }
      }
    }
  }
}

export function addPerimeterMountains(
  z: ZoneCanvas,
  thickness = 4,
  peakHeight = 8,
  ridgeTile = '#'
): void {
  for (let y = 0; y < z.height; y++) {
    for (let x = 0; x < z.width; x++) {
      const edgeDist = Math.min(x, y, z.width - 1 - x, z.height - 1 - y);
      if (edgeDist < thickness) {
        const ratio = 1 - edgeDist / thickness;
        const target = Math.max(z.heights[y][x], Math.round(peakHeight * (0.55 + ratio * 0.45)));
        z.heights[y][x] = Math.min(9, target);
        if (edgeDist <= 1) {
          z.tiles[y][x] = ridgeTile;
        }
      }
    }
  }
}

export function carveRoad(
  z: ZoneCanvas,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  width = 2,
  tile = '=',
  targetHeight?: number
): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = Math.round(x0 + (x1 - x0) * t);
    const cy = Math.round(y0 + (y1 - y0) * t);
    for (let dy = 0; dy < width; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const px = cx + dx;
        const py = cy + dy;
        if (px >= 0 && px < z.width && py >= 0 && py < z.height) {
          z.tiles[py][px] = tile;
          if (targetHeight !== undefined) {
            z.heights[py][px] = targetHeight;
          }
        }
      }
    }
  }
}

export interface MapPassOptions {
  x: number;
  y: number;
  exitDir: 'north' | 'south' | 'west' | 'east';
  roadWidth?: number;
  roadTile?: string;
  height?: number;
  depth?: number;
  shoulderWidth?: number;
  slopeWidth?: number;
  shoulderTile?: string;
}

const PRESERVED_PASS_TILES = new Set(['~', 'B', '^', '"', '*', '=', ',', '_', 'A']);

/**
 * Carves a natural, flat-shouldered valley pass leading to a border warp and
 * gently terraces surrounding perimeter mountains down to road level so
 * map transitions never form abrupt V-shaped cliff trenches.
 */
export function carveMapPass(z: ZoneCanvas, opts: MapPassOptions): void {
  const roadWidth = opts.roadWidth ?? 2;
  const roadTile = opts.roadTile ?? '=';
  const baseH = Math.max(0, Math.min(9, Math.round(opts.height ?? 2)));
  const depth = opts.depth ?? 8;
  const shoulderWidth = opts.shoulderWidth ?? 3;
  const slopeWidth = opts.slopeWidth ?? 5;
  const shoulderTile = opts.shoulderTile ?? '.';

  const isVertical = opts.exitDir === 'north' || opts.exitDir === 'south';
  const crossStart = isVertical ? opts.x : opts.y;
  const crossEnd = crossStart + roadWidth - 1;
  const totalCrossSpan = shoulderWidth + slopeWidth;
  const totalAlongSpan = depth + slopeWidth;

  for (let along = 0; along < totalAlongSpan; along++) {
    const pyBase =
      opts.exitDir === 'north'
        ? along
        : opts.exitDir === 'south'
          ? z.height - 1 - along
          : -1;
    const pxBase =
      opts.exitDir === 'west'
        ? along
        : opts.exitDir === 'east'
          ? z.width - 1 - along
          : -1;

    const innerOvershoot = Math.max(0, along - (depth - 1));

    for (
      let cross = crossStart - totalCrossSpan;
      cross <= crossEnd + totalCrossSpan;
      cross++
    ) {
      const px = isVertical ? cross : pxBase;
      const py = isVertical ? pyBase : cross;
      if (px < 0 || px >= z.width || py < 0 || py >= z.height) continue;

      let sideDist = 0;
      if (cross < crossStart) sideDist = crossStart - cross;
      else if (cross > crossEnd) sideDist = cross - crossEnd;

      const shoulderOvershoot = Math.max(0, sideDist - shoulderWidth);
      const effectiveStep = Math.max(shoulderOvershoot, innerOvershoot);
      const curTile = z.tiles[py][px];

      if (effectiveStep === 0) {
        if (sideDist === 0) {
          if (curTile !== 'B' && curTile !== '^') {
            z.tiles[py][px] = roadTile;
          }
        } else if (!PRESERVED_PASS_TILES.has(curTile)) {
          z.tiles[py][px] = shoulderTile;
        }
        z.heights[py][px] = baseH;
      } else if (effectiveStep <= slopeWidth) {
        const maxH = Math.min(9, baseH + effectiveStep);
        if (z.heights[py][px] > maxH) {
          z.heights[py][px] = maxH;
        }
        if (
          curTile === '#' &&
          effectiveStep <= Math.max(2, Math.floor(slopeWidth * 0.6))
        ) {
          z.tiles[py][px] = shoulderTile;
        }
      }
    }
  }
}

export function finalizeZone(z: ZoneCanvas): { grid: string[]; heights: string[] } {
  return {
    grid: z.tiles.map((row) => row.join('')),
    heights: z.heights.map((row) => row.join('')),
  };
}
