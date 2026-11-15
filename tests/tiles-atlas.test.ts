import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import { getTileUv } from '../src/engine/AtlasBuilder.ts';
import { buildBuildingsMesh } from '../src/engine/BuildingMesher.ts';
import { buildMapGatesGroup } from '../src/engine/GateMesher.ts';
import { buildTerrainBorderApron, buildTerrainChunks } from '../src/engine/TerrainMesher.ts';
import {
  ATLAS_GRID,
  ATLAS_SIZE,
  EXTRA_SHEET_COLS,
  EXTRA_SHEET_ROWS,
  EXTRA_TILE_MAPPING,
  SHEET_CELL_SIZE,
  SHEET_TILE_MAPPING,
  TILE_ATLAS_INDEX,
  TILE_SIZE,
  type TileAtlasKey,
} from '../src/gfx/ProceduralTiles.ts';

describe('5x5 tile & normal atlas integration', () => {

  it('maps all 25 (5x5) cells coherently to unique 64x64 slots inside the 512x512 atlas', () => {
    expect(TILE_SIZE).toBe(64);
    expect(SHEET_CELL_SIZE).toBe(64);
    expect(ATLAS_GRID).toBe(8);
    expect(ATLAS_SIZE).toBe(512);

    const coveredCells = new Set<string>();
    for (const [key, cell] of Object.entries(SHEET_TILE_MAPPING)) {
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(5);
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.col).toBeLessThan(5);
      expect(TILE_ATLAS_INDEX[key as TileAtlasKey]).toBeGreaterThanOrEqual(0);
      expect(TILE_ATLAS_INDEX[key as TileAtlasKey]).toBeLessThan(ATLAS_GRID * ATLAS_GRID);
      coveredCells.add(`${cell.row},${cell.col}`);
    }

    // All 25 cells of the 5x5 sheet must be mapped
    expect(coveredCells.size).toBe(25);

    // Extra 5x2 sheet must map all 10 extra terrain/facade tiles
    const extraCovered = new Set<string>();
    for (const [key, cell] of Object.entries(EXTRA_TILE_MAPPING)) {
      expect(cell.row).toBeGreaterThanOrEqual(0);
      expect(cell.row).toBeLessThan(EXTRA_SHEET_ROWS);
      expect(cell.col).toBeGreaterThanOrEqual(0);
      expect(cell.col).toBeLessThan(EXTRA_SHEET_COLS);
      expect(TILE_ATLAS_INDEX[key as TileAtlasKey]).toBeGreaterThanOrEqual(0);
      expect(TILE_ATLAS_INDEX[key as TileAtlasKey]).toBeLessThan(ATLAS_GRID * ATLAS_GRID);
      extraCovered.add(`${cell.row},${cell.col}`);
    }
    expect(extraCovered.size).toBe(10);

    // Verify UV rects stay crisp inside slot boundaries
    for (const key of Object.keys(TILE_ATLAS_INDEX) as TileAtlasKey[]) {
      const uv = getTileUv(key);
      expect(uv.u0).toBeGreaterThanOrEqual(0);
      expect(uv.u1).toBeLessThanOrEqual(1);
      expect(uv.v0).toBeGreaterThanOrEqual(0);
      expect(uv.v1).toBeLessThanOrEqual(1);
      expect(uv.u1).toBeGreaterThan(uv.u0);
      expect(uv.v1).toBeGreaterThan(uv.v0);
    }
  });

  it('generates vertex normals and normal-mapped MeshStandardMaterials across terrain, buildings, and gates', () => {
    const dummyAlbedo = new THREE.DataTexture(
      new Uint8Array(16),
      2,
      2
    ) as unknown as THREE.CanvasTexture;
    const dummyNormal = new THREE.DataTexture(
      new Uint8Array([128, 128, 255, 255]),
      1,
      1
    ) as unknown as THREE.CanvasTexture;
    dummyNormal.colorSpace = THREE.NoColorSpace;

    const atlasMat = new THREE.MeshStandardMaterial({
      map: dummyAlbedo,
      normalMap: dummyNormal,
      vertexColors: true,
    });
    const grassMat = new THREE.MeshStandardMaterial({
      map: dummyAlbedo,
      normalMap: dummyNormal,
      vertexColors: true,
    });

    const map = MAPS.villa_origen;
    const chunks = buildTerrainChunks(map, atlasMat, grassMat);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      const normalAttr = chunk.mesh.geometry.attributes.normal;
      expect(normalAttr, 'terrain chunk must have vertex normals for normalMap lighting').toBeDefined();
      expect(normalAttr.count).toBeGreaterThan(0);
      chunk.mesh.geometry.dispose();
    }

    const apron = buildTerrainBorderApron(map, atlasMat, grassMat);
    expect(apron).not.toBeNull();
    expect(apron!.geometry.attributes.normal).toBeDefined();
    apron!.geometry.dispose();

    const buildings = buildBuildingsMesh(
      map,
      atlasMat,
      () => dummyAlbedo,
      () => dummyNormal
    );
    expect(buildings).not.toBeNull();
    let roofStandardCount = 0;
    buildings!.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      expect(mesh.geometry.attributes.normal).toBeDefined();
      if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material !== atlasMat) {
        expect(mesh.material.normalMap).toBe(dummyNormal);
        roofStandardCount++;
        mesh.material.dispose();
      }
      mesh.geometry.dispose();
    });
    expect(roofStandardCount).toBeGreaterThan(0);

    const gates = buildMapGatesGroup(
      map,
      atlasMat,
      () => dummyAlbedo,
      () => dummyNormal
    );
    expect(gates).not.toBeNull();
    let gateRoofStandardCount = 0;
    gates!.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      expect(mesh.geometry.attributes.normal).toBeDefined();
      if (mesh.material instanceof THREE.MeshStandardMaterial && mesh.material !== atlasMat) {
        expect(mesh.material.normalMap).toBe(dummyNormal);
        gateRoofStandardCount++;
        mesh.material.dispose();
      } else if (mesh.material !== atlasMat && !Array.isArray(mesh.material)) {
        mesh.material.dispose();
      }
      mesh.geometry.dispose();
    });
    expect(gateRoofStandardCount).toBeGreaterThan(0);

    dummyAlbedo.dispose();
    dummyNormal.dispose();
    atlasMat.dispose();
    grassMat.dispose();
  });
});
