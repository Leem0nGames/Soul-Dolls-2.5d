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
  const isLarge =
    kind === 'cave_entrance' ||
    kind === 'well' ||
    kind === 'pillar' ||
    kind === 'bed' ||
    kind === 'sofa' ||
    kind === 'achievements_wall' ||
    kind === 'bookshelf' ||
    kind === 'stove' ||
    kind === 'forge_hearth' ||
    kind === 'doll_worktable' ||
    kind === 'mannequin_rack' ||
    kind === 'skill_altar' ||
    kind === 'training_dummy';

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

    case 'bed':
      // Cozy wooden bed with golden headboard, porcelain pillow & crimson-gold quilt
      px(3, 8, 26, 20, PALETTE.darkOak);
      px(4, 5, 24, 9, PALETTE.burntUmber);
      px(6, 6, 20, 4, PALETTE.resonantGold);
      px(5, 13, 22, 14, PALETTE.porcelain);
      px(7, 11, 8, 5, PALETTE.warmWhite);
      px(17, 11, 8, 5, PALETTE.warmWhite);
      px(5, 17, 22, 10, PALETTE.riftCrimson);
      px(5, 17, 22, 2, PALETTE.resonantGold);
      px(4, 27, 4, 4, PALETTE.darkOak);
      px(24, 27, 4, 4, PALETTE.darkOak);
      break;

    case 'chest':
      // Sturdy iron-banded wooden chest with golden lock
      px(2, 6, 20, 16, PALETTE.darkOak);
      px(3, 7, 18, 6, PALETTE.burntUmber);
      px(3, 13, 18, 8, PALETTE.leatherBrown);
      px(2, 12, 20, 2, PALETTE.cryptInk);
      px(5, 7, 2, 14, PALETTE.stoneMid);
      px(17, 7, 2, 14, PALETTE.stoneMid);
      px(10, 11, 4, 5, PALETTE.resonantGold);
      px(11, 13, 2, 2, PALETTE.cryptInk);
      break;

    case 'achievements_wall':
      // Ornate golden trophy wall plaque with ribbons & medallions
      px(2, 3, 28, 26, PALETTE.darkOak);
      px(3, 4, 26, 24, PALETTE.deepAmethyst);
      px(3, 4, 26, 2, PALETTE.resonantGold);
      px(3, 26, 26, 2, PALETTE.resonantGold);
      // Center trophy cup
      px(12, 8, 8, 7, PALETTE.resonantGold);
      px(13, 9, 6, 4, PALETTE.paleGold);
      px(10, 9, 2, 4, PALETTE.resonantGold);
      px(20, 9, 2, 4, PALETTE.resonantGold);
      px(15, 15, 2, 4, PALETTE.oldBronze);
      px(12, 19, 8, 2, PALETTE.oldBronze);
      // Flanking ribbons & gems
      px(6, 9, 4, 6, PALETTE.kiCyan);
      px(7, 15, 2, 3, PALETTE.vibrantAqua);
      px(22, 9, 4, 6, PALETTE.riftCrimson);
      px(23, 15, 2, 3, PALETTE.rubyGlow);
      px(6, 23, 20, 2, PALETTE.porcelain);
      break;

    case 'sofa':
      px(2, 10, 28, 17, PALETTE.darkOak);
      px(3, 8, 26, 11, PALETTE.rosewood);
      px(4, 15, 24, 9, PALETTE.riftCrimson);
      px(6, 15, 9, 7, PALETTE.rubyGlow);
      px(17, 15, 9, 7, PALETTE.rubyGlow);
      px(2, 14, 4, 12, PALETTE.burntUmber);
      px(26, 14, 4, 12, PALETTE.burntUmber);
      break;

    case 'dining_table':
      px(3, 9, 18, 5, PALETTE.woodHighlight);
      px(4, 8, 16, 4, PALETTE.burntUmber);
      px(6, 14, 3, 9, PALETTE.darkOak);
      px(15, 14, 3, 9, PALETTE.darkOak);
      px(8, 6, 4, 3, PALETTE.porcelain);
      px(13, 5, 3, 4, PALETTE.resonantGold);
      break;

    case 'kitchen_counter':
      px(1, 7, 22, 16, PALETTE.darkOak);
      px(2, 6, 20, 4, PALETTE.porcelain);
      px(2, 11, 20, 11, PALETTE.burntUmber);
      px(5, 13, 6, 6, PALETTE.leatherBrown);
      px(13, 13, 6, 6, PALETTE.leatherBrown);
      px(7, 15, 2, 2, PALETTE.resonantGold);
      px(15, 15, 2, 2, PALETTE.resonantGold);
      break;

    case 'stove':
      // Brick/iron hearth stove with simmering soup pot & ember glow
      px(3, 6, 26, 24, PALETTE.cryptInk);
      px(4, 7, 24, 22, PALETTE.stoneShadow);
      px(5, 8, 22, 4, PALETTE.coldStone);
      // Pot on top
      px(9, 2, 14, 7, PALETTE.stoneMid);
      px(11, 2, 10, 2, PALETTE.kiCyan);
      // Warm firebox
      px(9, 17, 14, 9, PALETTE.abyssInk);
      px(11, 19, 10, 6, PALETTE.riftCrimson);
      px(13, 21, 6, 4, PALETTE.resonantGold);
      break;

    case 'bookshelf':
      px(2, 3, 28, 27, PALETTE.darkOak);
      px(4, 5, 24, 23, PALETTE.burntUmber);
      for (let sy = 6; sy <= 20; sy += 7) {
        px(4, sy + 5, 24, 2, PALETTE.darkOak);
        px(5, sy, 3, 5, PALETTE.riftCrimson);
        px(9, sy + 1, 3, 4, PALETTE.vibrantAqua);
        px(13, sy, 3, 5, PALETTE.resonantGold);
        px(17, sy + 1, 3, 4, PALETTE.emerald);
        px(21, sy, 4, 5, PALETTE.soulViolet);
      }
      break;

    case 'house_plant':
      px(7, 14, 10, 9, PALETTE.rust);
      px(6, 13, 12, 2, PALETTE.oldBronze);
      px(6, 5, 12, 9, PALETTE.forestGreen);
      px(8, 3, 8, 8, PALETTE.oliveDrab);
      px(10, 4, 4, 5, PALETTE.moss);
      break;

    case 'stair_up':
      px(3, 4, 18, 18, PALETTE.darkOak);
      px(5, 16, 14, 4, PALETTE.woodHighlight);
      px(7, 12, 10, 4, PALETTE.woodHighlight);
      px(9, 8, 6, 4, PALETTE.resonantGold);
      break;

    case 'stair_down':
      px(3, 4, 18, 18, PALETTE.darkOak);
      px(5, 6, 14, 4, PALETTE.woodHighlight);
      px(7, 10, 10, 4, PALETTE.leatherBrown);
      px(9, 14, 6, 4, PALETTE.burntUmber);
      break;

    case 'forge_hearth':
      // Stone forge furnace with chimney hood, glowing embers, and bronze bellows pipe
      px(6, 2, 20, 10, PALETTE.stoneShadow);
      px(8, 3, 16, 8, PALETTE.stoneMid);
      px(3, 12, 26, 18, PALETTE.cryptInk);
      px(4, 13, 24, 16, PALETTE.stoneShadow);
      px(5, 14, 22, 4, PALETTE.stoneMid);
      px(5, 14, 22, 1, PALETTE.oldBronze);
      // Glowing hearth chamber
      px(8, 18, 16, 10, PALETTE.abyssInk);
      px(10, 20, 12, 7, PALETTE.riftCrimson);
      px(11, 21, 10, 5, PALETTE.coralRed);
      px(13, 22, 6, 4, PALETTE.resonantGold);
      px(14, 24, 4, 2, PALETTE.paleGold);
      // Brass side pipe / bellows accent
      px(2, 18, 3, 9, PALETTE.darkOak);
      px(2, 20, 3, 3, PALETTE.oldBronze);
      break;

    case 'anvil_bench':
      // Heavy timber stump & horned bronze-iron anvil
      px(4, 14, 16, 9, PALETTE.darkOak);
      px(5, 15, 14, 7, PALETTE.burntUmber);
      px(5, 15, 14, 2, PALETTE.leatherBrown);
      px(2, 8, 20, 4, PALETTE.stoneShadow);
      px(3, 7, 17, 3, PALETTE.stoneMid);
      px(6, 6, 11, 2, PALETTE.boneGray);
      px(8, 11, 8, 4, PALETTE.stoneShadow);
      // Glowing heated bar on anvil
      px(9, 6, 5, 1, PALETTE.resonantGold);
      break;

    case 'doll_worktable':
      // Articulated SoulDoll assembly table with brass calipers, silk ribbon & Ki crystal
      px(2, 13, 28, 16, PALETTE.darkOak);
      px(3, 12, 26, 6, PALETTE.leatherBrown);
      px(4, 13, 24, 4, PALETTE.woodHighlight);
      px(4, 19, 4, 11, PALETTE.darkOak);
      px(24, 19, 4, 11, PALETTE.darkOak);
      // Half-assembled wooden mannequin bust & tools on bench
      px(12, 5, 8, 7, PALETTE.cryptInk);
      px(13, 6, 6, 5, PALETTE.porcelain);
      px(14, 8, 4, 2, PALETTE.oldBronze);
      px(14, 12, 4, 3, PALETTE.tarnishedGold);
      // Ki crystal & glowing rune circle on tabletop
      px(6, 10, 4, 5, PALETTE.oceanicTeal);
      px(7, 9, 2, 4, PALETTE.kiCyan);
      px(21, 11, 5, 3, PALETTE.resonantGold);
      px(22, 10, 3, 2, PALETTE.paleGold);
      break;

    case 'mannequin_rack':
      // Display rack holding 2 crafted doll chassis frames
      px(3, 27, 26, 3, PALETTE.darkOak);
      px(4, 4, 2, 24, PALETTE.burntUmber);
      px(26, 4, 2, 24, PALETTE.burntUmber);
      px(3, 3, 26, 3, PALETTE.oldBronze);
      // Left chassis (Paladín / Bronze)
      px(8, 7, 6, 5, PALETTE.stoneMid);
      px(7, 12, 8, 7, PALETTE.tarnishedGold);
      px(9, 13, 4, 5, PALETTE.brightBrass);
      px(8, 19, 2, 6, PALETTE.stoneShadow);
      px(12, 19, 2, 6, PALETTE.stoneShadow);
      // Right chassis (Witch / Violet-Cyan)
      px(18, 7, 6, 5, PALETTE.porcelain);
      px(17, 12, 8, 7, PALETTE.royalPurple);
      px(19, 13, 4, 4, PALETTE.kiCyan);
      px(18, 19, 2, 6, PALETTE.deepAmethyst);
      px(22, 19, 2, 6, PALETTE.deepAmethyst);
      break;

    case 'blueprint_desk':
      // Drafting lectern with unrolled cyan arcane blueprint & quill
      px(3, 11, 18, 11, PALETTE.darkOak);
      px(4, 10, 16, 4, PALETTE.burntUmber);
      px(5, 14, 3, 8, PALETTE.darkOak);
      px(16, 14, 3, 8, PALETTE.darkOak);
      // Blueprint scroll
      px(5, 5, 14, 7, PALETTE.deepAbyss);
      px(6, 6, 12, 5, PALETTE.oceanicTeal);
      px(7, 7, 4, 3, PALETTE.kiCyan);
      px(12, 7, 5, 1, PALETTE.iceCyan);
      px(12, 9, 4, 1, PALETTE.paleGold);
      px(17, 4, 2, 4, PALETTE.resonantGold);
      break;

    case 'skill_altar':
      // Obsidian & brass arcane lectern with floating glowing Ki grimoire and crystal spires
      px(6, 23, 20, 7, PALETTE.cryptInk);
      px(7, 22, 18, 6, PALETTE.stoneShadow);
      px(9, 14, 14, 9, PALETTE.deepAmethyst);
      px(11, 15, 10, 7, PALETTE.royalPurple);
      px(10, 13, 12, 2, PALETTE.resonantGold);
      // Floating glowing open grimoire / skill tablet
      px(7, 5, 18, 7, PALETTE.deepAbyss);
      px(8, 6, 7, 5, PALETTE.porcelain);
      px(17, 6, 7, 5, PALETTE.porcelain);
      px(15, 6, 2, 5, PALETTE.resonantGold);
      px(10, 8, 3, 2, PALETTE.kiCyan);
      px(19, 8, 3, 2, PALETTE.etherealOrchid);
      // Arcane crystal crown & rune sparks
      px(14, 1, 4, 4, PALETTE.vibrantAqua);
      px(15, 2, 2, 2, PALETTE.frostedGlass);
      px(4, 10, 2, 2, PALETTE.kiCyan);
      px(26, 9, 2, 2, PALETTE.resonantGold);
      break;

    case 'training_dummy':
      // Heavy oak combat training dummy with bronze breastplate, wooden spar bar & Ki strike pad
      px(8, 26, 16, 4, PALETTE.darkOak);
      px(13, 18, 6, 9, PALETTE.burntUmber);
      px(5, 11, 22, 3, PALETTE.woodHighlight);
      px(4, 10, 3, 5, PALETTE.oldBronze);
      px(25, 10, 3, 5, PALETTE.oldBronze);
      // Armor torso
      px(10, 9, 12, 11, PALETTE.stoneShadow);
      px(11, 10, 10, 9, PALETTE.oldBronze);
      px(13, 12, 6, 5, PALETTE.riftCrimson);
      px(14, 13, 4, 3, PALETTE.resonantGold);
      // Helmet head
      px(12, 3, 8, 6, PALETTE.stoneMid);
      px(13, 4, 6, 4, PALETTE.boneGray);
      px(14, 5, 4, 1, PALETTE.kiCyan);
      break;

    case 'lab_console':
      // Arcane Soulpot telemetry desk with glowing cyan CRT monitor and specimen vial
      px(3, 18, 26, 11, PALETTE.darkOak);
      px(4, 16, 24, 5, PALETTE.burntUmber);
      px(5, 17, 22, 2, PALETTE.oldBronze);
      px(4, 21, 3, 8, PALETTE.cryptInk);
      px(25, 21, 3, 8, PALETTE.cryptInk);
      // Monitor housing & Ki waveform screen
      px(6, 5, 14, 12, PALETTE.stoneShadow);
      px(7, 6, 12, 10, PALETTE.deepAbyss);
      px(8, 7, 10, 7, PALETTE.oceanicTeal);
      px(9, 9, 3, 2, PALETTE.kiCyan);
      px(12, 8, 2, 4, PALETTE.neonMint);
      px(14, 10, 3, 1, PALETTE.iceCyan);
      // Glass Soulpot analyzer jar on the right
      px(22, 8, 5, 9, PALETTE.cryptInk);
      px(23, 9, 3, 7, PALETTE.vibrantAqua);
      px(23, 7, 3, 2, PALETTE.resonantGold);
      px(9, 15, 2, 1, PALETTE.resonantGold);
      px(12, 15, 2, 1, PALETTE.riftCrimson);
      break;
  }

  return canvas;
}
