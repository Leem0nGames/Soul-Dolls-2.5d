import { createRng } from '../core/Rng.ts';
import type { TileKind } from '../domain/types.ts';
import { PALETTE } from './Palette.ts';

export const TILE_SIZE = 16;
export const ATLAS_GRID = 16;
export const ATLAS_SIZE = TILE_SIZE * ATLAS_GRID; // 256x256

export type TileAtlasKey =
  | TileKind
  | 'water_1'
  | 'wall_plaster'
  | 'wall_brick'
  | 'window'
  | 'door'
  | 'roof_red'
  | 'roof_blue'
  | 'roof_pink'
  | 'roof_teal'
  | 'roof_purple'
  | 'roof_orange';

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
};

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

  ctx.fillStyle = base;
  ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);

  switch (pattern) {
    case 'noise':
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          if (rng.chance(36)) {
            ctx.fillStyle = rng.pick(shades);
            ctx.fillRect(ox + x, oy + y, 1, 1);
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
        ctx.fillRect(ox + sx, oy + sy, sw, sh);
        ctx.fillStyle = shades[2];
        ctx.fillRect(ox + sx, oy + sy, sw, 1);
      }
      return;
    }

    case 'planks':
      for (let y = 0; y < TILE_SIZE; y += 4) {
        ctx.fillStyle = y % 8 === 0 ? base : shades[0];
        ctx.fillRect(ox, oy + y, TILE_SIZE, 3);
        ctx.fillStyle = shades[1];
        ctx.fillRect(ox, oy + y + 3, TILE_SIZE, 1);
      }
      ctx.fillStyle = shades[1];
      ctx.fillRect(ox + 7, oy, 1, 4);
      ctx.fillRect(ox + 12, oy + 4, 1, 4);
      ctx.fillRect(ox + 3, oy + 8, 1, 4);
      ctx.fillRect(ox + 10, oy + 12, 1, 4);
      return;

    case 'log':
      for (let x = 0; x < TILE_SIZE; x += 2) {
        ctx.fillStyle = x % 4 === 0 ? base : shades[0];
        ctx.fillRect(ox + x, oy, 2, TILE_SIZE);
      }
      ctx.fillStyle = shades[1];
      ctx.fillRect(ox + 3, oy + 3, 1, 6);
      ctx.fillRect(ox + 11, oy + 7, 1, 6);
      return;

    case 'water': {
      const shift = seed % 2 === 0 ? 0 : 3;
      for (let y = 0; y < TILE_SIZE; y++) {
        for (let x = 0; x < TILE_SIZE; x++) {
          if ((x + shift + y * 2) % 7 === 0) {
            ctx.fillStyle = shades[0];
            ctx.fillRect(ox + x, oy + y, 2, 1);
          } else if (rng.chance(15)) {
            ctx.fillStyle = shades[1];
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
      return;
    }

    case 'flowers':
      drawPixelTile(ctx, col, row, base, [shades[0], shades[1]], seed, 'noise');
      for (const [fx, fy, fc] of [
        [3, 4, shades[2]],
        [11, 3, shades[3]],
        [6, 11, shades[3]],
        [12, 12, shades[2]],
      ] as const) {
        ctx.fillStyle = fc;
        ctx.fillRect(ox + fx - 1, oy + fy, 3, 1);
        ctx.fillRect(ox + fx, oy + fy - 1, 1, 3);
        ctx.fillStyle = PALETTE.resonantGold;
        ctx.fillRect(ox + fx, oy + fy, 1, 1);
      }
      return;

    case 'tall_grass':
      drawPixelTile(ctx, col, row, base, [shades[0]], seed, 'noise');
      for (let bx = 1; bx < TILE_SIZE; bx += 3) {
        for (let by = 3; by < TILE_SIZE; by += 5) {
          ctx.fillStyle = shades[1];
          ctx.fillRect(ox + bx, oy + by, 2, 3);
          ctx.fillStyle = shades[2];
          ctx.fillRect(ox + bx, oy + by - 1, 1, 2);
        }
      }
      return;

    case 'arena':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, 1);
      ctx.fillRect(ox, oy, 1, TILE_SIZE);
      ctx.fillStyle = shades[1];
      ctx.fillRect(ox + 2, oy + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = base;
      ctx.fillRect(ox + 4, oy + 4, TILE_SIZE - 8, TILE_SIZE - 8);
      return;

    case 'stairs':
      for (let y = 0; y < TILE_SIZE; y += 4) {
        ctx.fillStyle = shades[0];
        ctx.fillRect(ox, oy + y, TILE_SIZE, 1);
        ctx.fillStyle = shades[1];
        ctx.fillRect(ox, oy + y + 1, TILE_SIZE, 3);
      }
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, 1, TILE_SIZE);
      ctx.fillRect(ox + 15, oy, 1, TILE_SIZE);
      return;

    case 'roof':
      for (let y = 0; y < TILE_SIZE; y += 4) {
        ctx.fillStyle = shades[0];
        ctx.fillRect(ox, oy + y, TILE_SIZE, 1);
        ctx.fillStyle = y % 8 === 0 ? base : shades[1];
        ctx.fillRect(ox, oy + y + 1, TILE_SIZE, 3);
        for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < TILE_SIZE; x += 8) {
          ctx.fillStyle = shades[0];
          ctx.fillRect(ox + x, oy + y, 1, 4);
        }
      }
      return;

    case 'brick':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      for (let y = 0; y < TILE_SIZE; y += 4) {
        const off = (y / 4) % 2 === 0 ? 0 : 4;
        for (let x = 0; x < TILE_SIZE; x += 8) {
          ctx.fillStyle = shades[1];
          ctx.fillRect(ox + ((x + off) % 16) + 1, oy + y + 1, 6, 2);
        }
      }
      return;

    case 'window':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = shades[1];
      ctx.fillRect(ox + 2, oy + 2, 12, 12);
      ctx.fillStyle = PALETTE.iceCyan;
      ctx.fillRect(ox + 3, oy + 3, 4, 4);
      ctx.fillRect(ox + 9, oy + 3, 4, 4);
      ctx.fillRect(ox + 3, oy + 9, 4, 4);
      ctx.fillRect(ox + 9, oy + 9, 4, 4);
      return;

    case 'door':
      ctx.fillStyle = shades[0];
      ctx.fillRect(ox, oy, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = base;
      ctx.fillRect(ox + 2, oy + 2, 12, 14);
      ctx.fillStyle = shades[1];
      ctx.fillRect(ox + 4, oy + 4, 8, 5);
      ctx.fillStyle = PALETTE.resonantGold;
      ctx.fillRect(ox + 11, oy + 9, 2, 2);
      return;
  }
}

export function buildTileAtlasCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;

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
  put('wall_brick', PALETTE.boneGray, [PALETTE.coldStone, PALETTE.porcelain], 119, 'brick');
  put('window', PALETTE.cryptInk, [PALETTE.stoneShadow, PALETTE.vibrantAqua], 120, 'window');
  put('door', PALETTE.burntUmber, [PALETTE.darkOak, PALETTE.woodHighlight], 121, 'door');
  put('roof_red', PALETTE.rosewood, [PALETTE.bloodMoon, PALETTE.riftCrimson], 122, 'roof');
  put('roof_blue', PALETTE.oceanicTeal, [PALETTE.deepAbyss, PALETTE.vibrantAqua], 123, 'roof');
  put('roof_pink', PALETTE.rubyGlow, [PALETTE.rosewood, PALETTE.porcelainPink], 124, 'roof');
  put('roof_teal', PALETTE.emerald, [PALETTE.deepAbyss, PALETTE.kiCyan], 125, 'roof');
  put('roof_purple', PALETTE.royalPurple, [PALETTE.deepAmethyst, PALETTE.soulViolet], 126, 'roof');
  put('roof_orange', PALETTE.oldBronze, [PALETTE.rust, PALETTE.resonantGold], 127, 'roof');

  return canvas;
}
