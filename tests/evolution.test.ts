import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { createCreature } from '../src/domain/Creature.ts';
import {
  applyEvolution,
  checkItemEvolution,
  checkLevelEvolution,
} from '../src/domain/Evolution.ts';

describe('Evolution rules', () => {
  it('detects level-based evolution once threshold is reached', () => {
    const rng = createRng(333);
    const brasito = createCreature(1, 11, rng);
    expect(checkLevelEvolution(brasito)).toBeNull();

    brasito.level = 12;
    expect(checkLevelEvolution(brasito)).toBe(2);
  });

  it('detects item-based evolution with matching stone', () => {
    const rng = createRng(444);
    const chisporro = createCreature(12, 10, rng);
    expect(checkItemEvolution(chisporro, 'piedra_brasa')).toBeNull();
    expect(checkItemEvolution(chisporro, 'piedra_chispa')).toBe(13);

    applyEvolution(chisporro, 13);
    expect(chisporro.speciesId).toBe(13);
  });
});
