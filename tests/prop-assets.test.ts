import { describe, expect, it } from 'vitest';
import {
  buildPropAtlasKind,
  buildPropAtlasSnippet,
  getPropAtlasCellSize,
  getPropAtlasCropRect,
  PROP_ASSET_CATEGORIES,
  PROP_CATEGORY_DEFAULTS,
  slugifyPropBaseName,
} from '../src/data/propAssets.ts';

describe('prop atlas assets', () => {
  it('normalizes base names into stable atlas kinds', () => {
    expect(slugifyPropBaseName('  Rocas Ígneas  ')).toBe('rocas_igneas');
    expect(slugifyPropBaseName('')).toBe('prop');
    expect(buildPropAtlasKind('Flores del Bosque', 3)).toBe('atlas_flores_del_bosque_03');
    expect(buildPropAtlasKind('rock', 12)).toBe('atlas_rock_12');
  });

  it('computes square cell sizes and UV crops from atlas geometry', () => {
    expect(getPropAtlasCellSize({ cols: 4, rows: 4 }, 512, 512)).toEqual({
      width: 128,
      height: 128,
    });
    expect(getPropAtlasCropRect({ col: 2, row: 1, cols: 4, rows: 4 }, 512, 512)).toEqual({
      sx: 256,
      sy: 128,
      sw: 128,
      sh: 128,
    });
    expect(getPropAtlasCropRect({ col: 4, row: 0, cols: 4, rows: 4 }, 512, 512)).toBeNull();
    expect(getPropAtlasCellSize({ cols: 0, rows: 4 }, 512, 512)).toBeNull();
  });

  it('generates registry entries for selected cells only', () => {
    const snippet = buildPropAtlasSnippet({
      baseName: 'Flower Field',
      category: 'flower',
      sheetPath: '/assets/props/flower/flower_field.webp',
      cols: 4,
      rows: 2,
      cellIndices: [5, 0],
      width: 1.05,
      height: 0.9,
      windAmp: 0.05,
      shadow: false,
      occludable: false,
      solid: false,
      grass: false,
    });

    expect(snippet).toContain("kind: 'atlas_flower_field_00'");
    expect(snippet).toContain("kind: 'atlas_flower_field_05'");
    expect(snippet).not.toContain('atlas_flower_field_01');
    expect(snippet).toContain("sheetPath: '/assets/props/flower/flower_field.webp'");
    expect(snippet).toContain('col: 1,');
    expect(snippet).toContain('row: 1,');
    expect(snippet).toContain('cols: 4,');
    expect(snippet).toContain('rows: 2,');
    expect(snippet).toContain('windAmp: 0.05,');
    expect(snippet).not.toContain('shadow: true,');
  });

  it('exposes every category with render defaults', () => {
    expect(PROP_ASSET_CATEGORIES.length).toBeGreaterThanOrEqual(8);
    for (const category of PROP_ASSET_CATEGORIES) {
      const defaults = PROP_CATEGORY_DEFAULTS[category.id];
      expect(defaults.width).toBeGreaterThan(0);
      expect(defaults.height).toBeGreaterThan(0);
      expect(defaults.windAmp).toBeGreaterThanOrEqual(0);
    }
  });
});
