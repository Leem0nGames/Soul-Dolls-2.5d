import type { EncounterTable } from '../domain/types.ts';

export const ENCOUNTERS: Record<string, EncounterTable> = {
  ruta_1: {
    rate: 0.22,
    entries: [
      { speciesId: 15, minLevel: 3, maxLevel: 5, weight: 52 },
      { speciesId: 10, minLevel: 2, maxLevel: 5, weight: 14, timeOfDay: ['morning', 'day'] },
      { speciesId: 16, minLevel: 2, maxLevel: 5, weight: 10 },
      { speciesId: 46, minLevel: 2, maxLevel: 5, weight: 10, timeOfDay: ['morning', 'day', 'dusk'] },
      { speciesId: 37, minLevel: 3, maxLevel: 5, weight: 8, timeOfDay: ['morning', 'day'] },
      { speciesId: 12, minLevel: 4, maxLevel: 6, weight: 6 },
      { speciesId: 43, minLevel: 3, maxLevel: 5, weight: 18, timeOfDay: ['dusk', 'night'] },
      { speciesId: 40, minLevel: 3, maxLevel: 5, weight: 12, timeOfDay: ['night'] },
    ],
  },
  ruta_2: {
    rate: 0.18,
    entries: [
      { speciesId: 12, minLevel: 9, maxLevel: 12, weight: 22 },
      { speciesId: 11, minLevel: 10, maxLevel: 12, weight: 18, timeOfDay: ['morning', 'day'] },
      { speciesId: 48, minLevel: 9, maxLevel: 12, weight: 20 },
      { speciesId: 26, minLevel: 10, maxLevel: 12, weight: 16, timeOfDay: ['dusk', 'night'] },
      { speciesId: 14, minLevel: 10, maxLevel: 13, weight: 14 },
      { speciesId: 30, minLevel: 10, maxLevel: 13, weight: 10, timeOfDay: ['morning', 'day', 'dusk'] },
      { speciesId: 43, minLevel: 10, maxLevel: 12, weight: 16, timeOfDay: ['dusk', 'night'] },
      { speciesId: 17, minLevel: 11, maxLevel: 13, weight: 8, timeOfDay: ['night'] },
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
