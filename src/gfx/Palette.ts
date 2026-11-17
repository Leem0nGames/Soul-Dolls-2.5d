import type { CharacterRole, CreatureType } from '../domain/types.ts';

/**
 * Paleta maestra de 64 colores (63 valores HEX únicos organizados en 8 grupos)
 * + Rampas cromáticas y regla 80/10/10 para todo el motor SoulDolls.
 */
export const PALETTE = {
  // 1. Colores Base de la Marca (9)
  cryptInk: '#14101C',
  smokedWood: '#2A1F2D',
  oldBronze: '#8A6A3B',
  resonantGold: '#E8B84A',
  porcelain: '#F2E6C9',
  kiCyan: '#5FE3D2',
  soulViolet: '#9B6BFF',
  riftCrimson: '#C2234B',
  porcelainPink: '#FF8FB8',

  // 2. Neutros y Escala de Grises (6)
  voidBlack: '#000000',
  abyssInk: '#0B080E',
  ashPurple: '#3D3242',
  coldStone: '#6B5C70',
  boneGray: '#A89BA8',
  warmWhite: '#FFF9F0',

  // 3. Maderas, Cueros y Bronces (7)
  darkOak: '#3B2B1A',
  burntUmber: '#5C4227',
  tarnishedGold: '#A67F46',
  brightBrass: '#F4D073',
  paleGold: '#FCEDB8',
  rust: '#6E3A1B',
  leatherBrown: '#7A4F2E',

  // 4. Rojos y Rosas (8)
  driedBlood: '#4A0B18',
  bloodMoon: '#6E0C25',
  rosewood: '#911934',
  rubyGlow: '#E23E66',
  coralRed: '#F06060',
  peachBlush: '#FFB3CE',
  paleRose: '#FFD6E4',
  cherryBlossom: '#FFEBF2',

  // 5. Violetas y Magia Arcana (8)
  nightshade: '#24123B',
  deepAmethyst: '#3C1C6E',
  royalPurple: '#5E329E',
  arcaneLilac: '#7F4AD6',
  etherealOrchid: '#B691FF',
  ghostViolet: '#D1BEFF',
  lavenderMist: '#F4EFFF',
  hexPurple: '#6C3B8A',

  // 6. Cianes, Teales y Naturaleza (8)
  darkSlate: '#1B2A2A',
  deepAbyss: '#123F3C',
  oceanicTeal: '#1F6B65',
  vibrantAqua: '#32A89D',
  neonMint: '#85EADD',
  iceCyan: '#B8F4EE',
  frostedGlass: '#D9FBF7',
  emerald: '#2D8C55',

  // 7. Entornos, Tilesets y Propios del Mundo (10)
  pitchBlackGreen: '#10160D',
  forestGreen: '#2A3D24',
  oliveDrab: '#4C5C36',
  moss: '#7A8B3F',
  dirtBrown: '#453322',
  stoneShadow: '#2F3640',
  stoneMid: '#4B5563',
  stoneHighlight: '#6B778C',
  sandDesert: '#C2A77C',
  woodHighlight: '#9E7D5A',

  // 8. Acentos de UI y Efectos Especiales (8)
  uiDanger: '#FF0000',
  uiWarning: '#FFAA00',
  uiSuccess: '#00E639',
  uiManaInfo: '#0077FF',
  uiPoison: '#8F00FF',
  uiGold: '#FFD700',
  pureWhite: '#FFFFFF',
  uiInk: '#050505',
} as const;

export function hexToNumber(hex: string): number {
  return Number.parseInt(hex.replace('#', ''), 16);
}

export function hexToRgb01(hex: string): [number, number, number] {
  const n = hexToNumber(hex);
  return [((n >> 16) & 0xff) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

export interface TypePalette {
  outline: string;
  dark: string;
  base: string;
  light: string;
  accent: string;
}

export const TYPE_PALETTES: Record<CreatureType, TypePalette> = {
  brasa: {
    outline: PALETTE.driedBlood,
    dark: PALETTE.rosewood,
    base: PALETTE.coralRed,
    light: PALETTE.paleGold,
    accent: PALETTE.resonantGold,
  },
  marea: {
    outline: PALETTE.deepAbyss,
    dark: PALETTE.oceanicTeal,
    base: PALETTE.vibrantAqua,
    light: PALETTE.iceCyan,
    accent: PALETTE.kiCyan,
  },
  flora: {
    outline: PALETTE.pitchBlackGreen,
    dark: PALETTE.forestGreen,
    base: PALETTE.emerald,
    light: PALETTE.moss,
    accent: PALETTE.porcelainPink,
  },
  chispa: {
    outline: PALETTE.darkOak,
    dark: PALETTE.oldBronze,
    base: PALETTE.resonantGold,
    light: PALETTE.paleGold,
    accent: PALETTE.kiCyan,
  },
  roca: {
    outline: PALETTE.cryptInk,
    dark: PALETTE.stoneShadow,
    base: PALETTE.coldStone,
    light: PALETTE.boneGray,
    accent: PALETTE.tarnishedGold,
  },
  brisa: {
    outline: PALETTE.darkSlate,
    dark: PALETTE.ashPurple,
    base: PALETTE.neonMint,
    light: PALETTE.frostedGlass,
    accent: PALETTE.ghostViolet,
  },
  umbra: {
    outline: PALETTE.cryptInk,
    dark: PALETTE.deepAmethyst,
    base: PALETTE.soulViolet,
    light: PALETTE.etherealOrchid,
    accent: PALETTE.riftCrimson,
  },
  comun: {
    outline: PALETTE.cryptInk,
    dark: PALETTE.ashPurple,
    base: PALETTE.boneGray,
    light: PALETTE.porcelain,
    accent: PALETTE.porcelainPink,
  },
};

export interface CharacterPalette {
  hair: string;
  skin: string;
  shirt: string;
  pants: string;
  hat: string;
  trim: string;
}

export const CHARACTER_PALETTES: Record<CharacterRole, CharacterPalette> = {
  player: {
    hair: PALETTE.darkOak,
    skin: PALETTE.porcelain,
    shirt: PALETTE.riftCrimson,
    pants: PALETTE.oceanicTeal,
    hat: PALETTE.rubyGlow,
    trim: PALETTE.warmWhite,
  },
  rival: {
    hair: PALETTE.deepAmethyst,
    skin: PALETTE.peachBlush,
    shirt: PALETTE.royalPurple,
    pants: PALETTE.cryptInk,
    hat: PALETTE.arcaneLilac,
    trim: PALETTE.resonantGold,
  },
  professor: {
    hair: PALETTE.boneGray,
    skin: PALETTE.porcelain,
    shirt: PALETTE.warmWhite,
    pants: PALETTE.stoneMid,
    hat: PALETTE.boneGray,
    trim: PALETTE.coldStone,
  },
  healer: {
    hair: PALETTE.rubyGlow,
    skin: PALETTE.cherryBlossom,
    shirt: PALETTE.porcelainPink,
    pants: PALETTE.porcelain,
    hat: PALETTE.warmWhite,
    trim: PALETTE.riftCrimson,
  },
  merchant: {
    hair: PALETTE.burntUmber,
    skin: PALETTE.porcelain,
    shirt: PALETTE.vibrantAqua,
    pants: PALETTE.stoneShadow,
    hat: PALETTE.kiCyan,
    trim: PALETTE.paleGold,
  },
  trainer: {
    hair: PALETTE.leatherBrown,
    skin: PALETTE.peachBlush,
    shirt: PALETTE.arcaneLilac,
    pants: PALETTE.stoneShadow,
    hat: PALETTE.oldBronze,
    trim: PALETTE.brightBrass,
  },
  leader: {
    hair: PALETTE.resonantGold,
    skin: PALETTE.porcelain,
    shirt: PALETTE.royalPurple,
    pants: PALETTE.nightshade,
    hat: PALETTE.brightBrass,
    trim: PALETTE.paleGold,
  },
  artisan: {
    hair: PALETTE.burntUmber,
    skin: PALETTE.porcelain,
    shirt: PALETTE.rust,
    pants: PALETTE.stoneShadow,
    hat: PALETTE.oldBronze,
    trim: PALETTE.brightBrass,
  },
  scholar: {
    hair: PALETTE.frostedGlass,
    skin: PALETTE.porcelain,
    shirt: PALETTE.deepAmethyst,
    pants: PALETTE.cryptInk,
    hat: PALETTE.royalPurple,
    trim: PALETTE.kiCyan,
  },
  npc: {
    hair: PALETTE.ashPurple,
    skin: PALETTE.porcelain,
    shirt: PALETTE.emerald,
    pants: PALETTE.dirtBrown,
    hat: PALETTE.oliveDrab,
    trim: PALETTE.iceCyan,
  },
};
