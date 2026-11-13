import type { EncounterTable } from '../domain/types.ts';

export const ENCOUNTERS: Record<string, EncounterTable> = {
  ruta_1: {
    rate: 0.16,
    entries: [
      { speciesId: 10, minLevel: 2, maxLevel: 5, weight: 28 },
      { speciesId: 16, minLevel: 2, maxLevel: 5, weight: 24 },
      { speciesId: 46, minLevel: 2, maxLevel: 5, weight: 24 },
      { speciesId: 37, minLevel: 3, maxLevel: 5, weight: 12 },
      { speciesId: 12, minLevel: 4, maxLevel: 6, weight: 12 },
    ],
  },
  ruta_2: {
    rate: 0.18,
    entries: [
      { speciesId: 12, minLevel: 9, maxLevel: 12, weight: 22 },
      { speciesId: 11, minLevel: 10, maxLevel: 12, weight: 18 },
      { speciesId: 48, minLevel: 9, maxLevel: 12, weight: 20 },
      { speciesId: 26, minLevel: 10, maxLevel: 12, weight: 16 },
      { speciesId: 14, minLevel: 10, maxLevel: 13, weight: 14 },
      { speciesId: 30, minLevel: 10, maxLevel: 13, weight: 10 },
    ],
  },
  cueva_eco: {
    rate: 0.15,
    entries: [
      { speciesId: 14, minLevel: 12, maxLevel: 16, weight: 32 },
      { speciesId: 43, minLevel: 12, maxLevel: 15, weight: 22 },
      { speciesId: 17, minLevel: 13, maxLevel: 16, weight: 20 },
      { speciesId: 40, minLevel: 13, maxLevel: 16, weight: 14 },
      { speciesId: 18, minLevel: 15, maxLevel: 17, weight: 8 },
      { speciesId: 45, minLevel: 15, maxLevel: 17, weight: 4 },
    ],
  },
};
