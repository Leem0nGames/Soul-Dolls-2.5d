import type { Rng } from '../core/Rng.ts';
import {
  ALL_CONTAINER_IDS,
  getBodyContainer,
  SHARDS_PER_CONTAINER,
} from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import {
  addBodyPartShard,
  addVessel,
  consumeVessel,
  ensureSaveVesselState,
  getContainerAffinityMatch,
  rebindCreatureContainer,
} from './BodyParts.ts';
import { addSoulDust, ensureSoulDust, getSoulDust } from './Cards.ts';
import { createCreature, getCreatureDisplayName, recalculateCreatureStats } from './Creature.ts';
import {
  CRAFTING_BLUEPRINTS,
  ensureSaveSideQuestState,
  SIDE_QUESTS,
  type CraftingBlueprintDef,
} from './SideQuests.ts';
import { addCapturedCreature } from './Storage.ts';
import type {
  BodyPartName,
  CreatureInstance,
  CreatureType,
  SaveData,
  VesselCalibration,
} from './types.ts';

export const WORKSHOP_SHARD_SYNTH_DUST = 20;
export const WORKSHOP_SHARD_SYNTH_GOLD = 40;
export const WORKSHOP_FOCUS_GOLD = 120;
export const WORKSHOP_FOCUS_DUST = 10;
export const WORKSHOP_RUNE_GOLD = 180;
export const WORKSHOP_RUNE_DUST = 25;
export const WORKSHOP_MAX_TEMPER = 3;

export interface WorkshopRecipeMeta {
  containerId: string;
  blueprintId: string;
  alwaysUnlocked?: boolean;
  workshopLearnCost?: { gold: number; dust: number };
  dustForgeDiscountGold: number;
  dustForgeCost: number;
  dismantleShards: number;
  dismantleDust: number;
  dismantleGold: number;
  questHint?: string;
}

const QUEST_HINT_BY_BP = new Map<string, string>();
for (const q of SIDE_QUESTS) {
  QUEST_HINT_BY_BP.set(q.rewardBlueprintId, `Misión: ${q.title} (${q.giverName})`);
}

export const WORKSHOP_RECIPES: Record<string, WorkshopRecipeMeta> = {
  cuerpo_aprendiz: {
    containerId: 'cuerpo_aprendiz',
    blueprintId: 'plano_aprendiz',
    alwaysUnlocked: true,
    dustForgeDiscountGold: 120,
    dustForgeCost: 15,
    dismantleShards: 2,
    dismantleDust: 12,
    dismantleGold: 60,
  },
  cuerpo_maga: {
    containerId: 'cuerpo_maga',
    blueprintId: 'plano_maga',
    dustForgeDiscountGold: 220,
    dustForgeCost: 25,
    dismantleShards: 2,
    dismantleDust: 18,
    dismantleGold: 95,
    questHint: QUEST_HINT_BY_BP.get('plano_maga'),
  },
  cuerpo_priest: {
    containerId: 'cuerpo_priest',
    blueprintId: 'plano_priest',
    dustForgeDiscountGold: 220,
    dustForgeCost: 25,
    dismantleShards: 2,
    dismantleDust: 18,
    dismantleGold: 95,
    questHint: QUEST_HINT_BY_BP.get('plano_priest'),
  },
  cuerpo_paladin: {
    containerId: 'cuerpo_paladin',
    blueprintId: 'plano_paladin',
    dustForgeDiscountGold: 360,
    dustForgeCost: 40,
    dismantleShards: 2,
    dismantleDust: 30,
    dismantleGold: 160,
    questHint: QUEST_HINT_BY_BP.get('plano_paladin'),
  },
  cuerpo_bruja: {
    containerId: 'cuerpo_bruja',
    blueprintId: 'plano_bruja',
    dustForgeDiscountGold: 340,
    dustForgeCost: 35,
    dismantleShards: 2,
    dismantleDust: 28,
    dismantleGold: 150,
    questHint: QUEST_HINT_BY_BP.get('plano_bruja'),
  },
  cuerpo_asesina: {
    containerId: 'cuerpo_asesina',
    blueprintId: 'plano_asesina',
    workshopLearnCost: { gold: 280, dust: 20 },
    dustForgeDiscountGold: 380,
    dustForgeCost: 40,
    dismantleShards: 2,
    dismantleDust: 32,
    dismantleGold: 165,
  },
  cuerpo_automata: {
    containerId: 'cuerpo_automata',
    blueprintId: 'plano_automata',
    workshopLearnCost: { gold: 420, dust: 35 },
    dustForgeDiscountGold: 520,
    dustForgeCost: 55,
    dismantleShards: 2,
    dismantleDust: 42,
    dismantleGold: 220,
  },
  cuerpo_titan: {
    containerId: 'cuerpo_titan',
    blueprintId: 'plano_titan',
    dustForgeDiscountGold: 720,
    dustForgeCost: 75,
    dismantleShards: 2,
    dismantleDust: 60,
    dismantleGold: 320,
    questHint: QUEST_HINT_BY_BP.get('plano_titan'),
  },
};

export function getWorkshopRecipe(containerId: string): WorkshopRecipeMeta {
  return WORKSHOP_RECIPES[containerId] ?? WORKSHOP_RECIPES.cuerpo_aprendiz;
}

export function getBlueprintForContainer(containerId: string): CraftingBlueprintDef {
  const recipe = getWorkshopRecipe(containerId);
  return CRAFTING_BLUEPRINTS[recipe.blueprintId] ?? CRAFTING_BLUEPRINTS.plano_aprendiz;
}

export function isContainerRecipeUnlocked(save: SaveData, containerId: string): boolean {
  const recipe = getWorkshopRecipe(containerId);
  if (recipe.alwaysUnlocked) return true;
  return (save.blueprints ?? []).includes(recipe.blueprintId);
}

export function unlockWorkshopBlueprint(
  save: SaveData,
  containerId: string
): { ok: boolean; reason?: 'already_unlocked' | 'quest_only' | 'no_money' | 'no_dust'; blueprintName?: string } {
  ensureSaveSideQuestState(save);
  ensureSoulDust(save);
  const recipe = getWorkshopRecipe(containerId);
  const bp = getBlueprintForContainer(containerId);
  if (isContainerRecipeUnlocked(save, containerId)) {
    return { ok: false, reason: 'already_unlocked', blueprintName: bp.name };
  }
  if (!recipe.workshopLearnCost) {
    return { ok: false, reason: 'quest_only', blueprintName: bp.name };
  }
  if (save.money < recipe.workshopLearnCost.gold) {
    return { ok: false, reason: 'no_money' };
  }
  if (getSoulDust(save) < recipe.workshopLearnCost.dust) {
    return { ok: false, reason: 'no_dust' };
  }
  save.money -= recipe.workshopLearnCost.gold;
  addSoulDust(save, -recipe.workshopLearnCost.dust);
  if (!save.blueprints!.includes(bp.id)) {
    save.blueprints!.push(bp.id);
  }
  return { ok: true, blueprintName: bp.name };
}

export function craftContainerAtWorkshop(
  save: SaveData,
  containerId: string,
  paymentMode: 'gold' | 'dust_mix' = 'gold'
): { ok: boolean; reason?: 'locked' | 'no_money' | 'no_dust'; containerName?: string } {
  ensureSaveSideQuestState(save);
  ensureSaveVesselState(save);
  ensureSoulDust(save);

  if (!ALL_CONTAINER_IDS.includes(containerId)) {
    return { ok: false, reason: 'locked' };
  }
  if (!isContainerRecipeUnlocked(save, containerId)) {
    return { ok: false, reason: 'locked' };
  }

  const recipe = getWorkshopRecipe(containerId);
  const bp = getBlueprintForContainer(containerId);
  const goldCost = paymentMode === 'dust_mix' ? recipe.dustForgeDiscountGold : bp.craftGoldCost;
  const dustCost = paymentMode === 'dust_mix' ? recipe.dustForgeCost : 0;

  if (save.money < goldCost) {
    return { ok: false, reason: 'no_money' };
  }
  if (getSoulDust(save) < dustCost) {
    return { ok: false, reason: 'no_dust' };
  }

  save.money -= goldCost;
  if (dustCost > 0) addSoulDust(save, -dustCost);
  addVessel(save, containerId, 1);

  return {
    ok: true,
    containerName: getBodyContainer(containerId).name,
  };
}

export function dismantleVesselAtWorkshop(
  save: SaveData,
  containerId: string
): {
  ok: boolean;
  reason?: 'no_vessel';
  shardsGained?: number;
  assembledCount?: number;
  dustGained?: number;
  goldGained?: number;
  containerName?: string;
} {
  ensureSaveVesselState(save);
  ensureSoulDust(save);
  if (!consumeVessel(save, containerId)) {
    return { ok: false, reason: 'no_vessel' };
  }
  const recipe = getWorkshopRecipe(containerId);
  const shardRes = addBodyPartShard(save, containerId, recipe.dismantleShards);
  addSoulDust(save, recipe.dismantleDust);
  save.money += recipe.dismantleGold;

  return {
    ok: true,
    shardsGained: recipe.dismantleShards,
    assembledCount: shardRes.assembledCount,
    dustGained: recipe.dismantleDust,
    goldGained: recipe.dismantleGold,
    containerName: getBodyContainer(containerId).name,
  };
}

export function synthesizeShardFromDust(
  save: SaveData,
  containerId: string
): {
  ok: boolean;
  reason?: 'no_money' | 'no_dust' | 'invalid';
  currentShards?: number;
  assembledCount?: number;
  containerName?: string;
} {
  if (!ALL_CONTAINER_IDS.includes(containerId)) {
    return { ok: false, reason: 'invalid' };
  }
  ensureSaveVesselState(save);
  ensureSoulDust(save);
  if (save.money < WORKSHOP_SHARD_SYNTH_GOLD) {
    return { ok: false, reason: 'no_money' };
  }
  if (getSoulDust(save) < WORKSHOP_SHARD_SYNTH_DUST) {
    return { ok: false, reason: 'no_dust' };
  }
  save.money -= WORKSHOP_SHARD_SYNTH_GOLD;
  addSoulDust(save, -WORKSHOP_SHARD_SYNTH_DUST);
  const res = addBodyPartShard(save, containerId, 1);
  return {
    ok: true,
    currentShards: res.currentShards,
    assembledCount: res.assembledCount,
    containerName: getBodyContainer(containerId).name,
  };
}

export function getTemperUpgradeCost(nextLevel: number): { gold: number; dust: number } {
  const clamped = Math.max(1, Math.min(WORKSHOP_MAX_TEMPER, Math.floor(nextLevel)));
  return {
    gold: clamped * 200,
    dust: clamped * 20,
  };
}

export function computeCalibrationCost(
  current: VesselCalibration | undefined,
  next: VesselCalibration | undefined,
  currentContainerId?: string,
  nextContainerId?: string
): {
  gold: number;
  dust: number;
  changedFocus: boolean;
  changedRune: boolean;
  temperSteps: number;
  changedContainer: boolean;
} {
  const curFocus = current?.focusPart;
  const nxtFocus = next?.focusPart;
  const changedFocus = Boolean(nxtFocus && nxtFocus !== curFocus);

  const curRune = current?.affinityOverride;
  const nxtRune = next?.affinityOverride;
  const changedRune = Boolean(nxtRune && nxtRune !== curRune);

  const curTemper = Math.max(0, Math.min(WORKSHOP_MAX_TEMPER, current?.temperLevel ?? 0));
  const nxtTemper = Math.max(curTemper, Math.min(WORKSHOP_MAX_TEMPER, next?.temperLevel ?? curTemper));
  const temperSteps = nxtTemper - curTemper;

  let gold = 0;
  let dust = 0;

  if (changedFocus) {
    gold += WORKSHOP_FOCUS_GOLD;
    dust += WORKSHOP_FOCUS_DUST;
  }
  if (changedRune) {
    gold += WORKSHOP_RUNE_GOLD;
    dust += WORKSHOP_RUNE_DUST;
  }
  for (let lv = curTemper + 1; lv <= nxtTemper; lv++) {
    const c = getTemperUpgradeCost(lv);
    gold += c.gold;
    dust += c.dust;
  }

  return {
    gold,
    dust,
    changedFocus,
    changedRune,
    temperSteps,
    changedContainer: Boolean(nextContainerId && currentContainerId !== nextContainerId),
  };
}

export interface CustomForgeOptions {
  focusPart?: BodyPartName;
  temperLevel?: number;
  affinityOverride?: CreatureType;
}

export function createCustomSoulDollFromReserve(
  save: SaveData,
  soulUid: string,
  containerId: string,
  rng: Rng,
  options: CustomForgeOptions = {}
): {
  ok: boolean;
  reason?: 'not_found' | 'no_vessel' | 'no_money' | 'no_dust' | 'storage_full';
  doll?: CreatureInstance;
  containerName?: string;
  destination?: 'party' | 'box';
} {
  ensureSaveVesselState(save);
  ensureSoulDust(save);
  const reserve = save.soulReserve ?? [];
  const idx = reserve.findIndex((s) => s.uid === soulUid);
  if (idx === -1) return { ok: false, reason: 'not_found' };
  if ((save.vessels?.[containerId] ?? 0) <= 0) {
    return { ok: false, reason: 'no_vessel' };
  }

  const cal: VesselCalibration = {
    ...(options.focusPart ? { focusPart: options.focusPart } : {}),
    ...(options.temperLevel && options.temperLevel > 0
      ? { temperLevel: Math.min(WORKSHOP_MAX_TEMPER, Math.floor(options.temperLevel)) }
      : {}),
    ...(options.affinityOverride ? { affinityOverride: options.affinityOverride } : {}),
  };
  const cost = computeCalibrationCost(undefined, cal);
  if (save.money < cost.gold) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < cost.dust) return { ok: false, reason: 'no_dust' };

  if (!consumeVessel(save, containerId)) {
    return { ok: false, reason: 'no_vessel' };
  }

  const soul = reserve.splice(idx, 1)[0];
  const doll = createCreature(soul.speciesId, soul.level, rng, containerId);
  if (cal.focusPart || cal.temperLevel || cal.affinityOverride) {
    doll.vesselCalibration = cal;
    recalculateCreatureStats(doll);
  }

  const dest = addCapturedCreature(save.party, save.storageBoxes, doll);
  if (dest.destination === 'none') {
    reserve.splice(idx, 0, soul);
    addVessel(save, containerId, 1);
    return { ok: false, reason: 'storage_full' };
  }

  save.money -= cost.gold;
  if (cost.dust > 0) addSoulDust(save, -cost.dust);

  return {
    ok: true,
    doll,
    containerName: getBodyContainer(containerId).name,
    destination: dest.destination === 'party' ? 'party' : 'box',
  };
}

export function modifyPartySoulDollBody(
  save: SaveData,
  doll: CreatureInstance,
  targetContainerId: string,
  options: CustomForgeOptions
): {
  ok: boolean;
  reason?: 'no_vessel' | 'no_money' | 'no_dust' | 'nothing_changed';
  dollName?: string;
  containerName?: string;
} {
  ensureSaveVesselState(save);
  ensureSoulDust(save);
  const curCid = doll.containerId ?? 'cuerpo_aprendiz';
  const swapContainer = targetContainerId !== curCid;

  const curCal = doll.vesselCalibration;
  const nextTemper = Math.max(
    curCal?.temperLevel ?? 0,
    Math.min(WORKSHOP_MAX_TEMPER, Math.floor(options.temperLevel ?? curCal?.temperLevel ?? 0))
  );
  const nextCal: VesselCalibration = {
    ...(options.focusPart ? { focusPart: options.focusPart } : {}),
    ...(nextTemper > 0 ? { temperLevel: nextTemper } : {}),
    ...(options.affinityOverride ? { affinityOverride: options.affinityOverride } : {}),
  };

  const cost = computeCalibrationCost(curCal, nextCal, curCid, targetContainerId);
  if (!swapContainer && !cost.changedFocus && !cost.changedRune && cost.temperSteps <= 0) {
    return { ok: false, reason: 'nothing_changed' };
  }
  if (swapContainer && (save.vessels?.[targetContainerId] ?? 0) <= 0) {
    return { ok: false, reason: 'no_vessel' };
  }
  if (save.money < cost.gold) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < cost.dust) return { ok: false, reason: 'no_dust' };

  if (swapContainer) {
    if (!consumeVessel(save, targetContainerId)) return { ok: false, reason: 'no_vessel' };
    addVessel(save, curCid, 1);
  }

  save.money -= cost.gold;
  if (cost.dust > 0) addSoulDust(save, -cost.dust);

  const hasAnyCal = Boolean(nextCal.focusPart || nextCal.temperLevel || nextCal.affinityOverride);
  if (hasAnyCal) {
    doll.vesselCalibration = nextCal;
  } else {
    delete doll.vesselCalibration;
  }
  rebindCreatureContainer(doll, targetContainerId, doll.vesselCalibration);
  recalculateCreatureStats(doll);

  return {
    ok: true,
    dollName: getCreatureDisplayName(doll),
    containerName: getBodyContainer(targetContainerId).name,
  };
}

export function getWorkshopDollPreview(
  creature: CreatureInstance,
  containerId: string,
  calibration?: VesselCalibration
) {
  const affinity = getContainerAffinityMatch(creature, containerId, calibration);
  const spec = getSpecies(creature.speciesId);
  return {
    spec,
    affinity,
    shardsPerContainer: SHARDS_PER_CONTAINER,
  };
}
