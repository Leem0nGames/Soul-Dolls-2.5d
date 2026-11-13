import { describe, expect, it } from 'vitest';
import {
  cameraRelativeMove,
  isTileWalkable,
  relativeSpriteDir,
  sampleInterpolatedHeight,
} from '../src/domain/TerrainRules.ts';
import type { MapDef } from '../src/domain/types.ts';

function makeTestMap(): MapDef {
  return {
    id: 'test_map',
    nameKey: 'test_map',
    biome: 'meadow',
    music: 'town',
    skyTopColor: 0x000000,
    skyBottomColor: 0x111111,
    fogColor: 0x222222,
    grid: [
      '......',
      '.^..~.',
      '......',
      '......',
    ],
    heights: [
      '111222',
      '123411',
      '113411',
      '111111',
    ],
    legend: {
      '.': { tile: 'grass', solid: false },
      '^': { tile: 'stairs', solid: false, ramp: true },
      '~': { tile: 'water', solid: true },
    },
    buildings: [{ kind: 'house_red', x: 4, z: 2, width: 2, depth: 2, facing: 'down' }],
    props: [{ kind: 'boulder', x: 0, z: 3 }],
    decoration: {
      seed: 1,
      treeDensity: 0,
      bushDensity: 0,
      flowerDensity: 0,
      rockDensity: 0,
      mushroomDensity: 0,
      treeKinds: [],
    },
    warps: [],
    npcs: [],
    signs: [{ x: 1, y: 3, textKey: 'sign' }],
  };
}

describe('TerrainRules', () => {
  it('allows height steps <= 1 on normal tiles and blocks steps >= 2', () => {
    const map = makeTestMap();
    // (0,0) h=1 -> (1,0) h=1 (diff 0)
    expect(isTileWalkable(map, 0, 0, 1, 0)).toBe(true);
    // (1,2) h=1 -> (2,2) h=3 (diff 2, not ramp) => blocked
    expect(isTileWalkable(map, 1, 2, 2, 2)).toBe(false);
    // (1,1) is stairs '^' h=2 -> (2,1) h=3 (diff 1) => allowed
    expect(isTileWalkable(map, 1, 1, 2, 1)).toBe(true);
    // (1,1) is stairs '^' h=2 -> (2,0) h=1 (diff 1) => allowed; also (1,1) to h=4 would be <=2
    map.heights[1] = '124411';
    expect(isTileWalkable(map, 1, 1, 2, 1)).toBe(true);
  });

  it('blocks water, buildings, props, signs, and dynamic props', () => {
    const map = makeTestMap();
    expect(isTileWalkable(map, 3, 1, 4, 1)).toBe(false); // water
    expect(isTileWalkable(map, 3, 2, 4, 2)).toBe(false); // building footprint
    expect(isTileWalkable(map, 0, 2, 0, 3)).toBe(false); // boulder prop
    expect(isTileWalkable(map, 1, 2, 1, 3)).toBe(false); // sign
    const dyn = new Set(['2,0']);
    expect(isTileWalkable(map, 1, 0, 2, 0, dyn)).toBe(false);
  });

  it('interpolates terrain heights smoothly', () => {
    const map = makeTestMap();
    expect(sampleInterpolatedHeight(map, 0, 0)).toBeCloseTo(0.5);
    expect(sampleInterpolatedHeight(map, 2.5, 0)).toBeCloseTo(0.75);
  });

  it('transforms D-pad input relative to camera yaw steps 0..3', () => {
    expect(cameraRelativeMove('up', 0)).toEqual({ dx: 0, dy: -1, dir: 'up' });
    expect(cameraRelativeMove('up', 1)).toEqual({ dx: -1, dy: 0, dir: 'left' });
    expect(cameraRelativeMove('right', 1)).toEqual({ dx: 0, dy: -1, dir: 'up' });
    expect(cameraRelativeMove('up', 2)).toEqual({ dx: 0, dy: 1, dir: 'down' });
    expect(cameraRelativeMove('up', 3)).toEqual({ dx: 1, dy: 0, dir: 'right' });
  });

  it('maps world character facing into camera-relative sprite direction', () => {
    expect(relativeSpriteDir('down', 0)).toBe('down');
    expect(relativeSpriteDir('left', 1)).toBe('up');
    expect(relativeSpriteDir('down', 2)).toBe('up');
  });
});
