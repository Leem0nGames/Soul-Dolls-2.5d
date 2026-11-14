import { getSpeciesDollProfile } from './containers.ts';
import { getSpecies, SPECIES } from './species.ts';
import type { CardDef, CardRarity, SpeciesDef, StatName, Stats } from '../domain/types.ts';
import { ES } from '../i18n/es.ts';

const STAT_PRIORITY: readonly StatName[] = ['atk', 'spa', 'spe', 'def', 'spd', 'hp'];
const CARD_CACHE = new Map<number, CardDef>();

export const BASE_CARD_DROP_CHANCE = 0.35;
export const BOSS_CARD_DROP_MULTIPLIER = 1.8;

export const CARD_RARITY_DROP_MULTIPLIERS: Record<CardRarity, number> = {
  comun: 1.0,
  rara: 0.75,
  epica: 0.5,
  legendaria: 0.3,
};

export const CARD_RARITY_ORDER: readonly CardRarity[] = [
  'comun',
  'rara',
  'epica',
  'legendaria',
];

export function getCardRarityDropMultiplier(rarity: CardRarity): number {
  return CARD_RARITY_DROP_MULTIPLIERS[rarity];
}

export function getCardRarity(specOrStage: SpeciesDef | (1 | 2 | 3)): CardRarity {
  if (typeof specOrStage === 'number') {
    if (specOrStage === 3) return 'epica';
    if (specOrStage === 2) return 'rara';
    return 'comun';
  }
  if (
    specOrStage.id === 50 ||
    specOrStage.catchRate <= 35 ||
    specOrStage.baseXpYield >= 260
  ) {
    return 'legendaria';
  }
  if (
    specOrStage.stage === 3 ||
    (specOrStage.stage === 1 && specOrStage.baseXpYield >= 200)
  ) {
    return 'epica';
  }
  if (
    specOrStage.stage === 2 ||
    (specOrStage.stage === 1 && specOrStage.baseXpYield >= 150)
  ) {
    return 'rara';
  }
  return 'comun';
}

export function computeCardBonuses(spec: SpeciesDef): Partial<Stats> {
  const ranked = [...STAT_PRIORITY].sort((a, b) => spec.baseStats[b] - spec.baseStats[a]);
  const bonuses: Partial<Stats> = {};
  const rarity = getCardRarity(spec);

  if (rarity === 'comun') {
    bonuses[ranked[0]] = 4;
    bonuses[ranked[1]] = 2;
  } else if (rarity === 'rara') {
    bonuses[ranked[0]] = 6;
    bonuses[ranked[1]] = 4;
    bonuses[ranked[2]] = 2;
  } else if (rarity === 'epica') {
    bonuses[ranked[0]] = 8;
    bonuses[ranked[1]] = 6;
    bonuses[ranked[2]] = 4;
  } else {
    bonuses[ranked[0]] = 10;
    bonuses[ranked[1]] = 8;
    bonuses[ranked[2]] = 6;
    bonuses[ranked[3]] = 4;
  }

  return bonuses;
}

export function getCardDef(speciesId: number): CardDef {
  const cached = CARD_CACHE.get(speciesId);
  if (cached) return cached;

  const spec = getSpecies(speciesId);
  const profile = getSpeciesDollProfile(
    spec.id,
    spec.types,
    spec.dollClass,
    spec.weapon
  );
  const rarity = getCardRarity(spec);
  const bonuses = computeCardBonuses(spec);

  const def: CardDef = {
    speciesId: spec.id,
    name: `Carta ${spec.name}`,
    title: profile.className,
    rarity,
    types: spec.types,
    description: `${spec.description} Al engarzarse en una SoulDoll, canaliza la esencia ${profile.className.toLowerCase()} de ${spec.name}.`,
    bonuses,
  };
  CARD_CACHE.set(speciesId, def);
  return def;
}

export function getCardBonuses(cardSpeciesId?: number): Partial<Stats> | undefined {
  if (cardSpeciesId === undefined || !SPECIES[cardSpeciesId]) return undefined;
  return getCardDef(cardSpeciesId).bonuses;
}

export function formatCardBonuses(bonuses: Partial<Stats>): string {
  const parts: string[] = [];
  const order: readonly StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  for (const stat of order) {
    const val = bonuses[stat];
    if (val && val > 0) {
      parts.push(`+${val} ${ES.stats[stat]}`);
    }
  }
  return parts.join(' · ');
}

export function getCardDropChance(speciesId: number, isBoss = false): number {
  const spec = SPECIES[speciesId];
  const rarity: CardRarity = spec ? getCardRarity(spec) : 'comun';
  const base = BASE_CARD_DROP_CHANCE * getCardRarityDropMultiplier(rarity);
  return isBoss ? Math.min(0.85, base * BOSS_CARD_DROP_MULTIPLIER) : base;
}
