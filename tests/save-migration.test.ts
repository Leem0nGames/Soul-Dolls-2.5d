import { describe, expect, it } from 'vitest';
import { CURRENT_SAVE_VERSION, migrateSaveData } from '../src/save/migrations.ts';

describe('Save migrations', () => {
  it('migrates a v1 save to current schema preserving progress', () => {
    const v1 = {
      version: 1,
      mapId: 'pueblo_bruma',
      playerX: 10,
      playerY: 8,
      playerDir: 'down',
      money: 1200,
      party: [],
      bag: [{ itemId: 'pocion', quantity: 4 }],
      seenSpecies: [1, 10],
      caughtSpecies: [1],
      defeatedTrainers: ['ruta1_scout'],
      flags: { starter_chosen: true },
    };

    const migrated = migrateSaveData(v1);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated!.mapId).toBe('pueblo_bruma');
    expect(migrated!.money).toBe(1200);
    expect(migrated!.repelSteps).toBe(0);
    expect(migrated!.stats.creaturesCaught).toBe(1);
    expect(migrated!.options.textSpeed).toBe('normal');
    expect(migrated!.options.pixelEffect).toBe(true);
  });

  it('preserves the pixel effect option when migrating a saved game', () => {
    const migrated = migrateSaveData({
      version: 4,
      options: { pixelEffect: false },
    });

    expect(migrated?.options.pixelEffect).toBe(false);
  });

  it('returns null for invalid payloads', () => {
    expect(migrateSaveData(null)).toBeNull();
    expect(migrateSaveData('bad')).toBeNull();
  });
});
