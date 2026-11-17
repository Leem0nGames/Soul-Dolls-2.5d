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

export interface SpeciesAttackSheetConfig {
  speciesId: number;
  sheetPath: string;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  cellAspect: number;
  heightScale: number;
  advanceDuration: number;
  attackDuration: number;
  returnDuration: number;
  totalDuration: number;
  elementTintStrength: number;
}

export const SOULDOLL_15_ATTACK_SHEET_PATH = '/assets/souldolls/15_attack.png';
export const SOULDOLL_15_COLS = 4;
export const SOULDOLL_15_ROWS = 5;
export const SOULDOLL_15_TOTAL_FRAMES = 18;
export const SOULDOLL_15_IMPACT_FRAME = 7;
export const SOULDOLL_15_ADVANCE_DURATION = 0.22;
export const SOULDOLL_15_ATTACK_DURATION = 0.96;
export const SOULDOLL_15_RETURN_DURATION = 0.18;
export const SOULDOLL_15_TOTAL_DURATION =
  SOULDOLL_15_ADVANCE_DURATION + SOULDOLL_15_ATTACK_DURATION + SOULDOLL_15_RETURN_DURATION;

export const SOULDOLL_15_ATTACK_SHEET: SpeciesAttackSheetConfig = {
  speciesId: 15,
  sheetPath: SOULDOLL_15_ATTACK_SHEET_PATH,
  cols: SOULDOLL_15_COLS,
  rows: SOULDOLL_15_ROWS,
  totalFrames: SOULDOLL_15_TOTAL_FRAMES,
  impactFrame: SOULDOLL_15_IMPACT_FRAME,
  cellAspect: 480 / 300,
  heightScale: 1.04,
  advanceDuration: SOULDOLL_15_ADVANCE_DURATION,
  attackDuration: SOULDOLL_15_ATTACK_DURATION,
  returnDuration: SOULDOLL_15_RETURN_DURATION,
  totalDuration: SOULDOLL_15_TOTAL_DURATION,
  elementTintStrength: 0.42,
};

const SPECIES_ATTACK_SHEETS: Readonly<Record<number, SpeciesAttackSheetConfig>> = {
  15: SOULDOLL_15_ATTACK_SHEET,
};

export function getSpeciesAttackSheetConfig(
  speciesId: number
): SpeciesAttackSheetConfig | null {
  return SPECIES_ATTACK_SHEETS[speciesId] ?? null;
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

export function computeGridFrameUvRect(
  frameIndex: number,
  cols: number,
  rows: number,
  totalFrames: number,
  flipX: boolean
): StabFrameUvRect {
  const safeTotal = Math.max(1, Math.min(cols * rows, totalFrames));
  const clamped = Math.max(0, Math.min(safeTotal - 1, Math.floor(frameIndex)));
  const col = clamped % cols;
  const row = Math.floor(clamped / cols);
  const cellW = 1 / cols;
  const cellH = 1 / rows;
  // Row 0 sits at top of the texture when flipY = true
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

export function computeStabFrameUvRect(frameIndex: number, flipX: boolean): StabFrameUvRect {
  return computeGridFrameUvRect(
    frameIndex,
    MELEE_STAB_COLS,
    MELEE_STAB_ROWS,
    MELEE_STAB_TOTAL_FRAMES,
    flipX
  );
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

export function mapSpecies15ProgressToFrame(p: number): number {
  const clamped = Math.max(0, Math.min(1, p));
  if (clamped < 0.3) {
    return Math.min(5, Math.floor((clamped / 0.3) * 6));
  }
  if (clamped < 0.36) {
    return 6;
  }
  if (clamped < 0.5) {
    return SOULDOLL_15_IMPACT_FRAME + Math.min(1, Math.floor(((clamped - 0.36) / 0.14) * 2));
  }
  if (clamped < 0.84) {
    return 9 + Math.min(5, Math.floor(((clamped - 0.5) / 0.34) * 6));
  }
  return 15 + Math.min(2, Math.floor(((clamped - 0.84) / 0.16) * 3));
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

export function evaluateAttackAnimPhase(
  elapsedSec: number,
  config?: SpeciesAttackSheetConfig | null
): MeleeStabPhaseState {
  if (!config) {
    return evaluateMeleeStabPhase(elapsedSec);
  }

  const t = Math.max(0, Math.min(config.totalDuration, elapsedSec));
  if (t < config.advanceDuration) {
    const p = t / config.advanceDuration;
    const easeOut = 1 - Math.pow(1 - p, 2);
    const fadeOut = p < 0.3 ? 1 : 1 - (p - 0.3) / 0.7;
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

  if (t < config.advanceDuration + config.attackDuration) {
    const p = (t - config.advanceDuration) / config.attackDuration;
    const frameIndex =
      config.speciesId === 15
        ? mapSpecies15ProgressToFrame(p)
        : Math.min(config.totalFrames - 1, Math.floor(p * config.totalFrames));

    let stabOpacity = 1;
    if (p < 0.06) {
      stabOpacity = p / 0.06;
    } else if (p > 0.9) {
      stabOpacity = 1 - (p - 0.9) / 0.1;
    }

    let elementGlow = 0;
    if (p >= 0.3 && p < 0.36) {
      elementGlow = (p - 0.3) / 0.06;
    } else if (p >= 0.36 && p <= 0.52) {
      elementGlow = 1;
    } else if (p > 0.52 && p < 0.78) {
      elementGlow = 1 - (p - 0.52) / 0.26;
    }

    return {
      phase: 'stab',
      phaseT: p,
      advanceLungeT: 1,
      attackerOpacity: 0,
      stabVisible: true,
      stabOpacity: Math.max(0, Math.min(1, stabOpacity)),
      frameIndex,
      impactTriggered: frameIndex >= config.impactFrame,
      elementGlow: Math.max(0, Math.min(1, elementGlow)),
    };
  }

  const p = Math.min(
    1,
    (t - config.advanceDuration - config.attackDuration) / config.returnDuration
  );
  return {
    phase: 'return',
    phaseT: p,
    advanceLungeT: 0,
    attackerOpacity: Math.max(0, Math.min(1, p)),
    stabVisible: false,
    stabOpacity: 0,
    frameIndex: config.totalFrames - 1,
    impactTriggered: true,
    elementGlow: 0,
  };
}

