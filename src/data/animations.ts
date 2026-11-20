export type AttackRole = 'physical_attack' | 'special_attack';
export type IdleRole = 'idle_front' | 'idle_back';
export type AnimationRole = AttackRole | IdleRole;

export interface AnimationSheetSpec {
  path: string;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  aspectRatio: number;
  facing?: 'left' | 'right';
  loop?: boolean;
  fps?: number;
}

export type AttackSheetSpec = AnimationSheetSpec;

export const ATTACK_SHEET_DIR = '/assets/attacks';
export const IDLE_SHEET_DIR = '/assets/idles';
export const DEFAULT_IDLE_FPS = 8;

export function isAttackRole(role: AnimationRole): role is AttackRole {
  return role === 'physical_attack' || role === 'special_attack';
}

export function isIdleRole(role: AnimationRole): role is IdleRole {
  return role === 'idle_front' || role === 'idle_back';
}

export function getIdleRoleForView(view: 'front' | 'back'): IdleRole {
  return view === 'back' ? 'idle_back' : 'idle_front';
}

export function getAnimationSheetDir(role: AnimationRole): string {
  return isIdleRole(role) ? IDLE_SHEET_DIR : ATTACK_SHEET_DIR;
}

export function getAnimationRoleLabel(role: AnimationRole): string {
  switch (role) {
    case 'physical_attack':
      return 'ataque físico';
    case 'special_attack':
      return 'ataque especial';
    case 'idle_front':
      return 'idle frontal';
    case 'idle_back':
      return 'idle trasero';
  }
}

export interface SpeciesAnimationEntry {
  speciesId: number;
  role: AnimationRole;
  label: string;
  spec: AttackSheetSpec;
}

export const GENERIC_ATTACK_FALLBACK_SHEET_PATH =
  '/assets/attacks/generic_attack_fallback.png';
export const SOULDOLL_01_ATTACK_SHEET_PATH =
  '/assets/attacks/physical_attack_01.webp';
export const SOULDOLL_15_ATTACK_SHEET_PATH =
  '/assets/attacks/special_attack_15.webp';

export const SOULDOLL_01_ATTACK_SPEC: AttackSheetSpec = {
  path: SOULDOLL_01_ATTACK_SHEET_PATH,
  cols: 4,
  rows: 9,
  totalFrames: 36,
  impactFrame: 16,
  aspectRatio: 640 / 360,
  facing: 'right',
};

export const SOULDOLL_01_SPECIAL_ATTACK_SPEC: AttackSheetSpec = {
  path: '/assets/attacks/special_attack_01.webp',
  cols: 4,
  rows: 9,
  totalFrames: 36,
  impactFrame: 16,
  aspectRatio: 640 / 360,
  facing: 'right',
};

export const SOULDOLL_01_IDLE_FRONT_SPEC: AnimationSheetSpec = {
  path: '/assets/idles/idle_front_01.webp',
  cols: 4,
  rows: 10,
  totalFrames: 37,
  impactFrame: 0,
  aspectRatio: 640 / 360,
  loop: true,
  fps: 8,
};

export const SOULDOLL_04_IDLE_BACK_SPEC: AnimationSheetSpec = {
  path: '/assets/idles/idle_back_04.webp',
  cols: 4,
  rows: 6,
  totalFrames: 24,
  impactFrame: 0,
  aspectRatio: 640 / 360,
  loop: true,
  fps: 8,
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

export const GENERIC_ATTACK_FALLBACK_SPEC: AttackSheetSpec = {
  path: GENERIC_ATTACK_FALLBACK_SHEET_PATH,
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
    label: 'SoulDoll #01 — Brasito (4×9)',
    spec: SOULDOLL_01_ATTACK_SPEC,
  },
  {
    speciesId: 1,
    role: 'special_attack',
    label: 'SoulDoll #01 — Brasito (Ataque Especial 4×9)',
    spec: SOULDOLL_01_SPECIAL_ATTACK_SPEC,
  },
  {
    speciesId: 1,
    role: 'idle_front',
    label: 'SoulDoll #01 — Brasito (Idle Frente 4×10)',
    spec: SOULDOLL_01_IDLE_FRONT_SPEC,
  },
  {
    speciesId: 4,
    role: 'idle_back',
    label: 'SoulDoll #04 — Gotín (Idle Espalda 4×6)',
    spec: SOULDOLL_04_IDLE_BACK_SPEC,
  },
  {
    speciesId: 15,
    role: 'special_attack',
    label: 'SoulDoll #15 — Alabarda Rúnica (Ataque Especial 4×5)',
    spec: SOULDOLL_15_ATTACK_SPEC,
  },
];

export const ALL_SPECIES_IDS_WITH_ANIMATION: number[] = Array.from(
  new Set(SPECIES_ANIMATION_REGISTRY.map((entry) => entry.speciesId))
).sort((a, b) => a - b);

export const ALL_SPECIES_IDS_WITH_ATTACK: number[] = Array.from(
  new Set(
    SPECIES_ANIMATION_REGISTRY.filter((entry) => isAttackRole(entry.role)).map(
      (entry) => entry.speciesId
    )
  )
).sort((a, b) => a - b);

export const ALL_SPECIES_IDS_WITH_IDLE: number[] = Array.from(
  new Set(
    SPECIES_ANIMATION_REGISTRY.filter((entry) => isIdleRole(entry.role)).map(
      (entry) => entry.speciesId
    )
  )
).sort((a, b) => a - b);

export function getSpeciesRegisteredAnimations(speciesId: number): SpeciesAnimationEntry[] {
  return SPECIES_ANIMATION_REGISTRY.filter((entry) => entry.speciesId === speciesId);
}

export function getSpeciesAnimationEntry(
  speciesId: number,
  role: AnimationRole
): SpeciesAnimationEntry | undefined {
  return SPECIES_ANIMATION_REGISTRY.find(
    (entry) => entry.speciesId === speciesId && entry.role === role
  );
}

export function getIdleAnimationSpecForSpecies(
  speciesId: number,
  view: 'front' | 'back'
): AnimationSheetSpec | null {
  return getSpeciesAnimationEntry(speciesId, getIdleRoleForView(view))?.spec ?? null;
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
  role: AttackRole = 'physical_attack'
): AttackSheetSpec {
  if (speciesId === undefined) return GENERIC_ATTACK_FALLBACK_SPEC;
  const exact = SPECIES_ANIMATION_REGISTRY.find(
    (entry) => entry.speciesId === speciesId && entry.role === role
  );
  if (exact) return exact.spec;

  const anyAttack = SPECIES_ANIMATION_REGISTRY.find(
    (entry) => entry.speciesId === speciesId && isAttackRole(entry.role)
  );
  return anyAttack ? anyAttack.spec : GENERIC_ATTACK_FALLBACK_SPEC;
}
