import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { ABILITIES } from '../src/data/abilities.ts';
import { ITEMS } from '../src/data/items.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { getSpecies } from '../src/data/species.ts';
import { computeBodyPartRatios } from '../src/domain/BodyParts.ts';
import { ensureSoulDust, getSoulDust } from '../src/domain/Cards.ts';
import { createCreature } from '../src/domain/Creature.ts';
import {
  addItem,
  applyMedicineToCreature,
  applyTmToCreature,
  VITAMIN_EV_AMOUNT,
} from '../src/domain/Inventory.ts';
import {
  canCreatureLearnMove,
  craftTmScrollAtWorkshop,
  EV_TRAIN_COST,
  EV_TRAIN_STEP,
  forgeCreatureIvBoost,
  forgeMoveOnCreature,
  getAvailableAbilitiesForCreature,
  getEvTotal,
  getForgeableMovesForCreature,
  getRelearnableMoves,
  IV_FORGE_COST,
  MAX_EV_PER_STAT,
  MAX_EV_TOTAL,
  MAX_IV,
  PASSIVE_FORGE_COST,
  RELEARN_MOVE_COST,
  relearnCreatureMove,
  TALLER_SKILL_SHOP_STOCK,
  trainCreatureAttribute,
  unlockOrSetCreatureAbility,
} from '../src/domain/SkillForge.ts';
import { isTileWalkable } from '../src/domain/TerrainRules.ts';
import { createInitialSave, migrateSaveData } from '../src/save/migrations.ts';

describe('Skill Forge, Passive Awakening, Attribute Training & Workshop Skill Wing', () => {
  it('places the Skill Wing, skill_altar, training_dummy, and Maestra Lyra inside taller_origen with clear passage', () => {
    const taller = MAPS.taller_origen;
    expect(taller).toBeDefined();

    const altar = taller.props.find((p) => p.kind === 'skill_altar');
    const dummy = taller.props.find((p) => p.kind === 'training_dummy');
    const lyra = taller.npcs.find((n) => n.id === 'taller_maestra_lyra');

    expect(altar).toBeDefined();
    expect(dummy).toBeDefined();
    expect(lyra).toBeDefined();
    expect(lyra?.role).toBe('scholar');

    // Passage through interior divider x=17 at rows 4..7 must be walkable
    for (const row of [4, 5, 6, 7]) {
      expect(isTileWalkable(taller, 17, row, 16, row)).toBe(true);
      expect(isTileWalkable(taller, 18, row, 17, row)).toBe(true);
    }

    // Approach tiles in front of altar & dummy must be walkable
    expect(isTileWalkable(taller, altar!.x, altar!.z + 1, altar!.x, altar!.z + 2)).toBe(true);
    expect(isTileWalkable(taller, dummy!.x - 1, dummy!.z, dummy!.x - 2, dummy!.z)).toBe(true);

    // Skill shop stock references real items (tonics + TMs + gacha relic)
    expect(TALLER_SKILL_SHOP_STOCK.length).toBeGreaterThanOrEqual(16);
    for (const id of TALLER_SKILL_SHOP_STOCK) {
      expect(ITEMS[id], `Unknown stock item ${id}`).toBeDefined();
    }
  });

  it('relearns species moves, forges new techniques, and respects 4-slot limits & engraved runes', () => {
    const save = createInitialSave();
    ensureSoulDust(save);
    save.money = 5000;
    save.soulDust = 500;

    // Species 1 (brasa) starts at lv 18; strip one early learnset move to test Relearner
    const doll = createCreature(1, 18, createRng(10));
    const sp = getSpecies(1);
    const knownMoveId = doll.moves[0].moveId;
    doll.moves.splice(0, 1);
    expect(doll.moves.some((m) => m.moveId === knownMoveId)).toBe(false);

    const relearnList = getRelearnableMoves(doll);
    expect(relearnList.some((m) => m.id === knownMoveId)).toBe(true);

    const moneyBefore = save.money;
    const relearnRes = relearnCreatureMove(save, doll, knownMoveId);
    expect(relearnRes.ok).toBe(true);
    expect(save.money).toBe(moneyBefore - RELEARN_MOVE_COST.gold);
    expect(doll.moves.some((m) => m.moveId === knownMoveId)).toBe(true);

    // Without Marea rune, a pure Brasa doll cannot forge a Marea move like pulso_abismo
    if (!sp.types.includes('marea')) {
      expect(canCreatureLearnMove(doll, 'pulso_abismo')).toBe(false);
      // Engrave Marea rune onto the vessel -> unlocks Marea techniques & passives!
      doll.vesselCalibration = { affinityOverride: 'marea' };
      expect(canCreatureLearnMove(doll, 'pulso_abismo')).toBe(true);
    }

    const forgeable = getForgeableMovesForCreature(save, doll);
    const unlockedTarget = forgeable.find((o) => o.unlocked && o.move.id === 'pulso_abismo') ??
      forgeable.find((o) => o.unlocked);
    expect(unlockedTarget).toBeDefined();

    // Ensure 4 moves to test slot replacement flow
    while (doll.moves.length < 4 && forgeable.length > 0) {
      const filler = getForgeableMovesForCreature(save, doll).find(
        (o) => o.unlocked && o.move.id !== unlockedTarget!.move.id
      );
      if (!filler) break;
      forgeMoveOnCreature(save, doll, filler.move.id);
    }
    expect(doll.moves.length).toBe(4);

    // Trying to forge without replaceSlotIndex asks for slot selection
    const needSlot = forgeMoveOnCreature(save, doll, unlockedTarget!.move.id);
    expect(needSlot.ok).toBe(false);
    expect(needSlot.reason).toBe('need_slot');

    const dustBeforeForge = getSoulDust(save);
    const replacedOld = doll.moves[2].moveId;
    const forged = forgeMoveOnCreature(save, doll, unlockedTarget!.move.id, 2);
    expect(forged.ok).toBe(true);
    expect(doll.moves[2].moveId).toBe(unlockedTarget!.move.id);
    expect(doll.moves.some((m) => m.moveId === replacedOld)).toBe(false);
    expect(getSoulDust(save)).toBe(dustBeforeForge - unlockedTarget!.dustCost);
  });

  it('crafts portable TM discs at the workshop and teaches moves & vitamin tonics from Bag', () => {
    const save = createInitialSave();
    ensureSoulDust(save);
    save.money = 3000;
    save.soulDust = 200;

    const crafted = craftTmScrollAtWorkshop(save, 'mt_corte_critico');
    expect(crafted.ok).toBe(true);
    expect(save.bag.find((s) => s.itemId === 'mt_corte_critico')?.quantity).toBe(1);

    const doll = createCreature(4, 12, createRng(15));
    const slotIdx = doll.moves.length >= 4 ? 0 : undefined;
    const learned = applyTmToCreature('mt_corte_critico', doll, slotIdx);
    expect(learned.applied).toBe(true);
    expect(doll.moves.some((m) => m.moveId === 'corte_critico')).toBe(true);

    // Apply Vitamin Tonic via applyMedicineToCreature
    addItem(save.bag, 'tonico_vel', 1);
    const speBefore = doll.stats.spe;
    const medRes = applyMedicineToCreature('tonico_vel', doll);
    expect(medRes.applied).toBe(true);
    expect(medRes.addedEv).toBe(VITAMIN_EV_AMOUNT);
    expect(medRes.vitaminStat).toBe('spe');
    expect(doll.evBonuses?.spe).toBe(VITAMIN_EV_AMOUNT);
    expect(doll.stats.spe).toBeGreaterThanOrEqual(speBefore);
  });

  it('forges and swaps passive abilities cleanly with persistent unlockedAbilities', () => {
    const save = createInitialSave();
    ensureSoulDust(save);
    save.money = 3000;
    save.soulDust = 300;

    const doll = createCreature(1, 10, createRng(21));
    const options = getAvailableAbilitiesForCreature(doll);
    const forgeOpt = options.find((o) => !o.active && !o.unlocked && o.source === 'forged');
    expect(forgeOpt).toBeDefined();

    const dustBefore = getSoulDust(save);
    const moneyBefore = save.money;
    const res = unlockOrSetCreatureAbility(save, doll, forgeOpt!.ability.id);
    expect(res.ok).toBe(true);
    expect(res.newlyForged).toBe(true);
    expect(doll.abilityId).toBe(forgeOpt!.ability.id);
    expect(doll.unlockedAbilities).toContain(forgeOpt!.ability.id);
    expect(ABILITIES[doll.abilityId!]).toBeDefined();
    expect(save.money).toBe(moneyBefore - PASSIVE_FORGE_COST.gold);
    expect(getSoulDust(save)).toBe(dustBefore - PASSIVE_FORGE_COST.dust);

    // Swapping back to an already unlocked ability costs only swap gold & 0 dust
    const initialInnate = options.find((o) => o.unlocked)!;
    const dustBeforeSwap = getSoulDust(save);
    const swapRes = unlockOrSetCreatureAbility(save, doll, initialInnate.ability.id);
    expect(swapRes.ok).toBe(true);
    expect(swapRes.newlyForged).toBe(false);
    expect(getSoulDust(save)).toBe(dustBeforeSwap);
  });

  it('trains EV attributes and IV potential within strict caps, updates body part ratios, and survives save migration', () => {
    const save = createInitialSave();
    ensureSoulDust(save);
    save.money = 20000;
    save.soulDust = 2000;

    const doll = createCreature(1, 25, createRng(33), 'cuerpo_aprendiz');
    doll.ivs = { hp: 10, atk: 10, def: 10, spa: 10, spd: 10, spe: 10 };

    const atkBefore = doll.stats.atk;
    const ratiosBefore = computeBodyPartRatios('cuerpo_aprendiz', doll.ivs, doll.evBonuses);

    // Train ATK up to cap (30 EV -> 10 sessions of +3 EV)
    for (let i = 0; i < MAX_EV_PER_STAT / EV_TRAIN_STEP; i++) {
      const m0 = save.money;
      const d0 = getSoulDust(save);
      const t = trainCreatureAttribute(save, doll, 'atk');
      expect(t.ok).toBe(true);
      expect(save.money).toBe(m0 - EV_TRAIN_COST.gold);
      expect(getSoulDust(save)).toBe(d0 - EV_TRAIN_COST.dust);
    }
    expect(doll.evBonuses?.atk).toBe(MAX_EV_PER_STAT);
    expect(doll.stats.atk).toBeGreaterThan(atkBefore);

    // Further ATK EV training is capped
    const capped = trainCreatureAttribute(save, doll, 'atk');
    expect(capped.ok).toBe(false);
    expect(capped.reason).toBe('stat_capped');

    // EVs reshape anatomical arm ratio
    const ratiosAfter = computeBodyPartRatios('cuerpo_aprendiz', doll.ivs, doll.evBonuses);
    expect(ratiosAfter.arms).toBeGreaterThan(ratiosBefore.arms);

    // Fill remaining 60 EV budget (def + spe = 30 each -> total 90)
    for (let i = 0; i < 10; i++) expect(trainCreatureAttribute(save, doll, 'def').ok).toBe(true);
    for (let i = 0; i < 10; i++) expect(trainCreatureAttribute(save, doll, 'spe').ok).toBe(true);
    expect(getEvTotal(doll)).toBe(MAX_EV_TOTAL);
    expect(trainCreatureAttribute(save, doll, 'hp').reason).toBe('total_capped');

    // Forge IV from 10 to 15
    for (let v = 11; v <= MAX_IV; v++) {
      const m0 = save.money;
      const d0 = getSoulDust(save);
      const f = forgeCreatureIvBoost(save, doll, 'atk');
      expect(f.ok).toBe(true);
      expect(f.newIv).toBe(v);
      expect(save.money).toBe(m0 - IV_FORGE_COST.gold);
      expect(getSoulDust(save)).toBe(d0 - IV_FORGE_COST.dust);
    }
    expect(forgeCreatureIvBoost(save, doll, 'atk').reason).toBe('iv_max');

    // Verify save migration preserves unlockedAbilities + evBonuses cleanly
    doll.unlockedAbilities = [doll.abilityId!, 'enfoque_puro'];
    save.party.push(doll);
    const migrated = migrateSaveData(save);
    expect(migrated).not.toBeNull();
    expect(migrated!.party[0].evBonuses).toEqual({ atk: 30, def: 30, spe: 30 });
    expect(migrated!.party[0].unlockedAbilities).toContain('enfoque_puro');
    expect(migrated!.party[0].ivs.atk).toBe(MAX_IV);
  });
});
