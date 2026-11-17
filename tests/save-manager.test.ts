import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SaveManager } from '../src/save/SaveManager.ts';

const SLOT_1 = 'souldolls_save_slot_1';
const SLOT_2 = 'souldolls_save_slot_2';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? this.map.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal('localStorage', storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SaveManager', () => {
  it('saves and loads a slot with metadata', () => {
    const manager = new SaveManager();
    const save = manager.createNew();
    save.mapId = 'pueblo_bruma';
    save.money = 999;
    save.stats.playTimeSec = 3725;
    save.badges = ['medalla_1', 'medalla_2'];

    const result = manager.saveToSlot('slot2', save);

    expect(result.ok).toBe(true);
    expect(manager.loadSlot('slot2')?.money).toBe(999);
    expect(manager.loadSlot('slot2')?.mapId).toBe('pueblo_bruma');

    const summary = manager.listSlots().find((slot) => slot.id === 'slot2');
    expect(summary?.exists).toBe(true);
    expect(summary?.corrupted).toBe(false);
    expect(summary?.meta?.playTimeSec).toBe(3725);
    expect(summary?.meta?.badges).toBe(2);
  });

  it('recovers the previous save from backup when the primary is corrupted', () => {
    const manager = new SaveManager();
    const save = manager.createNew();
    save.money = 100;
    manager.saveToSlot('slot1', save);
    const firstRaw = storage.getItem(SLOT_1)!;

    save.money = 200;
    manager.saveToSlot('slot1', save);
    storage.setItem(SLOT_1, '{"broken":');

    const loaded = manager.loadSlot('slot1');

    expect(loaded?.money).toBe(100);
    expect(manager.wasLastLoadRecovered()).toBe(true);
    expect(storage.getItem(SLOT_1)).toBe(firstRaw);
  });

  it('marks a slot as corrupted when the checksum fails and no backup exists', () => {
    const manager = new SaveManager();
    const save = manager.createNew();
    manager.saveToSlot('slot3', save);

    const key = 'souldolls_save_slot_3';
    const envelope = JSON.parse(storage.getItem(key)!) as {
      payload: { money: number };
    };
    envelope.payload.money = 1;
    storage.setItem(key, JSON.stringify(envelope));

    const summary = manager.listSlots().find((slot) => slot.id === 'slot3');
    expect(summary?.exists).toBe(true);
    expect(summary?.corrupted).toBe(true);
    expect(manager.loadSlot('slot3')).toBeNull();
  });

  it('reports quota errors without throwing', () => {
    const manager = new SaveManager();
    const save = manager.createNew();
    const originalSetItem = storage.setItem.bind(storage);
    storage.setItem = (key: string, value: string): void => {
      if (key === SLOT_2) {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      originalSetItem(key, value);
    };

    const result = manager.saveToSlot('slot2', save);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('quota');
    expect(manager.getLastError()).toBe('quota');
  });

  it('imports the legacy single-save key into slot 1 and removes it', () => {
    storage.setItem(
      'souldolls_save_v1',
      JSON.stringify({
        version: 1,
        mapId: 'pueblo_bruma',
        playerX: 5,
        playerY: 6,
        playerDir: 'down',
        money: 777,
        party: [],
        bag: [],
        seenSpecies: [],
        caughtSpecies: [],
      })
    );

    const manager = new SaveManager();
    const loaded = manager.loadLatest();

    expect(loaded?.id).toBe('slot1');
    expect(loaded?.data.money).toBe(777);
    expect(storage.getItem('souldolls_save_v1')).toBeNull();
  });

  it('persists options globally even without a save slot', () => {
    const manager = new SaveManager();
    const options = manager.createNew().options;
    options.volume = 0.2;
    options.muted = true;

    expect(manager.saveOptions(options)).toBe(true);

    const reloaded = new SaveManager();
    const loadedOptions = reloaded.loadOptions();
    expect(loadedOptions?.volume).toBe(0.2);
    expect(loadedOptions?.muted).toBe(true);
  });
});
