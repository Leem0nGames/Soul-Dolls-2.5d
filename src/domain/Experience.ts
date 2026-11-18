import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { recalculateCreatureStats, xpForLevel } from './Creature.ts';
import type { CreatureInstance } from './types.ts';

export function computeBattleXp(
  defeated: CreatureInstance,
  isTrainer: boolean
): number {
  const spec = getSpecies(defeated.speciesId);
  const trainerBonus = isTrainer ? 1.5 : 1.0;
  return Math.max(
    1,
    Math.floor((spec.baseXpYield * defeated.level * trainerBonus) / 4.2)
  );
}

export function computeSharedPartyXp(fullXp: number): number {
  return Math.max(1, Math.floor(fullXp * 0.35));
}

export interface XpAwardResult {
  leveledUpTo: number[];
  autoLearnedMoves: string[];
  pendingLearnMoves: string[];
}

export function awardExperience(
  creature: CreatureInstance,
  amount: number
): XpAwardResult {
  const spec = getSpecies(creature.speciesId);
  const leveledUpTo: number[] = [];
  const autoLearnedMoves: string[] = [];
  const pendingLearnMoves: string[] = [];

  if (creature.level >= 100) {
    return { leveledUpTo, autoLearnedMoves, pendingLearnMoves };
  }

  creature.xp += Math.max(0, Math.floor(amount));

  while (
    creature.level < 100 &&
    creature.xp >= xpForLevel(creature.level + 1, spec.growthRate)
  ) {
    creature.level += 1;
    leveledUpTo.push(creature.level);
    recalculateCreatureStats(creature);

    for (const entry of spec.learnset) {
      if (entry.level === creature.level) {
        const alreadyKnows = creature.moves.some((m) => m.moveId === entry.moveId);
        if (alreadyKnows) continue;
        if (creature.moves.length < 4) {
          const def = getMove(entry.moveId);
          creature.moves.push({
            moveId: entry.moveId,
            pp: def.pp,
            maxPp: def.pp,
          });
          autoLearnedMoves.push(entry.moveId);
        } else {
          pendingLearnMoves.push(entry.moveId);
        }
      }
    }
  }

  return { leveledUpTo, autoLearnedMoves, pendingLearnMoves };
}

export function replaceCreatureMove(
  creature: CreatureInstance,
  slotIndex: number,
  newMoveId: string
): string | null {
  if (slotIndex < 0 || slotIndex >= creature.moves.length) return null;
  const oldId = creature.moves[slotIndex].moveId;
  const def = getMove(newMoveId);
  creature.moves[slotIndex] = { moveId: newMoveId, pp: def.pp, maxPp: def.pp };
  return oldId;
}
