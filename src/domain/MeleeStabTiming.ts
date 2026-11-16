export const MELEE_STAB_SHEET_PATH = '/assets/aistudio/004-special_attack-v1_5431e7bd.png';
export const SOULDOLL_PORTRAIT_PLACEHOLDER_PATH =
  '/assets/aistudio/004-portrait-frame_5c78ef77.png';

export const MELEE_STAB_COLS = 5;
export const MELEE_STAB_ROWS = 5;
export const MELEE_STAB_TOTAL_FRAMES = MELEE_STAB_COLS * MELEE_STAB_ROWS;
export const MELEE_STAB_IMPACT_FRAME = 11;

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

export function computeStabFrameUvRect(frameIndex: number, flipX: boolean): StabFrameUvRect {
  const clamped = Math.max(0, Math.min(MELEE_STAB_TOTAL_FRAMES - 1, Math.floor(frameIndex)));
  const col = clamped % MELEE_STAB_COLS;
  const row = Math.floor(clamped / MELEE_STAB_COLS);
  const cellW = 1 / MELEE_STAB_COLS;
  const cellH = 1 / MELEE_STAB_ROWS;
  // Row 0 sits at top of the texture (v in [0.8, 1.0]) when flipY = true
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

export function mapStabProgressToFrame(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  if (clamped < 0.34) {
    return Math.min(9, Math.floor((clamped / 0.34) * 10));
  }
  if (clamped < 0.4) {
    return 10;
  }
  if (clamped < 0.54) {
    return MELEE_STAB_IMPACT_FRAME;
  }
  return 12 + Math.min(12, Math.floor(((clamped - 0.54) / 0.46) * 13));
}

export function evaluateMeleeStabPhase(elapsedSec: number): MeleeStabPhaseState {
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
    const frameIndex = mapStabProgressToFrame(p);
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
      impactTriggered: frameIndex >= MELEE_STAB_IMPACT_FRAME,
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
    frameIndex: MELEE_STAB_TOTAL_FRAMES - 1,
    impactTriggered: true,
    elementGlow: 0,
  };
}
