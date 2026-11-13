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

export function finalizeZone(z: ZoneCanvas): { grid: string[]; heights: string[] } {
  return {
    grid: z.tiles.map((row) => row.join('')),
    heights: z.heights.map((row) => row.join('')),
  };
}
