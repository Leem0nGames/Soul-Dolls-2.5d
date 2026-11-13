import type { Rng } from '../core/Rng.ts';
import { getItem } from '../data/items.ts';
import { getSpecies } from '../data/species.ts';
import type { BattleBiome, CreatureInstance } from './types.ts';

export interface CatchContext {
  biome?: BattleBiome;
  turnCount?: number;
}

export function computeCatchProbability(
  creature: CreatureInstance,
  capsuleItemId: string,
  context?: CatchContext
): number {
  const spec = getSpecies(creature.speciesId);
  const item = getItem(capsuleItemId);
  let ballMult = item.catchMultiplier ?? 1;

  if (item.catchCondition === 'water_coast') {
    const isWaterOrCoast =
      spec.types.includes('marea') || context?.biome === 'coast';
    ballMult = isWaterOrCoast ? ballMult : 1.0;
  } else if (item.catchCondition === 'cave_night') {
    const isCave = context?.biome === 'cave';
    ballMult = isCave ? ballMult : 1.0;
  } else if (item.catchCondition === 'first_turn') {
    const isFirstTurn = (context?.turnCount ?? 1) <= 1;
    ballMult = isFirstTurn ? ballMult : 1.0;
  }

  const maxHp = Math.max(1, creature.stats.hp);
  const hpFactor = (3 * maxHp - 2 * creature.currentHp) / (3 * maxHp);
  const statusMult =
    creature.status === 'sleep'
      ? 2.0
      : creature.status === 'burn' ||
          creature.status === 'poison' ||
          creature.status === 'paralysis'
        ? 1.5
        : 1.0;

  const modifiedRate = hpFactor * spec.catchRate * ballMult * statusMult;
  return Math.max(0.03, Math.min(1, modifiedRate / 255));
}

export function attemptCatch(
  creature: CreatureInstance,
  capsuleItemId: string,
  rng: Rng,
  context?: CatchContext
): { caught: boolean; shakes: number; probability: number } {
  const probability = computeCatchProbability(creature, capsuleItemId, context);
  if (probability >= 1) {
    return { caught: true, shakes: 3, probability };
  }

  // Per-shake check derived from cube root of overall catch probability
  const shakeProb = Math.pow(probability, 1 / 3);
  let shakes = 0;
  for (let i = 0; i < 3; i++) {
    if (rng.next() < shakeProb) {
      shakes++;
    } else {
      return { caught: false, shakes, probability };
    }
  }
  return { caught: true, shakes: 3, probability };
}
