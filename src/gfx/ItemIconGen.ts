import { ITEMS } from '../data/items.ts';
import type { ItemDef } from '../domain/types.ts';
import { PALETTE } from './Palette.ts';

function defaultColors(item: ItemDef): { main: string; accent: string } {
  const main = item.iconColor ?? PALETTE.kiCyan;
  const accent = item.iconAccent ?? PALETTE.porcelain;
  return { main, accent };
}

export function generateItemIconCanvas(itemId: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  const item = ITEMS[itemId];
  const { main, accent } = item
    ? defaultColors(item)
    : { main: PALETTE.coldStone, accent: PALETTE.porcelain };
  const shape = item?.iconShape ?? 'utility';

  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  switch (shape) {
    case 'potion':
      px(6, 2, 4, 2, PALETTE.coldStone);
      px(7, 4, 2, 2, PALETTE.boneGray);
      px(4, 6, 8, 8, PALETTE.cryptInk);
      px(5, 7, 6, 6, main);
      px(6, 8, 2, 3, accent);
      break;
    case 'pill':
      px(4, 4, 8, 8, PALETTE.cryptInk);
      px(5, 5, 6, 3, main);
      px(5, 8, 6, 3, accent);
      px(6, 6, 2, 1, PALETTE.warmWhite);
      break;
    case 'capsule':
      // Soulpot: mystical lidded vessel with soul-seal rune
      px(7, 2, 2, 1, PALETTE.resonantGold);
      px(5, 3, 6, 2, PALETTE.cryptInk);
      px(6, 3, 4, 1, accent);
      px(5, 5, 6, 1, PALETTE.oldBronze);
      px(3, 6, 10, 7, PALETTE.cryptInk);
      px(4, 6, 8, 6, main);
      px(5, 7, 2, 3, accent);
      px(4, 8, 8, 2, PALETTE.smokedWood);
      px(7, 8, 2, 2, PALETTE.kiCyan);
      px(5, 13, 6, 1, PALETTE.cryptInk);
      break;
    case 'stone':
      px(6, 2, 4, 2, PALETTE.cryptInk);
      px(4, 4, 8, 8, PALETTE.cryptInk);
      px(5, 3, 6, 10, main);
      px(3, 6, 10, 4, main);
      px(6, 5, 4, 5, accent);
      px(6, 5, 2, 2, PALETTE.warmWhite);
      break;
    case 'berry':
      px(7, 2, 2, 3, accent);
      px(5, 3, 2, 2, accent);
      px(4, 5, 8, 8, PALETTE.cryptInk);
      px(5, 6, 6, 6, main);
      px(6, 7, 2, 2, PALETTE.warmWhite);
      break;
    case 'charm':
      px(7, 2, 2, 2, PALETTE.oldBronze);
      px(4, 4, 8, 9, PALETTE.cryptInk);
      px(5, 5, 6, 7, main);
      px(7, 7, 2, 3, accent);
      break;
    case 'gear':
      px(3, 5, 10, 6, PALETTE.cryptInk);
      px(5, 3, 6, 10, PALETTE.cryptInk);
      px(4, 6, 8, 4, main);
      px(6, 4, 4, 8, main);
      px(7, 7, 2, 2, accent);
      break;
    case 'disc':
      px(3, 3, 10, 10, PALETTE.cryptInk);
      px(4, 4, 8, 8, main);
      px(5, 5, 2, 2, accent);
      px(9, 9, 2, 2, accent);
      px(7, 7, 2, 2, PALETTE.cryptInk);
      break;
    case 'gem':
      px(5, 3, 6, 10, PALETTE.cryptInk);
      px(3, 6, 10, 4, PALETTE.cryptInk);
      px(6, 4, 4, 8, main);
      px(4, 7, 8, 2, main);
      px(6, 5, 2, 2, accent);
      break;
    default:
      px(4, 3, 8, 10, PALETTE.cryptInk);
      px(5, 4, 6, 8, main);
      px(6, 6, 4, 2, accent);
      break;
  }

  return canvas;
}
