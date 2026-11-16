import type { Rng } from '../core/Rng.ts';
import { getCardBonuses } from '../data/cards.ts';
import { getDefaultContainerForTypes } from '../data/containers.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { resolveDeterministicAbility } from './Abilities.ts';
import { buildBodyPartsHp, syncBodyPartsFull } from './BodyParts.ts';
import type { CreatureInstance, GrowthRate, MoveSlot, Stats } from './types.ts';

export function xpForLevel(level: number, growthRate: GrowthRate): number {
  const lv = Math.max(1, Math.min(100, Math.floor(level)));
  if (lv <= 1) return 0;
  const n3 = lv * lv * lv;
  switch (growthRate) {
    case 'fast':
      return Math.floor(0.8 * n3);
    case 'medium':
      return n3;
    case 'slow':
      return Math.floor(1.25 * n3);
  }
}

export function calculateStats(
  base: Stats,
  ivs: Stats,
  level: number,
  evBonuses?: Partial<Stats>,
  cardBonuses?: Partial<Stats>
): Stats {
  const hpBonus = (evBonuses?.hp ?? 0) + (cardBonuses?.hp ?? 0);
  const hp = Math.floor(((2 * base.hp + ivs.hp) * level) / 100) + level + 10 + hpBonus;
  const calc = (b: number, iv: number, bonus = 0) =>
    Math.floor(((2 * b + iv) * level) / 100) + 5 + bonus;
  return {
    hp,
    atk: calc(base.atk, ivs.atk, (evBonuses?.atk ?? 0) + (cardBonuses?.atk ?? 0)),
    def: calc(base.def, ivs.def, (evBonuses?.def ?? 0) + (cardBonuses?.def ?? 0)),
    spa: calc(base.spa, ivs.spa, (evBonuses?.spa ?? 0) + (cardBonuses?.spa ?? 0)),
    spd: calc(base.spd, ivs.spd, (evBonuses?.spd ?? 0) + (cardBonuses?.spd ?? 0)),
    spe: calc(base.spe, ivs.spe, (evBonuses?.spe ?? 0) + (cardBonuses?.spe ?? 0)),
  };
}

let uidCounter = 1;

export function createCreature(
  speciesId: number,
  level: number,
  rng: Rng,
  containerId?: string
): CreatureInstance {
  const spec = getSpecies(speciesId);
  const clampedLevel = Math.max(1, Math.min(100, level));
  const ivs: Stats = {
    hp: rng.int(0, 15),
    atk: rng.int(0, 15),
    def: rng.int(0, 15),
    spa: rng.int(0, 15),
    spd: rng.int(0, 15),
    spe: rng.int(0, 15),
  };
  const stats = calculateStats(spec.baseStats, ivs, clampedLevel);
  const eligibleMoves = spec.learnset
    .filter((e) => e.level <= clampedLevel)
    .map((e) => e.moveId);
  const uniqueMoves = Array.from(new Set(eligibleMoves)).slice(-4);
  const moves: MoveSlot[] = uniqueMoves.map((moveId) => {
    const def = getMove(moveId);
    return { moveId, pp: def.pp, maxPp: def.pp };
  });

  const abilityId = resolveDeterministicAbility(
    speciesId,
    rng.int(0, Math.max(0, spec.abilities.length - 1))
  );
  const resolvedContainer = containerId ?? getDefaultContainerForTypes(spec.types);
  const bodyParts = buildBodyPartsHp(stats.hp, resolvedContainer, ivs, undefined, stats.hp);

  return {
    uid: `c_${speciesId}_${clampedLevel}_${uidCounter++}_${rng.int(1000, 9999)}`,
    speciesId,
    level: clampedLevel,
    xp: xpForLevel(clampedLevel, spec.growthRate),
    ivs,
    stats,
    currentHp: stats.hp,
    containerId: resolvedContainer,
    bodyParts,
    status: 'none',
    sleepTurns: 0,
    abilityId,
    moves,
  };
}

export function getCreatureDisplayName(creature: CreatureInstance): string {
  return creature.nickname ?? getSpecies(creature.speciesId).name;
}

export function healCreatureFull(creature: CreatureInstance): void {
  creature.currentHp = creature.stats.hp;
  syncBodyPartsFull(creature);
  creature.status = 'none';
  creature.sleepTurns = 0;
  for (const m of creature.moves) {
    m.pp = m.maxPp;
  }
}

export function recalculateCreatureStats(creature: CreatureInstance): void {
  const spec = getSpecies(creature.speciesId);
  const prevMax = creature.stats.hp;
  const cardBonuses =
    creature.socketedCardId !== undefined
      ? (creature.socketedCardBonuses ?? getCardBonuses(creature.socketedCardId))
      : undefined;
  const nextStats = calculateStats(
    spec.baseStats,
    creature.ivs,
    creature.level,
    creature.evBonuses,
    cardBonuses
  );
  const hpGain = Math.max(0, nextStats.hp - prevMax);
  creature.stats = nextStats;
  if (creature.currentHp > 0) {
    creature.currentHp = Math.min(nextStats.hp, Math.max(1, creature.currentHp + hpGain));
  }
  const containerId = creature.containerId ?? getDefaultContainerForTypes(spec.types);
  creature.containerId = containerId;
  creature.bodyParts = buildBodyPartsHp(
    nextStats.hp,
    containerId,
    creature.ivs,
    creature.evBonuses,
    creature.currentHp
  );
}
