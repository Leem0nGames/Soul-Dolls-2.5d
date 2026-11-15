import { SPECIES } from '../data/species.ts';
import { resolveDeterministicAbility } from '../domain/Abilities.ts';
import { ensureBodyParts, ensureSaveVesselState } from '../domain/BodyParts.ts';
import { clampQuestIndex } from '../domain/Quests.ts';
import { createDefaultStorageBoxes, normalizeStorageBoxes } from '../domain/Storage.ts';
import type {
  BestiaryEntry,
  CapturedSoul,
  CardEntry,
  CreatureInstance,
  GameOptions,
  SaveData,
} from '../domain/types.ts';

export const CURRENT_SAVE_VERSION = 6;

export function defaultOptions(): GameOptions {
  return {
    volume: 0.6,
    muted: false,
    batterySaver: false,
    pixelEffect: false,
    textSpeed: 'normal',
  };
}

export function createInitialSave(): SaveData {
  return {
    version: CURRENT_SAVE_VERSION,
    mapId: 'villa_origen',
    playerX: 24,
    playerY: 26,
    playerDir: 'up',
    money: 500,
    repelSteps: 0,
    party: [],
    bag: [
      { itemId: 'pocion', quantity: 2 },
      { itemId: 'capsula', quantity: 3 },
      { itemId: 'fragmento_alma', quantity: 1 },
    ],
    seenSpecies: [],
    caughtSpecies: [],
    bestiary: {},
    claimedBestiaryMilestones: [],
    storageBoxes: createDefaultStorageBoxes(),
    badges: [],
    collectedPickups: [],
    champion: false,
    defeatedTrainers: [],
    flags: {},
    questIndex: 0,
    vessels: { cuerpo_aprendiz: 1 },
    bodyPartShards: {},
    soulReserve: [],
    cardAlbum: {},
    stats: {
      battlesWon: 0,
      creaturesCaught: 0,
      steps: 0,
      playTimeSec: 0,
    },
    options: defaultOptions(),
    savedAt: Date.now(),
  };
}

function hydrateCreature(c: CreatureInstance, indexSeed: number): CreatureInstance {
  if (!c.abilityId) {
    c.abilityId = resolveDeterministicAbility(c.speciesId, indexSeed);
  }
  if (c.socketedCardId !== undefined && !SPECIES[c.socketedCardId]) {
    delete c.socketedCardId;
  }
  ensureBodyParts(c);
  return c;
}

export function migrateSaveData(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const version = typeof obj.version === 'number' ? obj.version : 1;

  const base = createInitialSave();

  const vessels: Record<string, number> = {};
  if (obj.vessels && typeof obj.vessels === 'object') {
    for (const [k, v] of Object.entries(obj.vessels as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) vessels[k] = Math.floor(v);
    }
  } else if (version < 4) {
    vessels.cuerpo_aprendiz = 1;
  }

  const bodyPartShards: Record<string, number> = {};
  if (obj.bodyPartShards && typeof obj.bodyPartShards === 'object') {
    for (const [k, v] of Object.entries(obj.bodyPartShards as Record<string, unknown>)) {
      if (typeof v === 'number' && v > 0) bodyPartShards[k] = Math.floor(v);
    }
  }

  const soulReserve: CapturedSoul[] = Array.isArray(obj.soulReserve)
    ? (obj.soulReserve as CapturedSoul[]).filter(
        (s) => s && typeof s.speciesId === 'number' && typeof s.level === 'number'
      )
    : [];

  const migrated: SaveData = {
    ...base,
    version: CURRENT_SAVE_VERSION,
    mapId: typeof obj.mapId === 'string' ? obj.mapId : base.mapId,
    playerX: typeof obj.playerX === 'number' ? obj.playerX : base.playerX,
    playerY: typeof obj.playerY === 'number' ? obj.playerY : base.playerY,
    playerDir:
      obj.playerDir === 'up' ||
      obj.playerDir === 'down' ||
      obj.playerDir === 'left' ||
      obj.playerDir === 'right'
        ? obj.playerDir
        : base.playerDir,
    money: typeof obj.money === 'number' ? obj.money : base.money,
    repelSteps: typeof obj.repelSteps === 'number' ? obj.repelSteps : 0,
    party: Array.isArray(obj.party)
      ? (obj.party as CreatureInstance[]).map((c, idx) => hydrateCreature(c, idx))
      : [],
    bag: Array.isArray(obj.bag) ? (obj.bag as SaveData['bag']) : base.bag,
    seenSpecies: Array.isArray(obj.seenSpecies)
      ? (obj.seenSpecies as number[])
      : [],
    caughtSpecies: Array.isArray(obj.caughtSpecies)
      ? (obj.caughtSpecies as number[])
      : [],
    claimedBestiaryMilestones: Array.isArray(obj.claimedBestiaryMilestones)
      ? (obj.claimedBestiaryMilestones as string[])
      : [],
    storageBoxes: normalizeStorageBoxes(obj.storageBoxes),
    badges: Array.isArray(obj.badges) ? (obj.badges as string[]) : [],
    collectedPickups: Array.isArray(obj.collectedPickups)
      ? (obj.collectedPickups as string[])
      : [],
    champion: typeof obj.champion === 'boolean' ? obj.champion : false,
    defeatedTrainers: Array.isArray(obj.defeatedTrainers)
      ? (obj.defeatedTrainers as string[])
      : [],
    flags:
      obj.flags && typeof obj.flags === 'object'
        ? (obj.flags as Record<string, boolean>)
        : {},
    questIndex: clampQuestIndex(obj.questIndex),
    vessels,
    bodyPartShards,
    soulReserve,
    savedAt: typeof obj.savedAt === 'number' ? obj.savedAt : Date.now(),
  };

  ensureSaveVesselState(migrated);
  if (version < 4 && !migrated.bag.some((slot) => slot.itemId === 'fragmento_alma')) {
    migrated.bag.push({ itemId: 'fragmento_alma', quantity: 1 });
  }

  for (const box of migrated.storageBoxes) {
    for (let s = 0; s < box.slots.length; s++) {
      const mon = box.slots[s];
      if (mon) hydrateCreature(mon, s);
    }
  }

  // Seed & hydrate Bestiary from raw bestiary, seen/caught arrays, party, and storage
  const bestiary: Record<number, BestiaryEntry> = {};
  if (obj.bestiary && typeof obj.bestiary === 'object') {
    for (const [k, v] of Object.entries(obj.bestiary as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isFinite(id) || !v || typeof v !== 'object') continue;
      const e = v as Partial<BestiaryEntry>;
      bestiary[id] = {
        state: e.state === 'caught' ? 'caught' : e.state === 'seen' ? 'seen' : 'unseen',
        firstLocation: typeof e.firstLocation === 'string' ? e.firstLocation : undefined,
        timesCaught: typeof e.timesCaught === 'number' ? e.timesCaught : 0,
        highestLevel: typeof e.highestLevel === 'number' ? e.highestLevel : 0,
      };
    }
  }

  for (const id of migrated.seenSpecies) {
    if (!bestiary[id]) {
      bestiary[id] = { state: 'seen', timesCaught: 0, highestLevel: 0 };
    } else if (bestiary[id].state === 'unseen') {
      bestiary[id].state = 'seen';
    }
  }

  for (const id of migrated.caughtSpecies) {
    if (!bestiary[id]) {
      bestiary[id] = { state: 'caught', timesCaught: 1, highestLevel: 0 };
    } else {
      bestiary[id].state = 'caught';
      if (bestiary[id].timesCaught === 0) bestiary[id].timesCaught = 1;
    }
    if (!migrated.seenSpecies.includes(id)) migrated.seenSpecies.push(id);
  }

  const allOwned: CreatureInstance[] = [
    ...migrated.party,
    ...migrated.storageBoxes.flatMap((b) => b.slots.filter((x): x is CreatureInstance => x !== null)),
  ];
  for (const mon of allOwned) {
    if (!migrated.seenSpecies.includes(mon.speciesId)) migrated.seenSpecies.push(mon.speciesId);
    if (!migrated.caughtSpecies.includes(mon.speciesId)) migrated.caughtSpecies.push(mon.speciesId);
    const cur = bestiary[mon.speciesId];
    if (!cur) {
      bestiary[mon.speciesId] = {
        state: 'caught',
        timesCaught: 1,
        highestLevel: mon.level,
      };
    } else {
      cur.state = 'caught';
      if (cur.timesCaught === 0) cur.timesCaught = 1;
      if (mon.level > cur.highestLevel) cur.highestLevel = mon.level;
    }
  }
  migrated.bestiary = bestiary;

  const cardAlbum: Record<number, CardEntry> = {};
  if (obj.cardAlbum && typeof obj.cardAlbum === 'object') {
    for (const [k, v] of Object.entries(obj.cardAlbum as Record<string, unknown>)) {
      const id = Number(k);
      if (!Number.isFinite(id) || !SPECIES[id] || !v || typeof v !== 'object') continue;
      const e = v as Partial<CardEntry>;
      const count = typeof e.count === 'number' && e.count > 0 ? Math.floor(e.count) : 0;
      if (count <= 0) continue;
      cardAlbum[id] = {
        speciesId: id,
        count,
        firstObtainedAt:
          typeof e.firstObtainedAt === 'number' ? e.firstObtainedAt : migrated.savedAt,
      };
    }
  }
  const socketCounts: Record<number, number> = {};
  for (const mon of allOwned) {
    if (mon.socketedCardId !== undefined && SPECIES[mon.socketedCardId]) {
      socketCounts[mon.socketedCardId] = (socketCounts[mon.socketedCardId] ?? 0) + 1;
    }
  }
  for (const [idStr, needed] of Object.entries(socketCounts)) {
    const id = Number(idStr);
    if (!cardAlbum[id]) {
      cardAlbum[id] = { speciesId: id, count: needed, firstObtainedAt: migrated.savedAt };
    } else if (cardAlbum[id].count < needed) {
      cardAlbum[id].count = needed;
    }
  }
  migrated.cardAlbum = cardAlbum;

  if (version < 2) {
    migrated.stats = {
      battlesWon: 0,
      creaturesCaught: migrated.caughtSpecies.length,
      steps: 0,
      playTimeSec: 0,
    };
  } else if (obj.stats && typeof obj.stats === 'object') {
    const st = obj.stats as Record<string, unknown>;
    migrated.stats = {
      battlesWon: typeof st.battlesWon === 'number' ? st.battlesWon : 0,
      creaturesCaught:
        typeof st.creaturesCaught === 'number'
          ? st.creaturesCaught
          : migrated.caughtSpecies.length,
      steps: typeof st.steps === 'number' ? st.steps : 0,
      playTimeSec: typeof st.playTimeSec === 'number' ? st.playTimeSec : 0,
    };
  }

  if (obj.options && typeof obj.options === 'object') {
    const opt = obj.options as Record<string, unknown>;
    migrated.options = {
      volume: typeof opt.volume === 'number' ? opt.volume : 0.6,
      muted: typeof opt.muted === 'boolean' ? opt.muted : false,
      batterySaver: typeof opt.batterySaver === 'boolean' ? opt.batterySaver : false,
      pixelEffect:
        version >= 6 && typeof opt.pixelEffect === 'boolean' ? opt.pixelEffect : false,
      textSpeed: opt.textSpeed === 'fast' ? 'fast' : 'normal',
    };
  }

  return migrated;
}
