import { PALETTE } from '../../gfx/Palette.ts';

/**
 * Exact 64-color brand palette organized by the 8 documented brand groups.
 * Flat shading only: zero gradients, zero blur, zero 3D skew.
 */
export const BRAND_PALETTE_64 = PALETTE;

export interface PaletteGroup {
  id:
    | 'base'
    | 'neutrals'
    | 'woodsBronze'
    | 'redsPink'
    | 'violets'
    | 'cyansNature'
    | 'environment'
    | 'uiAccents';
  label: string;
  colors: readonly string[];
}

export const BRAND_PALETTE_GROUPS: readonly PaletteGroup[] = [
  {
    id: 'base',
    label: 'Base',
    colors: [
      PALETTE.cryptInk,
      PALETTE.smokedWood,
      PALETTE.oldBronze,
      PALETTE.resonantGold,
      PALETTE.porcelain,
      PALETTE.kiCyan,
      PALETTE.soulViolet,
      PALETTE.riftCrimson,
      PALETTE.porcelainPink,
    ],
  },
  {
    id: 'neutrals',
    label: 'Neutrals',
    colors: [
      PALETTE.voidBlack,
      PALETTE.abyssInk,
      PALETTE.ashPurple,
      PALETTE.coldStone,
      PALETTE.boneGray,
      PALETTE.warmWhite,
    ],
  },
  {
    id: 'woodsBronze',
    label: 'Woods / Bronze',
    colors: [
      PALETTE.darkOak,
      PALETTE.burntUmber,
      PALETTE.tarnishedGold,
      PALETTE.brightBrass,
      PALETTE.paleGold,
      PALETTE.rust,
      PALETTE.leatherBrown,
    ],
  },
  {
    id: 'redsPink',
    label: 'Reds / Pink',
    colors: [
      PALETTE.driedBlood,
      PALETTE.bloodMoon,
      PALETTE.rosewood,
      PALETTE.rubyGlow,
      PALETTE.coralRed,
      PALETTE.peachBlush,
      PALETTE.paleRose,
      PALETTE.cherryBlossom,
    ],
  },
  {
    id: 'violets',
    label: 'Violets',
    colors: [
      PALETTE.nightshade,
      PALETTE.deepAmethyst,
      PALETTE.royalPurple,
      PALETTE.arcaneLilac,
      PALETTE.etherealOrchid,
      PALETTE.ghostViolet,
      PALETTE.lavenderMist,
      PALETTE.hexPurple,
    ],
  },
  {
    id: 'cyansNature',
    label: 'Cyans / Nature',
    colors: [
      PALETTE.darkSlate,
      PALETTE.deepAbyss,
      PALETTE.oceanicTeal,
      PALETTE.vibrantAqua,
      PALETTE.neonMint,
      PALETTE.iceCyan,
      PALETTE.frostedGlass,
      PALETTE.emerald,
    ],
  },
  {
    id: 'environment',
    label: 'Environment',
    colors: [
      PALETTE.pitchBlackGreen,
      PALETTE.forestGreen,
      PALETTE.oliveDrab,
      PALETTE.moss,
      PALETTE.dirtBrown,
      PALETTE.stoneShadow,
      PALETTE.stoneMid,
      PALETTE.stoneHighlight,
      PALETTE.sandDesert,
      PALETTE.woodHighlight,
    ],
  },
  {
    id: 'uiAccents',
    label: 'UI Accents',
    colors: [
      PALETTE.uiDanger,
      PALETTE.uiWarning,
      PALETTE.uiSuccess,
      PALETTE.uiManaInfo,
      PALETTE.uiPoison,
      PALETTE.uiGold,
      PALETTE.pureWhite,
      PALETTE.uiInk,
    ],
  },
] as const;

export const ALL_BRAND_COLORS: readonly string[] = Object.values(PALETTE);

export const BRAND_HEX_SET: ReadonlySet<string> = new Set(
  ALL_BRAND_COLORS.map((hex) => hex.toUpperCase())
);

export function isBrandPaletteHex(hex: string): boolean {
  return BRAND_HEX_SET.has(hex.trim().toUpperCase());
}

export function assertBrandPaletteHex(hex: string): string {
  const normalized = hex.trim().toUpperCase();
  if (!BRAND_HEX_SET.has(normalized)) {
    throw new Error(`Color "${hex}" is outside the strict 64-color brand palette.`);
  }
  return normalized;
}
