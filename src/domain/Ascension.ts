import type { CreatureInstance, SaveData } from './types.ts';
import { ensureSoulDust, getSoulDust, addSoulDust } from './Cards.ts';
import { recalculateCreatureStats } from './Creature.ts';

export const ASCENSION_GOLD_COST = 400;
export const ASCENSION_DUST_COST = 30;
export const MAX_ASCENSION_RANK = 3;

export function canAscendCreature(creature: CreatureInstance): boolean {
  const rank = creature.ascensionRank ?? 0;
  return creature.level >= 100 && rank < MAX_ASCENSION_RANK;
}

export function ascendCreature(
  save: SaveData,
  creature: CreatureInstance
): { ok: boolean; reason?: 'max_rank' | 'not_level_100' | 'no_money' | 'no_dust'; newRank?: number } {
  ensureSoulDust(save);
  const rank = creature.ascensionRank ?? 0;
  if (creature.level < 100) {
    return { ok: false, reason: 'not_level_100' };
  }
  if (rank >= MAX_ASCENSION_RANK) {
    return { ok: false, reason: 'max_rank' };
  }
  if (save.money < ASCENSION_GOLD_COST) {
    return { ok: false, reason: 'no_money' };
  }
  if (getSoulDust(save) < ASCENSION_DUST_COST) {
    return { ok: false, reason: 'no_dust' };
  }

  save.money -= ASCENSION_GOLD_COST;
  addSoulDust(save, -ASCENSION_DUST_COST);

  creature.ascensionRank = rank + 1;
  creature.level = 1;
  creature.xp = 0;
  recalculateCreatureStats(creature);

  return { ok: true, newRank: creature.ascensionRank };
}

export function getAscensionStatMultiplier(creature: CreatureInstance): number {
  const rank = creature.ascensionRank ?? 0;
  return 1 + rank * 0.15; // +15% stats per ascension rank
}
