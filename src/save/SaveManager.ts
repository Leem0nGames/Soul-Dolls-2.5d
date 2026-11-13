import type { SaveData } from '../domain/types.ts';
import { createInitialSave, migrateSaveData } from './migrations.ts';

const STORAGE_KEY = 'souldolls_save_v1';
const LEGACY_STORAGE_KEY = 'monstrix_save_v1';

export class SaveManager {
  hasSave(): boolean {
    try {
      return (
        localStorage.getItem(STORAGE_KEY) !== null ||
        localStorage.getItem(LEGACY_STORAGE_KEY) !== null
      );
    } catch {
      return false;
    }
  }

  load(): SaveData | null {
    try {
      const raw =
        localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return migrateSaveData(parsed);
    } catch {
      return null;
    }
  }

  save(data: SaveData): boolean {
    try {
      data.savedAt = Date.now();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  createNew(): SaveData {
    return createInitialSave();
  }
}
