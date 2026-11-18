import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { ENCOUNTERS } from '../src/data/encounters.ts';
import { getMove, MOVES } from '../src/data/moves.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../src/data/species.ts';
import { TRAINERS } from '../src/data/trainers.ts';
import { BattleEngine } from '../src/domain/BattleEngine.ts';
import { applyDamageToBodyParts, ensureBodyParts } from '../src/domain/BodyParts.ts';
import { computeCatchProbability } from '../src/domain/Catch.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { calculateDamage, createDefaultStages } from '../src/domain/Damage.ts';
import { awardExperience, computeBattleXp, computeSharedPartyXp } from '../src/domain/Experience.ts';
import { getTypeMultiplier } from '../src/domain/TypeChart.ts';
import type { CreatureType } from '../src/domain/types.ts';

function getBst(speciesId: number): number {
  const b = getSpecies(speciesId).baseStats;
  return b.hp + b.atk + b.def + b.spa + b.spd + b.spe;
}

describe('Game balance: difficulty curve, damage, resistances & chances', () => {
  it('keeps wild encounter curve monotonic with no overpowered outliers on ruta_1', () => {
    const avgLevel = (mapId: string) => {
      const entries = ENCOUNTERS[mapId].entries;
      const sum = entries.reduce((acc, e) => acc + (e.minLevel + e.maxLevel) / 2, 0);
      return sum / entries.length;
    };

    expect(avgLevel('ruta_1')).toBeLessThan(avgLevel('ruta_2'));
    expect(avgLevel('ruta_2')).toBeLessThan(avgLevel('cueva_eco'));

    for (const entry of ENCOUNTERS.ruta_1.entries) {
      const spec = getSpecies(entry.speciesId);
      expect(spec.stage).toBe(1);
      expect(getBst(entry.speciesId)).toBeLessThan(380);
    }

    // Lv 5 starters must never face >65% HP single-hit bursts from ruta_1 wilds
    for (const starterId of [1, 4, 7]) {
      const starter = createCreature(starterId, 5, createRng(10));
      for (const entry of ENCOUNTERS.ruta_1.entries) {
        const wild = createCreature(entry.speciesId, entry.maxLevel, createRng(20));
        const wildMove =
          wild.moves.find((m) => getMove(m.moveId).category !== 'status') ?? wild.moves[0];
        const hit = calculateDamage(
          wild,
          starter,
          createDefaultStages(),
          createDefaultStages(),
          getMove(wildMove.moveId),
          createRng(5)
        );
        expect(hit.damage / starter.stats.hp).toBeLessThanOrEqual(0.65);
      }
    }
  });

  it('maintains smooth trainer level progression and shares XP with benched party allies', () => {
    const order = [
      'ruta1_scout',
      'rival_1',
      'ruta2_guarda',
      'ruta2_chispero',
      'cueva_minero',
      'rival_2',
      'arena_discipulo',
      'leader_valeria',
    ];
    let prevMax = 0;
    for (const id of order) {
      const maxLv = Math.max(...TRAINERS[id].party.map((p) => p.level));
      expect(maxLv).toBeGreaterThanOrEqual(prevMax);
      prevMax = maxLv;
    }

    // Active faint awards full XP to active mon + partial XP to healthy bench allies
    const lead = createCreature(1, 5, createRng(1));
    const benchHealthy = createCreature(10, 4, createRng(2));
    const benchFainted = createCreature(16, 4, createRng(3));
    benchFainted.currentHp = 0;
    const wildFoe = createCreature(46, 5, createRng(4));
    applyDamageToBodyParts(wildFoe, wildFoe.stats.hp - 1);
    lead.moves = [{ moveId: 'ascuas', pp: 25, maxPp: 25 }];
    wildFoe.moves = [{ moveId: 'placaje', pp: 35, maxPp: 35 }];

    const expectedFull = computeBattleXp(wildFoe, false);
    const expectedShare = computeSharedPartyXp(expectedFull);
    const xpBeforeBench = benchHealthy.xp;

    const engine = new BattleEngine([lead, benchHealthy, benchFainted], [wildFoe], [], createRng(99));
    const events = engine.stepTurn({ type: 'move', moveIndex: 0 });
    const xpEvents = events.filter((e) => e.type === 'xp_gain');

    expect(xpEvents.some((e) => e.type === 'xp_gain' && e.partyIndex === 0 && e.amount === expectedFull)).toBe(true);
    expect(xpEvents.some((e) => e.type === 'xp_gain' && e.partyIndex === 1 && e.amount === expectedShare)).toBe(true);
    expect(xpEvents.some((e) => e.type === 'xp_gain' && e.partyIndex === 2)).toBe(false);
    expect(benchHealthy.xp).toBeGreaterThan(xpBeforeBench);

    // Campaign XP pacing keeps starter near Valeria's level (~20-25) with modest wild fights
    const starter = createCreature(1, 5, createRng(11));
    const zoneWilds: Array<[number, number[]]> = [
      [3, [10, 46, 16, 37, 12, 46]],
      [9, [12, 48, 30, 14]],
      [13, [14, 43, 40, 17, 14, 43, 17, 40]],
    ];
    for (const [lv, ids] of zoneWilds) {
      for (const spId of ids) {
        awardExperience(starter, computeBattleXp(createCreature(spId, lv, createRng(spId)), false));
      }
    }
    for (const id of order.slice(0, -1)) {
      for (const foeSpec of TRAINERS[id].party) {
        awardExperience(
          starter,
          computeBattleXp(createCreature(foeSpec.speciesId, foeSpec.level, createRng(foeSpec.level)), true)
        );
      }
    }
    expect(starter.level).toBeGreaterThanOrEqual(19);
    expect(starter.level).toBeLessThanOrEqual(25);
  });

  it('keeps non-legendary single/stage-2 species BSTs within balanced stage ceilings', () => {
    for (const id of ALL_SPECIES_IDS) {
      if (id === 50) continue; // Astralón is legendary
      const spec = getSpecies(id);
      const bst = getBst(id);
      if (spec.stage === 1 && spec.evolutions.length > 0) {
        expect(bst).toBeLessThanOrEqual(365);
      } else if (spec.stage === 2 || spec.stage === 1) {
        expect(bst).toBeLessThanOrEqual(490);
      } else {
        expect(bst).toBeLessThanOrEqual(560);
      }
    }
    expect(getBst(50)).toBe(600);
  });

  it('balances elemental TypeChart offense and defense without excessive rock/umbra skew', () => {
    const types: CreatureType[] = ['brasa', 'marea', 'flora', 'chispa', 'roca', 'brisa', 'umbra', 'comun'];
    for (const t of types) {
      const mitigationsIn = types.filter((a) => getTypeMultiplier(a, [t]) < 1).length;
      expect(mitigationsIn).toBeLessThanOrEqual(4);
      if (t !== 'comun') {
        const seOut = types.filter((d) => getTypeMultiplier(t, [d]) === 2).length;
        expect(seOut).toBeGreaterThanOrEqual(2);
      }
    }
    expect(getTypeMultiplier('umbra', ['flora'])).toBe(2);
    expect(getTypeMultiplier('umbra', ['roca'])).toBe(1);
  });

  it('applies container resonance resistance and broken limb penalties in Damage calculation', () => {
    const attacker = createCreature(1, 18, createRng(21), 'cuerpo_maga'); // Full Brasa resonance
    const defenderResonant = createCreature(4, 18, createRng(22), 'cuerpo_priest'); // Full Marea resonance
    const defenderNoResonance = createCreature(4, 18, createRng(22), 'cuerpo_maga'); // None Marea resonance
    defenderNoResonance.ivs = { ...defenderResonant.ivs };
    defenderNoResonance.stats = { ...defenderResonant.stats };

    const move = getMove('ascuas');
    const vsResonant = calculateDamage(
      attacker,
      defenderResonant,
      createDefaultStages(),
      createDefaultStages(),
      move,
      createRng(50)
    );
    const vsNonResonant = calculateDamage(
      attacker,
      defenderNoResonance,
      createDefaultStages(),
      createDefaultStages(),
      move,
      createRng(50)
    );
    expect(vsResonant.damage).toBeLessThan(vsNonResonant.damage);

    // Broken head reduces special damage, broken arms reduces physical damage
    const neutralAttacker = createCreature(1, 25, createRng(21), 'cuerpo_maga');
    const neutralTarget = createCreature(16, 25, createRng(23), 'cuerpo_aprendiz');
    const healthyDmg = calculateDamage(
      neutralAttacker,
      neutralTarget,
      createDefaultStages(),
      createDefaultStages(),
      getMove('giro_fuego'),
      createRng(77)
    );
    ensureBodyParts(neutralAttacker).head.current = 0;
    const brokenHeadDmg = calculateDamage(
      neutralAttacker,
      neutralTarget,
      createDefaultStages(),
      createDefaultStages(),
      getMove('giro_fuego'),
      createRng(77)
    );
    expect(brokenHeadDmg.damage).toBeLessThan(healthyDmg.damage);

    const healthyPhys = calculateDamage(
      neutralAttacker,
      neutralTarget,
      createDefaultStages(),
      createDefaultStages(),
      getMove('araniazo'),
      createRng(77)
    );
    ensureBodyParts(neutralAttacker).arms.current = 0;
    const brokenArmsPhys = calculateDamage(
      neutralAttacker,
      neutralTarget,
      createDefaultStages(),
      createDefaultStages(),
      getMove('araniazo'),
      createRng(77)
    );
    expect(brokenArmsPhys.damage).toBeLessThan(healthyPhys.damage);
  });

  it('calibrates status durations, DoTs, multi-hit expected power, and catch probabilities', () => {
    // Burn ticks gentler than Poison since Burn already halves physical ATK
    const burned = createCreature(16, 20, createRng(1), 'cuerpo_aprendiz');
    const poisoned = createCreature(16, 20, createRng(1), 'cuerpo_aprendiz');
    poisoned.ivs = { ...burned.ivs };
    poisoned.stats = { ...burned.stats };
    burned.stats.hp = 96;
    poisoned.stats.hp = 96;
    burned.currentHp = 96;
    poisoned.currentHp = 96;
    burned.status = 'burn';
    poisoned.status = 'poison';
    burned.moves = [{ moveId: 'barrera_total', pp: 10, maxPp: 10 }];
    poisoned.moves = [{ moveId: 'barrera_total', pp: 10, maxPp: 10 }];

    const foeA = createCreature(46, 20, createRng(2));
    const foeB = createCreature(46, 20, createRng(2));
    foeA.moves = [{ moveId: 'barrera_total', pp: 10, maxPp: 10 }];
    foeB.moves = [{ moveId: 'barrera_total', pp: 10, maxPp: 10 }];

    const bEvents = new BattleEngine([burned], [foeA], [], createRng(5)).stepTurn({
      type: 'move',
      moveIndex: 0,
    });
    const pEvents = new BattleEngine([poisoned], [foeB], [], createRng(5)).stepTurn({
      type: 'move',
      moveIndex: 0,
    });
    const burnTick = bEvents.find((e) => e.type === 'status_tick' && e.target === 'player');
    const poisonTick = pEvents.find((e) => e.type === 'status_tick' && e.target === 'player');
    expect(burnTick && burnTick.type === 'status_tick' ? burnTick.damage : 0).toBe(8);
    expect(poisonTick && poisonTick.type === 'status_tick' ? poisonTick.damage : 0).toBe(12);

    // Multi-hit expected power stays below 75 base power
    for (const move of Object.values(MOVES)) {
      if (move.effect.kind === 'multi_hit') {
        const avgHits = ((move.effect.minHits ?? 2) + (move.effect.maxHits ?? 4)) / 2;
        expect(move.power * avgHits).toBeLessThanOrEqual(75);
      }
    }

    // Catch probabilities sit within satisfying early & boss windows
    const zumbin = createCreature(10, 4, createRng(5));
    zumbin.currentHp = Math.max(1, Math.floor(zumbin.stats.hp * 0.25));
    expect(computeCatchProbability(zumbin, 'capsula')).toBeGreaterThan(0.75);

    const astralon = createCreature(50, 30, createRng(5));
    expect(computeCatchProbability(astralon, 'capsula')).toBeLessThan(0.1);
    astralon.currentHp = Math.max(1, Math.floor(astralon.stats.hp * 0.1));
    astralon.status = 'sleep';
    const bossProb = computeCatchProbability(astralon, 'ultracapsula');
    expect(bossProb).toBeGreaterThan(0.35);
    expect(bossProb).toBeLessThan(0.6);
  });
});
