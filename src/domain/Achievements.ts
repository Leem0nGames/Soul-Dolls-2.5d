import { getAlbumCounts } from './Cards.ts';
import { getOwnedHousesCount } from './Housing.ts';
import type { SaveData } from './types.ts';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  category: 'aventura' | 'coleccion' | 'hogar' | 'combate';
  target: number;
  getCurrent: (save: SaveData) => number;
}

export interface AchievementStatus {
  def: AchievementDef;
  unlocked: boolean;
  current: number;
  target: number;
  pct: number;
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  {
    id: 'primer_vinculo',
    title: 'Primer Despertar',
    description: 'Despierta tu primera SoulDoll en Villa Origen.',
    category: 'aventura',
    target: 1,
    getCurrent: (save) => (save.flags.starter_chosen || save.party.length > 0 ? 1 : 0),
  },
  {
    id: 'primera_casa',
    title: 'Hogar Propio',
    description: 'Adquiere tu primera casa base en la región.',
    category: 'hogar',
    target: 1,
    getCurrent: (save) => Math.min(1, getOwnedHousesCount(save)),
  },
  {
    id: 'todas_casas',
    title: 'Anfitrión Regional',
    description: 'Compra las 3 casas disponibles entre Villa Origen, Pueblo Bruma y Arena Cumbre.',
    category: 'hogar',
    target: 3,
    getCurrent: (save) => getOwnedHousesCount(save),
  },
  {
    id: 'duelos_5',
    title: 'Espíritu Combatiente',
    description: 'Gana 5 combates contra SoulDolls o entrenadores.',
    category: 'combate',
    target: 5,
    getCurrent: (save) => save.stats.battlesWon,
  },
  {
    id: 'duelos_20',
    title: 'Maestro de Duelos',
    description: 'Alcanza 20 victorias en combate.',
    category: 'combate',
    target: 20,
    getCurrent: (save) => save.stats.battlesWon,
  },
  {
    id: 'capturas_5',
    title: 'Sellador de Almas',
    description: 'Sella 5 SoulDolls salvajes con Soulpots.',
    category: 'coleccion',
    target: 5,
    getCurrent: (save) => save.stats.creaturesCaught,
  },
  {
    id: 'grimorio_15',
    title: 'Estudioso del Grimorio',
    description: 'Captura 15 especies distintas de SoulDolls.',
    category: 'coleccion',
    target: 15,
    getCurrent: (save) => save.caughtSpecies.length,
  },
  {
    id: 'grimorio_30',
    title: 'Archivero Supremo',
    description: 'Captura 30 especies distintas en tu Grimorio.',
    category: 'coleccion',
    target: 30,
    getCurrent: (save) => save.caughtSpecies.length,
  },
  {
    id: 'cartas_10',
    title: 'Coleccionista de Cartas',
    description: 'Reúne 10 cartas distintas en tu Álbum de Cartas.',
    category: 'coleccion',
    target: 10,
    getCurrent: (save) => {
      const ids = new Set<number>();
      for (const [k, entry] of Object.entries(save.cardAlbum ?? {})) {
        if (entry && entry.count > 0) ids.add(Number(k));
      }
      for (const [k, entry] of Object.entries(save.cardChest ?? {})) {
        if (entry && entry.count > 0) ids.add(Number(k));
      }
      return Math.max(ids.size, getAlbumCounts(save).collected);
    },
  },
  {
    id: 'pasos_500',
    title: 'Viajero Incansable',
    description: 'Recorre 500 pasos explorando rutas y ciudades.',
    category: 'aventura',
    target: 500,
    getCurrent: (save) => save.stats.steps,
  },
  {
    id: 'misiones_3',
    title: 'Alianza de la Región',
    description: 'Completa 3 misiones secundarias para los habitantes.',
    category: 'aventura',
    target: 3,
    getCurrent: (save) => save.completedSideQuests?.length ?? 0,
  },
  {
    id: 'campeon_cumbre',
    title: 'Campeón de Cumbre',
    description: 'Derrota a la Líder Valeria en la Arena Cumbre.',
    category: 'combate',
    target: 1,
    getCurrent: (save) => (save.champion ? 1 : 0),
  },
];

export function evaluateAchievements(save: SaveData): {
  items: AchievementStatus[];
  unlockedCount: number;
  totalCount: number;
} {
  const items: AchievementStatus[] = ACHIEVEMENTS.map((def) => {
    const raw = Math.max(0, Math.floor(def.getCurrent(save)));
    const current = Math.min(def.target, raw);
    const unlocked = raw >= def.target;
    const pct = def.target > 0 ? Math.min(100, Math.round((current / def.target) * 100)) : 100;
    return {
      def,
      unlocked,
      current,
      target: def.target,
      pct,
    };
  });

  const unlockedCount = items.filter((item) => item.unlocked).length;
  return {
    items,
    unlockedCount,
    totalCount: items.length,
  };
}
