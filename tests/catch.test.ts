import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { attemptCatch, computeCatchProbability } from '../src/domain/Catch.ts';
import { createCreature } from '../src/domain/Creature.ts';

describe('Capture formula', () => {
  it('increases probability when HP is lower, status is applied, or capsule is stronger', () => {
    const rng = createRng(777);
    const wild = createCreature(14, 10, rng);
    const fullProb = computeCatchProbability(wild, 'capsula');

    wild.currentHp = 1;
    const lowHpProb = computeCatchProbability(wild, 'capsula');
    const ultraProb = computeCatchProbability(wild, 'ultracapsula');

    wild.status = 'sleep';
    const asleepProb = computeCatchProbability(wild, 'ultracapsula');

    expect(lowHpProb).toBeGreaterThan(fullProb);
    expect(ultraProb).toBeGreaterThan(lowHpProb);
    expect(asleepProb).toBeGreaterThanOrEqual(ultraProb);
  });

  it('produces valid 0..3 shakes on catch attempts', () => {
    const rng = createRng(888);
    const wild = createCreature(10, 5, rng);
    wild.currentHp = 1;
    const res = attemptCatch(wild, 'ultracapsula', createRng(101));
    expect(res.shakes).toBeGreaterThanOrEqual(0);
    expect(res.shakes).toBeLessThanOrEqual(3);
  });
});
