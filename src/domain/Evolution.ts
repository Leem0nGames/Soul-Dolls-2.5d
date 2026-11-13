import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { recalculateCreatureStats } from './Creature.ts';
import type { CreatureInstance } from './types.ts';

export function checkLevelEvolution(creature: CreatureInstance): number | null {
  const spec = getSpecies(creature.speciesId);
  for (const rule of spec.evolutions) {
    if (rule.method === 'level' && creature.level >= rule.level) {
      return rule.targetSpeciesId;
    }
    if (
      rule.method === 'knows_move' &&
      creature.moves.some((m) => m.moveId === rule.moveId)
    ) {
      return rule.targetSpeciesId;
    }
    if (
      rule.method === 'level_held' &&
      creature.level >= rule.level &&
      creature.heldItemId === rule.itemId
    ) {
      return rule.targetSpeciesId;
    }
  }
  return null;
}

export function checkItemEvolution(
  creature: CreatureInstance,
  itemId: string
): number | null {
  const spec = getSpecies(creature.speciesId);
  for (const rule of spec.evolutions) {
    if (rule.method === 'item' && rule.itemId === itemId) {
      return rule.targetSpeciesId;
    }
  }
  return null;
}

export function applyEvolution(
  creature: CreatureInstance,
  targetSpeciesId: number
): { autoLearnedMoves: string[]; pendingLearnMoves: string[] } {
  const targetSpec = getSpecies(targetSpeciesId);
  creature.speciesId = targetSpeciesId;
  recalculateCreatureStats(creature);

  const autoLearnedMoves: string[] = [];
  const pendingLearnMoves: string[] = [];

  for (const entry of targetSpec.learnset) {
    if (entry.level <= creature.level) {
      const alreadyKnows = creature.moves.some((m) => m.moveId === entry.moveId);
      if (alreadyKnows) continue;
      if (creature.moves.length < 4) {
        const def = getMove(entry.moveId);
        creature.moves.push({ moveId: entry.moveId, pp: def.pp, maxPp: def.pp });
        autoLearnedMoves.push(entry.moveId);
      } else if (entry.level === creature.level) {
        pendingLearnMoves.push(entry.moveId);
      }
    }
  }

  return { autoLearnedMoves, pendingLearnMoves };
}
