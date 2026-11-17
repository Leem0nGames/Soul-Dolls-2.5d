import type { Rng } from '../core/Rng.ts';
import { getSpecies } from '../data/species.ts';
import {
  computeIncomingAbilityEffect,
  computeOutgoingAbilityMultiplier,
} from './Abilities.ts';
import { computeHeldDamageMultiplier } from './HeldItems.ts';
import { getTypeMultiplier } from './TypeChart.ts';
import type {
  AbilityDef,
  BattleWeather,
  CreatureInstance,
  ItemDef,
  MoveDef,
  StatStages,
} from './types.ts';

export function stageMultiplier(stage: number): number {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

export function createDefaultStages(): StatStages {
  return { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
}

export interface DamageResult {
  damage: number;
  effectiveness: number;
  crit: boolean;
  stab: boolean;
  immuneHealRatio: number;
  triggeredAttackerAbility: AbilityDef | null;
  triggeredDefenderAbility: AbilityDef | null;
  triggeredHeldItem: ItemDef | null;
}

export function calculateDamage(
  attacker: CreatureInstance,
  defender: CreatureInstance,
  attackerStages: StatStages,
  defenderStages: StatStages,
  move: MoveDef,
  rng: Rng,
  weather: BattleWeather = 'none'
): DamageResult {
  if (move.category === 'status' || move.power <= 0) {
    return {
      damage: 0,
      effectiveness: 1,
      crit: false,
      stab: false,
      immuneHealRatio: 0,
      triggeredAttackerAbility: null,
      triggeredDefenderAbility: null,
      triggeredHeldItem: null,
    };
  }

  const attackerSpecies = getSpecies(attacker.speciesId);
  const defenderSpecies = getSpecies(defender.speciesId);

  const effectiveness = getTypeMultiplier(move.type, defenderSpecies.types);
  if (effectiveness === 0) {
    return {
      damage: 0,
      effectiveness: 0,
      crit: false,
      stab: false,
      immuneHealRatio: 0,
      triggeredAttackerAbility: null,
      triggeredDefenderAbility: null,
      triggeredHeldItem: null,
    };
  }

  const incomingAb = computeIncomingAbilityEffect(defender, move, effectiveness);
  if (incomingAb.damageMultiplier === 0) {
    return {
      damage: 0,
      effectiveness: 0,
      crit: false,
      stab: false,
      immuneHealRatio: incomingAb.immuneHealRatio,
      triggeredAttackerAbility: null,
      triggeredDefenderAbility: incomingAb.triggeredAbility,
      triggeredHeldItem: null,
    };
  }

  const critChance = (move.critRatio ?? 1) / 16;
  const crit = rng.next() < critChance;
  const isPhysical = move.category === 'physical';

  const atkStage = isPhysical ? attackerStages.atk : attackerStages.spa;
  const defStage = isPhysical ? defenderStages.def : defenderStages.spd;

  const effAtkStage = crit && atkStage < 0 ? 0 : atkStage;
  const effDefStage = crit && defStage > 0 ? 0 : defStage;

  let A = (isPhysical ? attacker.stats.atk : attacker.stats.spa) * stageMultiplier(effAtkStage);
  let D = Math.max(
    1,
    (isPhysical ? defender.stats.def : defender.stats.spd) * stageMultiplier(effDefStage)
  );

  if (!isPhysical && weather === 'sandstorm' && defenderSpecies.types.includes('roca')) {
    D *= 1.3;
  } else if (
    isPhysical &&
    weather === 'snow' &&
    (defenderSpecies.types.includes('marea') || defenderSpecies.types.includes('brisa'))
  ) {
    D *= 1.2;
  }

  if (isPhysical && attacker.status === 'burn') {
    A *= 0.5;
  }

  const base = Math.floor(
    (Math.floor((2 * attacker.level) / 5 + 2) * move.power * (A / D)) / 50 + 2
  );

  const stab = attackerSpecies.types.includes(move.type);
  const stabMult = stab ? 1.5 : 1;
  const critMult = crit ? 1.5 : 1;
  const randMult = 0.85 + rng.next() * 0.15;

  let weatherMult = 1;
  if (weather === 'sun') {
    if (move.type === 'brasa') weatherMult = 1.35;
    else if (move.type === 'marea') weatherMult = 0.65;
  } else if (weather === 'rain') {
    if (move.type === 'marea') weatherMult = 1.35;
    else if (move.type === 'brasa') weatherMult = 0.65;
  }

  const outAb = computeOutgoingAbilityMultiplier(attacker, move);
  const heldMod = computeHeldDamageMultiplier(attacker, move);

  const raw = Math.floor(
    base *
      stabMult *
      weatherMult *
      effectiveness *
      critMult *
      randMult *
      outAb.multiplier *
      heldMod.multiplier *
      incomingAb.damageMultiplier
  );

  return {
    damage: Math.max(1, raw),
    effectiveness,
    crit,
    stab,
    immuneHealRatio: 0,
    triggeredAttackerAbility: outAb.triggeredAbility,
    triggeredDefenderAbility: incomingAb.triggeredAbility,
    triggeredHeldItem: heldMod.item,
  };
}
