import type { CreatureInstance, Stats } from './types.ts';
import { recalculateCreatureStats } from './Creature.ts';

export interface TalentNodeDef {
  id: string;
  name: string;
  category: 'offense' | 'defense' | 'utility';
  tier: number;
  cost: number;
  description: string;
  bonus: Partial<Stats>;
  prerequisiteId?: string;
}

export const SOULDOLL_TALENT_TREE: TalentNodeDef[] = [
  // Tier 1
  {
    id: 'fierce_strikes',
    name: 'Golpes Feroces I',
    category: 'offense',
    tier: 1,
    cost: 1,
    description: 'Aumenta el Ataque físico base de la marioneta un 6%.',
    bonus: { atk: 4 },
  },
  {
    id: 'iron_plating',
    name: 'Blindaje de Bronce I',
    category: 'defense',
    tier: 1,
    cost: 1,
    description: 'Refuerza la Defensa física con placas densas (+6 Def).',
    bonus: { def: 6 },
  },
  {
    id: 'swift_servos',
    name: 'Servos Ágiles I',
    category: 'utility',
    tier: 1,
    cost: 1,
    description: 'Optimiza los engranajes para mayor Velocidad (+5 Spe).',
    bonus: { spe: 5 },
  },
  // Tier 2
  {
    id: 'arcane_focus',
    name: 'Enfoque Arcano II',
    category: 'offense',
    tier: 2,
    cost: 2,
    description: 'Sintoniza el núcleo con energía espiritual pura (+8 SpA).',
    bonus: { spa: 8 },
    prerequisiteId: 'fierce_strikes',
  },
  {
    id: 'vital_core',
    name: 'Núcleo Vital II',
    category: 'defense',
    tier: 2,
    cost: 2,
    description: 'Expande el contenedor de HP máximo (+15 HP).',
    bonus: { hp: 15 },
    prerequisiteId: 'iron_plating',
  },
  {
    id: 'warding_aura',
    name: 'Aura Defensiva II',
    category: 'defense',
    tier: 2,
    cost: 2,
    description: 'Disipa las ondas hostiles aumentanto la Defensa Especial (+7 SpD).',
    bonus: { spd: 7 },
    prerequisiteId: 'iron_plating',
  },
  // Tier 3 (Mastery)
  {
    id: 'master_artisan',
    name: 'Maestría del Artífice III',
    category: 'offense',
    tier: 3,
    cost: 3,
    description: 'Poder absoluto en ataque y velocidad (+10 Atk, +8 Spe).',
    bonus: { atk: 10, spe: 8 },
    prerequisiteId: 'arcane_focus',
  },
  {
    id: 'eternal_vessel',
    name: 'Contenedor Eterno III',
    category: 'defense',
    tier: 3,
    cost: 3,
    description: 'Resistencia legendaria del núcleo vital (+25 HP, +10 Def).',
    bonus: { hp: 25, def: 10 },
    prerequisiteId: 'vital_core',
  },
];

export function getAvailableTalentPoints(creature: CreatureInstance): number {
  const level = creature.level;
  const earned = Math.max(0, level - 1); // 1 point per level past 1
  const unlocked = creature.unlockedTalents ?? [];
  let spent = 0;
  for (const tid of unlocked) {
    const node = SOULDOLL_TALENT_TREE.find((n) => n.id === tid);
    if (node) spent += node.cost;
  }
  return Math.max(0, earned - spent);
}

export function unlockCreatureTalent(
  creature: CreatureInstance,
  talentId: string
): { ok: boolean; reason?: 'not_found' | 'already_unlocked' | 'no_points' | 'missing_prerequisite' } {
  const node = SOULDOLL_TALENT_TREE.find((n) => n.id === talentId);
  if (!node) return { ok: false, reason: 'not_found' };

  if (!creature.unlockedTalents) creature.unlockedTalents = [];
  if (creature.unlockedTalents.includes(talentId)) {
    return { ok: false, reason: 'already_unlocked' };
  }

  if (node.prerequisiteId && !creature.unlockedTalents.includes(node.prerequisiteId)) {
    return { ok: false, reason: 'missing_prerequisite' };
  }

  const available = getAvailableTalentPoints(creature);
  if (available < node.cost) {
    return { ok: false, reason: 'no_points' };
  }

  creature.unlockedTalents.push(talentId);
  recalculateCreatureStats(creature);
  return { ok: true };
}

export function getTalentStatBonuses(creature: CreatureInstance): Stats {
  const totals: Stats = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  const unlocked = creature.unlockedTalents ?? [];
  for (const tid of unlocked) {
    const node = SOULDOLL_TALENT_TREE.find((n) => n.id === tid);
    if (node && node.bonus) {
      if (node.bonus.hp) totals.hp += node.bonus.hp;
      if (node.bonus.atk) totals.atk += node.bonus.atk;
      if (node.bonus.def) totals.def += node.bonus.def;
      if (node.bonus.spa) totals.spa += node.bonus.spa;
      if (node.bonus.spd) totals.spd += node.bonus.spd;
      if (node.bonus.spe) totals.spe += node.bonus.spe;
    }
  }
  return totals;
}
