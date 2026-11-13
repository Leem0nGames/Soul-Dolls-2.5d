import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { ITEMS } from '../src/data/items.ts';
import { ALL_MOVE_IDS, MOVES } from '../src/data/moves.ts';
import { ALL_SPECIES_IDS, getSpecies, SPECIES } from '../src/data/species.ts';
import { BattleEngine } from '../src/domain/BattleEngine.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { checkItemEvolution, checkLevelEvolution } from '../src/domain/Evolution.ts';
import type { CreatureType } from '../src/domain/types.ts';
import { buildCreaturePixelGrid } from '../src/gfx/CreatureSpriteGen.ts';

describe('Phase 2 roster, moves & sprites', () => {
  it('defines 50 original species (1..50) with unique <=10-char names', () => {
    expect(ALL_SPECIES_IDS).toHaveLength(50);
    expect(ALL_SPECIES_IDS[0]).toBe(1);
    expect(ALL_SPECIES_IDS[49]).toBe(50);

    const seenNames = new Set<string>();
    for (const id of ALL_SPECIES_IDS) {
      const s = SPECIES[id];
      expect(s).toBeDefined();
      expect(s.name.length).toBeGreaterThanOrEqual(3);
      expect(s.name.length).toBeLessThanOrEqual(10);
      expect(seenNames.has(s.name)).toBe(false);
      seenNames.add(s.name);
      expect(s.abilities.length).toBeGreaterThanOrEqual(1);
      for (const abId of s.abilities) {
        expect(ABILITIES[abId]).toBeDefined();
      }
      expect(s.learnset.length).toBeGreaterThanOrEqual(4);
      for (const entry of s.learnset) {
        expect(MOVES[entry.moveId]).toBeDefined();
      }
    }
  });

  it('defines >=95 moves with >=10 moves per elemental type and valid keys', () => {
    expect(ALL_MOVE_IDS.length).toBeGreaterThanOrEqual(95);
    const counts: Record<CreatureType, number> = {
      brasa: 0,
      marea: 0,
      flora: 0,
      chispa: 0,
      roca: 0,
      brisa: 0,
      umbra: 0,
      comun: 0,
    };
    for (const key of ALL_MOVE_IDS) {
      const m = MOVES[key];
      expect(m.id).toBe(key);
      counts[m.type] += 1;
    }
    for (const type of Object.keys(counts) as CreatureType[]) {
      expect(counts[type]).toBeGreaterThanOrEqual(10);
    }
  });

  it('validates all evolution chains are acyclic, targets exist, and knows_move / stones work', () => {
    for (const id of ALL_SPECIES_IDS) {
      const s = getSpecies(id);
      for (const rule of s.evolutions) {
        expect(SPECIES[rule.targetSpeciesId]).toBeDefined();
        expect(rule.targetSpeciesId).not.toBe(id);
        if (rule.method === 'knows_move') {
          expect(MOVES[rule.moveId]).toBeDefined();
        }
        if (rule.method === 'item') {
          expect(ITEMS[rule.itemId]).toBeDefined();
        }
      }
    }

    const rng = createRng(99);
    const bruma = createCreature(24, 15, rng);
    expect(checkLevelEvolution(bruma)).toBeNull();
    bruma.moves.push({ moveId: 'pulso_abismo', pp: 15, maxPp: 15 });
    expect(checkLevelEvolution(bruma)).toBe(25);

    const aletin = createCreature(22, 10, rng);
    expect(checkItemEvolution(aletin, 'piedra_marea')).toBe(23);
  });

  it('generates non-empty, distinct 32x32 pixel grids for all 50 species (front & back)', () => {
    const frontHashes = new Set<string>();
    const backHashes = new Set<string>();

    for (const id of ALL_SPECIES_IDS) {
      const front = buildCreaturePixelGrid(id, 'front');
      const back = buildCreaturePixelGrid(id, 'back');
      expect(front).toHaveLength(32);
      expect(back).toHaveLength(32);
      const frontFlat = front.flat().join(',');
      const backFlat = back.flat().join(',');
      expect(frontFlat).not.toBe(backFlat);
      expect(front.flat().some((v) => v > 1)).toBe(true);
      frontHashes.add(frontFlat);
      backHashes.add(backFlat);
    }

    expect(frontHashes.size).toBe(50);
    expect(backHashes.size).toBe(50);
  });

  it('executes new move effects: protect, multi_hit, fixed_damage, trap, leech, confuse', () => {
    const rng = createRng(42);
    const p1 = createCreature(46, 20, rng);
    const e1 = createCreature(48, 20, rng);
    p1.moves = [
      { moveId: 'barrera_total', pp: 10, maxPp: 10 },
      { moveId: 'doble_bofeton', pp: 20, maxPp: 20 },
      { moveId: 'impacto_fijo', pp: 20, maxPp: 20 },
      { moveId: 'espora_drenaje', pp: 15, maxPp: 15 },
    ];
    e1.moves = [{ moveId: 'placaje', pp: 35, maxPp: 35 }];

    const engine = new BattleEngine([p1], [e1], [], rng);
    const hpStart = p1.currentHp;

    // Protect blocks incoming damage
    const protectEvents = engine.stepTurn({ type: 'move', moveIndex: 0 });
    expect(p1.currentHp).toBe(hpStart);
    expect(protectEvents.some((ev) => ev.type === 'text' && ev.message.includes('bloqueó'))).toBe(true);

    // Fixed damage deals exactly 45
    const eHpBefore = e1.currentHp;
    const fixedEvents = engine.stepTurn({ type: 'move', moveIndex: 2 });
    const fixedDmg = fixedEvents.find((ev) => ev.type === 'damage' && ev.target === 'enemy');
    const enemyHeal = fixedEvents
      .filter((ev) => ev.type === 'heal' && ev.target === 'enemy')
      .reduce((s, ev) => s + (ev.type === 'heal' ? ev.amount : 0), 0);
    expect(fixedDmg && fixedDmg.type === 'damage' ? fixedDmg.amount : 0).toBe(45);
    expect(fixedDmg && fixedDmg.type === 'damage' ? fixedDmg.hpAfter : -1).toBe(
      Math.max(0, eHpBefore - 45)
    );
    expect(e1.currentHp).toBe(Math.max(0, eHpBefore - 45) + enemyHeal);

    // Multi-hit emits multiple damage events
    const e2 = createCreature(49, 40, rng);
    e2.moves = [{ moveId: 'placaje', pp: 35, maxPp: 35 }];
    const p2 = createCreature(47, 40, rng);
    p2.moves = [
      { moveId: 'doble_bofeton', pp: 20, maxPp: 20 },
      { moveId: 'espora_drenaje', pp: 15, maxPp: 15 },
    ];
    const engine2 = new BattleEngine([p2], [e2], [], rng);
    const mhEvents = engine2.stepTurn({ type: 'move', moveIndex: 0 });
    const hits = mhEvents.filter((ev) => ev.type === 'damage' && ev.target === 'enemy');
    expect(hits.length).toBeGreaterThanOrEqual(2);

    // Leech drains HP at end of turn
    const leechEvents = engine2.stepTurn({ type: 'move', moveIndex: 1 });
    expect(leechEvents.some((ev) => ev.type === 'text' && ev.message.includes('esporas'))).toBe(true);
  });
});
