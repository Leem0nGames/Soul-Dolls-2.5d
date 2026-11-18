import {
  type AnimationRole,
  type AttackSheetSpec,
  getSpeciesAttackSpec,
  PLACEHOLDER_ATTACK_SHEET_PATH,
  PLACEHOLDER_ATTACK_SPEC,
  SOULDOLL_15_ATTACK_SHEET_PATH,
  SOULDOLL_15_ATTACK_SPEC,
} from '../data/animations.ts';

export type { AnimationRole, AttackSheetSpec };
export {
  PLACEHOLDER_ATTACK_SHEET_PATH,
  PLACEHOLDER_ATTACK_SPEC,
  SOULDOLL_15_ATTACK_SHEET_PATH,
  SOULDOLL_15_ATTACK_SPEC,
};

export const MELEE_STAB_SHEET_PATH = '/assets/attacks/special_attack_15.webp';
export const SOULDOLL_PORTRAIT_PLACEHOLDER_PATH =
  '/assets/aistudio/004-portrait-frame_5c78ef77.png';

export function getAttackSheetSpecForSpecies(
  speciesId?: number,
  role: AnimationRole = 'physical_attack'
): AttackSheetSpec {
  return getSpeciesAttackSpec(speciesId, role);
}

export const MELEE_STAB_COLS = 4;
export const MELEE_STAB_ROWS = 5;
export const MELEE_STAB_TOTAL_FRAMES = MELEE_STAB_COLS * MELEE_STAB_ROWS;
export const MELEE_STAB_IMPACT_FRAME = 9;

export const MELEE_ADVANCE_DURATION = 0.24;
export const MELEE_STAB_DURATION = 0.8;
export const MELEE_RETURN_DURATION = 0.18;
export const MELEE_STAB_TOTAL_DURATION =
  MELEE_ADVANCE_DURATION + MELEE_STAB_DURATION + MELEE_RETURN_DURATION;

export interface StabFrameUvRect {
  col: number;
  row: number;
  uMin: number;
  vMin: number;
  uSize: number;
  vSize: number;
}

export type MeleeStabPhaseKind = 'advance' | 'stab' | 'return';

export interface MeleeStabPhaseState {
  phase: MeleeStabPhaseKind;
  phaseT: number;
  advanceLungeT: number;
  attackerOpacity: number;
  stabVisible: boolean;
  stabOpacity: number;
  frameIndex: number;
  impactTriggered: boolean;
  elementGlow: number;
}

export function computeStabFrameUvRect(
  frameIndex: number,
  flipX: boolean,
  cols: number = MELEE_STAB_COLS,
  rows: number = MELEE_STAB_ROWS
): StabFrameUvRect {
  const total = cols * rows;
  const clamped = Math.max(0, Math.min(total - 1, Math.floor(frameIndex)));
  const col = clamped % cols;
  const row = Math.floor(clamped / cols);
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  // Row 0 sits at top of the texture (v in [1 - cellH, 1.0]) when flipY = true
  const vMin = 1 - (row + 1) * cellH;
  if (flipX) {
    return {
      col,
      row,
      uMin: (col + 1) * cellW,
      vMin,
      uSize: -cellW,
      vSize: cellH,
    };
  }
  return {
    col,
    row,
    uMin: col * cellW,
    vMin,
    uSize: cellW,
    vSize: cellH,
  };
}

export function mapStabProgressToFrame(
  p: number,
  totalFrames: number = MELEE_STAB_TOTAL_FRAMES
): number {
  const clamped = Math.max(0, Math.min(1, p));
  return Math.min(totalFrames - 1, Math.floor(clamped * totalFrames));
}

export function evaluateMeleeStabPhase(
  elapsedSec: number,
  spec: AttackSheetSpec = SOULDOLL_15_ATTACK_SPEC
): MeleeStabPhaseState {
  const t = Math.max(0, Math.min(MELEE_STAB_TOTAL_DURATION, elapsedSec));

  if (t < MELEE_ADVANCE_DURATION) {
    const p = t / MELEE_ADVANCE_DURATION;
    const easeOut = 1 - Math.pow(1 - p, 2);
    const fadeOut = p < 0.35 ? 1 : 1 - (p - 0.35) / 0.65;
    return {
      phase: 'advance',
      phaseT: p,
      advanceLungeT: easeOut,
      attackerOpacity: Math.max(0, Math.min(1, fadeOut)),
      stabVisible: false,
      stabOpacity: 0,
      frameIndex: 0,
      impactTriggered: false,
      elementGlow: 0,
    };
  }

  if (t < MELEE_ADVANCE_DURATION + MELEE_STAB_DURATION) {
    const p = (t - MELEE_ADVANCE_DURATION) / MELEE_STAB_DURATION;
    const frameIndex = mapStabProgressToFrame(p, spec.totalFrames);
    let stabOpacity = 1;
    if (p < 0.08) {
      stabOpacity = p / 0.08;
    } else if (p > 0.86) {
      stabOpacity = 1 - (p - 0.86) / 0.14;
    }
    let elementGlow = 0;
    if (p >= 0.34 && p <= 0.4) {
      elementGlow = (p - 0.34) / 0.06;
    } else if (p > 0.4 && p <= 0.54) {
      elementGlow = 1;
    } else if (p > 0.54 && p < 0.82) {
      elementGlow = 1 - (p - 0.54) / 0.28;
    }

    return {
      phase: 'stab',
      phaseT: p,
      advanceLungeT: 1,
      attackerOpacity: 0,
      stabVisible: true,
      stabOpacity: Math.max(0, Math.min(1, stabOpacity)),
      frameIndex,
      impactTriggered: frameIndex >= spec.impactFrame,
      elementGlow: Math.max(0, Math.min(1, elementGlow)),
    };
  }

  const p = Math.min(1, (t - MELEE_ADVANCE_DURATION - MELEE_STAB_DURATION) / MELEE_RETURN_DURATION);
  return {
    phase: 'return',
    phaseT: p,
    advanceLungeT: 0,
    attackerOpacity: Math.max(0, Math.min(1, p)),
    stabVisible: false,
    stabOpacity: 0,
    frameIndex: spec.totalFrames - 1,
    impactTriggered: true,
    elementGlow: 0,
  };
}
