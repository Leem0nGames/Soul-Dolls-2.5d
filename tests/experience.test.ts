import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { createCreature, xpForLevel } from '../src/domain/Creature.ts';
import { awardExperience, computeBattleXp } from '../src/domain/Experience.ts';

describe('Experience and leveling', () => {
  it('orders growth rates fast < medium < slow at level 20', () => {
    expect(xpForLevel(20, 'fast')).toBeLessThan(xpForLevel(20, 'medium'));
    expect(xpForLevel(20, 'medium')).toBeLessThan(xpForLevel(20, 'slow'));
  });

  it('levels up, increases stats, and learns level-up moves', () => {
    const rng = createRng(555);
    const brasito = createCreature(1, 4, rng);
    const hpBefore = brasito.stats.hp;
    const needed = xpForLevel(5, 'medium') - brasito.xp;

    const res = awardExperience(brasito, needed);
    expect(brasito.level).toBe(5);
    expect(res.leveledUpTo).toEqual([5]);
    expect(brasito.stats.hp).toBeGreaterThan(hpBefore);
    expect(res.autoLearnedMoves).toContain('ascuas');
  });

  it('grants 1.5x XP bonus in trainer battles', () => {
    const rng = createRng(12);
    const foe = createCreature(10, 8, rng);
    const wildXp = computeBattleXp(foe, false);
    const trainerXp = computeBattleXp(foe, true);
    expect(trainerXp).toBeGreaterThan(wildXp);
  });
});
