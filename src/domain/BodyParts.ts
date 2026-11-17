import {
  ALL_CONTAINER_IDS,
  getBodyContainer,
  getDefaultContainerForTypes,
  SHARDS_PER_CONTAINER,
} from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import type {
  BodyPartName,
  BodyPartRatios,
  BodyPartsHp,
  CreatureInstance,
  CreatureType,
  MoveCategory,
  SaveData,
  Stats,
  VesselCalibration,
} from './types.ts';

export const BODY_PART_ORDER: readonly BodyPartName[] = ['head', 'torso', 'arms', 'legs'];

export const BODY_PART_LABELS: Record<BodyPartName, string> = {
  head: 'Cabeza',
  torso: 'Torso',
  arms: 'Brazos',
  legs: 'Piernas',
};

export const BODY_PART_SHORT: Record<BodyPartName, string> = {
  head: 'Cab',
  torso: 'Tor',
  arms: 'Bra',
  legs: 'Pie',
};

/**
 * Calcula porcentajes de vida entre Cabeza, Torso, Brazos y Piernas
 * combinando el Cuerpo Contenedor base con los IVs y EVs de la SoulDoll.
 */
export function computeBodyPartRatios(
  containerId: string,
  ivs: Stats,
  evBonuses?: Partial<Stats>,
  calibration?: VesselCalibration
): BodyPartRatios {
  const container = getBodyContainer(containerId);
  const evHp = evBonuses?.hp ?? 0;
  const evAtk = evBonuses?.atk ?? 0;
  const evDef = evBonuses?.def ?? 0;
  const evSpa = evBonuses?.spa ?? 0;
  const evSpd = evBonuses?.spd ?? 0;
  const evSpe = evBonuses?.spe ?? 0;

  // IVs (0..15) y EVs moldean el reparto anatómico del contenedor
  const focus = calibration?.focusPart;
  const rawHead = Math.max(
    8,
    container.ratios.head +
      (ivs.spa - 7) * 0.35 +
      (ivs.spd - 7) * 0.15 +
      (evSpa + evSpd) * 0.2 +
      (focus === 'head' ? 9 : focus ? -3 : 0)
  );
  const rawTorso = Math.max(
    15,
    container.ratios.torso +
      (ivs.hp - 7) * 0.4 +
      (ivs.def - 7) * 0.25 +
      (evHp + evDef) * 0.25 +
      (focus === 'torso' ? 9 : focus ? -3 : 0)
  );
  const rawArms = Math.max(
    8,
    container.ratios.arms +
      (ivs.atk - 7) * 0.35 +
      evAtk * 0.2 +
      (focus === 'arms' ? 9 : focus ? -3 : 0)
  );
  const rawLegs = Math.max(
    8,
    container.ratios.legs +
      (ivs.spe - 7) * 0.35 +
      evSpe * 0.2 +
      (focus === 'legs' ? 9 : focus ? -3 : 0)
  );

  const sum = rawHead + rawTorso + rawArms + rawLegs;
  const head = Math.round((rawHead / sum) * 100);
  const arms = Math.round((rawArms / sum) * 100);
  const legs = Math.round((rawLegs / sum) * 100);
  const torso = Math.max(10, 100 - head - arms - legs);

  return { head, torso, arms, legs };
}

export function buildBodyPartsHp(
  totalMaxHp: number,
  containerId: string,
  ivs: Stats,
  evBonuses?: Partial<Stats>,
  targetCurrentHp?: number,
  calibration?: VesselCalibration
): BodyPartsHp {
  const maxHp = Math.max(4, Math.floor(totalMaxHp));
  const ratios = computeBodyPartRatios(containerId, ivs, evBonuses, calibration);

  const headMax = Math.max(1, Math.floor((maxHp * ratios.head) / 100));
  const armsMax = Math.max(1, Math.floor((maxHp * ratios.arms) / 100));
  const legsMax = Math.max(1, Math.floor((maxHp * ratios.legs) / 100));
  const torsoMax = Math.max(1, maxHp - headMax - armsMax - legsMax);

  const hpTarget =
    targetCurrentHp === undefined ? maxHp : Math.max(0, Math.min(maxHp, Math.floor(targetCurrentHp)));

  if (hpTarget >= maxHp) {
    return {
      head: { current: headMax, max: headMax },
      torso: { current: torsoMax, max: torsoMax },
      arms: { current: armsMax, max: armsMax },
      legs: { current: legsMax, max: legsMax },
    };
  }

  if (hpTarget <= 0) {
    return {
      head: { current: 0, max: headMax },
      torso: { current: 0, max: torsoMax },
      arms: { current: 0, max: armsMax },
      legs: { current: 0, max: legsMax },
    };
  }

  // Distribute remaining HP proportionally
  const ratio = hpTarget / maxHp;
  let headCur = Math.min(headMax, Math.floor(headMax * ratio));
  let armsCur = Math.min(armsMax, Math.floor(armsMax * ratio));
  let legsCur = Math.min(legsMax, Math.floor(legsMax * ratio));
  let torsoCur = Math.min(torsoMax, hpTarget - headCur - armsCur - legsCur);

  let rem = hpTarget - (headCur + torsoCur + armsCur + legsCur);
  const caps: Array<{ key: BodyPartName; get: () => number; set: (v: number) => void; max: number }> = [
    { key: 'torso', get: () => torsoCur, set: (v) => (torsoCur = v), max: torsoMax },
    { key: 'head', get: () => headCur, set: (v) => (headCur = v), max: headMax },
    { key: 'arms', get: () => armsCur, set: (v) => (armsCur = v), max: armsMax },
    { key: 'legs', get: () => legsCur, set: (v) => (legsCur = v), max: legsMax },
  ];
  while (rem > 0) {
    let progressed = false;
    for (const c of caps) {
      if (rem <= 0) break;
      if (c.get() < c.max) {
        c.set(c.get() + 1);
        rem -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }

  return {
    head: { current: headCur, max: headMax },
    torso: { current: torsoCur, max: torsoMax },
    arms: { current: armsCur, max: armsMax },
    legs: { current: legsCur, max: legsMax },
  };
}

export function ensureBodyParts(creature: CreatureInstance): BodyPartsHp {
  if (!creature.containerId) {
    const spec = getSpecies(creature.speciesId);
    creature.containerId = getDefaultContainerForTypes(spec.types);
  }
  if (!creature.bodyParts) {
    creature.bodyParts = buildBodyPartsHp(
      creature.stats.hp,
      creature.containerId,
      creature.ivs,
      creature.evBonuses,
      creature.currentHp,
      creature.vesselCalibration
    );
  }
  return creature.bodyParts;
}

export function sumBodyPartsCurrent(parts: BodyPartsHp): number {
  return parts.head.current + parts.torso.current + parts.arms.current + parts.legs.current;
}

export function syncBodyPartsFull(creature: CreatureInstance): void {
  const containerId =
    creature.containerId ?? getDefaultContainerForTypes(getSpecies(creature.speciesId).types);
  creature.containerId = containerId;
  creature.bodyParts = buildBodyPartsHp(
    creature.stats.hp,
    containerId,
    creature.ivs,
    creature.evBonuses,
    creature.stats.hp,
    creature.vesselCalibration
  );
  creature.currentHp = creature.stats.hp;
}

export function pickTargetBodyPart(
  category: MoveCategory,
  roll01: number
): BodyPartName {
  if (category === 'physical') {
    if (roll01 < 0.34) return 'torso';
    if (roll01 < 0.64) return 'arms';
    if (roll01 < 0.86) return 'legs';
    return 'head';
  }
  if (category === 'special') {
    if (roll01 < 0.36) return 'head';
    if (roll01 < 0.72) return 'torso';
    if (roll01 < 0.88) return 'arms';
    return 'legs';
  }
  return 'torso';
}

export function applyDamageToBodyParts(
  creature: CreatureInstance,
  damageAmount: number,
  preferredPart: BodyPartName = 'torso'
): { actualDamage: number; damagedPart: BodyPartName; partBroken?: BodyPartName } {
  const parts = ensureBodyParts(creature);
  const prevTotal = sumBodyPartsCurrent(parts);
  const totalToDeal = Math.max(0, Math.min(prevTotal, Math.floor(damageAmount)));
  if (totalToDeal <= 0) {
    creature.currentHp = prevTotal;
    return { actualDamage: 0, damagedPart: preferredPart };
  }

  const order: BodyPartName[] = [
    preferredPart,
    ...(['torso', 'arms', 'legs', 'head'] as BodyPartName[]).filter((p) => p !== preferredPart),
  ];

  let rem = totalToDeal;
  let primaryHit: BodyPartName = preferredPart;
  let firstBroken: BodyPartName | undefined;

  for (const part of order) {
    if (rem <= 0) break;
    const p = parts[part];
    if (p.current <= 0) continue;
    if (rem === totalToDeal) primaryHit = part;
    const hit = Math.min(p.current, rem);
    p.current -= hit;
    rem -= hit;
    if (p.current === 0 && !firstBroken && part !== 'torso') {
      firstBroken = part;
    }
  }

  creature.currentHp = sumBodyPartsCurrent(parts);
  return {
    actualDamage: prevTotal - creature.currentHp,
    damagedPart: primaryHit,
    partBroken: creature.currentHp > 0 ? firstBroken : undefined,
  };
}

export function healBodyParts(creature: CreatureInstance, healAmount: number): number {
  const parts = ensureBodyParts(creature);
  const prevTotal = sumBodyPartsCurrent(parts);
  let rem = Math.max(0, Math.min(creature.stats.hp - prevTotal, Math.floor(healAmount)));
  if (rem <= 0) {
    creature.currentHp = prevTotal;
    return 0;
  }

  // Heal torso first, then head, arms, legs in small balanced steps
  const order: BodyPartName[] = ['torso', 'head', 'arms', 'legs'];
  while (rem > 0) {
    let moved = false;
    for (const key of order) {
      if (rem <= 0) break;
      const p = parts[key];
      if (p.current < p.max) {
        p.current += 1;
        rem -= 1;
        moved = true;
      }
    }
    if (!moved) break;
  }

  creature.currentHp = sumBodyPartsCurrent(parts);
  return creature.currentHp - prevTotal;
}

export function rebindCreatureContainer(
  creature: CreatureInstance,
  newContainerId: string,
  calibration?: VesselCalibration
): void {
  creature.containerId = getBodyContainer(newContainerId).id;
  if (calibration !== undefined) {
    creature.vesselCalibration = calibration;
  }
  creature.bodyParts = buildBodyPartsHp(
    creature.stats.hp,
    creature.containerId,
    creature.ivs,
    creature.evBonuses,
    creature.currentHp,
    creature.vesselCalibration
  );
}

export interface ContainerAffinityMatch {
  matchedTypes: CreatureType[];
  effectiveAffinities: CreatureType[];
  level: 'none' | 'partial' | 'full';
  hasRuneOverride: boolean;
}

export function getContainerAffinityMatch(
  creature: CreatureInstance,
  containerIdOverride?: string,
  calibrationOverride?: VesselCalibration
): ContainerAffinityMatch {
  const spec = getSpecies(creature.speciesId);
  const cdef = getBodyContainer(containerIdOverride ?? creature.containerId ?? getDefaultContainerForTypes(spec.types));
  const cal = calibrationOverride ?? creature.vesselCalibration;
  const effectiveAffinities: CreatureType[] = [...cdef.affinityTypes];
  const hasRuneOverride = Boolean(cal?.affinityOverride && !effectiveAffinities.includes(cal.affinityOverride));
  if (cal?.affinityOverride && !effectiveAffinities.includes(cal.affinityOverride)) {
    effectiveAffinities.push(cal.affinityOverride);
  }
  const matchedTypes = spec.types.filter((t) => effectiveAffinities.includes(t));
  const level: 'none' | 'partial' | 'full' =
    matchedTypes.length === 0
      ? 'none'
      : matchedTypes.length >= spec.types.length
        ? 'full'
        : 'partial';
  return {
    matchedTypes,
    effectiveAffinities,
    level,
    hasRuneOverride,
  };
}

export function ensureSaveVesselState(save: SaveData): void {
  if (!save.vessels) save.vessels = {};
  if (!save.bodyPartShards) save.bodyPartShards = {};
  if (!save.soulReserve) save.soulReserve = [];
}

export function addVessel(save: SaveData, containerId: string, qty = 1): void {
  ensureSaveVesselState(save);
  const id = getBodyContainer(containerId).id;
  save.vessels![id] = (save.vessels![id] ?? 0) + qty;
}

export function consumeVessel(save: SaveData, containerId: string): boolean {
  ensureSaveVesselState(save);
  const cur = save.vessels![containerId] ?? 0;
  if (cur <= 0) return false;
  if (cur === 1) delete save.vessels![containerId];
  else save.vessels![containerId] = cur - 1;
  return true;
}

export function getTotalVesselCount(save: SaveData): number {
  ensureSaveVesselState(save);
  return Object.values(save.vessels!).reduce((s, n) => s + Math.max(0, n), 0);
}

export function pickBestVesselForSpecies(save: SaveData, speciesId: number): string | null {
  ensureSaveVesselState(save);
  const spec = getSpecies(speciesId);
  const preferred = getDefaultContainerForTypes(spec.types);
  if ((save.vessels![preferred] ?? 0) > 0) return preferred;
  if ((save.vessels!.cuerpo_aprendiz ?? 0) > 0) return 'cuerpo_aprendiz';
  for (const id of ALL_CONTAINER_IDS) {
    if ((save.vessels![id] ?? 0) > 0) return id;
  }
  return null;
}

export function addBodyPartShard(
  save: SaveData,
  containerId: string,
  count = 1
): { currentShards: number; assembledCount: number } {
  ensureSaveVesselState(save);
  const id = getBodyContainer(containerId).id;
  const total = (save.bodyPartShards![id] ?? 0) + count;
  const assembledCount = Math.floor(total / SHARDS_PER_CONTAINER);
  const rem = total % SHARDS_PER_CONTAINER;
  if (rem > 0) save.bodyPartShards![id] = rem;
  else delete save.bodyPartShards![id];
  if (assembledCount > 0) {
    addVessel(save, id, assembledCount);
  }
  return { currentShards: rem, assembledCount };
}
