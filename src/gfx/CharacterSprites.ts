import type { CharacterFrame, CharacterRole, Direction } from '../domain/types.ts';
import { CHARACTER_PALETTES, PALETTE } from './Palette.ts';

export function generateCharacterSpriteCanvas(
  role: CharacterRole,
  dir: Direction,
  frame: CharacterFrame
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 24;
  const ctx = canvas.getContext('2d')!;
  const pal = CHARACTER_PALETTES[role];

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  // Ground shadow
  px(4, 22, 8, 2, 'rgba(11,8,14,0.34)');

  // Outline silhouette base
  const step = frame % 2;

  // Legs
  px(5, 17 - step, 2, 5 + step, PALETTE.cryptInk);
  px(9, 17 - (1 - step), 2, 5 + (1 - step), PALETTE.cryptInk);
  px(5, 17 - step, 2, 4, pal.pants);
  px(9, 17 - (1 - step), 2, 4, pal.pants);
  px(5, 21 - step, 2, 1, PALETTE.smokedWood);
  px(9, 21 - (1 - step), 2, 1, PALETTE.smokedWood);

  // Torso
  px(4, 11, 8, 7, PALETTE.cryptInk);
  px(5, 12, 6, 5, pal.shirt);
  if (role === 'professor' || role === 'healer') {
    px(6, 12, 4, 5, PALETTE.porcelain);
    px(7, 12, 2, 4, pal.shirt);
  } else if (role === 'leader') {
    px(4, 12, 1, 6, pal.trim);
    px(11, 12, 1, 6, pal.trim);
  }

  // Arms
  const armBob = frame % 2;
  if (dir === 'left') {
    px(6, 12 + armBob, 2, 4, pal.skin);
  } else if (dir === 'right') {
    px(8, 12 + armBob, 2, 4, pal.skin);
  } else {
    px(3, 12 + armBob, 2, 4, pal.shirt);
    px(3, 15 + armBob, 1, 1, pal.skin);
    px(11, 12 + (1 - armBob), 2, 4, pal.shirt);
    px(12, 15 + (1 - armBob), 1, 1, pal.skin);
  }

  // Head
  px(4, 3, 8, 8, PALETTE.cryptInk);
  px(5, 4, 6, 6, pal.skin);

  // Hair / Hat
  if (dir === 'up') {
    px(4, 3, 8, 6, pal.hair);
  } else {
    px(4, 3, 8, 3, pal.hair);
  }

  if (role === 'player' || role === 'trainer') {
    px(4, 2, 8, 3, pal.hat);
    px(5, 3, 6, 1, pal.trim);
    if (dir === 'left') px(3, 4, 2, 1, pal.hat);
    if (dir === 'right') px(11, 4, 2, 1, pal.hat);
  } else if (role === 'healer') {
    px(5, 2, 6, 2, pal.hat);
    px(7, 2, 2, 2, pal.trim);
  } else if (role === 'leader') {
    px(5, 1, 6, 2, pal.trim);
    px(6, 0, 1, 2, pal.trim);
    px(9, 0, 1, 2, pal.trim);
  } else if (role === 'rival') {
    px(4, 2, 2, 2, pal.hair);
    px(10, 2, 2, 2, pal.hair);
    px(7, 1, 2, 2, pal.hair);
  }

  // Eyes by direction
  if (dir === 'down') {
    px(6, 7, 1, 2, PALETTE.cryptInk);
    px(9, 7, 1, 2, PALETTE.cryptInk);
  } else if (dir === 'left') {
    px(5, 7, 1, 2, PALETTE.cryptInk);
  } else if (dir === 'right') {
    px(10, 7, 1, 2, PALETTE.cryptInk);
  }

  return canvas;
}
