import { ATLAS_GRID, TILE_ATLAS_INDEX, type TileAtlasKey } from '../gfx/ProceduralTiles.ts';

export interface UvRect {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

const CACHE = new Map<TileAtlasKey, UvRect>();

export function getTileUv(key: TileAtlasKey): UvRect {
  let rect = CACHE.get(key);
  if (rect) return rect;

  const idx = TILE_ATLAS_INDEX[key];
  const col = idx % ATLAS_GRID;
  const row = Math.floor(idx / ATLAS_GRID);
  const step = 1 / ATLAS_GRID;
  const eps = 0.0015;

  const u0 = col * step + eps;
  const u1 = (col + 1) * step - eps;
  const v1 = 1 - row * step - eps;
  const v0 = 1 - (row + 1) * step + eps;

  rect = { u0, v0, u1, v1 };
  CACHE.set(key, rect);
  return rect;
}
