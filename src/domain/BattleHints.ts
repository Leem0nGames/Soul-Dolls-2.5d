import { getTypeMultiplier } from './TypeChart.ts';
import type { CreatureType, MoveCategory } from './types.ts';

export type EffectivenessTone = 'super' | 'neutral' | 'resist' | 'immune' | 'status';

export interface MoveEffectivenessHint {
  multiplier: number;
  label: string;
  tone: EffectivenessTone;
}

export function getMoveEffectivenessHint(
  moveType: CreatureType,
  category: MoveCategory,
  defenderTypes: readonly CreatureType[]
): MoveEffectivenessHint {
  if (category === 'status') {
    return { multiplier: 1, label: '', tone: 'status' };
  }

  const mult = getTypeMultiplier(moveType, defenderTypes);
  if (mult === 0) {
    return { multiplier: 0, label: '×0', tone: 'immune' };
  }
  if (mult >= 4) {
    return { multiplier: mult, label: '×4', tone: 'super' };
  }
  if (mult >= 2) {
    return { multiplier: mult, label: '×2', tone: 'super' };
  }
  if (mult <= 0.25) {
    return { multiplier: mult, label: '×¼', tone: 'resist' };
  }
  if (mult < 1) {
    return { multiplier: mult, label: '×½', tone: 'resist' };
  }
  return { multiplier: 1, label: '', tone: 'neutral' };
}
