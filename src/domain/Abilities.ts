import { ABILITIES } from '../data/abilities.ts';
import { getSpecies } from '../data/species.ts';
import type {
  AbilityDef,
  BattleStatName,
  CreatureInstance,
  MoveDef,
  StatusCondition,
} from './types.ts';

export function resolveDeterministicAbility(
  speciesId: number,
  seedHint = 0
): string {
  const spec = getSpecies(speciesId);
  const pool = spec.abilities;
  if (!pool || pool.length === 0) return 'enfoque_puro';
  return pool[Math.abs(seedHint) % pool.length];
}

export function getCreatureAbilityDef(creature: CreatureInstance): AbilityDef | null {
  const id = creature.abilityId ?? getSpecies(creature.speciesId).abilities[0];
  return id ? ABILITIES[id] ?? null : null;
}

export function computeAbilityPriorityDelta(
  creature: CreatureInstance,
  move: MoveDef
): number {
  const ab = getCreatureAbilityDef(creature);
  if (!ab?.hooks.priorityBoost) return 0;
  const boost = ab.hooks.priorityBoost;
  if (boost.category && boost.category !== move.category) return 0;
  return boost.delta;
}

export function computeAbilityStatMultiplier(
  creature: CreatureInstance,
  stat: BattleStatName
): number {
  const ab = getCreatureAbilityDef(creature);
  const hook = ab?.hooks.modifyStat;
  if (!hook || hook.stat !== stat) return 1;
  if (hook.requiresStatus && creature.status === 'none') return 1;
  return hook.multiplier;
}

export function computeOutgoingAbilityMultiplier(
  attacker: CreatureInstance,
  move: MoveDef
): { multiplier: number; triggeredAbility: AbilityDef | null } {
  const ab = getCreatureAbilityDef(attacker);
  if (!ab) return { multiplier: 1, triggeredAbility: null };

  let multiplier = 1;
  let triggered: AbilityDef | null = null;

  const out = ab.hooks.modifyOutgoingDamage;
  if (out) {
    const lowOk = !out.requiresLowHp || attacker.currentHp <= attacker.stats.hp * 0.34;
    const typeOk = !out.type || out.type === move.type;
    if (lowOk && typeOk) {
      multiplier *= out.multiplier;
      triggered = ab;
    }
  }

  const low = ab.hooks.onLowHp;
  if (low && attacker.currentHp > 0 && attacker.currentHp <= attacker.stats.hp * low.thresholdRatio) {
    if ((!low.boostType || low.boostType === move.type) && low.damageMultiplier) {
      multiplier *= low.damageMultiplier;
      triggered = ab;
    }
  }

  return { multiplier, triggeredAbility: triggered };
}

export function computeIncomingAbilityEffect(
  defender: CreatureInstance,
  move: MoveDef,
  effectiveness: number
): {
  immuneHealRatio: number;
  damageMultiplier: number;
  triggeredAbility: AbilityDef | null;
} {
  const ab = getCreatureAbilityDef(defender);
  if (!ab?.hooks.modifyIncomingDamage) {
    return { immuneHealRatio: 0, damageMultiplier: 1, triggeredAbility: null };
  }
  const inc = ab.hooks.modifyIncomingDamage;
  if (inc.immuneType && inc.immuneType === move.type) {
    return {
      immuneHealRatio: inc.healRatioOnImmune ?? 0,
      damageMultiplier: 0,
      triggeredAbility: ab,
    };
  }
  if (inc.resistMultiplier && (!inc.superEffectiveOnly || effectiveness >= 2)) {
    return {
      immuneHealRatio: 0,
      damageMultiplier: inc.resistMultiplier,
      triggeredAbility: ab,
    };
  }
  return { immuneHealRatio: 0, damageMultiplier: 1, triggeredAbility: null };
}

export function isStatusBlockedByAbility(
  target: CreatureInstance,
  status: Exclude<StatusCondition, 'none'>
): AbilityDef | null {
  const ab = getCreatureAbilityDef(target);
  const imm = ab?.hooks.onStatusAttempt?.immuneStatuses;
  if (imm && imm.includes(status)) {
    return ab ?? null;
  }
  return null;
}
