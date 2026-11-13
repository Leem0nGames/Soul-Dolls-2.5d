import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { buildEncounterGrassPlacements } from '../src/engine/BillboardBatch.ts';
import { buildTerrainChunks } from '../src/engine/TerrainMesher.ts';
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
    grid: ['."%'],
    heights: ['111'],
    legend: {
      '.': { tile: 'grass', solid: false },
      '"': { tile: 'tall_grass', solid: false, encounter: true },
      '%': { tile: 'cave_floor', solid: false, encounter: true },
    },
    buildings: [],
    props: [],
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
    signs: [],
  };
}

describe('tall grass', () => {
  it('creates animated billboard placements only on grass encounter tiles', () => {
    const placements = buildEncounterGrassPlacements(makeTestMap());

    expect(placements).toHaveLength(1);
    expect(placements[0]).toMatchObject({ x: 1, y: 0.5, z: 0, scale: expect.any(Number) });
    expect(['tall_grass_clump', 'tall_grass_flower']).toContain(placements[0].kind);
  });

  it('uses the regular grass material beneath tall grass', () => {
    const atlasMaterial = new THREE.MeshBasicMaterial();
    const grassMaterial = new THREE.MeshBasicMaterial();
    const [chunk] = buildTerrainChunks(makeTestMap(), atlasMaterial, grassMaterial);
    const materials = chunk.mesh.material;

    expect(Array.isArray(materials)).toBe(true);
    if (!Array.isArray(materials)) throw new Error('Expected terrain materials to be grouped');
    expect(materials[1]).toBe(grassMaterial);
    expect(chunk.mesh.geometry.groups).toContainEqual(
      expect.objectContaining({ materialIndex: 1, count: 12 })
    );
    chunk.mesh.geometry.dispose();
    atlasMaterial.dispose();
    grassMaterial.dispose();
  });

  it('keeps the grass material beneath tall grass on steep terrain', () => {
    const map = makeTestMap();
    map.grid = ['"'];
    map.heights = ['123'];
    const atlasMaterial = new THREE.MeshBasicMaterial();
    const grassMaterial = new THREE.MeshBasicMaterial();
    const [chunk] = buildTerrainChunks(map, atlasMaterial, grassMaterial);

    expect(chunk.mesh.geometry.groups).toContainEqual(
      expect.objectContaining({ materialIndex: 1, count: 6 })
    );
    chunk.mesh.geometry.dispose();
    atlasMaterial.dispose();
    grassMaterial.dispose();
  });
});
