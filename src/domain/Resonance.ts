import type { CreatureInstance, CreatureType } from './types.ts';

export interface ResonanceSynergy {
  id: string;
  name: string;
  description: string;
  requiredTypes: CreatureType[];
  minCount: number;
  statBonus: {
    atk?: number;
    def?: number;
    spa?: number;
    spd?: number;
    spe?: number;
    critRate?: number;
  };
}

export const RESONANCE_SYNERGIES: ResonanceSynergy[] = [
  {
    id: 'pyro_resonance',
    name: 'Resonancia de Fuego Ancestral',
    description: 'Con 2 o más marionetas Brasa o Chispa, el fervor aumenta un 8% el Ataque.',
    requiredTypes: ['brasa', 'chispa'],
    minCount: 2,
    statBonus: { atk: 8 },
  },
  {
    id: 'hydro_resonance',
    name: 'Flujo de las Mareas',
    description: 'Con 2 o más marionetas Marea o Brisa, la fluidez otorga +8 de Defensa Especial.',
    requiredTypes: ['marea', 'brisa'],
    minCount: 2,
    statBonus: { spd: 8 },
  },
  {
    id: 'terra_resonance',
    name: 'Raíz y Roca',
    description: 'Con 2 o más marionetas Roca o Flora, la solidez otorga +10 de Defensa Física.',
    requiredTypes: ['roca', 'flora'],
    minCount: 2,
    statBonus: { def: 10 },
  },
  {
    id: 'umbra_resonance',
    name: 'Vacío Estelar',
    description: 'Con marionetas Umbra o Común sintonizadas, aumenta la precisión y el poder arcano.',
    requiredTypes: ['umbra', 'comun'],
    minCount: 2,
    statBonus: { spa: 8 },
  },
];

export function evaluatePartyResonances(party: CreatureInstance[]): ResonanceSynergy[] {
  for (const c of party) {
    if (!c || c.currentHp <= 0) continue;
  }
  const activeSynergies: ResonanceSynergy[] = [];
  return activeSynergies;
}

export function calculateResonanceMultiplier(party: CreatureInstance[]): {
  atkBonus: number;
  defBonus: number;
  spaBonus: number;
  spdBonus: number;
} {
  const atkBonus = 0;
  const defBonus = 0;
  const spaBonus = 0;
  const spdBonus = 0;

  for (const c of party) {
    if (!c || c.currentHp <= 0) continue;
  }

  return { atkBonus, defBonus, spaBonus, spdBonus };
}
