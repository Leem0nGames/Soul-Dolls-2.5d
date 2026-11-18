import type { CreatureType } from './types.ts';

const CHART: Record<CreatureType, Partial<Record<CreatureType, number>>> = {
  brasa: {
    flora: 2,
    brisa: 2,
    marea: 0.5,
    roca: 0.5,
    brasa: 0.5,
  },
  marea: {
    brasa: 2,
    roca: 2,
    flora: 0.5,
    marea: 0.5,
  },
  flora: {
    marea: 2,
    roca: 2,
    brasa: 0.5,
    brisa: 0.5,
    flora: 0.5,
  },
  chispa: {
    marea: 2,
    brisa: 2,
    flora: 0.5,
    chispa: 0.5,
    roca: 0,
  },
  roca: {
    brasa: 2,
    chispa: 2,
    brisa: 2,
    marea: 0.5,
    flora: 0.5,
  },
  brisa: {
    flora: 2,
    umbra: 2,
    chispa: 0.5,
    roca: 0.5,
  },
  umbra: {
    umbra: 2,
    flora: 2,
    brisa: 0.5,
    comun: 0,
  },
  comun: {
    roca: 0.5,
    umbra: 0,
  },
};

export function getTypeMultiplier(
  attackType: CreatureType,
  defenderTypes: readonly CreatureType[]
): number {
  let mult = 1;
  const row = CHART[attackType];
  for (const defType of defenderTypes) {
    const mod = row[defType];
    if (mod !== undefined) {
      mult *= mod;
    }
  }
  return mult;
}
