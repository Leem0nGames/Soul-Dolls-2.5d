export type CreatureSpriteView = 'front' | 'back' | 'wild';

export interface SoulFormEntry {
  speciesId: number;
  /** Unbodied wild soul illustration shown in wild encounters and unbodied reserves */
  wildSoulPath?: string;
  /** Reserved pixel-art companion/pet sprite for future overworld follower system */
  followerPetPath?: string;
}

/**
 * Registry of per-species wild/unbodied soul forms and reserved pixel-art follower pets.
 * Add entries here (or via scripts/soul-sheet-to-assets.mjs) as more dual sheets are added.
 */
export const SOUL_FORM_REGISTRY: SoulFormEntry[] = [
  {
    speciesId: 1,
    wildSoulPath: '/assets/souls/01.webp',
    followerPetPath: '/assets/followers/01.webp',
  },
  {
    speciesId: 10,
    wildSoulPath: '/assets/souls/10.webp',
    followerPetPath: '/assets/followers/10.webp',
  },
  {
    speciesId: 12,
    wildSoulPath: '/assets/souls/12.webp',
    followerPetPath: '/assets/followers/12.webp',
  },
];

const SOUL_FORM_MAP = new Map<number, SoulFormEntry>(
  SOUL_FORM_REGISTRY.map((entry) => [entry.speciesId, entry])
);

export const ALL_SPECIES_IDS_WITH_WILD_SOUL: number[] = SOUL_FORM_REGISTRY.filter((e) =>
  Boolean(e.wildSoulPath)
)
  .map((e) => e.speciesId)
  .sort((a, b) => a - b);

export const ALL_SPECIES_IDS_WITH_FOLLOWER_PET: number[] = SOUL_FORM_REGISTRY.filter((e) =>
  Boolean(e.followerPetPath)
)
  .map((e) => e.speciesId)
  .sort((a, b) => a - b);

export function getSoulFormEntry(speciesId: number): SoulFormEntry | undefined {
  return SOUL_FORM_MAP.get(speciesId);
}

export function hasWildSoulSprite(speciesId: number): boolean {
  return Boolean(SOUL_FORM_MAP.get(speciesId)?.wildSoulPath);
}

export function getWildSoulSpriteUrl(speciesId: number): string | null {
  return SOUL_FORM_MAP.get(speciesId)?.wildSoulPath ?? null;
}

export function hasFollowerPetSprite(speciesId: number): boolean {
  return Boolean(SOUL_FORM_MAP.get(speciesId)?.followerPetPath);
}

export function getFollowerPetSpriteUrl(speciesId: number): string | null {
  return SOUL_FORM_MAP.get(speciesId)?.followerPetPath ?? null;
}

/**
 * In BattleScene:
 * - Wild encounters (`isWild = true`) show the unbodied wild soul sprite (if registered).
 * - SoulTrainer battles (`isWild = false`) show the embodied SoulDoll sprite (`front`).
 */
export function resolveEnemyBattleSpriteView(
  speciesId: number,
  isWild: boolean
): 'front' | 'wild' {
  if (isWild && hasWildSoulSprite(speciesId)) {
    return 'wild';
  }
  return 'front';
}

/**
 * Unbodied captured souls waiting in Soul Reserve / Soul Chest display their wild soul form when available.
 */
export function resolveReserveSoulSpriteView(speciesId: number): 'front' | 'wild' {
  return hasWildSoulSprite(speciesId) ? 'wild' : 'front';
}
