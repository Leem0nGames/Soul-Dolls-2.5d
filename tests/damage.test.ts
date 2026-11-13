import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { getMove } from '../src/data/moves.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { calculateDamage, createDefaultStages } from '../src/domain/Damage.ts';

describe('Damage formula', () => {
  it('deals positive damage and applies STAB and type effectiveness', () => {
    const rng = createRng(12345);
    const brasito = createCreature(1, 10, rng); // Brasa
    const brotin = createCreature(7, 10, rng); // Flora
    const gotin = createCreature(4, 10, rng); // Marea

    const ascuas = getMove('ascuas'); // Brasa, special 40
    const placaje = getMove('placaje'); // Comun, physical 40

    const superHit = calculateDamage(
      brasito,
      brotin,
      createDefaultStages(),
      createDefaultStages(),
      ascuas,
      createRng(99)
    );
    const resistedHit = calculateDamage(
      brasito,
      gotin,
      createDefaultStages(),
      createDefaultStages(),
      ascuas,
      createRng(99)
    );
    const neutralHit = calculateDamage(
      gotin,
      brotin,
      createDefaultStages(),
      createDefaultStages(),
      placaje,
      createRng(99)
    );

    expect(superHit.stab).toBe(true);
    expect(superHit.effectiveness).toBe(2);
    expect(resistedHit.effectiveness).toBe(0.5);
    expect(superHit.damage).toBeGreaterThan(resistedHit.damage * 2);
    expect(neutralHit.stab).toBe(false);
    expect(neutralHit.damage).toBeGreaterThan(0);
  });

  it('returns 0 damage against immune targets', () => {
    const rng = createRng(42);
    const chisporro = createCreature(12, 12, rng); // Chispa
    const pedrin = createCreature(14, 12, rng); // Roca (immune to Chispa)
    const res = calculateDamage(
      chisporro,
      pedrin,
      createDefaultStages(),
      createDefaultStages(),
      getMove('chispazo'),
      rng
    );
    expect(res.effectiveness).toBe(0);
    expect(res.damage).toBe(0);
  });
});
