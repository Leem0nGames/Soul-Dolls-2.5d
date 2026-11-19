import { describe, it, expect } from 'vitest';
import { createCreature } from '../src/domain/Creature.ts';
import { getAvailableTalentPoints, unlockCreatureTalent, getTalentStatBonuses } from '../src/domain/Talents.ts';
import { createRng } from '../src/core/Rng.ts';

describe('SoulDoll Talent Trees & Stat Scaling', () => {
  it('calculates talent points based on level', () => {
    const rng = createRng(123);
    const doll = createCreature(1, 10, rng);
    expect(getAvailableTalentPoints(doll)).toBe(9); // level 10 - 1 = 9 points
  });

  it('allows unlocking valid talent nodes and updates stats', () => {
    const rng = createRng(123);
    const doll = createCreature(1, 10, rng);
    const initialAtk = doll.stats.atk;

    const res = unlockCreatureTalent(doll, 'fierce_strikes');
    expect(res.ok).toBe(true);
    expect(getAvailableTalentPoints(doll)).toBe(8);

    const bonuses = getTalentStatBonuses(doll);
    expect(bonuses.atk).toBe(4);
    expect(doll.stats.atk).toBeGreaterThan(initialAtk);
  });

  it('prevents unlocking talents without meeting prerequisites', () => {
    const rng = createRng(123);
    const doll = createCreature(1, 10, rng);

    // arcana_focus requires fierce_strikes
    const res = unlockCreatureTalent(doll, 'arcane_focus');
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('missing_prerequisite');
  });
});
