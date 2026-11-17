import { ABILITIES } from '../data/abilities.ts';
import { getItem, ITEMS } from '../data/items.ts';
import { getMove, MOVES } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { addSoulDust, ensureSoulDust, getSoulDust } from './Cards.ts';
import { getCreatureDisplayName, recalculateCreatureStats } from './Creature.ts';
import { addItem } from './Inventory.ts';
import type {
  AbilityDef,
  CreatureInstance,
  CreatureType,
  MoveDef,
  SaveData,
  StatName,
} from './types.ts';

export const MAX_EV_PER_STAT = 30;
export const MAX_EV_TOTAL = 90;
export const EV_TRAIN_STEP = 3;
export const EV_TRAIN_COST = { gold: 90, dust: 8 } as const;

export const MAX_IV = 15;
export const IV_FORGE_COST = { gold: 260, dust: 25 } as const;

export const RELEARN_MOVE_COST = { gold: 60, dust: 0 } as const;
export const PASSIVE_SWAP_COST = { gold: 50, dust: 0 } as const;
export const PASSIVE_INNATE_UNLOCK_COST = { gold: 140, dust: 10 } as const;
export const PASSIVE_FORGE_COST = { gold: 280, dust: 25 } as const;

export const ALL_STAT_NAMES: readonly StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export type MoveForgeTier = 'basico' | 'avanzado' | 'maestro';

export interface ForgeableMoveOption {
  move: MoveDef;
  tier: MoveForgeTier;
  goldCost: number;
  dustCost: number;
  requiredLevel: number;
  unlocked: boolean;
  unlockedByCard: boolean;
  reasonLocked?: string;
  viaRune: boolean;
  tmItemId?: string;
}

export interface AvailableAbilityOption {
  ability: AbilityDef;
  source: 'innate' | 'forged' | 'rune';
  unlocked: boolean;
  active: boolean;
  goldCost: number;
  dustCost: number;
}

export const TALLER_CRAFTABLE_TMS: ReadonlyArray<{
  itemId: string;
  moveId: string;
  goldCost: number;
  dustCost: number;
}> = [
  { itemId: 'mt_golpe_rapido', moveId: 'golpe_rapido', goldCost: 220, dustCost: 12 },
  { itemId: 'mt_recuperacion', moveId: 'recuperacion', goldCost: 340, dustCost: 22 },
  { itemId: 'mt_corte_critico', moveId: 'corte_critico', goldCost: 280, dustCost: 18 },
  { itemId: 'mt_forja_interna', moveId: 'forja_interna', goldCost: 300, dustCost: 20 },
  { itemId: 'mt_pulso_abismo', moveId: 'pulso_abismo', goldCost: 360, dustCost: 24 },
  { itemId: 'mt_gigadrenado', moveId: 'gigadrenado', goldCost: 380, dustCost: 26 },
  { itemId: 'mt_arco_prisma', moveId: 'arco_prisma', goldCost: 360, dustCost: 24 },
  { itemId: 'mt_avalancha', moveId: 'avalancha', goldCost: 360, dustCost: 24 },
  { itemId: 'mt_tajo_pluma', moveId: 'tajo_pluma', goldCost: 340, dustCost: 22 },
  { itemId: 'mt_sombra_vil', moveId: 'sombra_vil', goldCost: 240, dustCost: 15 },
];

export const TALLER_SKILL_SHOP_STOCK: string[] = [
  'tonico_ps',
  'tonico_atq',
  'tonico_def',
  'tonico_ate',
  'tonico_dfe',
  'tonico_vel',
  'mt_golpe_rapido',
  'mt_corte_critico',
  'mt_recuperacion',
  'mt_forja_interna',
  'mt_pulso_abismo',
  'mt_gigadrenado',
  'mt_arco_prisma',
  'mt_avalancha',
  'mt_tajo_pluma',
  'mt_sombra_vil',
  'fragmento_alma',
];

const TM_ID_BY_MOVE: Record<string, string> = Object.fromEntries(
  TALLER_CRAFTABLE_TMS.map((entry) => [entry.moveId, entry.itemId])
);

const TYPE_FORGE_ABILITIES: Record<CreatureType, readonly string[]> = {
  brasa: ['furia_brasa', 'cuerpo_igneo', 'absorbe_brasa'],
  marea: ['furia_marea', 'absorbe_marea', 'regeneracion'],
  flora: ['furia_flora', 'piel_espinas', 'regeneracion'],
  chispa: ['estatica_viva', 'absorbe_chispa', 'impulso_inicial'],
  roca: ['coraza_dura', 'escudo_puro', 'intimidacion'],
  brisa: ['velo_ligero', 'broma_veloz', 'impulso_inicial'],
  umbra: ['broma_veloz', 'mente_clara', 'enfoque_puro'],
  comun: ['enfoque_puro', 'intimidacion', 'mente_clara', 'escudo_puro'],
};

const UNIVERSAL_FORGE_ABILITIES: readonly string[] = [
  'enfoque_puro',
  'mente_clara',
  'coraza_dura',
];

export function getCreatureAffinityTypes(creature: CreatureInstance): CreatureType[] {
  const spec = getSpecies(creature.speciesId);
  const out = new Set<CreatureType>(spec.types);
  if (creature.vesselCalibration?.affinityOverride) {
    out.add(creature.vesselCalibration.affinityOverride);
  }
  return Array.from(out);
}

export function canCreatureLearnMove(creature: CreatureInstance, moveId: string): boolean {
  const move = MOVES[moveId];
  if (!move) return false;
  if (move.type === 'comun') return true;
  const spec = getSpecies(creature.speciesId);
  if (spec.types.includes(move.type)) return true;
  if (creature.vesselCalibration?.affinityOverride === move.type) return true;
  return spec.learnset.some((entry) => entry.moveId === moveId);
}

export function teachMoveToCreature(
  creature: CreatureInstance,
  moveId: string,
  replaceSlotIndex?: number
): { ok: boolean; reason?: 'invalid_move' | 'already_known' | 'need_slot'; replacedMoveId?: string } {
  if (!MOVES[moveId]) return { ok: false, reason: 'invalid_move' };
  if (creature.moves.some((m) => m.moveId === moveId)) {
    return { ok: false, reason: 'already_known' };
  }
  const def = getMove(moveId);
  if (creature.moves.length < 4) {
    creature.moves.push({ moveId, pp: def.pp, maxPp: def.pp });
    return { ok: true };
  }
  if (
    replaceSlotIndex === undefined ||
    replaceSlotIndex < 0 ||
    replaceSlotIndex >= creature.moves.length
  ) {
    return { ok: false, reason: 'need_slot' };
  }
  const replacedMoveId = creature.moves[replaceSlotIndex].moveId;
  creature.moves[replaceSlotIndex] = { moveId, pp: def.pp, maxPp: def.pp };
  return { ok: true, replacedMoveId };
}

export function getRelearnableMoves(creature: CreatureInstance): MoveDef[] {
  const spec = getSpecies(creature.speciesId);
  const known = new Set(creature.moves.map((m) => m.moveId));
  const seen = new Set<string>();
  const out: MoveDef[] = [];

  for (const entry of spec.learnset) {
    if (entry.level <= creature.level && !known.has(entry.moveId) && !seen.has(entry.moveId)) {
      const def = MOVES[entry.moveId];
      if (def) {
        seen.add(entry.moveId);
        out.push(def);
      }
    }
  }
  return out;
}

export function relearnCreatureMove(
  save: SaveData,
  creature: CreatureInstance,
  moveId: string,
  replaceSlotIndex?: number
): {
  ok: boolean;
  reason?: 'not_eligible' | 'already_known' | 'need_slot' | 'no_money';
  moveName?: string;
  replacedMoveName?: string;
} {
  const eligible = getRelearnableMoves(creature);
  if (!eligible.some((m) => m.id === moveId)) {
    const known = creature.moves.some((m) => m.moveId === moveId);
    return { ok: false, reason: known ? 'already_known' : 'not_eligible' };
  }
  if (save.money < RELEARN_MOVE_COST.gold) {
    return { ok: false, reason: 'no_money' };
  }
  const res = teachMoveToCreature(creature, moveId, replaceSlotIndex);
  if (!res.ok) {
    return { ok: false, reason: res.reason === 'need_slot' ? 'need_slot' : 'already_known' };
  }
  save.money -= RELEARN_MOVE_COST.gold;
  return {
    ok: true,
    moveName: getMove(moveId).name,
    replacedMoveName: res.replacedMoveId ? getMove(res.replacedMoveId).name : undefined,
  };
}

function classifyMoveTier(move: MoveDef): {
  tier: MoveForgeTier;
  goldCost: number;
  dustCost: number;
  requiredLevel: number;
} {
  if (move.power >= 90) {
    return { tier: 'maestro', goldCost: 380, dustCost: 34, requiredLevel: 16 };
  }
  if (move.power >= 60 || move.id === 'recuperacion' || move.id === 'forja_interna') {
    return { tier: 'avanzado', goldCost: 220, dustCost: 18, requiredLevel: 9 };
  }
  return { tier: 'basico', goldCost: 120, dustCost: 10, requiredLevel: 1 };
}

export function getForgeableMovesForCreature(
  save: SaveData,
  creature: CreatureInstance
): ForgeableMoveOption[] {
  const spec = getSpecies(creature.speciesId);
  const known = new Set(creature.moves.map((m) => m.moveId));
  const runeType = creature.vesselCalibration?.affinityOverride;
  const hasSpeciesCard = (save.cardAlbum?.[creature.speciesId]?.count ?? 0) > 0;
  const badges = save.badges.length;

  const options: ForgeableMoveOption[] = [];

  for (const move of Object.values(MOVES)) {
    if (known.has(move.id)) continue;
    const isSpeciesType = spec.types.includes(move.type);
    const isCommon = move.type === 'comun';
    const viaRune = Boolean(runeType && move.type === runeType && !isSpeciesType && !isCommon);
    if (!isSpeciesType && !isCommon && !viaRune) continue;

    const meta = classifyMoveTier(move);
    const effectiveMinLevel = hasSpeciesCard
      ? Math.max(1, meta.requiredLevel - 5)
      : meta.requiredLevel;
    const unlockedByLevel = creature.level >= effectiveMinLevel;
    const unlockedByBadges = meta.tier === 'maestro' ? badges >= 1 || hasSpeciesCard : true;
    const unlocked = unlockedByLevel && unlockedByBadges;

    let reasonLocked: string | undefined;
    if (!unlocked) {
      if (!unlockedByLevel) {
        reasonLocked = `Requiere Nv.${effectiveMinLevel}${hasSpeciesCard ? ' (ya rebajado por Carta)' : ''}`;
      } else if (!unlockedByBadges) {
        reasonLocked = `Requiere 1 Medalla o Carta de ${spec.name}`;
      }
    }

    options.push({
      move,
      tier: meta.tier,
      goldCost: meta.goldCost,
      dustCost: meta.dustCost,
      requiredLevel: effectiveMinLevel,
      unlocked,
      unlockedByCard: hasSpeciesCard && creature.level < meta.requiredLevel && unlocked,
      reasonLocked,
      viaRune,
      tmItemId: TM_ID_BY_MOVE[move.id],
    });
  }

  const tierRank: Record<MoveForgeTier, number> = { basico: 0, avanzado: 1, maestro: 2 };
  options.sort((a, b) => {
    if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
    if (a.viaRune !== b.viaRune) return a.viaRune ? -1 : 1;
    if (tierRank[a.tier] !== tierRank[b.tier]) return tierRank[a.tier] - tierRank[b.tier];
    return b.move.power - a.move.power || a.move.name.localeCompare(b.move.name);
  });
  return options;
}

export function forgeMoveOnCreature(
  save: SaveData,
  creature: CreatureInstance,
  moveId: string,
  replaceSlotIndex?: number
): {
  ok: boolean;
  reason?: 'locked' | 'already_known' | 'need_slot' | 'no_money' | 'no_dust' | 'not_compatible';
  moveName?: string;
  replacedMoveName?: string;
} {
  ensureSoulDust(save);
  if (creature.moves.some((m) => m.moveId === moveId)) {
    return { ok: false, reason: 'already_known' };
  }
  const opt = getForgeableMovesForCreature(save, creature).find((o) => o.move.id === moveId);
  if (!opt) return { ok: false, reason: 'not_compatible' };
  if (!opt.unlocked) return { ok: false, reason: 'locked' };
  if (save.money < opt.goldCost) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < opt.dustCost) return { ok: false, reason: 'no_dust' };

  const res = teachMoveToCreature(creature, moveId, replaceSlotIndex);
  if (!res.ok) {
    return { ok: false, reason: res.reason === 'need_slot' ? 'need_slot' : 'already_known' };
  }

  save.money -= opt.goldCost;
  if (opt.dustCost > 0) addSoulDust(save, -opt.dustCost);
  return {
    ok: true,
    moveName: opt.move.name,
    replacedMoveName: res.replacedMoveId ? getMove(res.replacedMoveId).name : undefined,
  };
}

export function craftTmScrollAtWorkshop(
  save: SaveData,
  tmItemId: string
): {
  ok: boolean;
  reason?: 'invalid' | 'no_money' | 'no_dust';
  itemName?: string;
} {
  ensureSoulDust(save);
  const recipe = TALLER_CRAFTABLE_TMS.find((t) => t.itemId === tmItemId);
  if (!recipe || !ITEMS[tmItemId]) {
    return { ok: false, reason: 'invalid' };
  }
  if (save.money < recipe.goldCost) {
    return { ok: false, reason: 'no_money' };
  }
  if (getSoulDust(save) < recipe.dustCost) {
    return { ok: false, reason: 'no_dust' };
  }
  save.money -= recipe.goldCost;
  addSoulDust(save, -recipe.dustCost);
  addItem(save.bag, tmItemId, 1);
  return { ok: true, itemName: getItem(tmItemId).name };
}

export function getCreatureUnlockedAbilities(creature: CreatureInstance): string[] {
  const out = new Set<string>();
  const spec = getSpecies(creature.speciesId);
  if (creature.abilityId && ABILITIES[creature.abilityId]) {
    out.add(creature.abilityId);
  } else if (spec.abilities[0]) {
    out.add(spec.abilities[0]);
  }
  for (const id of creature.unlockedAbilities ?? []) {
    if (ABILITIES[id]) out.add(id);
  }
  return Array.from(out);
}

export function getAvailableAbilitiesForCreature(
  creature: CreatureInstance
): AvailableAbilityOption[] {
  const spec = getSpecies(creature.speciesId);
  const currentId = creature.abilityId ?? spec.abilities[0];
  const unlockedSet = new Set(getCreatureUnlockedAbilities(creature));
  const runeType = creature.vesselCalibration?.affinityOverride;

  const seen = new Set<string>();
  const options: AvailableAbilityOption[] = [];

  const pushOption = (abilityId: string, source: 'innate' | 'forged' | 'rune') => {
    if (seen.has(abilityId)) return;
    const ability = ABILITIES[abilityId];
    if (!ability) return;
    seen.add(abilityId);

    const unlocked = unlockedSet.has(abilityId);
    const active = currentId === abilityId;
    const cost = active
      ? { gold: 0, dust: 0 }
      : unlocked
        ? PASSIVE_SWAP_COST
        : source === 'innate'
          ? PASSIVE_INNATE_UNLOCK_COST
          : PASSIVE_FORGE_COST;

    options.push({
      ability,
      source,
      unlocked,
      active,
      goldCost: cost.gold,
      dustCost: cost.dust,
    });
  };

  for (const id of spec.abilities) {
    pushOption(id, 'innate');
  }
  for (const t of spec.types) {
    for (const id of TYPE_FORGE_ABILITIES[t] ?? []) {
      pushOption(id, 'forged');
    }
  }
  if (runeType && !spec.types.includes(runeType)) {
    for (const id of TYPE_FORGE_ABILITIES[runeType] ?? []) {
      pushOption(id, 'rune');
    }
  }
  for (const id of UNIVERSAL_FORGE_ABILITIES) {
    pushOption(id, 'forged');
  }

  return options;
}

export function unlockOrSetCreatureAbility(
  save: SaveData,
  creature: CreatureInstance,
  abilityId: string
): {
  ok: boolean;
  reason?: 'invalid' | 'already_active' | 'no_money' | 'no_dust';
  abilityName?: string;
  newlyForged?: boolean;
} {
  ensureSoulDust(save);
  const opt = getAvailableAbilitiesForCreature(creature).find((o) => o.ability.id === abilityId);
  if (!opt) return { ok: false, reason: 'invalid' };
  if (opt.active) return { ok: false, reason: 'already_active' };
  if (save.money < opt.goldCost) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < opt.dustCost) return { ok: false, reason: 'no_dust' };

  save.money -= opt.goldCost;
  if (opt.dustCost > 0) addSoulDust(save, -opt.dustCost);

  const unlocked = new Set(getCreatureUnlockedAbilities(creature));
  const newlyForged = !opt.unlocked;
  unlocked.add(abilityId);
  creature.unlockedAbilities = Array.from(unlocked);
  creature.abilityId = abilityId;

  return {
    ok: true,
    abilityName: opt.ability.name,
    newlyForged,
  };
}

export function getEvTotal(creature: CreatureInstance): number {
  const ev = creature.evBonuses;
  if (!ev) return 0;
  let sum = 0;
  for (const s of ALL_STAT_NAMES) {
    sum += Math.max(0, Math.floor(ev[s] ?? 0));
  }
  return sum;
}

export function getRemainingEvBudget(creature: CreatureInstance): number {
  return Math.max(0, MAX_EV_TOTAL - getEvTotal(creature));
}

export function applyEvBonusToCreature(
  creature: CreatureInstance,
  stat: StatName,
  delta: number
): { applied: boolean; added: number; newStatValue: number } {
  if (delta <= 0) {
    return { applied: false, added: 0, newStatValue: creature.evBonuses?.[stat] ?? 0 };
  }
  const current = Math.max(0, Math.floor(creature.evBonuses?.[stat] ?? 0));
  const statRoom = Math.max(0, MAX_EV_PER_STAT - current);
  const totalRoom = getRemainingEvBudget(creature);
  const added = Math.min(Math.floor(delta), statRoom, totalRoom);
  if (added <= 0) {
    return { applied: false, added: 0, newStatValue: current };
  }
  if (!creature.evBonuses) creature.evBonuses = {};
  creature.evBonuses[stat] = current + added;
  recalculateCreatureStats(creature);
  return { applied: true, added, newStatValue: creature.evBonuses[stat]! };
}

export function trainCreatureAttribute(
  save: SaveData,
  creature: CreatureInstance,
  stat: StatName
): {
  ok: boolean;
  reason?: 'stat_capped' | 'total_capped' | 'no_money' | 'no_dust';
  added?: number;
  dollName?: string;
} {
  ensureSoulDust(save);
  const current = Math.max(0, Math.floor(creature.evBonuses?.[stat] ?? 0));
  if (current >= MAX_EV_PER_STAT) {
    return { ok: false, reason: 'stat_capped' };
  }
  if (getRemainingEvBudget(creature) <= 0) {
    return { ok: false, reason: 'total_capped' };
  }
  if (save.money < EV_TRAIN_COST.gold) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < EV_TRAIN_COST.dust) return { ok: false, reason: 'no_dust' };

  const res = applyEvBonusToCreature(creature, stat, EV_TRAIN_STEP);
  if (!res.applied) {
    return { ok: false, reason: 'total_capped' };
  }
  save.money -= EV_TRAIN_COST.gold;
  addSoulDust(save, -EV_TRAIN_COST.dust);

  return {
    ok: true,
    added: res.added,
    dollName: getCreatureDisplayName(creature),
  };
}

export function forgeCreatureIvBoost(
  save: SaveData,
  creature: CreatureInstance,
  stat: StatName
): {
  ok: boolean;
  reason?: 'iv_max' | 'no_money' | 'no_dust';
  newIv?: number;
  dollName?: string;
} {
  ensureSoulDust(save);
  if (creature.ivs[stat] >= MAX_IV) {
    return { ok: false, reason: 'iv_max' };
  }
  if (save.money < IV_FORGE_COST.gold) return { ok: false, reason: 'no_money' };
  if (getSoulDust(save) < IV_FORGE_COST.dust) return { ok: false, reason: 'no_dust' };

  save.money -= IV_FORGE_COST.gold;
  addSoulDust(save, -IV_FORGE_COST.dust);
  creature.ivs[stat] = Math.min(MAX_IV, creature.ivs[stat] + 1);
  recalculateCreatureStats(creature);

  return {
    ok: true,
    newIv: creature.ivs[stat],
    dollName: getCreatureDisplayName(creature),
  };
}
