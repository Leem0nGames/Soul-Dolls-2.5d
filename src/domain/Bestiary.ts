import { ENCOUNTERS } from '../data/encounters.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { addItem } from './Inventory.ts';
import type {
  BestiaryEntry,
  HabitatTag,
  SaveData,
} from './types.ts';

export interface BestiaryMilestone {
  id: string;
  kind: 'seen' | 'caught';
  count: number;
  rewardMoney: number;
  rewardItemId: string;
  rewardQty: number;
}

export const BESTIARY_MILESTONES: readonly BestiaryMilestone[] = [
  {
    id: 'seen_10',
    kind: 'seen',
    count: 10,
    rewardMoney: 500,
    rewardItemId: 'supercapsula',
    rewardQty: 3,
  },
  {
    id: 'caught_10',
    kind: 'caught',
    count: 10,
    rewardMoney: 1000,
    rewardItemId: 'baya_alba',
    rewardQty: 2,
  },
  {
    id: 'seen_25',
    kind: 'seen',
    count: 25,
    rewardMoney: 1500,
    rewardItemId: 'ultracapsula',
    rewardQty: 4,
  },
  {
    id: 'caught_25',
    kind: 'caught',
    count: 25,
    rewardMoney: 2500,
    rewardItemId: 'gema_poder',
    rewardQty: 1,
  },
  {
    id: 'seen_50',
    kind: 'seen',
    count: 50,
    rewardMoney: 4000,
    rewardItemId: 'musgo_vital',
    rewardQty: 1,
  },
  {
    id: 'caught_50',
    kind: 'caught',
    count: 50,
    rewardMoney: 8000,
    rewardItemId: 'ultracapsula',
    rewardQty: 10,
  },
];

export function createEmptyBestiary(): Record<number, BestiaryEntry> {
  return {};
}

export function getBestiaryEntry(
  bestiary: Record<number, BestiaryEntry>,
  speciesId: number
): BestiaryEntry {
  return (
    bestiary[speciesId] ?? {
      state: 'unseen',
      timesCaught: 0,
      highestLevel: 0,
    }
  );
}

export function markBestiarySeen(
  save: SaveData,
  speciesId: number,
  location?: string,
  level = 0
): void {
  if (!save.seenSpecies.includes(speciesId)) {
    save.seenSpecies.push(speciesId);
  }
  const existing = save.bestiary[speciesId];
  if (!existing) {
    save.bestiary[speciesId] = {
      state: 'seen',
      firstLocation: location,
      timesCaught: 0,
      highestLevel: level,
    };
  } else {
    if (existing.state === 'unseen') existing.state = 'seen';
    if (!existing.firstLocation && location) existing.firstLocation = location;
    if (level > existing.highestLevel) existing.highestLevel = level;
  }
}

export function markBestiaryCaught(
  save: SaveData,
  speciesId: number,
  location?: string,
  level = 0,
  incrementCatchCount = true
): void {
  markBestiarySeen(save, speciesId, location, level);
  if (!save.caughtSpecies.includes(speciesId)) {
    save.caughtSpecies.push(speciesId);
  }
  const entry = save.bestiary[speciesId];
  entry.state = 'caught';
  if (incrementCatchCount) {
    entry.timesCaught += 1;
  } else if (entry.timesCaught === 0) {
    entry.timesCaught = 1;
  }
  if (level > entry.highestLevel) {
    entry.highestLevel = level;
  }
}

export function getBestiaryCounts(save: SaveData): {
  seen: number;
  caught: number;
  total: number;
} {
  let seen = 0;
  let caught = 0;
  for (const id of ALL_SPECIES_IDS) {
    const entry = save.bestiary[id];
    const st = entry?.state ?? (save.caughtSpecies.includes(id) ? 'caught' : save.seenSpecies.includes(id) ? 'seen' : 'unseen');
    if (st === 'seen' || st === 'caught') seen += 1;
    if (st === 'caught') caught += 1;
  }
  return { seen, caught, total: ALL_SPECIES_IDS.length };
}

export function getClaimableMilestones(save: SaveData): BestiaryMilestone[] {
  const counts = getBestiaryCounts(save);
  return BESTIARY_MILESTONES.filter((m) => {
    if (save.claimedBestiaryMilestones.includes(m.id)) return false;
    const val = m.kind === 'caught' ? counts.caught : counts.seen;
    return val >= m.count;
  });
}

export function claimBestiaryMilestone(
  save: SaveData,
  milestoneId: string
): BestiaryMilestone | null {
  const m = getClaimableMilestones(save).find((x) => x.id === milestoneId);
  if (!m) return null;
  save.claimedBestiaryMilestones.push(m.id);
  save.money += m.rewardMoney;
  addItem(save.bag, m.rewardItemId, m.rewardQty);
  return m;
}

const MAP_HABITAT_GUESS: Record<string, HabitatTag> = {
  villa_origen: 'meadow',
  ruta_1: 'meadow',
  pueblo_bruma: 'meadow',
  ruta_2: 'mountain',
  cueva_eco: 'cave',
  arena_cumbre: 'mountain',
  ruta_3: 'forest',
  bahia_coral: 'coast',
  arena_marea: 'coast',
  paso_escarcha: 'snow',
  ciudad_eclipse: 'cave',
};

export function getSpeciesEncounterLocations(speciesId: number): string[] {
  const mapIds: string[] = [];
  for (const [mapId, table] of Object.entries(ENCOUNTERS)) {
    if (table.entries.some((e) => e.speciesId === speciesId)) {
      mapIds.push(mapId);
    }
  }
  return mapIds;
}

export function getSpeciesHabitats(speciesId: number): HabitatTag[] {
  const set = new Set<HabitatTag>(getSpecies(speciesId).habitats ?? []);
  for (const mapId of getSpeciesEncounterLocations(speciesId)) {
    const guess = MAP_HABITAT_GUESS[mapId];
    if (guess) set.add(guess);
  }
  return Array.from(set);
}
