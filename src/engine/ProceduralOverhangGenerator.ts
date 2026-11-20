import * as THREE from 'three';
import type { BattleBiome, MapDef } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';
import { attachCliffEdgeDirectionalLighting } from './CliffEdgeLighting.ts';
import {
  DIORAMA_RENDER_ORDER,
  type CliffBoundary,
  type CliffDirection,
} from './DioramaLayers.ts';
import {
  attachCameraOcclusionCutout,
  OCCLUSION_TERRAIN_MIN_REL_Y,
} from './OcclusionCutout.ts';
import { detectCliffBoundaries } from './TerrainMesher.ts';

export type OverhangAssetKind =
  | 'edge_lip'
  | 'worn_capstone'
  | 'cracked_trim'
  | 'mossy_patch'
  | 'hanging_roots'
  | 'hanging_vine'
  | 'crystal_icicle'
  | 'overhang_turf';

export const OVERHANG_SHEET_SLOTS: readonly OverhangAssetKind[] = [
  'edge_lip',
  'worn_capstone',
  'cracked_trim',
  'mossy_patch',
  'hanging_roots',
  'hanging_vine',
  'crystal_icicle',
  'overhang_turf',
] as const;

export const OVERHANG_ASSET_SHEET_URL =
  '/assets/aistudio/520710015_1795112955056095_ccb22d3d.jpg';

export interface OverhangPlacement {
  x: number;
  y: number;
  z: number;
  tileX: number;
  tileZ: number;
  nx: number;
  nz: number;
  face: CliffDirection;
  width: number;
  height: number;
  kind: OverhangAssetKind;
  drapeKind?: OverhangAssetKind;
  drapeHeight: number;
  offsetOutward: number;
  hasTopCap: boolean;
  capDepth: number;
  overhangProjection: number;
  lipThickness: number;
  isCorner: boolean;
  extendLeftCorner: boolean;
  extendRightCorner: boolean;
}

export interface OverhangGenerationStats {
  total: number;
  corners: number;
  withTopCap: number;
  volumetricSlabs: number;
  drapeSkirts: number;
  byKind: Partial<Record<OverhangAssetKind, number>>;
}

export const OVERHANG_OFFSET_OUTWARD = 0.025;
const OVERHANG_CAP_LIFT = 0.015;
const OVERHANG_CAP_DEPTH = 0.14;
const CELL_PX = 64;

const SLOT_INDEX: Record<OverhangAssetKind, number> = {
  edge_lip: 0,
  worn_capstone: 1,
  cracked_trim: 2,
  mossy_patch: 3,
  hanging_roots: 4,
  hanging_vine: 5,
  crystal_icicle: 6,
  overhang_turf: 7,
};

function hashEdge(x: number, z: number, face: CliffDirection, seed: number): number {
  const faceNum = face === 'north' ? 1 : face === 'south' ? 2 : face === 'west' ? 3 : 4;
  let h = (x * 374761393 + z * 668265263 + faceNum * 2147483647 + seed * 1597334677) | 0;
  h = ((h ^ (h >> 13)) * 1274126177) | 0;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function hashCell(x: number, y: number, salt: number): number {
  let h = (x * 1664525 + y * 1013904223 + salt * 2654435761) | 0;
  h = ((h ^ (h >> 15)) * 2246822519) | 0;
  return ((h ^ (h >> 13)) >>> 0) / 4294967296;
}

/**
 * Computes which adjacent orthogonal corners on the same tile also drop off,
 * using our right-handed edge basis N = (nx,0,nz), T = (nz,0,-nx).
 * -T side = left corner, +T side = right corner.
 */
function detectConvexCorners(
  boundary: CliffBoundary,
  boundaryKeys: ReadonlySet<string>
): { extendLeft: boolean; extendRight: boolean } {
  const { x, z, face } = boundary;
  if (face === 'south') {
    // T = +East (+X), -T = West (-X)
    return {
      extendLeft: boundaryKeys.has(`${x},${z},west`),
      extendRight: boundaryKeys.has(`${x},${z},east`),
    };
  }
  if (face === 'north') {
    // T = -East (-X), -T = East (+X)
    return {
      extendLeft: boundaryKeys.has(`${x},${z},east`),
      extendRight: boundaryKeys.has(`${x},${z},west`),
    };
  }
  if (face === 'east') {
    // T = North (-Z), -T = South (+Z)
    return {
      extendLeft: boundaryKeys.has(`${x},${z},south`),
      extendRight: boundaryKeys.has(`${x},${z},north`),
    };
  }
  // west: T = South (+Z), -T = North (-Z)
  return {
    extendLeft: boundaryKeys.has(`${x},${z},north`),
    extendRight: boundaryKeys.has(`${x},${z},south`),
  };
}

export function generateCliffOverhangPlan(
  map: MapDef,
  boundaries?: readonly CliffBoundary[]
): OverhangPlacement[] {
  if (map.isInterior) return [];
  const cliffList = boundaries ?? detectCliffBoundaries(map);
  if (cliffList.length === 0) return [];

  const boundaryKeys = new Set<string>();
  for (const b of cliffList) {
    boundaryKeys.add(`${b.x},${b.z},${b.face}`);
  }

  const placements: OverhangPlacement[] = [];
  const seed = map.decoration?.seed ?? 17;

  for (const b of cliffList) {
    // Keep staircases cleanly readable without overlapping coping or drapes
    if (b.topTile === 'stairs') continue;
    const neighborCh = map.grid[b.nz]?.[b.nx];
    const neighborTile = neighborCh ? map.legend[neighborCh]?.tile : undefined;
    if (neighborTile === 'stairs') continue;
    // Never stick chunky cliff slabs out over pond water surfaces
    if (neighborTile === 'water') continue;

    const drop = b.yTop - b.yBottom;
    if (drop <= 0.05) continue;

    const { extendLeft, extendRight } = detectConvexCorners(b, boundaryKeys);
    const corner = extendLeft || extendRight;
    const r = hashEdge(b.x, b.z, b.face, seed);
    const rDetail = hashEdge(b.x + 19, b.z + 31, b.face, seed + 7);
    const rShape = hashEdge(b.x + 53, b.z + 11, b.face, seed + 23);

    let kind: OverhangAssetKind;
    let drapeKind: OverhangAssetKind | undefined;
    let drapeHeight = 0;

    const isCave = map.biome === 'cave' || map.music === 'cave';
    const isSnow = map.biome === 'snow' || b.topTile === 'snow';
    const isLush = map.biome === 'forest' || map.biome === 'meadow';
    const isRocky =
      b.topTile === 'stone' ||
      b.topTile === 'cliff_rock' ||
      b.topTile === 'cracked_stone' ||
      b.topTile === 'cobble' ||
      map.biome === 'mountain' ||
      map.biome === 'arena';

    if (isCave) {
      kind = 'cracked_trim';
      if (!corner && drop >= 0.85) {
        if (r < 0.42) {
          drapeKind = 'crystal_icicle';
          drapeHeight = Math.min(drop * 0.90, 0.72);
        } else if (r < 0.72) {
          drapeKind = 'hanging_roots';
          drapeHeight = Math.min(drop * 0.88, 0.70);
        }
      }
    } else if (isSnow) {
      kind = rDetail < 0.45 ? 'crystal_icicle' : 'worn_capstone';
      if (!corner && r < 0.55 && drop >= 0.85) {
        drapeKind = 'crystal_icicle';
        drapeHeight = Math.min(drop * 0.88, 0.68);
      }
    } else if (isLush) {
      if (isRocky) {
        kind = rDetail < 0.65 ? 'worn_capstone' : 'mossy_patch';
      } else {
        // Lush meadow/forest grass plateaus always wear organic mossy grass tufts, never grey sidewalk stone
        kind = 'mossy_patch';
      }
      if (drop >= 0.85) {
        if (r < 0.28) {
          drapeKind = 'hanging_roots';
          drapeHeight = Math.min(drop * 0.90, 0.72);
        } else if (r < 0.60) {
          drapeKind = 'hanging_vine';
          drapeHeight = Math.min(drop * 0.92, 0.74);
        }
      }
    } else if (map.biome === 'coast') {
      kind = 'worn_capstone';
      if (!corner && r < 0.35 && drop >= 0.85) {
        drapeKind = 'hanging_roots';
        drapeHeight = Math.min(drop * 0.86, 0.64);
      }
    } else {
      // Mountain / Arena
      kind = rDetail < 0.75 ? 'worn_capstone' : 'cracked_trim';
      if (!corner && r < 0.34 && drop >= 0.85) {
        drapeKind = 'hanging_roots';
        drapeHeight = Math.min(drop * 0.86, 0.64);
      }
    }

    const nx = b.face === 'east' ? 1 : b.face === 'west' ? -1 : 0;
    const nz = b.face === 'south' ? 1 : b.face === 'north' ? -1 : 0;

    // Sculpted Octopath-style projection: lush organic tufts puff outward cleanly; stone rims stay tight
    const isOrganic = kind === 'mossy_patch';
    const projection = isOrganic
      ? corner
        ? 0.13
        : 0.095 + rShape * 0.042
      : corner
        ? 0.105
        : 0.075 + rShape * 0.032;
    const lipThickness = Math.min(drop * 0.62, isOrganic ? 0.22 + rDetail * 0.09 : 0.18 + rDetail * 0.07);
    const height = Math.max(lipThickness, Math.min(drop * 0.68, 0.34));

    placements.push({
      x: b.x + nx * (0.5 + OVERHANG_OFFSET_OUTWARD),
      y: b.yTop,
      z: b.z + nz * (0.5 + OVERHANG_OFFSET_OUTWARD),
      tileX: b.x,
      tileZ: b.z,
      nx,
      nz,
      face: b.face,
      width: 1.0,
      height,
      kind,
      drapeKind,
      drapeHeight,
      offsetOutward: OVERHANG_OFFSET_OUTWARD,
      hasTopCap: true,
      capDepth: OVERHANG_CAP_DEPTH,
      overhangProjection: projection,
      lipThickness,
      isCorner: corner,
      extendLeftCorner: extendLeft,
      extendRightCorner: extendRight,
    });
  }

  return placements;
}

export function isChromaGreenPixel(r: number, g: number, b: number): boolean {
  return g >= 148 && g - Math.max(r, b) >= 62 && r <= 130 && b <= 130;
}

export function isChromaMagentaPixel(r: number, g: number, b: number): boolean {
  return r >= 165 && b >= 160 && g <= 118 && r - g >= 58 && b - g >= 52;
}

/**
 * Extracts, chroma-keys, despills, and top-aligns the 8 horizontal overhang slots
 * from an RGBA image buffer (e.g. a green-screen sprite strip) into a crisp 512x64 atlas.
 */
export function processChromaKeyOverhangBuffer(
  srcRgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  cellSize = CELL_PX
): { width: number; height: number; data: Uint8ClampedArray } {
  const slots = OVERHANG_SHEET_SLOTS.length;
  const dstW = cellSize * slots;
  const dstH = cellSize;
  const dst = new Uint8ClampedArray(dstW * dstH * 4);

  const mask = new Uint8Array(srcW * srcH);
  let minX = srcW;
  let maxX = -1;
  let minY = srcH;
  let maxY = -1;

  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const idx = (y * srcW + x) * 4;
      const r = srcRgba[idx];
      const g = srcRgba[idx + 1];
      const b = srcRgba[idx + 2];
      const a = srcRgba[idx + 3];
      if (a > 128 && !isChromaGreenPixel(r, g, b)) {
        mask[y * srcW + x] = 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { width: dstW, height: dstH, data: dst };
  }

  const totalW = maxX - minX + 1;
  const colW = totalW / slots;

  for (let s = 0; s < slots; s++) {
    const sx0 = Math.floor(minX + s * colW);
    const sx1 = Math.min(maxX, Math.floor(minX + (s + 1) * colW) - 1);
    const sw = Math.max(1, sx1 - sx0 + 1);

    let slotMinY = maxY;
    let slotMaxY = minY;
    for (let y = minY; y <= maxY; y++) {
      for (let x = sx0; x <= sx1; x++) {
        if (mask[y * srcW + x]) {
          if (y < slotMinY) slotMinY = y;
          if (y > slotMaxY) slotMaxY = y;
        }
      }
    }
    if (slotMaxY < slotMinY) continue;
    const sh = Math.max(1, slotMaxY - slotMinY + 1);

    const ox = s * cellSize;
    for (let dy = 0; dy < cellSize; dy++) {
      const sy = Math.min(slotMaxY, slotMinY + Math.floor(((dy + 0.5) / cellSize) * sh));
      for (let dx = 0; dx < cellSize; dx++) {
        const sx = Math.min(sx1, sx0 + Math.floor(((dx + 0.5) / cellSize) * sw));
        const pIdx = sy * srcW + sx;
        if (!mask[pIdx]) continue;

        const sIdx = pIdx * 4;
        const r = srcRgba[sIdx];
        let g = srcRgba[sIdx + 1];
        const b = srcRgba[sIdx + 2];

        const hasBgNeighbor =
          sx <= sx0 ||
          sx >= sx1 ||
          sy <= slotMinY ||
          sy >= slotMaxY ||
          !mask[pIdx - 1] ||
          !mask[pIdx + 1] ||
          !mask[pIdx - srcW] ||
          !mask[pIdx + srcW];

        if (hasBgNeighbor) {
          const rbMax = Math.max(r, b);
          if (g > rbMax + 26 && g > 118) {
            if (g - rbMax > 48 && rbMax < 95) {
              continue;
            }
            g = Math.min(g, rbMax + 14);
          }
        }

        const dIdx = (dy * dstW + (ox + dx)) * 4;
        dst[dIdx] = r;
        dst[dIdx + 1] = g;
        dst[dIdx + 2] = b;
        dst[dIdx + 3] = 255;
      }
    }
  }

  return { width: dstW, height: dstH, data: dst };
}

function paintTopDownRimSlots(dst: Uint8ClampedArray, dstW: number, cellSize: number): void {
  const hexToRgb = (hex: string): [number, number, number] => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  };

  const mossRgb = hexToRgb(PALETTE.moss);
  const emeraldRgb = hexToRgb(PALETTE.emerald);
  const forestRgb = hexToRgb(PALETTE.forestGreen);
  const darkGrassRgb = hexToRgb(PALETTE.pitchBlackGreen);

  const stoneHiRgb = hexToRgb(PALETTE.stoneHighlight);
  const stoneMidRgb = hexToRgb(PALETTE.stoneMid);
  const stoneShRgb = hexToRgb(PALETTE.stoneShadow);
  const earthRgb = hexToRgb(PALETTE.burntUmber);

  const setPx = (ox: number, x: number, y: number, rgb: [number, number, number], a = 255) => {
    const idx = (y * dstW + (ox + x)) * 4;
    dst[idx] = rgb[0];
    dst[idx + 1] = rgb[1];
    dst[idx + 2] = rgb[2];
    dst[idx + 3] = a;
  };

  // Slot 7 (overhang_turf): top-down organic grass/moss lip for green plateau edges
  const turfOx = SLOT_INDEX.overhang_turf * cellSize;
  for (let x = 0; x < cellSize; x++) {
    const n2 = hashCell(Math.floor(x / 3), 7, 19);
    const grassLimit = Math.round(cellSize * (0.78 + n2 * 0.16));
    for (let y = 0; y < cellSize; y++) {
      // y=0 corresponds to v=1 (outer overhanging rim edge in Face #2 UVs); y=cellSize-1 is inner plateau merge
      if (y > grassLimit) {
        setPx(turfOx, x, y, forestRgb, 0);
        continue;
      }
      const n = hashCell(x, y, 41);
      if (y <= 3) {
        // Warm sunlit outer overhanging tip + crisp micro shadow
        const c = n > 0.4 ? mossRgb : emeraldRgb;
        setPx(turfOx, x, y, c, 255);
      } else if (y < 14) {
        const c = n > 0.62 ? mossRgb : n > 0.25 ? emeraldRgb : forestRgb;
        setPx(turfOx, x, y, c, 255);
      } else if (y === grassLimit || y === grassLimit - 1) {
        setPx(turfOx, x, y, darkGrassRgb, 255);
      } else {
        const c = n > 0.72 ? emeraldRgb : forestRgb;
        setPx(turfOx, x, y, c, 255);
      }
    }
  }

  // Slot 0 (edge_lip): top-down weathered rocky/earthy rim for mountain/cave/stone cliffs
  const stoneOx = SLOT_INDEX.edge_lip * cellSize;
  for (let x = 0; x < cellSize; x++) {
    const nEdge = hashCell(Math.floor(x / 2), 5, 53);
    const rockLimit = Math.round(cellSize * (0.76 + nEdge * 0.16));
    for (let y = 0; y < cellSize; y++) {
      if (y > rockLimit) {
        setPx(stoneOx, x, y, stoneMidRgb, 0);
        continue;
      }
      const n = hashCell(x, y, 89);
      const isCrack = (x % 16 === 0 && y < rockLimit - 6) || n < 0.08;
      if (y <= 3) {
        setPx(stoneOx, x, y, stoneHiRgb, 255);
      } else if (isCrack) {
        setPx(stoneOx, x, y, stoneShRgb, 255);
      } else if (y < 16) {
        setPx(stoneOx, x, y, n > 0.55 ? stoneHiRgb : stoneMidRgb, 255);
      } else {
        setPx(stoneOx, x, y, n > 0.78 ? earthRgb : n > 0.35 ? stoneMidRgb : stoneShRgb, 255);
      }
    }
  }
}

/**
 * Extracts a 3x2 grid overhang sheet keyed on pure magenta (#FF00FF), despills pink edge fringes,
 * places the 6 sculpted assets into their semantic slots, and paints top-down rim textures in slots 0 & 7.
 */
export function processMagentaGridOverhangBuffer(
  srcRgba: Uint8ClampedArray,
  srcW: number,
  srcH: number,
  cols = 3,
  rows = 2,
  cellSize = CELL_PX
): { width: number; height: number; data: Uint8ClampedArray } {
  const slots = OVERHANG_SHEET_SLOTS.length;
  const dstW = cellSize * slots;
  const dstH = cellSize;
  const dst = new Uint8ClampedArray(dstW * dstH * 4);

  paintTopDownRimSlots(dst, dstW, cellSize);

  const mask = new Uint8Array(srcW * srcH);
  for (let i = 0; i < srcW * srcH; i++) {
    const idx = i * 4;
    if (
      srcRgba[idx + 3] > 128 &&
      !isChromaMagentaPixel(srcRgba[idx], srcRgba[idx + 1], srcRgba[idx + 2])
    ) {
      mask[i] = 1;
    }
  }

  // Maps [row, col] of the 3x2 uploaded sheet into the 8-slot overhang atlas
  const cellMapping: Array<{ row: number; col: number; slot: OverhangAssetKind }> = [
    { row: 0, col: 0, slot: 'mossy_patch' },
    { row: 0, col: 1, slot: 'hanging_vine' },
    { row: 0, col: 2, slot: 'hanging_roots' },
    { row: 1, col: 0, slot: 'worn_capstone' },
    { row: 1, col: 1, slot: 'cracked_trim' },
    { row: 1, col: 2, slot: 'crystal_icicle' },
  ];

  const sectorW = srcW / cols;
  const sectorH = srcH / rows;

  for (const entry of cellMapping) {
    const bx0 = Math.floor(entry.col * sectorW);
    const bx1 = Math.min(srcW - 1, Math.floor((entry.col + 1) * sectorW) - 1);
    const by0 = Math.floor(entry.row * sectorH);
    const by1 = Math.min(srcH - 1, Math.floor((entry.row + 1) * sectorH) - 1);

    let minX = bx1;
    let maxX = bx0;
    let minY = by1;
    let maxY = by0;
    let found = false;
    for (let y = by0; y <= by1; y++) {
      for (let x = bx0; x <= bx1; x++) {
        if (mask[y * srcW + x]) {
          found = true;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (!found) continue;

    const sw = Math.max(1, maxX - minX + 1);
    const sh = Math.max(1, maxY - minY + 1);
    const ox = SLOT_INDEX[entry.slot] * cellSize;

    for (let dy = 0; dy < cellSize; dy++) {
      const sy = Math.min(maxY, minY + Math.floor(((dy + 0.5) / cellSize) * sh));
      for (let dx = 0; dx < cellSize; dx++) {
        const sx = Math.min(maxX, minX + Math.floor(((dx + 0.5) / cellSize) * sw));
        const pIdx = sy * srcW + sx;
        if (!mask[pIdx]) continue;

        const sIdx = pIdx * 4;
        let r = srcRgba[sIdx];
        const g = srcRgba[sIdx + 1];
        let b = srcRgba[sIdx + 2];

        const hasBgNeighbor =
          sx <= minX ||
          sx >= maxX ||
          sy <= minY ||
          sy >= maxY ||
          !mask[pIdx - 1] ||
          !mask[pIdx + 1] ||
          !mask[pIdx - srcW] ||
          !mask[pIdx + srcW];

        if (hasBgNeighbor) {
          // Despill pink/magenta JPEG edge halo while preserving green foliage & warm bark intact
          if (r > g + 34 && b > g + 30 && g < 138) {
            if (Math.min(r, b) - g > 64 && g < 88) {
              continue;
            }
            const limit = Math.min(255, g + 18);
            r = Math.min(r, limit);
            b = Math.min(b, limit);
          }
        }

        const dIdx = (dy * dstW + (ox + dx)) * 4;
        dst[dIdx] = r;
        dst[dIdx + 1] = g;
        dst[dIdx + 2] = b;
        dst[dIdx + 3] = 255;
      }
    }
  }

  return { width: dstW, height: dstH, data: dst };
}

function drawProceduralFallbackOverhangSheet(
  ctx: CanvasRenderingContext2D,
  cell: number
): void {
  const slots = OVERHANG_SHEET_SLOTS.length;
  ctx.clearRect(0, 0, cell * slots, cell);
  const scale = cell / 32;
  ctx.save();
  ctx.scale(scale, scale);

  const c32 = 32;
  // Slot 0: edge_lip
  {
    const ox = 0 * c32;
    for (let px = 0; px < c32; px++) {
      const drop = 16 + ((px * 3 + 2) % 6) + (px % 9 === 0 ? 3 : 0);
      ctx.fillStyle = PALETTE.stoneShadow;
      ctx.fillRect(ox + px, 0, 1, drop + 2);
      ctx.fillStyle = px % 5 === 0 ? PALETTE.stoneMid : PALETTE.stoneHighlight;
      ctx.fillRect(ox + px, 0, 1, Math.max(8, drop - 2));
      ctx.fillStyle = PALETTE.moss;
      ctx.fillRect(ox + px, 0, 1, 4 + (px % 4 === 0 ? 1 : 0));
    }
  }
  // Slot 1: worn_capstone
  {
    const ox = 1 * c32;
    const blocks = [0, 9, 17, 25];
    for (let px = 0; px < c32; px++) {
      const n = hashCell(px, 1, 11);
      const isSeam = blocks.includes(px);
      const drop = isSeam ? 18 : 22 + Math.floor(n * 4);
      ctx.fillStyle = PALETTE.cryptInk;
      ctx.fillRect(ox + px, 0, 1, drop + 2);
      ctx.fillStyle = isSeam ? PALETTE.stoneShadow : n > 0.55 ? PALETTE.stoneHighlight : PALETTE.stoneMid;
      ctx.fillRect(ox + px, 0, 1, drop);
      ctx.fillStyle = PALETTE.boneGray;
      ctx.fillRect(ox + px, 0, 1, 4);
    }
  }
  // Slot 2: cracked_trim
  {
    const ox = 2 * c32;
    for (let px = 0; px < c32; px++) {
      const notch = px % 8 === 3 || px % 11 === 7 ? 3 : 0;
      const drop = Math.max(12, 22 - notch + (px % 5));
      ctx.fillStyle = PALETTE.cryptInk;
      ctx.fillRect(ox + px, 0, 1, drop + 2);
      ctx.fillStyle = px % 3 === 0 ? PALETTE.coldStone : PALETTE.stoneMid;
      ctx.fillRect(ox + px, 0, 1, drop);
      ctx.fillStyle = PALETTE.boneGray;
      ctx.fillRect(ox + px, 0, 1, 3);
    }
  }
  // Slot 3: mossy_patch
  {
    const ox = 3 * c32;
    const lobes = [
      { cx: 5, w: 7, d: 22 },
      { cx: 13, w: 8, d: 28 },
      { cx: 21, w: 7, d: 21 },
      { cx: 28, w: 6, d: 24 },
    ];
    ctx.fillStyle = PALETTE.pitchBlackGreen;
    ctx.fillRect(ox, 0, c32, 12);
    ctx.fillStyle = PALETTE.forestGreen;
    ctx.fillRect(ox, 0, c32, 9);
    ctx.fillStyle = PALETTE.moss;
    ctx.fillRect(ox, 0, c32, 4);
    for (const lobe of lobes) {
      const x0 = Math.max(0, lobe.cx - Math.floor(lobe.w * 0.5));
      const x1 = Math.min(c32 - 1, lobe.cx + Math.floor(lobe.w * 0.5));
      for (let px = x0; px <= x1; px++) {
        const edgeDist = Math.abs(px - lobe.cx) / Math.max(1, lobe.w * 0.5);
        const h = Math.max(10, Math.round(lobe.d * (1 - edgeDist * edgeDist * 0.45)));
        ctx.fillStyle = PALETTE.pitchBlackGreen;
        ctx.fillRect(ox + px, 6, 1, h - 4);
        ctx.fillStyle = PALETTE.forestGreen;
        ctx.fillRect(ox + px, 4, 1, h - 6);
        if (edgeDist < 0.65) {
          ctx.fillStyle = PALETTE.emerald;
          ctx.fillRect(ox + px, 3, 1, Math.max(4, h - 9));
        }
      }
    }
  }
  // Slot 4: hanging_roots
  {
    const ox = 4 * c32;
    const roots = [
      { sx: 5, len: 24, baseW: 4, drift: -1 },
      { sx: 14, len: 30, baseW: 5, drift: 1 },
      { sx: 23, len: 22, baseW: 4, drift: -1 },
      { sx: 29, len: 17, baseW: 3, drift: 0 },
    ];
    ctx.fillStyle = PALETTE.cryptInk;
    ctx.fillRect(ox, 0, c32, 8);
    ctx.fillStyle = PALETTE.darkOak;
    ctx.fillRect(ox, 0, c32, 6);
    for (const rt of roots) {
      for (let py = 3; py < rt.len; py++) {
        const t = (py - 3) / Math.max(1, rt.len - 3);
        const sway = Math.round(Math.sin(t * Math.PI * 1.5) * rt.drift);
        const w = Math.max(1, Math.round(rt.baseW * (1 - t * 0.7)));
        const px = Math.max(1, Math.min(c32 - w - 1, rt.sx + sway - Math.floor(w * 0.5)));
        ctx.fillStyle = PALETTE.cryptInk;
        ctx.fillRect(ox + px - 1, py, w + 2, 2);
        ctx.fillStyle = PALETTE.burntUmber;
        ctx.fillRect(ox + px, py, w, 1);
      }
    }
  }
  // Slot 5: hanging_vine
  {
    const ox = 5 * c32;
    const drapeCols = [
      { cx: 5, halfW: 4, len: 23 },
      { cx: 14, halfW: 5, len: 30 },
      { cx: 24, halfW: 4, len: 25 },
    ];
    ctx.fillStyle = PALETTE.pitchBlackGreen;
    ctx.fillRect(ox, 0, c32, 8);
    ctx.fillStyle = PALETTE.forestGreen;
    ctx.fillRect(ox, 0, c32, 6);
    for (const d of drapeCols) {
      for (let py = 4; py < d.len; py++) {
        const t = (py - 4) / Math.max(1, d.len - 4);
        const w = Math.max(2, Math.round(d.halfW * 2 * (1 - t * 0.7)));
        const sx = ox + d.cx - Math.floor(w * 0.5);
        ctx.fillStyle = PALETTE.pitchBlackGreen;
        ctx.fillRect(sx - 1, py, w + 2, 2);
        ctx.fillStyle = PALETTE.emerald;
        ctx.fillRect(sx, py, w, 1);
      }
    }
  }
  // Slot 6: crystal_icicle
  {
    const ox = 6 * c32;
    const spikes = [
      { x: 2, w: 6, h: 20 },
      { x: 9, w: 7, h: 29 },
      { x: 17, w: 6, h: 23 },
      { x: 24, w: 6, h: 25 },
    ];
    ctx.fillStyle = PALETTE.frostedGlass;
    ctx.fillRect(ox, 0, c32, 5);
    for (const sp of spikes) {
      for (let row = 2; row < sp.h; row++) {
        const shrink = Math.floor(((row - 2) / sp.h) * (sp.w * 0.5));
        const curW = Math.max(2, sp.w - shrink * 2);
        ctx.fillStyle = PALETTE.cryptInk;
        ctx.fillRect(ox + sp.x + shrink - 1, row, curW + 2, 2);
        ctx.fillStyle = row < 10 ? PALETTE.iceCyan : PALETTE.kiCyan;
        ctx.fillRect(ox + sp.x + shrink, row, curW, 1);
      }
    }
  }
  // Slot 7: overhang_turf
  {
    const ox = 7 * c32;
    for (let px = 0; px < c32; px++) {
      const blade = 14 + (px % 5 === 0 ? 7 : px % 3 === 0 ? 4 : 0);
      ctx.fillStyle = PALETTE.pitchBlackGreen;
      ctx.fillRect(ox + px, 0, 1, blade + 2);
      ctx.fillStyle = PALETTE.forestGreen;
      ctx.fillRect(ox + px, 0, 1, blade);
      ctx.fillStyle = PALETTE.moss;
      ctx.fillRect(ox + px, 0, 1, Math.max(6, blade - 6));
    }
  }
  ctx.restore();
}

let cachedProcessedSheet: ImageData | null = null;
let cachedNormalBuffer: Uint8ClampedArray | null = null;
let loadingSheetPromise: Promise<ImageData | null> | null = null;

function getSlotReliefProfile(slotIndex: number): {
  slopeStrength: number;
  bevelStrength: number;
} {
  // Slot 6: crystal_icicle (sharp faceted edges)
  if (slotIndex === 6) {
    return { slopeStrength: 3.1, bevelStrength: 0.85 };
  }
  // Slots 3, 4, 5, 7: foliage / roots / vines / turf (sculpted organic lobes)
  if (slotIndex === 3 || slotIndex === 4 || slotIndex === 5 || slotIndex === 7) {
    return { slopeStrength: 2.6, bevelStrength: 0.72 };
  }
  // Slots 0, 1, 2: carved stone cornices & capstone seams
  return { slopeStrength: 2.4, bevelStrength: 0.65 };
}

/**
 * Generates an OpenGL tangent-space normal map (Linear RGBA) from an overhang
 * sprite strip using per-slot clamped 3x3 Sobel gradients + silhouette bevel cushions.
 */
export function buildOverhangNormalBuffer(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  cellSize = CELL_PX
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  const totalPixels = width * height;
  const luma = new Float32Array(totalPixels);
  const opaque = new Uint8Array(totalPixels);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const a = rgba[idx + 3];
    if (a > 128) {
      opaque[i] = 1;
      luma[i] =
        (rgba[idx] * 0.299 + rgba[idx + 1] * 0.587 + rgba[idx + 2] * 0.114) / 255;
    }
  }

  const slotCount = Math.max(1, Math.floor(width / Math.max(1, cellSize)));

  for (let s = 0; s < slotCount; s++) {
    const sx0 = s * cellSize;
    const sx1 = Math.min(width - 1, sx0 + cellSize - 1);
    const { slopeStrength, bevelStrength } = getSlotReliefProfile(s);

    const sampleH = (px: number, py: number): number => {
      const cx = Math.max(sx0, Math.min(sx1, px));
      const cy = Math.max(0, Math.min(height - 1, py));
      const pIdx = cy * width + cx;
      if (!opaque[pIdx]) return 0;

      // Compute 1-2px inward silhouette cushion so crisp pixel silhouettes catch directional rim light
      let inwardDist = 0;
      const upOpaque = cy > 0 && opaque[(cy - 1) * width + cx] === 1;
      const dnOpaque = cy < height - 1 && opaque[(cy + 1) * width + cx] === 1;
      const lfOpaque = cx > sx0 && opaque[cy * width + (cx - 1)] === 1;
      const rtOpaque = cx < sx1 && opaque[cy * width + (cx + 1)] === 1;
      if (upOpaque && dnOpaque && lfOpaque && rtOpaque) {
        inwardDist = 1.0;
      } else if (upOpaque || dnOpaque || lfOpaque || rtOpaque) {
        inwardDist = 0.45;
      }
      return luma[pIdx] * 0.72 + inwardDist * bevelStrength * 0.55;
    };

    for (let y = 0; y < height; y++) {
      for (let x = sx0; x <= sx1; x++) {
        const idx = (y * width + x) * 4;
        if (!opaque[y * width + x]) {
          out[idx] = 128;
          out[idx + 1] = 128;
          out[idx + 2] = 255;
          out[idx + 3] = 255;
          continue;
        }

        const tl = sampleH(x - 1, y - 1);
        const tc = sampleH(x, y - 1);
        const tr = sampleH(x + 1, y - 1);
        const ml = sampleH(x - 1, y);
        const mr = sampleH(x + 1, y);
        const bl = sampleH(x - 1, y + 1);
        const bc = sampleH(x, y + 1);
        const br = sampleH(x + 1, y + 1);

        const dx = (tr + 2 * mr + br) - (tl + 2 * ml + bl);
        const dy = (bl + 2 * bc + br) - (tl + 2 * tc + tr);

        let nx = -dx * slopeStrength;
        // Canvas row +Y points downward (-V in UV); upward-facing lip edges yield positive +V normal
        let ny = dy * slopeStrength;
        let nz = 1.0;

        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;

        out[idx] = Math.max(0, Math.min(255, Math.round((nx * 0.5 + 0.5) * 255)));
        out[idx + 1] = Math.max(0, Math.min(255, Math.round((ny * 0.5 + 0.5) * 255)));
        out[idx + 2] = Math.max(128, Math.min(255, Math.round((nz * 0.5 + 0.5) * 255)));
        out[idx + 3] = 255;
      }
    }
  }

  return out;
}

function loadChromaKeyedOverhangSheet(): Promise<ImageData | null> {
  if (cachedProcessedSheet) return Promise.resolve(cachedProcessedSheet);
  if (loadingSheetPromise) return loadingSheetPromise;
  if (typeof Image === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve(null);
  }

  loadingSheetPromise = new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const scratch = document.createElement('canvas');
        scratch.width = img.naturalWidth || img.width;
        scratch.height = img.naturalHeight || img.height;
        const sctx = scratch.getContext('2d');
        if (!sctx || scratch.width === 0 || scratch.height === 0) {
          resolve(null);
          return;
        }
        sctx.drawImage(img, 0, 0);
        const srcImgData = sctx.getImageData(0, 0, scratch.width, scratch.height);
        const processed = processMagentaGridOverhangBuffer(
          srcImgData.data,
          scratch.width,
          scratch.height,
          3,
          2,
          CELL_PX
        );
        const outData = new ImageData(processed.width, processed.height);
        outData.data.set(processed.data);
        cachedProcessedSheet = outData;
        cachedNormalBuffer = buildOverhangNormalBuffer(
          processed.data,
          processed.width,
          processed.height,
          CELL_PX
        );
        resolve(outData);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = OVERHANG_ASSET_SHEET_URL;
  });

  return loadingSheetPromise;
}

export function createOverhangTexturePair(): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  const slots = OVERHANG_SHEET_SLOTS.length; // 8 -> 512x64 power-of-two sprite sheet
  const width = CELL_PX * slots;
  const height = CELL_PX;

  if (typeof document === 'undefined') {
    const albedoData = new Uint8Array(width * height * 4);
    const map = new THREE.DataTexture(albedoData, width, height, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace;
    map.magFilter = THREE.NearestFilter;
    map.minFilter = THREE.NearestFilter;
    map.generateMipmaps = false;
    map.needsUpdate = true;

    const normalRaw = buildOverhangNormalBuffer(albedoData, width, height, CELL_PX);
    const normalMap = new THREE.DataTexture(
      new Uint8Array(normalRaw),
      width,
      height,
      THREE.RGBAFormat
    );
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.magFilter = THREE.NearestFilter;
    normalMap.minFilter = THREE.NearestFilter;
    normalMap.generateMipmaps = false;
    normalMap.needsUpdate = true;

    map.userData.normalMap = normalMap;
    return { map, normalMap };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const nCanvas = document.createElement('canvas');
  nCanvas.width = width;
  nCanvas.height = height;
  const nCtx = nCanvas.getContext('2d')!;

  const writeNormalBuffer = (buf: Uint8ClampedArray) => {
    const nImg = nCtx.createImageData(width, height);
    nImg.data.set(buf);
    nCtx.putImageData(nImg, 0, 0);
  };

  if (cachedProcessedSheet) {
    ctx.putImageData(cachedProcessedSheet, 0, 0);
    if (!cachedNormalBuffer) {
      cachedNormalBuffer = buildOverhangNormalBuffer(
        cachedProcessedSheet.data,
        width,
        height,
        CELL_PX
      );
    }
    writeNormalBuffer(cachedNormalBuffer);
  } else {
    drawProceduralFallbackOverhangSheet(ctx, CELL_PX);
    const fallbackPixels = ctx.getImageData(0, 0, width, height);
    writeNormalBuffer(
      buildOverhangNormalBuffer(fallbackPixels.data, width, height, CELL_PX)
    );
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;

  const normalTex = new THREE.CanvasTexture(nCanvas);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.magFilter = THREE.NearestFilter;
  normalTex.minFilter = THREE.NearestFilter;
  normalTex.generateMipmaps = false;
  normalTex.needsUpdate = true;

  tex.userData.normalMap = normalTex;

  if (!cachedProcessedSheet) {
    let mapDisposed = false;
    let normalDisposed = false;
    tex.addEventListener('dispose', () => {
      mapDisposed = true;
    });
    normalTex.addEventListener('dispose', () => {
      normalDisposed = true;
    });
    void loadChromaKeyedOverhangSheet().then((processed) => {
      if (!processed) return;
      if (!mapDisposed) {
        ctx.putImageData(processed, 0, 0);
        tex.needsUpdate = true;
      }
      if (!normalDisposed) {
        if (!cachedNormalBuffer) {
          cachedNormalBuffer = buildOverhangNormalBuffer(
            processed.data,
            width,
            height,
            CELL_PX
          );
        }
        writeNormalBuffer(cachedNormalBuffer);
        normalTex.needsUpdate = true;
      }
    });
  }

  return { map: tex, normalMap: normalTex };
}

export function createOverhangAssetSheet(): THREE.Texture {
  return createOverhangTexturePair().map;
}

export function createOverhangMaterial(
  texture: THREE.Texture,
  normalTexture?: THREE.Texture,
  biome: BattleBiome = 'meadow',
  isCave = false
): THREE.MeshStandardMaterial {
  const resolvedNormal =
    normalTexture ?? (texture.userData.normalMap as THREE.Texture | undefined) ?? null;
  if (resolvedNormal && resolvedNormal.colorSpace !== THREE.NoColorSpace) {
    resolvedNormal.colorSpace = THREE.NoColorSpace;
  }

  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    normalMap: resolvedNormal,
    normalMapType: THREE.TangentSpaceNormalMap,
    normalScale: new THREE.Vector2(1.45, 1.45),
    alphaTest: 0.45,
    roughness: 0.88,
    metalness: 0.05,
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  attachCameraOcclusionCutout(mat, { minRelY: OCCLUSION_TERRAIN_MIN_REL_Y });
  attachCliffEdgeDirectionalLighting(mat, biome, isCave);
  return mat;
}

function getBiomeOverhangTint(
  map: MapDef,
  kind: OverhangAssetKind
): [number, number, number] {
  if (kind === 'crystal_icicle') {
    return map.biome === 'cave' || map.music === 'cave'
      ? [0.88, 0.78, 1.0]
      : [0.96, 0.99, 1.0];
  }
  if (kind === 'hanging_vine' || kind === 'mossy_patch' || kind === 'overhang_turf') {
    return map.biome === 'forest' ? [0.92, 1.0, 0.90] : [0.96, 0.98, 0.92];
  }
  if (kind === 'hanging_roots') {
    return map.biome === 'cave' || map.music === 'cave'
      ? [0.78, 0.74, 0.88]
      : [0.98, 0.94, 0.90];
  }
  if (map.biome === 'cave' || map.music === 'cave') {
    return [0.80, 0.76, 0.94];
  }
  if (map.biome === 'snow') {
    return [0.96, 0.98, 1.0];
  }
  if (map.biome === 'mountain') {
    return [0.98, 0.95, 0.92];
  }
  return [0.97, 0.97, 0.96];
}

function pushQuad(
  positions: number[],
  normals: number[],
  uvs: number[],
  colors: number[],
  indices: number[],
  verts: readonly [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ],
  normal: readonly [number, number, number],
  quadUvs: readonly [number, number, number, number, number, number, number, number],
  color: readonly [number, number, number]
): void {
  const base = positions.length / 3;
  for (let i = 0; i < 4; i++) {
    positions.push(verts[i][0], verts[i][1], verts[i][2]);
    normals.push(normal[0], normal[1], normal[2]);
    colors.push(color[0], color[1], color[2]);
  }
  uvs.push(
    quadUvs[0],
    quadUvs[1],
    quadUvs[2],
    quadUvs[3],
    quadUvs[4],
    quadUvs[5],
    quadUvs[6],
    quadUvs[7]
  );
  indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

/**
 * Emits a 5-face volumetric 3D overhanging cornice slab in our cyclic (N, T, Y) basis
 * where T = (nz, 0, -nx) satisfies N x T = +Y.
 */
function emitVolumetricCorniceSlab(
  positions: number[],
  normals: number[],
  uvs: number[],
  colors: number[],
  indices: number[],
  cx: number,
  cz: number,
  nx: number,
  nz: number,
  tStart: number,
  tEnd: number,
  dWall: number,
  dOut: number,
  dBackTop: number,
  yTopIn: number,
  yTopOut: number,
  yBot: number,
  u0: number,
  u1: number,
  vTop: number,
  vFrontBot: number,
  capU0: number,
  capU1: number,
  capVOuter: number,
  capVInner: number,
  baseColor: readonly [number, number, number],
  dirMul: number
): void {
  const tx = nz;
  const tz = -nx;

  const pt = (t: number, y: number, n: number): [number, number, number] => [
    cx + tx * t + nx * n,
    y,
    cz + tz * t + nz * n,
  ];

  // 1. Front protruding lip face (+N)
  const frontCol: [number, number, number] = [
    baseColor[0] * dirMul,
    baseColor[1] * dirMul,
    baseColor[2] * dirMul,
  ];
  pushQuad(
    positions,
    normals,
    uvs,
    colors,
    indices,
    [pt(tStart, yBot, dOut), pt(tEnd, yBot, dOut), pt(tEnd, yTopOut, dOut), pt(tStart, yTopOut, dOut)],
    [nx, 0, nz],
    [u0, vFrontBot, u1, vFrontBot, u1, vTop, u0, vTop],
    frontCol
  );

  // 2. Top shelf cap (+Y) mapped onto the dedicated top-down rim texture slot
  const topCol: [number, number, number] = [
    Math.min(1, baseColor[0] * 1.03),
    Math.min(1, baseColor[1] * 1.03),
    Math.min(1, baseColor[2] * 1.03),
  ];
  pushQuad(
    positions,
    normals,
    uvs,
    colors,
    indices,
    [
      pt(tStart, yTopOut, dOut),
      pt(tEnd, yTopOut, dOut),
      pt(tEnd, yTopIn, dBackTop),
      pt(tStart, yTopIn, dBackTop),
    ],
    [0, 1, 0],
    [capU0, capVOuter, capU1, capVOuter, capU1, capVInner, capU0, capVInner],
    topCol
  );

  // 3. Undercut shadow soffit (-Y) right below the projecting lip
  const soffitCol: [number, number, number] = [
    baseColor[0] * 0.24,
    baseColor[1] * 0.24,
    baseColor[2] * 0.24,
  ];
  pushQuad(
    positions,
    normals,
    uvs,
    colors,
    indices,
    [pt(tStart, yBot, dWall), pt(tEnd, yBot, dWall), pt(tEnd, yBot, dOut), pt(tStart, yBot, dOut)],
    [0, -1, 0],
    [u0, vFrontBot, u1, vFrontBot, u1, vTop, u0, vTop],
    soffitCol
  );

  // 4. Right end-cap (+T) closing stepped volume back to the cliff wall
  const sideU1 = u0 + (u1 - u0) * 0.35;
  const sideColR: [number, number, number] = [
    baseColor[0] * 0.72,
    baseColor[1] * 0.72,
    baseColor[2] * 0.72,
  ];
  pushQuad(
    positions,
    normals,
    uvs,
    colors,
    indices,
    [pt(tEnd, yBot, dOut), pt(tEnd, yBot, dWall), pt(tEnd, yTopOut, dWall), pt(tEnd, yTopOut, dOut)],
    [tx, 0, tz],
    [u0, vFrontBot, sideU1, vFrontBot, sideU1, vTop, u0, vTop],
    sideColR
  );

  // 5. Left end-cap (-T) closing stepped volume back to the cliff wall
  const sideColL: [number, number, number] = [
    baseColor[0] * 0.66,
    baseColor[1] * 0.66,
    baseColor[2] * 0.66,
  ];
  pushQuad(
    positions,
    normals,
    uvs,
    colors,
    indices,
    [
      pt(tStart, yBot, dWall),
      pt(tStart, yBot, dOut),
      pt(tStart, yTopOut, dOut),
      pt(tStart, yTopOut, dWall),
    ],
    [-tx, 0, -tz],
    [sideU1, vFrontBot, u0, vFrontBot, u0, vTop, sideU1, vTop],
    sideColL
  );
}

export function buildProceduralOverhangsGroup(
  map: MapDef,
  material?: THREE.Material
): THREE.Group | null {
  const placements = generateCliffOverhangPlan(map);
  if (placements.length === 0) return null;

  const group = new THREE.Group();
  let ownedTex: THREE.Texture | null = null;
  let ownedNormalTex: THREE.Texture | null = null;
  let ownedMat: THREE.MeshStandardMaterial | null = null;
  let mat = material;
  if (!mat) {
    const pair = createOverhangTexturePair();
    ownedTex = pair.map;
    ownedNormalTex = pair.normalMap;
    ownedMat = createOverhangMaterial(
      ownedTex,
      ownedNormalTex,
      map.biome,
      map.music === 'cave'
    );
    mat = ownedMat;
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const stats: OverhangGenerationStats = {
    total: placements.length,
    corners: 0,
    withTopCap: 0,
    volumetricSlabs: 0,
    drapeSkirts: 0,
    byKind: {},
  };

  const slotStep = 1 / OVERHANG_SHEET_SLOTS.length;
  const epsU = 0.002;
  const epsV = 0.008;

  for (const p of placements) {
    if (p.isCorner) stats.corners++;
    if (p.hasTopCap) stats.withTopCap++;
    stats.byKind[p.kind] = (stats.byKind[p.kind] ?? 0) + 1;

    const slot = SLOT_INDEX[p.kind];
    const u0 = slot * slotStep + epsU;
    const u1 = (slot + 1) * slotStep - epsU;
    const uMid = (u0 + u1) * 0.5;
    const vTop = 1 - epsV;
    const vFrontBot = 0.14; // Show full rounded moss lobes / rock strata / icicles on the 3D overhanging lip

    // Map top horizontal cap (+Y) cleanly onto top-down turf (slot 7) or stone rim (slot 0)
    const capSlot =
      p.kind === 'mossy_patch' || p.kind === 'overhang_turf'
        ? SLOT_INDEX.overhang_turf
        : SLOT_INDEX.edge_lip;
    const cu0 = capSlot * slotStep + epsU;
    const cu1 = (capSlot + 1) * slotStep - epsU;
    const cuMid = (cu0 + cu1) * 0.5;
    const cvOuter = 1 - epsV;
    const cvInner = epsV + 0.08;

    const tint = getBiomeOverhangTint(map, p.kind);
    const dirMul =
      p.face === 'south' ? 1.0 : p.face === 'east' ? 0.94 : p.face === 'west' ? 0.88 : 0.82;

    // Anchor at exact tile wall face (b.x + nx * 0.5, b.z + nz * 0.5)
    const wallX = p.tileX + p.nx * 0.5;
    const wallZ = p.tileZ + p.nz * 0.5;
    const dWall = 0.01;
    const dBackTop = -p.capDepth;

    const subJitter =
      (hashEdge(p.tileX * 2 + 1, p.tileZ * 2 + 3, p.face, 99) - 0.5) * 0.032;
    const dOutA = p.overhangProjection + subJitter;
    const dOutB = p.overhangProjection - subJitter * 0.85;
    const lipBotA = p.y - p.lipThickness;
    const lipBotB = p.y - p.lipThickness * (0.92 + (subJitter > 0 ? 0.16 : -0.06));
    const yTopOut = p.y + OVERHANG_CAP_LIFT;
    const yTopIn = yTopOut + 0.005;

    const tMin = -0.5 - (p.extendLeftCorner ? p.overhangProjection * 0.85 : 0);
    const tMax = 0.5 + (p.extendRightCorner ? p.overhangProjection * 0.85 : 0);

    // Split straight cliff edges into 2 organically stepped 3D slabs (Octopath chunky diorama rim)
    emitVolumetricCorniceSlab(
      positions,
      normals,
      uvs,
      colors,
      indices,
      wallX,
      wallZ,
      p.nx,
      p.nz,
      tMin,
      0,
      dWall,
      dOutA,
      dBackTop,
      yTopIn,
      yTopOut,
      lipBotA,
      u0,
      uMid,
      vTop,
      vFrontBot,
      cu0,
      cuMid,
      cvOuter,
      cvInner,
      tint,
      dirMul
    );
    emitVolumetricCorniceSlab(
      positions,
      normals,
      uvs,
      colors,
      indices,
      wallX,
      wallZ,
      p.nx,
      p.nz,
      0,
      tMax,
      dWall,
      dOutB,
      dBackTop,
      yTopIn,
      yTopOut,
      lipBotB,
      uMid,
      u1,
      vTop,
      vFrontBot,
      cuMid,
      cu1,
      cvOuter,
      cvInner,
      tint,
      dirMul
    );
    stats.volumetricSlabs += 2;

    // Hanging roots / vines / crystal icicles suspended right beneath the protruding cornice
    if (p.drapeKind && p.drapeHeight > 0.05) {
      const dSlot = SLOT_INDEX[p.drapeKind];
      const du0 = dSlot * slotStep + epsU;
      const du1 = (dSlot + 1) * slotStep - epsU;
      const dvTop = 1 - epsV;
      const dvBot = epsV;
      const dTint = getBiomeOverhangTint(map, p.drapeKind);
      const dMul = dirMul * 0.96;
      const dColor: [number, number, number] = [
        dTint[0] * dMul,
        dTint[1] * dMul,
        dTint[2] * dMul,
      ];

      const tx = p.nz;
      const tz = -p.nx;
      const dDrapeOffset = 0.064;
      const dyTop = p.y - p.lipThickness * 0.35;
      const dyBot = p.y - p.drapeHeight;
      const dhw = 0.48;

      const dpt = (t: number, y: number): [number, number, number] => [
        wallX + tx * t + p.nx * dDrapeOffset,
        y,
        wallZ + tz * t + p.nz * dDrapeOffset,
      ];

      pushQuad(
        positions,
        normals,
        uvs,
        colors,
        indices,
        [dpt(-dhw, dyBot), dpt(dhw, dyBot), dpt(dhw, dyTop), dpt(-dhw, dyTop)],
        [p.nx, 0, p.nz],
        [du0, dvBot, du1, dvBot, du1, dvTop, du0, dvTop],
        dColor
      );
      stats.drapeSkirts++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeTangents();
  geo.computeBoundingSphere();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = DIORAMA_RENDER_ORDER.CLIFF_ORNAMENT;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.userData.overhangStats = stats;
  group.add(mesh);

  group.userData.overhangStats = stats;
  if (ownedTex) group.userData.createdTexture = ownedTex;
  if (ownedNormalTex) group.userData.createdNormalTexture = ownedNormalTex;
  if (ownedMat) group.userData.createdMaterial = ownedMat;
  group.matrixAutoUpdate = false;
  group.updateMatrix();
  return group;
}
