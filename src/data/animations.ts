export type AnimationRole = 'physical_attack' | 'special_attack';

export interface AttackSheetSpec {
  path: string;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  aspectRatio: number;
  facing?: 'left' | 'right';
}

export interface SpeciesAnimationEntry {
  speciesId: number;
  role: AnimationRole;
  label: string;
  spec: AttackSheetSpec;
}

export const PLACEHOLDER_ATTACK_SHEET_PATH =
  '/assets/aistudio/004-special_attack-v1_5431e7bd.png';
export const SOULDOLL_01_ATTACK_SHEET_PATH =
  '/assets/attacks/physical_attack_01.webp';
export const SOULDOLL_15_ATTACK_SHEET_PATH =
  '/assets/attacks/special_attack_15.webp';

export const SOULDOLL_01_ATTACK_SPEC: AttackSheetSpec = {
  path: SOULDOLL_01_ATTACK_SHEET_PATH,
  cols: 4,
  rows: 5,
  totalFrames: 20,
  impactFrame: 8,
  aspectRatio: 640 / 360,
  facing: 'left',
};

export const SOULDOLL_15_ATTACK_SPEC: AttackSheetSpec = {
  path: SOULDOLL_15_ATTACK_SHEET_PATH,
  cols: 4,
  rows: 5,
  totalFrames: 20,
  impactFrame: 9,
  aspectRatio: 640 / 360,
  facing: 'right',
};

export const PLACEHOLDER_ATTACK_SPEC: AttackSheetSpec = {
  path: PLACEHOLDER_ATTACK_SHEET_PATH,
  cols: 5,
  rows: 5,
  totalFrames: 25,
  impactFrame: 11,
  aspectRatio: 1,
  facing: 'right',
};

/**
 * Central registry of per-SoulDoll battle animations.
 * Add new species animations here (or via scripts/video-to-spritesheet.mjs)
 * so BattleScene and Sprite Studio pick them up automatically.
 */
export const SPECIES_ANIMATION_REGISTRY: SpeciesAnimationEntry[] = [
  {
    speciesId: 1,
    role: 'physical_attack',
    label: 'SoulDoll #01 — Corte Cósmico (4×5)',
    spec: SOULDOLL_01_ATTACK_SPEC,
  },
  {
    speciesId: 15,
    role: 'physical_attack',
    label: 'SoulDoll #15 — Alabarda Rúnica (4×5)',
    spec: SOULDOLL_15_ATTACK_SPEC,
  },
];

export const ALL_SPECIES_IDS_WITH_ANIMATION: number[] = Array.from(
  new Set(SPECIES_ANIMATION_REGISTRY.map((entry) => entry.speciesId))
).sort((a, b) => a - b);

export function getSpeciesRegisteredAnimations(speciesId: number): SpeciesAnimationEntry[] {
  return SPECIES_ANIMATION_REGISTRY.filter((entry) => entry.speciesId === speciesId);
}

export function hasSpeciesAnimationRole(
  speciesId: number | undefined,
  role: AnimationRole
): boolean {
  if (speciesId === undefined) return false;
  return SPECIES_ANIMATION_REGISTRY.some(
    (entry) => entry.speciesId === speciesId && entry.role === role
  );
}

export function getSpeciesAttackSpec(
  speciesId?: number,
  role: AnimationRole = 'physical_attack'
): AttackSheetSpec {
  if (speciesId === undefined) return PLACEHOLDER_ATTACK_SPEC;
  const exact = SPECIES_ANIMATION_REGISTRY.find(
    (entry) => entry.speciesId === speciesId && entry.role === role
  );
  if (exact) return exact.spec;

  const anyRole = SPECIES_ANIMATION_REGISTRY.find((entry) => entry.speciesId === speciesId);
  return anyRole ? anyRole.spec : PLACEHOLDER_ATTACK_SPEC;
}
