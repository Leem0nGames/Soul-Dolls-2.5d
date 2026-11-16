import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import { getTileHeightLevel, isTileWalkable } from '../src/domain/TerrainRules.ts';
import { buildMapGatesGroup } from '../src/engine/GateMesher.ts';
import { buildTerrainBorderApron } from '../src/engine/TerrainMesher.ts';

describe('Map passages & border apron', () => {
  it('ensures every warp across all 6 maps has flat shoulders and no sheer V-trench cliffs', () => {
    const mapList = Object.values(MAPS);
    expect(mapList.length).toBeGreaterThanOrEqual(6);

    for (const map of mapList) {
      const h = map.grid.length;
      const w = map.grid[0].length;

      for (const warp of map.warps) {
        const ch = map.grid[warp.y]?.[warp.x];
        const leg = map.legend[ch];
        expect(leg, `${map.id} warp (${warp.x},${warp.y}) missing legend`).toBeDefined();
        expect(leg.solid, `${map.id} warp (${warp.x},${warp.y}) must be walkable`).toBe(false);

        // No hand-placed prop, sign, or NPC should occupy the warp tile
        expect(map.props.some((p) => p.x === warp.x && p.z === warp.y)).toBe(false);
        expect(map.signs.some((s) => s.x === warp.x && s.y === warp.y)).toBe(false);
        expect(map.npcs.some((n) => n.x === warp.x && n.y === warp.y)).toBe(false);

        // Check height smoothness around every warp (2-tile shoulder has maxDiff <= 1, never a sheer cliff)
        const warpH = getTileHeightLevel(map, warp.x, warp.y);
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const nx = warp.x + dx;
            const ny = warp.y + dy;
            if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
            const neighborH = getTileHeightLevel(map, nx, ny);
            expect(
              Math.abs(neighborH - warpH),
              `${map.id} warp (${warp.x},${warp.y}) neighbor (${nx},${ny}) cliff delta too steep`
            ).toBeLessThanOrEqual(1);
          }
        }

        // Verify target spawn tile on destination map is walkable from at least one neighbor
        const targetMap = MAPS[warp.targetMap];
        expect(targetMap).toBeDefined();
        const tx = warp.targetX;
        const ty = warp.targetY;
        const neighbors: [number, number][] = [
          [tx + 1, ty],
          [tx - 1, ty],
          [tx, ty + 1],
          [tx, ty - 1],
        ];
        expect(
          neighbors.some(([nx, ny]) => isTileWalkable(targetMap, tx, ty, nx, ny)),
          `${warp.targetMap} spawn (${tx},${ty}) should be walkable`
        ).toBe(true);
      }
    }
  });

  it('builds a seamless outer terrain border apron extending beyond all 4 map borders', () => {
    const atlasMat = new THREE.MeshBasicMaterial();
    const grassMat = new THREE.MeshBasicMaterial();
    const map = MAPS.ruta_1;
    const width = map.grid[0].length;
    const height = map.grid.length;

    const apron = buildTerrainBorderApron(map, atlasMat, grassMat);
    expect(apron).not.toBeNull();
    if (!apron) return;

    apron.geometry.computeBoundingBox();
    const box = apron.geometry.boundingBox!;
    expect(box.min.x).toBeLessThan(-40);
    expect(box.max.x).toBeGreaterThan(width + 39);
    expect(box.min.z).toBeLessThan(-40);
    expect(box.max.z).toBeGreaterThan(height + 39);

    const pos = apron.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) {
      expect(Number.isFinite(pos[i])).toBe(true);
    }

    apron.geometry.dispose();
    atlasMat.dispose();
    grassMat.dispose();
  });

  it('builds 3D route archways and cave portals at all map warp clusters', () => {
    const atlasMat = new THREE.MeshBasicMaterial();
    const dummyTex = new THREE.DataTexture(
      new Uint8Array(16),
      2,
      2
    ) as unknown as THREE.CanvasTexture;

    for (const map of Object.values(MAPS)) {
      if (map.isInterior) continue;
      const group = buildMapGatesGroup(map, atlasMat, () => dummyTex);
      expect(group, `${map.id} should generate 3D warp gates`).not.toBeNull();
      if (!group) continue;

      let meshCount = 0;
      group.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          meshCount++;
          const pos = mesh.geometry.attributes.position.array as Float32Array;
          expect(pos.length).toBeGreaterThan(0);
          mesh.geometry.dispose();
          if (mesh.material !== atlasMat && !Array.isArray(mesh.material)) {
            mesh.material.dispose();
          }
        }
      });
      expect(meshCount).toBeGreaterThanOrEqual(3);
    }

    dummyTex.dispose();
    atlasMat.dispose();
  });
});
