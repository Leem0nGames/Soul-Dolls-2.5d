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
  legendaria: 0.35,
};

export const CARD_RARITY_ORDER: readonly CardRarity[] = [
  'comun',
  'rara',
  'epica',
  'legendaria',
];

export const CARD_DISMANTLE_DUST: Record<CardRarity, number> = {
  comun: 15,
  rara: 35,
  epica: 75,
  legendaria: 150,
};

export const CARD_RARITY_UPGRADE_COST: Record<Exclude<CardRarity, 'legendaria'>, number> = {
  comun: 45,
  rara: 100,
  epica: 220,
};

export const MAX_CARD_STAT_UPGRADE_LEVEL = 5;

export function getNextCardRarity(rarity: CardRarity): CardRarity | null {
  const idx = CARD_RARITY_ORDER.indexOf(rarity);
  if (idx < 0 || idx >= CARD_RARITY_ORDER.length - 1) return null;
  return CARD_RARITY_ORDER[idx + 1];
}

export function getRarityUpgradeCost(rarity: CardRarity): number {
  if (rarity === 'legendaria') return 0;
  return CARD_RARITY_UPGRADE_COST[rarity];
}

export function getCardStatUpgradeCost(rarity: CardRarity, currentLevel: number): number {
  const lv = Math.max(0, Math.floor(currentLevel));
  if (lv >= MAX_CARD_STAT_UPGRADE_LEVEL) return 0;
  const tierIndex = Math.max(0, CARD_RARITY_ORDER.indexOf(rarity));
  return 25 + lv * 20 + tierIndex * 15;
}

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

export function getCardRankedStats(spec: SpeciesDef): StatName[] {
  return [...STAT_PRIORITY].sort((a, b) => spec.baseStats[b] - spec.baseStats[a]);
}

export function computeCardBonusesForRarity(
  spec: SpeciesDef,
  rarity: CardRarity,
  upgradeLevel = 0
): Partial<Stats> {
  const ranked = getCardRankedStats(spec);
  const bonuses: Partial<Stats> = {};

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

  const lv = Math.max(0, Math.min(MAX_CARD_STAT_UPGRADE_LEVEL, Math.floor(upgradeLevel)));
  if (lv > 0) {
    bonuses[ranked[0]] = (bonuses[ranked[0]] ?? 0) + lv * 2;
    bonuses[ranked[1]] = (bonuses[ranked[1]] ?? 0) + lv;
  }

  return bonuses;
}

export function computeCardBonuses(spec: SpeciesDef): Partial<Stats> {
  return computeCardBonusesForRarity(spec, getCardRarity(spec), 0);
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
