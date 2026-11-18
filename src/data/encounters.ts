import type { EncounterTable } from '../domain/types.ts';

export const ENCOUNTERS: Record<string, EncounterTable> = {
  ruta_1: {
    rate: 0.2,
    entries: [
      { speciesId: 10, minLevel: 2, maxLevel: 4, weight: 26, timeOfDay: ['morning', 'day'] },
      { speciesId: 46, minLevel: 2, maxLevel: 4, weight: 22, timeOfDay: ['morning', 'day', 'dusk'] },
      { speciesId: 16, minLevel: 2, maxLevel: 5, weight: 18 },
      { speciesId: 37, minLevel: 3, maxLevel: 5, weight: 16, timeOfDay: ['morning', 'day'] },
      { speciesId: 12, minLevel: 3, maxLevel: 5, weight: 10 },
      { speciesId: 48, minLevel: 3, maxLevel: 5, weight: 8, timeOfDay: ['morning', 'day', 'dusk'] },
      { speciesId: 26, minLevel: 2, maxLevel: 4, weight: 20, timeOfDay: ['dusk', 'night'] },
      { speciesId: 43, minLevel: 2, maxLevel: 4, weight: 12, timeOfDay: ['night'] },
    ],
  },
  ruta_2: {
    rate: 0.18,
    entries: [
      { speciesId: 10, minLevel: 7, maxLevel: 9, weight: 14, timeOfDay: ['morning', 'day'] },
      { speciesId: 12, minLevel: 7, maxLevel: 10, weight: 18 },
      { speciesId: 48, minLevel: 7, maxLevel: 10, weight: 16 },
      { speciesId: 26, minLevel: 8, maxLevel: 10, weight: 14, timeOfDay: ['dusk', 'night'] },
      { speciesId: 14, minLevel: 8, maxLevel: 10, weight: 14 },
      { speciesId: 30, minLevel: 8, maxLevel: 10, weight: 12, timeOfDay: ['morning', 'day', 'dusk'] },
      { speciesId: 11, minLevel: 9, maxLevel: 11, weight: 8, timeOfDay: ['morning', 'day'] },
      { speciesId: 43, minLevel: 8, maxLevel: 10, weight: 16, timeOfDay: ['dusk', 'night'] },
    ],
  },
  cueva_eco: {
    rate: 0.15,
    entries: [
      { speciesId: 14, minLevel: 11, maxLevel: 14, weight: 32 },
      { speciesId: 43, minLevel: 11, maxLevel: 14, weight: 24 },
      { speciesId: 40, minLevel: 11, maxLevel: 14, weight: 20 },
      { speciesId: 17, minLevel: 12, maxLevel: 15, weight: 14 },
      { speciesId: 18, minLevel: 13, maxLevel: 15, weight: 6 },
      { speciesId: 45, minLevel: 13, maxLevel: 15, weight: 4 },
    ],
  },
};
