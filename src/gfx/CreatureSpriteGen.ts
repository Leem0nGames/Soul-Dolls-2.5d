import { createRng } from '../core/Rng.ts';
import { getSpeciesDollProfile } from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import type { CreatureFeature, CreatureType, DollWeaponKind } from '../domain/types.ts';
import { PALETTE, TYPE_PALETTES } from './Palette.ts';

function setPixel(grid: number[][], x: number, y: number, val: number): void {
  const size = grid.length;
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (ry < 1 || ry >= size - 1 || rx < 1 || rx >= size - 1) return;
  grid[ry][rx] = val;
}

function plotSymmetric(grid: number[][], x: number, y: number, val: number): void {
  const size = grid.length;
  const rx = Math.round(x);
  const ry = Math.round(y);
  if (ry < 1 || ry >= size - 1 || rx < 1 || rx >= size - 1) return;
  grid[ry][rx] = val;
  grid[ry][size - 1 - rx] = val;
}

function fillSymmetricRect(
  grid: number[][],
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  val: number
): void {
  for (let y = y1; y <= y2; y++) {
    for (let x = x1; x <= x2; x++) {
      plotSymmetric(grid, x, y, val);
    }
  }
}

function fillEllipse(
  grid: number[][],
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  val: number
): void {
  for (let y = 1; y < grid.length - 1; y++) {
    for (let x = 1; x <= grid.length / 2; x++) {
      const dx = (x - cx) / rx;
      const dy = (y - cy) / ry;
      if (dx * dx + dy * dy <= 1) {
        plotSymmetric(grid, x, y, val);
      }
    }
  }
}

function drawHumanoidDollBase(
  grid: number[][],
  primaryType: CreatureType,
  stage: 1 | 2 | 3,
  speciesId: number
): void {
  const scaleW = stage === 1 ? 0 : stage === 2 ? 1 : 2;
  const hairStyle = speciesId % 4;

  // 1. Head (chibi humanoid marionette proportions y=5..10)
  fillEllipse(grid, 15.5, 8, 3.3, 3.0, 2);

  // Class headgear / hood / hat / helmet
  switch (primaryType) {
    case 'brasa':
      // Maga: pointed mage hood + collar flame crest
      for (let y = 2; y <= 6; y++) {
        const w = Math.max(0, y - 2);
        for (let dx = 0; dx <= w; dx++) {
          plotSymmetric(grid, 15 - dx, y, y < 4 ? 4 : 3);
        }
      }
      fillSymmetricRect(grid, 12, 6, 15, 7, 3);
      break;
    case 'flora':
      // Priest: sacred mitre / floral coronet
      fillSymmetricRect(grid, 13, 3, 15, 5, 3);
      plotSymmetric(grid, 12, 5, 4);
      plotSymmetric(grid, 15, 3, 4);
      break;
    case 'roca':
      // Paladín: knight helm & visor plume
      fillSymmetricRect(grid, 12, 4, 15, 6, 3);
      plotSymmetric(grid, 15, 3, 4);
      plotSymmetric(grid, 14, 3, 4);
      break;
    case 'comun':
      // Witch: wide-brimmed pointed witch hat
      fillSymmetricRect(grid, 10, 6, 15, 6, 3);
      fillSymmetricRect(grid, 13, 3, 15, 5, 3);
      setPixel(grid, 16, 2, 4);
      setPixel(grid, 17, 2, 4);
      break;
    case 'marea':
      // Corsaria: tricorn crest / fin tiara
      fillSymmetricRect(grid, 12, 4, 15, 5, 3);
      plotSymmetric(grid, 11, 5, 4);
      plotSymmetric(grid, 15, 3, 4);
      break;
    case 'chispa':
      // Monje Ki: radiant headband & spiky Ki crest
      fillSymmetricRect(grid, 12, 5, 15, 6, 4);
      plotSymmetric(grid, 13, 4, 3);
      plotSymmetric(grid, 15, 3, 4);
      break;
    case 'brisa':
      // Céfira: winged feather circlet
      plotSymmetric(grid, 11, 5, 3);
      plotSymmetric(grid, 10, 4, 4);
      plotSymmetric(grid, 12, 6, 4);
      break;
    case 'umbra':
      // Segadora: hooded reaper cowl
      fillSymmetricRect(grid, 11, 4, 15, 7, 5);
      fillSymmetricRect(grid, 12, 5, 15, 5, 4);
      break;
  }

  // Distinct hair / side-locks silhouette
  if (hairStyle === 0 || hairStyle === 2) {
    fillSymmetricRect(grid, 11, 7, 12, 11, 3);
  } else {
    plotSymmetric(grid, 11, 8, 3);
    plotSymmetric(grid, 11, 9, 4);
  }

  // 2. Torso & Garment (y=11..19)
  const shoulderHalf = 3 + Math.min(2, scaleW);
  fillSymmetricRect(grid, 15 - shoulderHalf, 12, 15, 13, 3); // pauldrons / collar
  fillSymmetricRect(grid, 13, 12, 15, 18, 2); // core torso

  // Robe skirt for caster classes, armored belt/greaves for martial classes
  if (
    primaryType === 'brasa' ||
    primaryType === 'flora' ||
    primaryType === 'comun' ||
    primaryType === 'umbra'
  ) {
    fillSymmetricRect(grid, 12 - Math.min(1, scaleW), 16, 15, 21, 3);
    fillSymmetricRect(grid, 13, 16, 15, 19, 2);
  } else {
    // Belt + tunic tabard
    fillSymmetricRect(grid, 13, 16, 15, 17, 4);
    fillSymmetricRect(grid, 12, 17, 15, 19, 3);
  }

  // 3. Articulated marionette arms (left x=10..11, right x=20..21)
  for (let y = 13; y <= 17; y++) {
    setPixel(grid, 11, y, y === 15 ? 4 : 2);
    setPixel(grid, 10, Math.min(18, y + 1), y === 17 ? 3 : 2);
    setPixel(grid, 20, y, y === 15 ? 4 : 2);
    setPixel(grid, 21, Math.min(18, y + 1), y === 17 ? 3 : 2);
  }

  // 4. Marionette legs & boots (y=20..27)
  for (let y = 20; y <= 26; y++) {
    const legX = y >= 24 ? 12 : 13;
    plotSymmetric(grid, legX, y, y === 23 ? 4 : y >= 25 ? 5 : 2);
    plotSymmetric(grid, legX + 1, y, y >= 25 ? 3 : 2);
  }
  plotSymmetric(grid, 11, 26, 3); // boot toe
}

function drawUniqueWeapon(
  grid: number[][],
  weapon: DollWeaponKind,
  view: 'front' | 'back'
): void {
  // Front holds primary weapon on viewer's right (x=23..28); Back mirrors or raises across shoulder
  const dir = view === 'front' ? 1 : -1;
  const handX = view === 'front' ? 22 : 9;
  const px = (dx: number, y: number, val: number) => setPixel(grid, handX + dx * dir, y, val);

  switch (weapon) {
    case 'staff':
      for (let y = 6; y <= 25; y++) px(2, y, 5);
      px(2, 4, 4);
      px(1, 5, 4);
      px(3, 5, 4);
      px(2, 5, 3);
      px(2, 6, 4);
      break;
    case 'scepter':
      for (let y = 8; y <= 24; y++) px(2, y, 3);
      px(1, 7, 4);
      px(2, 6, 4);
      px(3, 7, 4);
      px(2, 8, 4);
      px(2, 7, 3);
      break;
    case 'sword_shield':
      // Sword in main hand
      for (let y = 6; y <= 18; y++) px(2, y, y <= 14 ? 3 : 4);
      px(1, 15, 4);
      px(3, 15, 4);
      // Shield on off-hand side
      {
        const sx = view === 'front' ? 8 : 23;
        for (let y = 13; y <= 19; y++) {
          for (let x = sx - 1; x <= sx + 1; x++) {
            setPixel(grid, x, y, y === 16 && x === sx ? 4 : 3);
          }
        }
      }
      break;
    case 'wand':
      for (let i = 0; i <= 9; i++) {
        px(1 + Math.floor(i * 0.4), 17 - i, i >= 7 ? 4 : 3);
      }
      px(5, 7, 4);
      px(4, 9, 4);
      break;
    case 'trident':
      for (let y = 7; y <= 25; y++) px(2, y, 3);
      px(0, 6, 4);
      px(0, 7, 4);
      px(2, 5, 4);
      px(2, 6, 4);
      px(4, 6, 4);
      px(4, 7, 4);
      px(1, 8, 4);
      px(3, 8, 4);
      break;
    case 'spear':
      for (let y = 4; y <= 26; y++) px(2, y, y <= 8 ? 4 : 5);
      px(1, 7, 3);
      px(3, 7, 3);
      px(2, 3, 3);
      break;
    case 'daggers':
      for (let i = 0; i <= 5; i++) {
        setPixel(grid, 22 + i, 17 - i, i >= 3 ? 4 : 3);
        setPixel(grid, 9 - i, 17 - i, i >= 3 ? 4 : 3);
      }
      break;
    case 'scythe':
      for (let y = 5; y <= 26; y++) px(2, y, 5);
      px(1, 5, 4);
      px(0, 5, 4);
      px(-1, 6, 4);
      px(-2, 7, 3);
      px(-2, 8, 3);
      px(3, 5, 3);
      break;
    case 'hammer':
      for (let y = 8; y <= 24; y++) px(2, y, 5);
      for (let dy = 6; dy <= 10; dy++) {
        for (let dx = 0; dx <= 4; dx++) {
          px(dx, dy, dy === 6 || dy === 10 ? 4 : 3);
        }
      }
      break;
    case 'bow':
      for (let y = 8; y <= 22; y++) {
        const curve = Math.abs(y - 15) <= 2 ? 3 : Math.abs(y - 15) <= 5 ? 2 : 1;
        px(curve, y, 4);
        px(0, y, 3);
      }
      break;
    case 'grimoire':
      for (let y = 13; y <= 19; y++) {
        for (let dx = 0; dx <= 4; dx++) {
          px(dx, y, dx === 2 ? 5 : y === 13 || y === 19 ? 4 : 3);
        }
      }
      px(2, 16, 4);
      break;
    case 'orb':
      px(2, 12, 4);
      px(1, 13, 3);
      px(2, 13, 4);
      px(3, 13, 3);
      px(1, 14, 4);
      px(2, 14, 3);
      px(3, 14, 4);
      px(2, 15, 4);
      break;
  }
}

function addDollFeatures(
  grid: number[][],
  features: readonly CreatureFeature[],
  stage: 1 | 2 | 3,
  speciesId: number
): void {
  const reach = stage + 1;
  const tilt = speciesId % 2;
  for (const feat of features) {
    switch (feat) {
      case 'ears':
        for (let i = 0; i < reach; i++) {
          plotSymmetric(grid, 11 - i, 6 - i + tilt, 3);
          plotSymmetric(grid, 12 - i, 6 - i + tilt, 2);
        }
        break;
      case 'horns':
        for (let i = 0; i <= reach; i++) {
          plotSymmetric(grid, 12 - Math.floor(i * 0.5), 5 - i, 4);
        }
        break;
      case 'wings':
        for (let y = 12; y <= 17 + stage; y++) {
          for (let x = 4; x <= 9; x++) {
            if (x + (y - 12) * 0.5 <= 10) {
              plotSymmetric(grid, x, y, (y + tilt) % 2 === 0 ? 3 : 4);
            }
          }
        }
        break;
      case 'flame':
        for (let i = 0; i < 2 + stage; i++) {
          plotSymmetric(grid, 13 + ((i + tilt) % 2), 4 - Math.min(2, i), 4);
        }
        break;
      case 'leaves':
        for (let i = 0; i < 2 + stage; i++) {
          plotSymmetric(grid, 12 - i, 6 - (i % 2), 4);
        }
        break;
      case 'tail':
        for (let i = 0; i < 3 + stage; i++) {
          const x = Math.max(4, 11 - i);
          const y = Math.max(15, 22 - Math.floor(i * 0.7));
          setPixel(grid, x, y, 3);
        }
        break;
    }
  }
}

function stampSpeciesSignature(grid: number[][], speciesId: number): void {
  // Deterministic 6-bit pattern on torso/hem so every single one of 50 species has a unique silhouette & crest
  const rng = createRng(speciesId * 104729 + 31);
  for (let bit = 0; bit < 6; bit++) {
    const row = 12 + (bit % 5) * 2;
    const col = 13 + ((speciesId + bit) % 3);
    const val = ((speciesId >> (bit % 6)) & 1) === 1 ? 4 : 3;
    plotSymmetric(grid, col, row, val);
  }
  // Unique shoulder/cloak emblem
  const ex = rng.int(12, 14);
  const ey = rng.int(12, 18);
  plotSymmetric(grid, ex, ey, 4);
  plotSymmetric(grid, 11, 14 + (speciesId % 5), (speciesId % 2) + 3);
}

export function buildCreaturePixelGrid(
  speciesId: number,
  view: 'front' | 'back'
): number[][] {
  const spec = getSpecies(speciesId);
  const size = 32;
  // Grid codes: 0=empty, 1=outline, 2=base, 3=light/secondary, 4=accent, 5=dark, 6=eye
  const grid: number[][] = Array.from({ length: size }, () =>
    new Array<number>(size).fill(0)
  );

  const profile = getSpeciesDollProfile(speciesId, spec.types, spec.dollClass, spec.weapon);

  drawHumanoidDollBase(grid, spec.types[0], spec.stage, speciesId);
  addDollFeatures(grid, spec.features, spec.stage, speciesId);
  stampSpeciesSignature(grid, speciesId);
  drawUniqueWeapon(grid, profile.weapon, view);

  // Shading pass on lower armor/robe
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (grid[y][x] === 2 && y > 21) {
        grid[y][x] = 5;
      }
    }
  }

  // Front possessed eyes vs Back cloak/rune clasp
  if (view === 'front') {
    plotSymmetric(grid, 14, 8, 6);
    plotSymmetric(grid, 14, 7, 6);
  } else {
    // Back view reveals Ki cloak spine & sigil
    for (let y = 11; y <= 19; y++) {
      setPixel(grid, 15, y, y % 2 === 0 ? 4 : 3);
      setPixel(grid, 16, y, y % 2 === 0 ? 4 : 3);
    }
    for (let y = 7; y <= 10; y++) {
      plotSymmetric(grid, 14, y, 5);
    }
  }

  // Outline pass around non-zero pixels
  const out: number[][] = grid.map((row) => row.slice());
  for (let y = 1; y < size - 1; y++) {
    for (let x = 1; x < size - 1; x++) {
      if (grid[y][x] === 0) {
        if (
          grid[y - 1][x] > 1 ||
          grid[y + 1][x] > 1 ||
          grid[y][x - 1] > 1 ||
          grid[y][x + 1] > 1
        ) {
          out[y][x] = 1;
        }
      }
    }
  }

  return out;
}

export function generateCreatureSpriteCanvas(
  speciesId: number,
  view: 'front' | 'back'
): HTMLCanvasElement {
  const spec = getSpecies(speciesId);
  const primaryPal = TYPE_PALETTES[spec.types[0]];
  const secondaryPal = spec.types[1] ? TYPE_PALETTES[spec.types[1]] : primaryPal;
  const out = buildCreaturePixelGrid(speciesId, view);
  const size = out.length;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const soulEyeColor =
    spec.types[0] === 'umbra'
      ? PALETTE.soulViolet
      : spec.types[0] === 'brasa' || spec.types[0] === 'chispa'
        ? PALETTE.resonantGold
        : PALETTE.kiCyan;

  const colorMap: Record<number, string> = {
    1: primaryPal.outline,
    2: primaryPal.base,
    3: secondaryPal.light,
    4: secondaryPal.accent,
    5: primaryPal.dark,
    6: view === 'front' ? PALETTE.cryptInk : primaryPal.dark,
  };

  // 1. Marionette suspension strings from top bar down to doll crown & shoulders
  const stringColumns = [10, 15, 21];
  for (const sx of stringColumns) {
    let firstSolidY = -1;
    for (let y = 0; y < size; y++) {
      if (out[y][sx] > 0) {
        firstSolidY = y;
        break;
      }
    }
    if (firstSolidY > 1) {
      for (let y = 0; y < firstSolidY; y++) {
        ctx.fillStyle = y % 2 === 0 ? PALETTE.ghostViolet : PALETTE.boneGray;
        ctx.fillRect(sx, y, 1, 1);
      }
      ctx.fillStyle = PALETTE.oldBronze;
      ctx.fillRect(sx, 0, 1, 1);
    }
  }

  // 2. Marionette body + weapon + glowing soul eyes
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const code = out[y][x];
      if (code === 0) continue;
      ctx.fillStyle = colorMap[code] ?? primaryPal.base;
      ctx.fillRect(x, y, 1, 1);
      if (code === 6 && view === 'front') {
        if (y > 0 && out[y - 1][x] === 6) {
          ctx.fillStyle = PALETTE.cryptInk;
          ctx.fillRect(x, y, 1, 1);
        } else {
          ctx.fillStyle = soulEyeColor;
          ctx.fillRect(x, y, 1, 1);
          if (y > 0) {
            ctx.fillStyle = PALETTE.warmWhite;
            ctx.fillRect(x, y - 1, 1, 1);
          }
        }
      }
    }
  }

  // 3. Bronze ball-joint rivets on shoulders & knees
  const joints: Array<[number, number]> = [
    [11, 13],
    [20, 13],
    [13, 23],
    [18, 23],
  ];
  for (const [jx, jy] of joints) {
    if (out[jy]?.[jx] > 1) {
      ctx.fillStyle = PALETTE.oldBronze;
      ctx.fillRect(jx, jy, 1, 1);
    }
  }

  // 4. Floating Ki spirit wisp orbiting the SoulDoll
  const wispSideLeft = speciesId % 2 === 0;
  const wx = wispSideLeft ? 2 : 28;
  const wy = 6 + (speciesId % 4);
  if (out[wy][wx] === 0 && out[wy + 1][wx] === 0) {
    ctx.fillStyle = soulEyeColor;
    ctx.fillRect(wx, wy, 2, 2);
    ctx.fillStyle = PALETTE.warmWhite;
    ctx.fillRect(wx, wy, 1, 1);
    ctx.fillStyle = PALETTE.ghostViolet;
    ctx.fillRect(wx + (wispSideLeft ? 1 : 0), wy - 1, 1, 1);
  }

  return canvas;
}
