import type { GameOptions, SaveData } from '../domain/types.ts';
import {
  createInitialSave,
  migrateSaveData,
  normalizeGameOptions,
} from './migrations.ts';

export const SAVE_FORMAT = 'souldolls.save';
export const SAVE_FORMAT_VERSION = 1;

export const MANUAL_SLOT_IDS = ['slot1', 'slot2', 'slot3'] as const;
export type ManualSaveSlotId = (typeof MANUAL_SLOT_IDS)[number];
export type SaveSlotId = ManualSaveSlotId | 'auto';
export const SAVE_SLOT_IDS: readonly SaveSlotId[] = [...MANUAL_SLOT_IDS, 'auto'];

const SLOT_KEYS: Record<SaveSlotId, string> = {
  slot1: 'souldolls_save_slot_1',
  slot2: 'souldolls_save_slot_2',
  slot3: 'souldolls_save_slot_3',
  auto: 'souldolls_autosave',
};
const BACKUP_SUFFIX = '_bak';
const OPTIONS_KEY = 'souldolls_options_v1';
const LEGACY_STORAGE_KEYS = ['souldolls_save_v1', 'monstrix_save_v1'] as const;

export interface SaveMeta {
  savedAt: number;
  mapId: string;
  money: number;
  playTimeSec: number;
  badges: number;
  partySize: number;
  topLevel: number;
  leadSpeciesId: number | null;
  questIndex: number;
}

export interface SaveSlotSummary {
  id: SaveSlotId;
  exists: boolean;
  corrupted: boolean;
  isAuto: boolean;
  meta: SaveMeta | null;
}

export type SaveErrorReason = 'unavailable' | 'quota' | 'unknown';

export type SaveResult =
  | { ok: true; savedAt: number }
  | { ok: false; reason: SaveErrorReason };

export interface LoadedSave {
  id: SaveSlotId;
  data: SaveData;
  recovered: boolean;
}

interface SaveEnvelope {
  format: typeof SAVE_FORMAT;
  formatVersion: number;
  checksum: string;
  meta: SaveMeta;
  payload: SaveData;
}

type SlotReadResult =
  | { kind: 'empty' }
  | { kind: 'corrupt' }
  | { kind: 'ok'; data: SaveData; meta: SaveMeta; recovered: boolean };

function storageAvailable(): boolean {
  return typeof localStorage !== 'undefined';
}

function safeGet(key: string): string | null {
  if (!storageAvailable()) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeRemove(key: string): boolean {
  if (!storageAvailable()) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function classifyStorageError(error: unknown): SaveErrorReason {
  if (error && typeof error === 'object') {
    const name = (error as { name?: unknown }).name;
    const code = (error as { code?: unknown }).code;
    if (
      name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      code === 22 ||
      code === 1014
    ) {
      return 'quota';
    }
  }
  return 'unknown';
}

function safeSet(key: string, value: string): SaveErrorReason | null {
  if (!storageAvailable()) return 'unavailable';
  try {
    localStorage.setItem(key, value);
    return null;
  } catch (error) {
    return classifyStorageError(error);
  }
}

export function computeChecksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildSaveMeta(save: SaveData): SaveMeta {
  const party = Array.isArray(save.party) ? save.party : [];
  let topLevel = 0;
  for (const creature of party) {
    if (creature && typeof creature.level === 'number' && creature.level > topLevel) {
      topLevel = creature.level;
    }
  }
  const lead = party[0];
  return {
    savedAt: typeof save.savedAt === 'number' ? save.savedAt : Date.now(),
    mapId: typeof save.mapId === 'string' ? save.mapId : 'villa_origen',
    money: typeof save.money === 'number' ? save.money : 0,
    playTimeSec: Math.max(0, Math.floor(save.stats?.playTimeSec ?? 0)),
    badges: Array.isArray(save.badges) ? save.badges.length : 0,
    partySize: party.length,
    topLevel,
    leadSpeciesId: typeof lead?.speciesId === 'number' ? lead.speciesId : null,
    questIndex: typeof save.questIndex === 'number' ? save.questIndex : 0,
  };
}

function isSaveMeta(value: unknown): value is SaveMeta {
  if (!value || typeof value !== 'object') return false;
  const meta = value as Record<string, unknown>;
  return typeof meta.savedAt === 'number' && typeof meta.mapId === 'string';
}

function parseStored(raw: string | null): { data: SaveData; meta: SaveMeta } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    if (obj.format === SAVE_FORMAT) {
      if (
        typeof obj.formatVersion === 'number' &&
        obj.formatVersion > SAVE_FORMAT_VERSION
      ) {
        return null;
      }
      if (typeof obj.checksum !== 'string') return null;
      const payload = obj.payload;
      if (!payload || typeof payload !== 'object') return null;
      if (computeChecksum(JSON.stringify(payload)) !== obj.checksum) return null;
      const data = migrateSaveData(payload);
      if (!data) return null;
      return {
        data,
        meta: isSaveMeta(obj.meta) ? obj.meta : buildSaveMeta(data),
      };
    }

    const data = migrateSaveData(parsed);
    if (!data) return null;
    return { data, meta: buildSaveMeta(data) };
  } catch {
    return null;
  }
}

export class SaveManager {
  private activeSlot: SaveSlotId | null = null;
  private lastError: SaveErrorReason | null = null;
  private lastLoadRecovered = false;

  constructor() {
    this.migrateLegacySaves();
  }

  hasSave(): boolean {
    return this.listSlots().some((slot) => slot.exists);
  }

  hasPlayableSave(): boolean {
    return this.listSlots().some((slot) => slot.exists && !slot.corrupted);
  }

  listSlots(): SaveSlotSummary[] {
    return SAVE_SLOT_IDS.map((id) => {
      const result = this.readSlot(id);
      if (result.kind === 'ok') {
        return {
          id,
          exists: true,
          corrupted: false,
          isAuto: id === 'auto',
          meta: result.meta,
        };
      }
      return {
        id,
        exists: result.kind === 'corrupt',
        corrupted: result.kind === 'corrupt',
        isAuto: id === 'auto',
        meta: null,
      };
    });
  }

  getLatestSlot(): SaveSlotSummary | null {
    let latest: SaveSlotSummary | null = null;
    for (const slot of this.listSlots()) {
      if (!slot.exists || slot.corrupted || !slot.meta) continue;
      if (!latest || !latest.meta || slot.meta.savedAt > latest.meta.savedAt) {
        latest = slot;
      }
    }
    return latest;
  }

  loadSlot(id: SaveSlotId): SaveData | null {
    this.lastLoadRecovered = false;
    const result = this.readSlot(id);
    if (result.kind !== 'ok') return null;
    this.lastLoadRecovered = result.recovered;
    this.activeSlot = id;
    return result.data;
  }

  loadLatest(): LoadedSave | null {
    this.lastLoadRecovered = false;
    const latest = this.getLatestSlot();
    if (!latest) return null;
    const result = this.readSlot(latest.id);
    if (result.kind !== 'ok') return null;
    this.activeSlot = latest.id;
    this.lastLoadRecovered = result.recovered;
    return { id: latest.id, data: result.data, recovered: result.recovered };
  }

  load(): SaveData | null {
    return this.loadLatest()?.data ?? null;
  }

  setActiveSlot(id: SaveSlotId): void {
    this.activeSlot = id;
  }

  getActiveSlot(): SaveSlotId | null {
    return this.activeSlot;
  }

  save(data: SaveData): boolean {
    return this.saveToSlot(this.resolveActiveSlot(), data).ok;
  }

  saveToSlot(id: SaveSlotId, data: SaveData): SaveResult {
    data.savedAt = Date.now();
    const envelope: SaveEnvelope = {
      format: SAVE_FORMAT,
      formatVersion: SAVE_FORMAT_VERSION,
      checksum: computeChecksum(JSON.stringify(data)),
      meta: buildSaveMeta(data),
      payload: data,
    };

    let serialized: string;
    try {
      serialized = JSON.stringify(envelope);
    } catch {
      this.lastError = 'unknown';
      return { ok: false, reason: 'unknown' };
    }

    const key = SLOT_KEYS[id];
    const backupKey = key + BACKUP_SUFFIX;
    const previous = safeGet(key);
    if (previous !== null) {
      safeSet(backupKey, previous);
    }

    let reason = safeSet(key, serialized);
    if (reason === 'quota' && previous !== null) {
      safeRemove(backupKey);
      reason = safeSet(key, serialized);
    }

    this.lastError = reason;
    if (reason) return { ok: false, reason };
    return { ok: true, savedAt: data.savedAt };
  }

  saveAuto(data: SaveData): SaveResult {
    return this.saveToSlot('auto', data);
  }

  deleteSlot(id: SaveSlotId): boolean {
    const key = SLOT_KEYS[id];
    const removed = safeRemove(key);
    safeRemove(key + BACKUP_SUFFIX);
    if (this.activeSlot === id) this.activeSlot = null;
    return removed;
  }

  clear(): void {
    for (const id of SAVE_SLOT_IDS) {
      const key = SLOT_KEYS[id];
      safeRemove(key);
      safeRemove(key + BACKUP_SUFFIX);
    }
    for (const key of LEGACY_STORAGE_KEYS) safeRemove(key);
    safeRemove(OPTIONS_KEY);
    this.activeSlot = null;
  }

  createNew(): SaveData {
    return createInitialSave();
  }

  loadOptions(): GameOptions | null {
    const raw = safeGet(OPTIONS_KEY);
    if (!raw) return null;
    try {
      return normalizeGameOptions(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  saveOptions(options: GameOptions): boolean {
    this.lastError = safeSet(OPTIONS_KEY, JSON.stringify(options));
    return this.lastError === null;
  }

  getLastError(): SaveErrorReason | null {
    return this.lastError;
  }

  wasLastLoadRecovered(): boolean {
    return this.lastLoadRecovered;
  }

  private resolveActiveSlot(): SaveSlotId {
    if (this.activeSlot) return this.activeSlot;
    return this.getLatestSlot()?.id ?? 'slot1';
  }

  private readSlot(id: SaveSlotId): SlotReadResult {
    const key = SLOT_KEYS[id];
    const backupKey = key + BACKUP_SUFFIX;
    const primary = safeGet(key);
    if (primary !== null) {
      const parsed = parseStored(primary);
      if (parsed) {
        return { kind: 'ok', ...parsed, recovered: false };
      }
    }

    const backup = safeGet(backupKey);
    if (backup !== null) {
      const parsed = parseStored(backup);
      if (parsed) {
        if (primary !== null) safeSet(key, backup);
        return { kind: 'ok', ...parsed, recovered: true };
      }
    }

    if (primary === null && backup === null) return { kind: 'empty' };
    return { kind: 'corrupt' };
  }

  private migrateLegacySaves(): void {
    let legacyRaw: string | null = null;
    for (const key of LEGACY_STORAGE_KEYS) {
      legacyRaw = safeGet(key);
      if (legacyRaw !== null) break;
    }
    if (legacyRaw === null) return;

    if (this.hasPlayableSave()) {
      for (const key of LEGACY_STORAGE_KEYS) safeRemove(key);
      return;
    }

    const parsed = parseStored(legacyRaw);
    if (!parsed) return;

    if (this.saveToSlot('slot1', parsed.data).ok) {
      for (const key of LEGACY_STORAGE_KEYS) safeRemove(key);
    }
  }
}
