import { createRng } from '../core/Rng.ts';
import type { TileKind } from '../domain/types.ts';
import { PALETTE } from './Palette.ts';

export const TILE_SIZE = 64;
export const ATLAS_GRID = 8;
export const ATLAS_SIZE = TILE_SIZE * ATLAS_GRID; // 512x512 (64 slots of 64x64)
export const SHEET_CELL_SIZE = 64;

export type TileAtlasKey =
  | TileKind
  | 'water_1'
  | 'wall_plaster'
  | 'wall_brick'
  | 'wall_fieldstone'
  | 'wall_castle'
  | 'wall_crypt'
  | 'wall_iron'
  | 'wall_vine_brick'
  | 'wall_wood_gold'
  | 'palace_tile'
  | 'cliff_rock'
  | 'cracked_stone'
  | 'mossy_stone'
  | 'window'
  | 'door'
  | 'roof_red'
  | 'roof_blue'
  | 'roof_pink'
  | 'roof_teal'
  | 'roof_purple'
  | 'roof_orange'
  | 'roof_slate'
  | 'roof_wood'
  | 'roof_patina';

export const TILE_ATLAS_INDEX: Record<TileAtlasKey, number> = {
  grass: 0,
  dirt: 1,
  stone: 2,
  cobble: 3,
  sand: 4,
  water: 5,
  water_1: 6,
  planks: 7,
  log: 8,
  leaves: 9,
  flowers: 10,
  tall_grass: 11,
  snow: 12,
  cave_floor: 13,
  stairs: 14,
  bridge: 15,
  arena_floor: 16,
  wall_plaster: 17,
  wall_brick: 18,
  window: 19,
  door: 20,
  roof_red: 21,
  roof_blue: 22,
  roof_pink: 23,
  roof_teal: 24,
  roof_purple: 25,
  roof_orange: 26,
  cliff_rock: 27,
  cracked_stone: 28,
  mossy_stone: 29,
  palace_tile: 30,
  wall_fieldstone: 31,
  wall_castle: 32,
  wall_crypt: 33,
  wall_iron: 34,
  wall_vine_brick: 35,
  wall_wood_gold: 36,
  roof_slate: 37,
  roof_wood: 38,
  roof_patina: 39,
};

export interface SheetCellCoord {
  row: number;
  col: number;
}

/**
 * Coherent semantic mapping from the processed 5x5 tile sheet (rows 0..4, cols 0..4)
 * to every terrain, floor, cliff, wall, door, and roof key used by the game engine.
 */
export const SHEET_TILE_MAPPING: Partial<Record<TileAtlasKey, SheetCellCoord>> = {
  // Row 0: ground turf, earth, cobblestone, cut flagstones, ornate cream palace tile
  grass: { row: 0, col: 0 },
  dirt: { row: 0, col: 1 },
  cobble: { row: 0, col: 2 },
  stone: { row: 0, col: 3 },
  palace_tile: { row: 0, col: 4 },

  // Row 1: wood planks/bridge, dark violet cave/dungeon stone, cracked slate, mossy flagstones, royal indigo/gold arena
  planks: { row: 1, col: 0 },
  bridge: { row: 1, col: 0 },
  cave_floor: { row: 1, col: 1 },
  cracked_stone: { row: 1, col: 2 },
  mossy_stone: { row: 1, col: 3 },
  arena_floor: { row: 1, col: 4 },

  // Row 2: rough fieldstone wall, clay brick, iron-braced timber door/beams, dark castle wall, crypt wall with rings
  wall_fieldstone: { row: 2, col: 0 },
  wall_brick: { row: 2, col: 1 },
  door: { row: 2, col: 2 },
  log: { row: 2, col: 2 },
  wall_castle: { row: 2, col: 3 },
  wall_crypt: { row: 2, col: 4 },

  // Row 3: iron-banded stone, vine-covered brick, dark wood & gold trim, jagged cliff rock, half-timber plaster
  wall_iron: { row: 3, col: 0 },
  wall_vine_brick: { row: 3, col: 1 },
  wall_wood_gold: { row: 3, col: 2 },
  cliff_rock: { row: 3, col: 3 },
  wall_plaster: { row: 3, col: 4 },

  // Row 4: terracotta, slate, brown wood shakes, mossy dark roof, royal blue & gold scale roof
  roof_red: { row: 4, col: 0 },
  roof_pink: { row: 4, col: 0 },
  roof_slate: { row: 4, col: 1 },
  roof_teal: { row: 4, col: 1 },
  roof_wood: { row: 4, col: 2 },
  roof_orange: { row: 4, col: 2 },
  roof_patina: { row: 4, col: 3 },
  roof_blue: { row: 4, col: 4 },
  roof_purple: { row: 4, col: 4 },
};

export const EXTRA_SHEET_COLS = 5;
export const EXTRA_SHEET_ROWS = 2;

/**
 * Coherent mapping for the extra 5x2 terrain/facade sheet (`tiles_extra_albedo.png` & `tiles_extra_normal.png`).
 * Row 0: water, water_1, window, snow, stairs
 * Row 1: door, flowers, tall_grass, sand, leaves
 */
export const EXTRA_TILE_MAPPING: Partial<Record<TileAtlasKey, SheetCellCoord>> = {
  water: { row: 0, col: 0 },
  water_1: { row: 0, col: 1 },
  window: { row: 0, col: 2 },
  snow: { row: 0, col: 3 },
  stairs: { row: 0, col: 4 },
  door: { row: 1, col: 0 },
  flowers: { row: 1, col: 1 },
  tall_grass: { row: 1, col: 2 },
  sand: { row: 1, col: 3 },
  leaves: { row: 1, col: 4 },
};

const SCALE = TILE_SIZE / 16;

function drawPixelTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  base: string,
  shades: readonly string[],
  seed: number,
  pattern:
    | 'noise'
    | 'cobble'
    | 'planks'
    | 'water'
    | 'flowers'
    | 'tall_grass'
    | 'arena'
    | 'log'
    | 'stairs'
    | 'roof'
    | 'window'
    | 'door'
    | 'brick'
): void {
  const ox = col * TILE_SIZE;
  const oy = row * TILE_SIZE;
  const rng = createRng(seed);
  const px = (x: number, y: number, w: number, h: number) => {
    ctx.fillRect(ox + x * SCALE, oy + y * SCALE, w * SCALE, h * SCALE);
  };

  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);

  switch (pattern) {
    case 'noise':
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (rng.chance(36)) {
            ctx.fillStyle = rng.pick(shades);
            px(x, y, 1, 1);
          }
        }
      }
      return;

    case 'cobble': {
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      const stones = [
        [1, 1, 6, 6],
        [8, 1, 7, 5],
        [1, 8, 7, 7],
        [9, 7, 6, 8],
      ];
      for (let i = 0; i < stones.length; i++) {
        const [sx, sy, sw, sh] = stones[i];
        ctx.fillStyle = i % 2 === 0 ? base : shades[1];
        px(sx, sy, sw, sh);
        ctx.fillStyle = shades[2];
        px(sx, sy, sw, 1);
      }
      return;
    }

    case 'planks':
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? base : shades[0];
        px(0, y, 16, 3);
        ctx.fillStyle = shades[1];
        px(0, y + 3, 16, 1);
      }
      ctx.fillStyle = shades[1];
      px(7, 0, 1, 4);
      px(12, 4, 1, 4);
      px(3, 8, 1, 4);
      px(10, 12, 1, 4);
      return;

    case 'log':
      for (let x = 0; x < 16; x += 2) {
        ctx.fillStyle = x % 4 === 0 ? base : shades[0];
        px(x, 0, 2, 16);
      }
      ctx.fillStyle = shades[1];
      px(3, 3, 1, 6);
      px(11, 7, 1, 6);
      return;

    case 'water': {
      const shift = seed % 2 === 0 ? 0 : 3;
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((x + shift + y * 2) % 7 === 0) {
            ctx.fillStyle = shades[0];
            px(x, y, 2, 1);
          } else if (rng.chance(15)) {
            ctx.fillStyle = shades[1];
            px(x, y, 1, 1);
          }
        }
      }
      return;
    }

    case 'flowers':
      drawPixelTile(ctx, col, row, base, [shades[0], shades[1]], seed, 'noise');
      drawFlowerSprigs(ctx, ox, oy, shades[2], shades[3]);
      return;

    case 'tall_grass':
      drawPixelTile(ctx, col, row, base, [shades[0]], seed, 'noise');
      drawTallGrassTufts(ctx, ox, oy, shades[1], shades[2]);
      return;

    case 'arena':
      ctx.fillStyle = shades[0];
      px(0, 0, 16, 1);
      px(0, 0, 1, 16);
      ctx.fillStyle = shades[1];
      px(2, 2, 12, 12);
      ctx.fillStyle = base;
      px(4, 4, 8, 8);
      return;

    case 'stairs':
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = shades[0];
        px(0, y, 16, 1);
        ctx.fillStyle = shades[1];
        px(0, y + 1, 16, 3);
      }
      ctx.fillStyle = shades[0];
      px(0, 0, 1, 16);
      px(15, 0, 1, 16);
      return;

    case 'roof':
      for (let y = 0; y < 16; y += 4) {
        ctx.fillStyle = shades[0];
        px(0, y, 16, 1);
        ctx.fillStyle = y % 8 === 0 ? base : shades[1];
        px(0, y + 1, 16, 3);
        for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < 16; x += 8) {
          ctx.fillStyle = shades[0];
          px(x, y, 1, 4);
        }
      }
      return;

    case 'brick':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      for (let y = 0; y < 16; y += 4) {
        const off = (y / 4) % 2 === 0 ? 0 : 4;
        for (let x = 0; x < 16; x += 8) {
          ctx.fillStyle = shades[1];
          px(((x + off) % 16) + 1, y + 1, 6, 2);
        }
      }
      return;

    case 'window':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = shades[1];
      px(2, 2, 12, 12);
      ctx.fillStyle = PALETTE.iceCyan;
      px(3, 3, 4, 4);
      px(9, 3, 4, 4);
      px(3, 9, 4, 4);
      px(9, 9, 4, 4);
      return;

    case 'door':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = base;
      px(2, 2, 12, 14);
      ctx.fillStyle = shades[1];
      px(4, 4, 8, 5);
      ctx.fillStyle = PALETTE.resonantGold;
      px(11, 9, 2, 2);
      return;
  }
}

function drawFlowerSprigs(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  c1: string,
  c2: string
): void {
  const px = (x: number, y: number, w: number, h: number) => {
    ctx.fillRect(ox + x * SCALE, oy + y * SCALE, w * SCALE, h * SCALE);
  };
  for (const [fx, fy, fc] of [
    [3, 4, c1],
    [11, 3, c2],
    [6, 11, c2],
    [12, 12, c1],
  ] as const) {
    ctx.fillStyle = PALETTE.pitchBlackGreen;
    px(fx - 1, fy + 1, 3, 1);
    ctx.fillStyle = fc;
    px(fx - 1, fy, 3, 1);
    px(fx, fy - 1, 1, 3);
    ctx.fillStyle = PALETTE.resonantGold;
    px(fx, fy, 1, 1);
  }
}

function drawTallGrassTufts(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number,
  dark: string,
  tip: string
): void {
  const px = (x: number, y: number, w: number, h: number) => {
    ctx.fillRect(ox + x * SCALE, oy + y * SCALE, w * SCALE, h * SCALE);
  };
  for (let bx = 1; bx < 16; bx += 3) {
    for (let by = 3; by < 16; by += 5) {
      ctx.fillStyle = dark;
      px(bx, by, 2, 3);
      ctx.fillStyle = tip;
      px(bx, by - 1, 1, 2);
    }
  }
}

function drawStairStepOverlays(
  ctx: CanvasRenderingContext2D,
  ox: number,
  oy: number
): void {
  // 4 horizontal stone stair treads with crisp top highlight and riser shadow
  for (let i = 0; i < 4; i++) {
    const sy = oy + i * 16;
    ctx.fillStyle = 'rgba(255, 249, 240, 0.22)';
    ctx.fillRect(ox + 2, sy + 1, TILE_SIZE - 4, 2);
    ctx.fillStyle = 'rgba(11, 8, 14, 0.55)';
    ctx.fillRect(ox, sy + 13, TILE_SIZE, 3);
  }
  ctx.fillStyle = 'rgba(11, 8, 14, 0.42)';
  ctx.fillRect(ox, oy, 3, TILE_SIZE);
  ctx.fillRect(ox + TILE_SIZE - 3, oy, 3, TILE_SIZE);
}

export function buildTileAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const put = (
    key: TileAtlasKey,
    base: string,
    shades: readonly string[],
    seed: number,
    pattern: Parameters<typeof drawPixelTile>[6]
  ) => {
    const idx = TILE_ATLAS_INDEX[key];
    const col = idx % ATLAS_GRID;
    const row = Math.floor(idx / ATLAS_GRID);
    drawPixelTile(ctx, col, row, base, shades, seed, pattern);
  };

  put('grass', PALETTE.oliveDrab, [PALETTE.forestGreen, PALETTE.moss, PALETTE.emerald], 101, 'noise');
  put('dirt', PALETTE.dirtBrown, [PALETTE.darkOak, PALETTE.burntUmber, PALETTE.leatherBrown], 102, 'noise');
  put('stone', PALETTE.stoneMid, [PALETTE.stoneShadow, PALETTE.stoneHighlight, PALETTE.ashPurple], 103, 'noise');
  put('cobble', PALETTE.coldStone, [PALETTE.stoneShadow, PALETTE.stoneMid, PALETTE.boneGray], 104, 'cobble');
  put('sand', PALETTE.sandDesert, [PALETTE.woodHighlight, PALETTE.porcelain, PALETTE.oldBronze], 105, 'noise');
  put('water', PALETTE.oceanicTeal, [PALETTE.vibrantAqua, PALETTE.deepAbyss], 106, 'water');
  put('water_1', PALETTE.oceanicTeal, [PALETTE.kiCyan, PALETTE.deepAbyss], 107, 'water');
  put('planks', PALETTE.leatherBrown, [PALETTE.burntUmber, PALETTE.darkOak], 108, 'planks');
  put('log', PALETTE.burntUmber, [PALETTE.darkOak, PALETTE.woodHighlight], 109, 'log');
  put('leaves', PALETTE.forestGreen, [PALETTE.pitchBlackGreen, PALETTE.oliveDrab], 110, 'noise');
  put('flowers', PALETTE.oliveDrab, [PALETTE.forestGreen, PALETTE.moss, PALETTE.rubyGlow, PALETTE.kiCyan], 111, 'flowers');
  put('tall_grass', PALETTE.forestGreen, [PALETTE.pitchBlackGreen, PALETTE.oliveDrab, PALETTE.moss], 112, 'tall_grass');
  put('snow', PALETTE.frostedGlass, [PALETTE.iceCyan, PALETTE.warmWhite], 113, 'noise');
  put('cave_floor', PALETTE.smokedWood, [PALETTE.cryptInk, PALETTE.ashPurple, PALETTE.abyssInk], 114, 'noise');
  put('stairs', PALETTE.stoneHighlight, [PALETTE.stoneShadow, PALETTE.boneGray], 115, 'stairs');
  put('bridge', PALETTE.woodHighlight, [PALETTE.leatherBrown, PALETTE.burntUmber], 116, 'planks');
  put('arena_floor', PALETTE.deepAmethyst, [PALETTE.nightshade, PALETTE.royalPurple], 117, 'arena');
  put('wall_plaster', PALETTE.porcelain, [PALETTE.boneGray, PALETTE.coldStone], 118, 'noise');
  put('wall_brick', PALETTE.burntUmber, [PALETTE.darkOak, PALETTE.rust], 119, 'brick');
  put('window', PALETTE.cryptInk, [PALETTE.stoneShadow, PALETTE.vibrantAqua], 120, 'window');
  put('door', PALETTE.burntUmber, [PALETTE.darkOak, PALETTE.woodHighlight], 121, 'door');
  put('roof_red', PALETTE.rosewood, [PALETTE.bloodMoon, PALETTE.riftCrimson], 122, 'roof');
  put('roof_blue', PALETTE.oceanicTeal, [PALETTE.deepAbyss, PALETTE.vibrantAqua], 123, 'roof');
  put('roof_pink', PALETTE.rubyGlow, [PALETTE.rosewood, PALETTE.porcelainPink], 124, 'roof');
  put('roof_teal', PALETTE.emerald, [PALETTE.deepAbyss, PALETTE.kiCyan], 125, 'roof');
  put('roof_purple', PALETTE.royalPurple, [PALETTE.deepAmethyst, PALETTE.soulViolet], 126, 'roof');
  put('roof_orange', PALETTE.oldBronze, [PALETTE.rust, PALETTE.resonantGold], 127, 'roof');

  // New semantic fallback tiles
  put('cliff_rock', PALETTE.burntUmber, [PALETTE.leatherBrown, PALETTE.stoneMid, PALETTE.darkOak], 128, 'cobble');
  put('cracked_stone', PALETTE.stoneMid, [PALETTE.cryptInk, PALETTE.stoneHighlight], 129, 'cobble');
  put('mossy_stone', PALETTE.stoneMid, [PALETTE.forestGreen, PALETTE.oliveDrab, PALETTE.stoneShadow], 130, 'cobble');
  put('palace_tile', PALETTE.porcelain, [PALETTE.boneGray, PALETTE.sandDesert], 131, 'arena');
  put('wall_fieldstone', PALETTE.coldStone, [PALETTE.stoneShadow, PALETTE.boneGray], 132, 'brick');
  put('wall_castle', PALETTE.stoneShadow, [PALETTE.cryptInk, PALETTE.stoneMid], 133, 'brick');
  put('wall_crypt', PALETTE.smokedWood, [PALETTE.abyssInk, PALETTE.ashPurple], 134, 'brick');
  put('wall_iron', PALETTE.stoneMid, [PALETTE.cryptInk, PALETTE.coldStone], 135, 'brick');
  put('wall_vine_brick', PALETTE.rust, [PALETTE.darkOak, PALETTE.forestGreen], 136, 'brick');
  put('wall_wood_gold', PALETTE.darkOak, [PALETTE.burntUmber, PALETTE.resonantGold], 137, 'arena');
  put('roof_slate', PALETTE.stoneShadow, [PALETTE.cryptInk, PALETTE.stoneMid], 138, 'roof');
  put('roof_wood', PALETTE.burntUmber, [PALETTE.darkOak, PALETTE.woodHighlight], 139, 'roof');
  put('roof_patina', PALETTE.smokedWood, [PALETTE.forestGreen, PALETTE.moss], 140, 'roof');

  return canvas;
}

/**
 * Generates a matching linear-space tangent normal atlas (512x512) filled with neutral
 * flat normals (#8080ff) and subtle bevel normals for procedural fallback tiles.
 */
export function buildTileNormalAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#8080ff';
  ctx.fillRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  // Add subtle bevel normals to stairs and windows so they catch directional light cleanly
  const stairsIdx = TILE_ATLAS_INDEX.stairs;
  const sx = (stairsIdx % ATLAS_GRID) * TILE_SIZE;
  const sy = Math.floor(stairsIdx / ATLAS_GRID) * TILE_SIZE;
  for (let i = 0; i < 4; i++) {
    const ty = sy + i * 16;
    ctx.fillStyle = '#80b8fa';
    ctx.fillRect(sx, ty, TILE_SIZE, 3);
    ctx.fillStyle = '#8048ea';
    ctx.fillRect(sx, ty + 13, TILE_SIZE, 3);
  }

  const winIdx = TILE_ATLAS_INDEX.window;
  const wx = (winIdx % ATLAS_GRID) * TILE_SIZE;
  const wy = Math.floor(winIdx / ATLAS_GRID) * TILE_SIZE;
  ctx.fillStyle = '#80b0fa';
  ctx.fillRect(wx + 4, wy + 4, TILE_SIZE - 8, 4);
  ctx.fillStyle = '#8050ea';
  ctx.fillRect(wx + 4, wy + TILE_SIZE - 8, TILE_SIZE - 8, 4);
  ctx.fillStyle = '#5080ea';
  ctx.fillRect(wx + 4, wy + 4, 4, TILE_SIZE - 8);
  ctx.fillStyle = '#b080ea';
  ctx.fillRect(wx + TILE_SIZE - 8, wy + 4, 4, TILE_SIZE - 8);

  return canvas;
}

function drawSheetCell(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  cell: SheetCellCoord,
  destX: number,
  destY: number,
  destSize = TILE_SIZE
): void {
  ctx.drawImage(
    sheet,
    cell.col * SHEET_CELL_SIZE,
    cell.row * SHEET_CELL_SIZE,
    SHEET_CELL_SIZE,
    SHEET_CELL_SIZE,
    destX,
    destY,
    destSize,
    destSize
  );
}

/**
 * Stamps all 25 tiles from the processed 5x5 albedo sheet into the 512x512 atlas canvas
 * and composes matching grass-based flowers/tall_grass and stone-based stairs.
 */
export function stampTileSheetOntoAlbedoAtlas(
  atlasCanvas: HTMLCanvasElement,
  sheetImg: CanvasImageSource
): void {
  const ctx = atlasCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  for (const [key, cell] of Object.entries(SHEET_TILE_MAPPING) as Array<
    [TileAtlasKey, SheetCellCoord]
  >) {
    const idx = TILE_ATLAS_INDEX[key];
    const ox = (idx % ATLAS_GRID) * TILE_SIZE;
    const oy = Math.floor(idx / ATLAS_GRID) * TILE_SIZE;
    drawSheetCell(ctx, sheetImg, cell, ox, oy);
  }

  // Cohesive derived tiles using the sheet's grass (0,0) and stone slabs (0,3)
  const flowersIdx = TILE_ATLAS_INDEX.flowers;
  const fox = (flowersIdx % ATLAS_GRID) * TILE_SIZE;
  const foy = Math.floor(flowersIdx / ATLAS_GRID) * TILE_SIZE;
  drawSheetCell(ctx, sheetImg, { row: 0, col: 0 }, fox, foy);
  drawFlowerSprigs(ctx, fox, foy, PALETTE.rubyGlow, PALETTE.kiCyan);

  const tallIdx = TILE_ATLAS_INDEX.tall_grass;
  const tox = (tallIdx % ATLAS_GRID) * TILE_SIZE;
  const toy = Math.floor(tallIdx / ATLAS_GRID) * TILE_SIZE;
  drawSheetCell(ctx, sheetImg, { row: 0, col: 0 }, tox, toy);
  drawTallGrassTufts(ctx, tox, toy, PALETTE.pitchBlackGreen, PALETTE.moss);

  const stairsIdx = TILE_ATLAS_INDEX.stairs;
  const stx = (stairsIdx % ATLAS_GRID) * TILE_SIZE;
  const sty = Math.floor(stairsIdx / ATLAS_GRID) * TILE_SIZE;
  drawSheetCell(ctx, sheetImg, { row: 0, col: 3 }, stx, sty);
  drawStairStepOverlays(ctx, stx, sty);
}

/**
 * Stamps all 25 normal maps from the processed 5x5 normal sheet into the 512x512 normal atlas.
 */
export function stampTileSheetOntoNormalAtlas(
  normalAtlasCanvas: HTMLCanvasElement,
  normalSheetImg: CanvasImageSource
): void {
  const ctx = normalAtlasCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  for (const [key, cell] of Object.entries(SHEET_TILE_MAPPING) as Array<
    [TileAtlasKey, SheetCellCoord]
  >) {
    const idx = TILE_ATLAS_INDEX[key];
    const ox = (idx % ATLAS_GRID) * TILE_SIZE;
    const oy = Math.floor(idx / ATLAS_GRID) * TILE_SIZE;
    drawSheetCell(ctx, normalSheetImg, cell, ox, oy);
  }

  // Match normal relief for grass-derived flowers & tall_grass
  for (const key of ['flowers', 'tall_grass'] as const) {
    const idx = TILE_ATLAS_INDEX[key];
    const ox = (idx % ATLAS_GRID) * TILE_SIZE;
    const oy = Math.floor(idx / ATLAS_GRID) * TILE_SIZE;
    drawSheetCell(ctx, normalSheetImg, { row: 0, col: 0 }, ox, oy);
  }

  // Match stone base + stepped horizontal bevel normals for stairs
  const stairsIdx = TILE_ATLAS_INDEX.stairs;
  const stx = (stairsIdx % ATLAS_GRID) * TILE_SIZE;
  const sty = Math.floor(stairsIdx / ATLAS_GRID) * TILE_SIZE;
  drawSheetCell(ctx, normalSheetImg, { row: 0, col: 3 }, stx, sty);
  for (let i = 0; i < 4; i++) {
    const ty = sty + i * 16;
    ctx.fillStyle = '#80b8fa';
    ctx.fillRect(stx, ty, TILE_SIZE, 3);
    ctx.fillStyle = '#8048ea';
    ctx.fillRect(stx, ty + 13, TILE_SIZE, 3);
  }
}

/**
 * Stamps all 10 tiles from the extra 5x2 sheet (`tiles_extra_albedo.png` or `tiles_extra_normal.png`)
 * into their assigned 64x64 slots in the 512x512 atlas, overriding derived fallbacks with dedicated artwork.
 */
export function stampExtraTilesOntoAtlas(
  atlasCanvas: HTMLCanvasElement,
  extraSheetImg: CanvasImageSource
): void {
  const ctx = atlasCanvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;

  for (const [key, cell] of Object.entries(EXTRA_TILE_MAPPING) as Array<
    [TileAtlasKey, SheetCellCoord]
  >) {
    const idx = TILE_ATLAS_INDEX[key];
    const ox = (idx % ATLAS_GRID) * TILE_SIZE;
    const oy = Math.floor(idx / ATLAS_GRID) * TILE_SIZE;
    drawSheetCell(ctx, extraSheetImg, cell, ox, oy);
  }
}
