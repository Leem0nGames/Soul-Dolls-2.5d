import type { PropKind } from '../domain/types.ts';
import { PALETTE } from './Palette.ts';

export function generatePropCanvas(kind: PropKind): HTMLCanvasElement {
  const isTree =
    kind === 'oak' ||
    kind === 'pine' ||
    kind === 'birch' ||
    kind === 'snow_pine' ||
    kind === 'mushroom_tree' ||
    kind === 'mushroom_tree_arcane';
  const isLarge = kind === 'cave_entrance' || kind === 'well' || kind === 'pillar';

  const w = isTree ? 32 : isLarge ? 32 : 24;
  const h = isTree ? 42 : isLarge ? 32 : 24;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, pw: number, ph: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, pw, ph);
  };

  switch (kind) {
    case 'oak':
      px(12, 27, 8, 14, PALETTE.darkOak);
      px(13, 28, 6, 13, PALETTE.burntUmber);
      px(14, 28, 2, 13, PALETTE.leatherBrown);
      px(4, 8, 24, 21, PALETTE.pitchBlackGreen);
      px(6, 5, 20, 21, PALETTE.forestGreen);
      px(8, 7, 16, 15, PALETTE.oliveDrab);
      px(10, 8, 9, 6, PALETTE.moss);
      break;

    case 'pine':
      px(13, 29, 6, 12, PALETTE.darkOak);
      px(14, 30, 4, 11, PALETTE.burntUmber);
      px(3, 23, 26, 8, PALETTE.pitchBlackGreen);
      px(5, 16, 22, 9, PALETTE.deepAbyss);
      px(8, 9, 16, 9, PALETTE.forestGreen);
      px(11, 3, 10, 8, PALETTE.emerald);
      break;

    case 'birch':
      px(13, 25, 6, 16, PALETTE.porcelain);
      px(14, 28, 3, 2, PALETTE.stoneShadow);
      px(15, 34, 3, 2, PALETTE.stoneShadow);
      px(6, 7, 20, 19, PALETTE.forestGreen);
      px(8, 5, 16, 18, PALETTE.oliveDrab);
      px(10, 7, 12, 12, PALETTE.moss);
      px(12, 8, 6, 5, PALETTE.resonantGold);
      break;

    case 'snow_pine':
      px(13, 29, 6, 12, PALETTE.darkOak);
      px(3, 23, 26, 8, PALETTE.darkSlate);
      px(5, 16, 22, 9, PALETTE.deepAbyss);
      px(8, 9, 16, 9, PALETTE.oceanicTeal);
      px(11, 3, 10, 8, PALETTE.frostedGlass);
      px(6, 15, 20, 3, PALETTE.warmWhite);
      px(4, 22, 24, 3, PALETTE.iceCyan);
      break;

    case 'mushroom_tree':
      px(12, 21, 8, 20, PALETTE.sandDesert);
      px(13, 22, 5, 19, PALETTE.porcelain);
      px(3, 9, 26, 13, PALETTE.bloodMoon);
      px(5, 5, 22, 14, PALETTE.riftCrimson);
      px(8, 7, 4, 4, PALETTE.paleGold);
      px(18, 6, 5, 4, PALETTE.paleGold);
      px(13, 12, 4, 3, PALETTE.paleGold);
      break;

    case 'mushroom_tree_arcane':
      px(12, 21, 8, 20, PALETTE.leatherBrown);
      px(13, 22, 5, 19, PALETTE.woodHighlight);
      px(3, 9, 26, 13, PALETTE.deepAmethyst);
      px(5, 5, 22, 14, PALETTE.arcaneLilac);
      px(4, 15, 24, 3, PALETTE.resonantGold);
      px(9, 7, 4, 4, PALETTE.kiCyan);
      px(17, 10, 4, 3, PALETTE.kiCyan);
      break;

    case 'bush':
      px(3, 10, 18, 12, PALETTE.pitchBlackGreen);
      px(4, 8, 16, 12, PALETTE.forestGreen);
      px(6, 10, 12, 7, PALETTE.oliveDrab);
      px(7, 13, 2, 2, PALETTE.rubyGlow);
      px(14, 11, 2, 2, PALETTE.rubyGlow);
      break;

    case 'bush_arcane':
      px(3, 10, 18, 12, PALETTE.nightshade);
      px(4, 8, 16, 12, PALETTE.deepAmethyst);
      px(6, 10, 12, 7, PALETTE.soulViolet);
      px(8, 11, 2, 2, PALETTE.kiCyan);
      px(13, 13, 2, 2, PALETTE.kiCyan);
      break;

    case 'flower_patch':
      px(4, 15, 16, 7, PALETTE.forestGreen);
      px(5, 13, 4, 4, PALETTE.porcelainPink);
      px(6, 14, 2, 2, PALETTE.resonantGold);
      px(14, 12, 4, 4, PALETTE.kiCyan);
      px(15, 13, 2, 2, PALETTE.resonantGold);
      px(10, 16, 4, 4, PALETTE.etherealOrchid);
      px(11, 17, 2, 2, PALETTE.resonantGold);
      break;

    case 'tall_grass_clump':
      for (let x = 2; x < 21; x += 3) {
        px(x, 12 + (x % 2) * 2, 2, 10, PALETTE.pitchBlackGreen);
        px(x, 9 + (x % 3), 2, 7, PALETTE.oliveDrab);
        px(x + 1, 8 + (x % 2), 1, 3, PALETTE.moss);
      }
      break;

    case 'tall_grass_flower':
      for (let x = 2; x < 21; x += 3) {
        px(x, 12 + (x % 2) * 2, 2, 10, PALETTE.nightshade);
        px(x, 9 + (x % 3), 2, 7, PALETTE.soulViolet);
        px(x + 1, 8 + (x % 2), 1, 3, PALETTE.kiCyan);
      }
      break;

    case 'boulder':
      px(3, 9, 18, 13, PALETTE.stoneShadow);
      px(5, 7, 14, 13, PALETTE.stoneMid);
      px(6, 8, 10, 8, PALETTE.coldStone);
      px(7, 9, 5, 4, PALETTE.boneGray);
      break;

    case 'stump':
      px(5, 14, 14, 9, PALETTE.burntUmber);
      px(6, 12, 12, 4, PALETTE.woodHighlight);
      px(8, 13, 8, 2, PALETTE.leatherBrown);
      break;

    case 'mushroom':
      px(10, 15, 4, 8, PALETTE.porcelain);
      px(6, 9, 12, 7, PALETTE.riftCrimson);
      px(8, 10, 2, 2, PALETTE.warmWhite);
      px(14, 11, 2, 2, PALETTE.warmWhite);
      break;

    case 'fence':
      px(2, 8, 4, 15, PALETTE.burntUmber);
      px(18, 8, 4, 15, PALETTE.burntUmber);
      px(0, 11, 24, 3, PALETTE.woodHighlight);
      px(0, 16, 24, 3, PALETTE.leatherBrown);
      break;

    case 'lamp_post':
      px(10, 6, 4, 17, PALETTE.stoneShadow);
      px(9, 20, 6, 3, PALETTE.cryptInk);
      px(8, 2, 8, 6, PALETTE.abyssInk);
      px(9, 3, 6, 4, PALETTE.resonantGold);
      break;

    case 'lamp_wood':
      px(9, 3, 4, 20, PALETTE.burntUmber);
      px(13, 6, 6, 2, PALETTE.cryptInk);
      px(15, 8, 5, 6, PALETTE.oldBronze);
      px(16, 9, 3, 4, PALETTE.brightBrass);
      break;

    case 'lamp_double':
      px(10, 8, 4, 15, PALETTE.cryptInk);
      px(5, 5, 14, 3, PALETTE.stoneShadow);
      px(4, 3, 5, 5, PALETTE.abyssInk);
      px(15, 3, 5, 5, PALETTE.abyssInk);
      px(5, 4, 3, 3, PALETTE.brightBrass);
      px(16, 4, 3, 3, PALETTE.brightBrass);
      break;

    case 'lamp_stone':
      px(8, 10, 8, 13, PALETTE.stoneMid);
      px(6, 2, 12, 8, PALETTE.stoneHighlight);
      px(9, 4, 6, 5, PALETTE.resonantGold);
      px(11, 5, 2, 3, PALETTE.paleGold);
      break;

    case 'sign':
      px(10, 14, 4, 9, PALETTE.burntUmber);
      px(4, 5, 16, 10, PALETTE.darkOak);
      px(5, 6, 14, 8, PALETTE.woodHighlight);
      px(7, 8, 10, 1, PALETTE.dirtBrown);
      px(7, 10, 8, 1, PALETTE.dirtBrown);
      break;

    case 'well':
      px(6, 18, 20, 12, PALETTE.stoneMid);
      px(8, 19, 16, 10, PALETTE.boneGray);
      px(9, 8, 2, 11, PALETTE.darkOak);
      px(21, 8, 2, 11, PALETTE.darkOak);
      px(5, 4, 22, 6, PALETTE.rust);
      px(7, 5, 18, 4, PALETTE.oldBronze);
      break;

    case 'crystal':
      px(8, 3, 8, 19, PALETTE.deepAbyss);
      px(9, 4, 6, 17, PALETTE.kiCyan);
      px(10, 5, 3, 12, PALETTE.frostedGlass);
      px(4, 11, 5, 10, PALETTE.vibrantAqua);
      px(15, 12, 5, 9, PALETTE.vibrantAqua);
      break;

    case 'capsule_pedestal':
      // Stone altar + mystical Soulpot with soul sparks
      px(5, 14, 14, 9, PALETTE.stoneShadow);
      px(6, 15, 12, 7, PALETTE.coldStone);
      px(7, 14, 10, 1, PALETTE.oldBronze);
      px(11, 3, 2, 1, PALETTE.resonantGold);
      px(8, 4, 8, 2, PALETTE.cryptInk);
      px(9, 4, 6, 1, PALETTE.porcelain);
      px(7, 6, 10, 8, PALETTE.cryptInk);
      px(8, 7, 8, 6, PALETTE.riftCrimson);
      px(8, 9, 8, 2, PALETTE.smokedWood);
      px(11, 9, 2, 2, PALETTE.kiCyan);
      px(5, 4, 1, 1, PALETTE.iceCyan);
      px(18, 5, 1, 1, PALETTE.ghostViolet);
      break;

    case 'heal_machine':
      px(4, 6, 16, 17, PALETTE.smokedWood);
      px(5, 7, 14, 15, PALETTE.porcelain);
      px(7, 9, 10, 6, PALETTE.kiCyan);
      px(11, 10, 2, 4, PALETTE.riftCrimson);
      px(10, 11, 4, 2, PALETTE.riftCrimson);
      break;

    case 'pillar':
      px(8, 3, 16, 27, PALETTE.deepAmethyst);
      px(10, 4, 12, 25, PALETTE.arcaneLilac);
      px(11, 5, 5, 23, PALETTE.ghostViolet);
      px(6, 2, 20, 4, PALETTE.lavenderMist);
      px(6, 26, 20, 4, PALETTE.lavenderMist);
      break;

    case 'bench':
      px(3, 12, 18, 8, PALETTE.burntUmber);
      px(4, 13, 16, 4, PALETTE.woodHighlight);
      break;

    case 'cave_entrance':
      px(2, 4, 28, 27, PALETTE.stoneShadow);
      px(4, 6, 24, 25, PALETTE.stoneMid);
      px(8, 11, 16, 20, PALETTE.abyssInk);
      px(10, 13, 12, 18, PALETTE.cryptInk);
      break;
  }

  return canvas;
}
