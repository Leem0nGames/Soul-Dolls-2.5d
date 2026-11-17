import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { BODY_CONTAINERS } from '../src/data/containers.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { BattleEngine } from '../src/domain/BattleEngine.ts';
import {
  addVessel,
  computeBodyPartRatios,
  ensureBodyParts,
  getContainerAffinityMatch,
} from '../src/domain/BodyParts.ts';
import { ensureSoulDust, getSoulDust } from '../src/domain/Cards.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { getSideQuestForNpc } from '../src/domain/SideQuests.ts';
import { isInsideBuilding, isTileWalkable } from '../src/domain/TerrainRules.ts';
import {
  craftContainerAtWorkshop,
  createCustomSoulDollFromReserve,
  dismantleVesselAtWorkshop,
  isContainerRecipeUnlocked,
  modifyPartySoulDollBody,
  synthesizeShardFromDust,
  unlockWorkshopBlueprint,
  WORKSHOP_RECIPES,
  WORKSHOP_SHARD_SYNTH_DUST,
  WORKSHOP_SHARD_SYNTH_GOLD,
} from '../src/domain/Workshop.ts';
import { createInitialSave, migrateSaveData } from '../src/save/migrations.ts';

describe('Workshop, Body Creation, Resonance & Physical Interior (Taller de Marionetas)', () => {
  it('places the physical Workshop building in Villa Origen with bidirectional warps to taller_origen', () => {
    const villa = MAPS.villa_origen;
    const taller = MAPS.taller_origen;
    expect(taller).toBeDefined();
    expect(taller.isInterior).toBe(true);

    const workshopBuilding = villa.buildings.find((b) => b.kind === 'workshop');
    expect(workshopBuilding).toBeDefined();

    const toTallerWarps = villa.warps.filter((w) => w.targetMap === 'taller_origen');
    expect(toTallerWarps.length).toBeGreaterThanOrEqual(1);
    for (const w of toTallerWarps) {
      expect(isInsideBuilding(villa.buildings, w.x, w.y)).toBe(false);
      expect(isTileWalkable(villa, w.x, w.y, w.x, w.y)).toBe(true);
      expect(isTileWalkable(taller, w.targetX, w.targetY, w.targetX, w.targetY)).toBe(true);
    }

    const backWarps = taller.warps.filter((w) => w.targetMap === 'villa_origen');
    expect(backWarps.length).toBeGreaterThanOrEqual(1);
    for (const w of backWarps) {
      expect(isTileWalkable(villa, w.targetX, w.targetY, w.targetX, w.targetY)).toBe(true);
    }

    // Verify all workshop props and NPCs inside taller_origen don't block exit warps
    const propKinds = new Set(taller.props.map((p) => p.kind));
    expect(propKinds.has('forge_hearth')).toBe(true);
    expect(propKinds.has('anvil_bench')).toBe(true);
    expect(propKinds.has('doll_worktable')).toBe(true);
    expect(propKinds.has('mannequin_rack')).toBe(true);
    expect(propKinds.has('blueprint_desk')).toBe(true);

    const gael = taller.npcs.find((n) => n.id === 'artesano_gael');
    const iris = taller.npcs.find((n) => n.id === 'taller_asistente_iris');
    const apprentice = villa.npcs.find((n) => n.id === 'aprendiz_taller');
    expect(gael?.role).toBe('artisan');
    expect(iris?.role).toBe('healer');
    expect(apprentice?.role).toBe('artisan');

    const save = createInitialSave();
    expect(getSideQuestForNpc('artesano_gael', save)?.quest.mapId).toBe('taller_origen');
  });

  it('supports dual-currency forging, workshop blueprint learning, shard synthesis, and dismantling', () => {
    const save = createInitialSave();
    ensureSoulDust(save);
    save.money = 3000;
    save.soulDust = 200;

    // Aprendiz is unlocked by default; Autómata is locked until studied in workshop
    expect(isContainerRecipeUnlocked(save, 'cuerpo_aprendiz')).toBe(true);
    expect(isContainerRecipeUnlocked(save, 'cuerpo_automata')).toBe(false);
    expect(BODY_CONTAINERS.cuerpo_automata).toBeDefined();

    // Dual forge (dust_mix) saves Gold using SoulDust
    const rDust = craftContainerAtWorkshop(save, 'cuerpo_aprendiz', 'dust_mix');
    expect(rDust.ok).toBe(true);
    expect(save.vessels?.cuerpo_aprendiz).toBe(2); // 1 initial + 1 forged
    expect(save.money).toBe(3000 - WORKSHOP_RECIPES.cuerpo_aprendiz.dustForgeDiscountGold);
    expect(getSoulDust(save)).toBe(200 - WORKSHOP_RECIPES.cuerpo_aprendiz.dustForgeCost);

    // Unlock and forge Autómata de Bronce
    const learn = unlockWorkshopBlueprint(save, 'cuerpo_automata');
    expect(learn.ok).toBe(true);
    expect(isContainerRecipeUnlocked(save, 'cuerpo_automata')).toBe(true);

    const forgeAuto = craftContainerAtWorkshop(save, 'cuerpo_automata', 'gold');
    expect(forgeAuto.ok).toBe(true);
    expect(save.vessels?.cuerpo_automata).toBe(1);

    // Dismantle Autómata -> gains shards, dust, and gold
    const goldBeforeDismantle = save.money;
    const dustBeforeDismantle = getSoulDust(save);
    const dismantle = dismantleVesselAtWorkshop(save, 'cuerpo_automata');
    expect(dismantle.ok).toBe(true);
    expect(save.vessels?.cuerpo_automata ?? 0).toBe(0);
    expect(save.bodyPartShards?.cuerpo_automata).toBe(WORKSHOP_RECIPES.cuerpo_automata.dismantleShards);
    expect(save.money).toBe(goldBeforeDismantle + WORKSHOP_RECIPES.cuerpo_automata.dismantleGold);
    expect(getSoulDust(save)).toBe(dustBeforeDismantle + WORKSHOP_RECIPES.cuerpo_automata.dismantleDust);

    // Synthesize remaining 3 shards -> assembles a fresh cuerpo_automata automatically
    for (let i = 0; i < 3; i++) {
      const m0 = save.money;
      const d0 = getSoulDust(save);
      const s = synthesizeShardFromDust(save, 'cuerpo_automata');
      expect(s.ok).toBe(true);
      expect(save.money).toBe(m0 - WORKSHOP_SHARD_SYNTH_GOLD);
      expect(getSoulDust(save)).toBe(d0 - WORKSHOP_SHARD_SYNTH_DUST);
      if (i === 2) {
        expect(s.assembledCount).toBe(1);
      }
    }
    expect(save.vessels?.cuerpo_automata).toBe(1);
    expect(save.bodyPartShards?.cuerpo_automata ?? 0).toBe(0);
  });

  it('creates custom calibrated SoulDolls from reserve and modifies/tempers party SoulDolls', () => {
    const rng = createRng(42);
    const save = createInitialSave();
    save.money = 4000;
    save.soulDust = 300;
    addVessel(save, 'cuerpo_paladin', 1);
    save.soulReserve = [
      { uid: 'soul-test-1', speciesId: 1, level: 8, caughtAt: Date.now(), soulpotId: 'capsula' },
    ];

    // Reserve creation with head focus, temper +2, and brasa rune
    const baseRatio = computeBodyPartRatios('cuerpo_paladin', {
      hp: 7,
      atk: 7,
      def: 7,
      spa: 7,
      spd: 7,
      spe: 7,
    });
    const headRatio = computeBodyPartRatios(
      'cuerpo_paladin',
      { hp: 7, atk: 7, def: 7, spa: 7, spd: 7, spe: 7 },
      undefined,
      { focusPart: 'head' }
    );
    expect(headRatio.head).toBeGreaterThan(baseRatio.head);

    const created = createCustomSoulDollFromReserve(save, 'soul-test-1', 'cuerpo_paladin', rng, {
      focusPart: 'head',
      temperLevel: 2,
      affinityOverride: 'brasa',
    });
    expect(created.ok).toBe(true);
    expect(save.soulReserve.length).toBe(0);
    expect(save.party.length).toBe(1);
    const doll = save.party[0];
    expect(doll.containerId).toBe('cuerpo_paladin');
    expect(doll.vesselCalibration).toEqual({
      focusPart: 'head',
      temperLevel: 2,
      affinityOverride: 'brasa',
    });

    // Compare tempered HP vs untempered reference
    const plain = createCreature(1, 8, createRng(42), 'cuerpo_paladin');
    plain.ivs = { ...doll.ivs };
    expect(doll.stats.hp).toBeGreaterThan(plain.stats.hp);

    // Upgrade party doll temper to +3 and engrave marea rune
    const mod = modifyPartySoulDollBody(save, doll, 'cuerpo_paladin', {
      focusPart: 'torso',
      temperLevel: 3,
      affinityOverride: 'marea',
    });
    expect(mod.ok).toBe(true);
    expect(doll.vesselCalibration?.temperLevel).toBe(3);
    expect(doll.vesselCalibration?.focusPart).toBe('torso');
    expect(doll.vesselCalibration?.affinityOverride).toBe('marea');
  });

  it('computes Resonancia de Armazón and mitigates broken-leg speed penalty in BattleEngine', () => {
    const rng = createRng(99);
    // Species 1 (Chispalma / Ignis - tipo Brasa): cuerpo_maga resonates (affinityTypes includes brasa), cuerpo_priest does not unless engraved
    const resonantDoll = createCreature(1, 10, rng, 'cuerpo_maga');
    const nonResonantDoll = createCreature(1, 10, rng, 'cuerpo_priest');
    nonResonantDoll.ivs = { ...resonantDoll.ivs };
    nonResonantDoll.stats = { ...resonantDoll.stats };

    expect(getContainerAffinityMatch(resonantDoll).level).toBe('full');
    expect(getContainerAffinityMatch(nonResonantDoll).level).toBe('none');

    // Engraved rune grants resonance even on mismatched container
    nonResonantDoll.vesselCalibration = { affinityOverride: 'brasa' };
    expect(getContainerAffinityMatch(nonResonantDoll).level).toBe('full');
    delete nonResonantDoll.vesselCalibration;

    // Verify BattleEngine broken-leg speed keeps resonant faster than non-resonant at equal stats
    ensureBodyParts(resonantDoll).legs.current = 0;
    ensureBodyParts(nonResonantDoll).legs.current = 0;

    const enemy = createCreature(4, 10, createRng(100));
    const engineRes = new BattleEngine([resonantDoll], [enemy], [], createRng(7));
    const engineNon = new BattleEngine([nonResonantDoll], [enemy], [], createRng(7));

    const resSpe = (engineRes as unknown as { effectiveSpeed: (s: 'player' | 'enemy') => number }).effectiveSpeed('player');
    const nonSpe = (engineNon as unknown as { effectiveSpeed: (s: 'player' | 'enemy') => number }).effectiveSpeed('player');
    expect(resSpe).toBeGreaterThan(nonSpe);
  });

  it('preserves and sanitizes vesselCalibration across save migrations', () => {
    const save = createInitialSave();
    const doll = createCreature(1, 5, createRng(1), 'cuerpo_aprendiz');
    doll.vesselCalibration = {
      focusPart: 'arms',
      temperLevel: 2,
      affinityOverride: 'chispa',
    };
    save.party.push(doll);

    const migrated = migrateSaveData(save);
    expect(migrated).not.toBeNull();
    expect(migrated!.party[0].vesselCalibration).toEqual({
      focusPart: 'arms',
      temperLevel: 2,
      affinityOverride: 'chispa',
    });
  });
});
