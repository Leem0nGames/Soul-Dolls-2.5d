import type { CreatureType } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export interface TypeVisual {
  id: CreatureType;
  color: string;
  bg: string;
  border: string;
}

export const TYPE_VISUALS: Record<CreatureType, TypeVisual> = {
  brasa: { id: 'brasa', color: PALETTE.warmWhite, bg: PALETTE.rosewood, border: PALETTE.rubyGlow },
  marea: { id: 'marea', color: PALETTE.frostedGlass, bg: PALETTE.oceanicTeal, border: PALETTE.kiCyan },
  flora: { id: 'flora', color: PALETTE.warmWhite, bg: PALETTE.emerald, border: PALETTE.moss },
  chispa: { id: 'chispa', color: PALETTE.cryptInk, bg: PALETTE.resonantGold, border: PALETTE.oldBronze },
  roca: { id: 'roca', color: PALETTE.porcelain, bg: PALETTE.stoneMid, border: PALETTE.stoneHighlight },
  brisa: { id: 'brisa', color: PALETTE.cryptInk, bg: PALETTE.iceCyan, border: PALETTE.vibrantAqua },
  umbra: { id: 'umbra', color: PALETTE.lavenderMist, bg: PALETTE.royalPurple, border: PALETTE.soulViolet },
  comun: { id: 'comun', color: PALETTE.porcelain, bg: PALETTE.coldStone, border: PALETTE.boneGray },
};
