import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  buildEncounterGrassPlacements,
  updatePropBatchAnimation,
  type PropBatchGroup,
} from '../src/engine/BillboardBatch.ts';
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

  it('skips GPU matrix re-uploads for static prop batches when yaw has not changed', () => {
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial();
    const treeMesh = new THREE.InstancedMesh(geo, mat, 1);
    const grassMesh = new THREE.InstancedMesh(geo, mat, 1);

    const groups: PropBatchGroup[] = [
      {
        kind: 'oak',
        mesh: treeMesh,
        items: [{ kind: 'oak', x: 5, y: 0, z: 5, scale: 1 }],
      },
      {
        kind: 'tall_grass_clump',
        mesh: grassMesh,
        items: [{ kind: 'tall_grass_clump', x: 2, y: 0, z: 2, scale: 1 }],
      },
    ];

    updatePropBatchAnimation(groups, 0.5, 0.1, 0, 0);
    expect(groups[0].lastYaw).toBe(0.5);

    // Reset dirty counters after initial sync
    const treeStartVer = treeMesh.instanceMatrix.version;
    const grassStartVer = grassMesh.instanceMatrix.version;

    // Same yaw: static tree batch is skipped, grass still animates
    updatePropBatchAnimation(groups, 0.5, 0.4, 2, 2);
    expect(treeMesh.instanceMatrix.version).toBe(treeStartVer);
    expect(grassMesh.instanceMatrix.version).toBeGreaterThan(grassStartVer);

    // Yaw changes: static tree batch updates
    updatePropBatchAnimation(groups, 1.25, 0.5, 2, 2);
    expect(treeMesh.instanceMatrix.version).toBeGreaterThan(treeStartVer);

    geo.dispose();
    mat.dispose();
  });
});
