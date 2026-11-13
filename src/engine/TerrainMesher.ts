import { getTileHeightLevel, HEIGHT_UNIT } from '../domain/TerrainRules.ts';
import type { MapDef } from '../domain/types.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import * as THREE from 'three';
import { getTileUv } from './AtlasBuilder.ts';

export const CHUNK_SIZE = 16;

export interface TerrainChunk {
  cx: number;
  cz: number;
  centerX: number;
  centerZ: number;
  mesh: THREE.Mesh;
  waterUvIndices: number[];
}

function buildVertexHeightGrid(map: MapDef): Float32Array {
  const h = map.grid.length;
  const w = map.grid[0]?.length ?? 0;
  const cols = w + 1;
  const rows = h + 1;
  const grid = new Float32Array(cols * rows);

  for (let vz = 0; vz < rows; vz++) {
    for (let vx = 0; vx < cols; vx++) {
      let sum = 0;
      let count = 0;
      let hasWater = false;
      for (let dz = -1; dz <= 0; dz++) {
        for (let dx = -1; dx <= 0; dx++) {
          const tx = vx + dx;
          const tz = vz + dz;
          if (tx >= 0 && tx < w && tz >= 0 && tz < h) {
            const ch = map.grid[tz][tx];
            if (map.legend[ch]?.tile === 'water') hasWater = true;
            sum += getTileHeightLevel(map, tx, tz);
            count++;
          }
        }
      }
      const avg = count > 0 ? sum / count : 0;
      grid[vz * cols + vx] = hasWater ? Math.min(avg, getTileHeightLevel(map, Math.min(w - 1, vx), Math.min(h - 1, vz))) : avg;
    }
  }
  return grid;
}

const _e1 = new THREE.Vector3();
const _e2 = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _sun = new THREE.Vector3(0.45, 0.82, 0.35).normalize();

export function buildTerrainChunks(
  map: MapDef,
  material: THREE.MeshBasicMaterial,
  grassMaterial?: THREE.MeshBasicMaterial,
  tallGrassMaterial?: THREE.MeshBasicMaterial
): TerrainChunk[] {
  const height = map.grid.length;
  const width = map.grid[0]?.length ?? 0;
  const vCols = width + 1;
  const vGrid = buildVertexHeightGrid(map);

  const chunksX = Math.ceil(width / CHUNK_SIZE);
  const chunksZ = Math.ceil(height / CHUNK_SIZE);
  const chunks: TerrainChunk[] = [];

  for (let cz = 0; cz < chunksZ; cz++) {
    for (let cx = 0; cx < chunksX; cx++) {
      const startX = cx * CHUNK_SIZE;
      const startZ = cz * CHUNK_SIZE;
      const endX = Math.min(width, startX + CHUNK_SIZE);
      const endZ = Math.min(height, startZ + CHUNK_SIZE);

      const tileCount = (endX - startX) * (endZ - startZ);
      const positions = new Float32Array(tileCount * 4 * 3);
      const uvs = new Float32Array(tileCount * 4 * 2);
      const colors = new Float32Array(tileCount * 4 * 3);
      const atlasIndices: number[] = [];
      const grassIndices: number[] = [];
      const tallGrassIndices: number[] = [];
      const waterUvIndices: number[] = [];

      let vPtr = 0;
      let uvPtr = 0;
      let cPtr = 0;
      let vertBase = 0;

      for (let z = startZ; z < endZ; z++) {
        const row = map.grid[z];
        for (let x = startX; x < endX; x++) {
          const ch = row[x] ?? '.';
          const legend = map.legend[ch] ?? { tile: 'grass' as const, solid: false };

          const h00 = vGrid[z * vCols + x];
          const h10 = vGrid[z * vCols + (x + 1)];
          const h11 = vGrid[(z + 1) * vCols + (x + 1)];
          const h01 = vGrid[(z + 1) * vCols + x];

          const minH = Math.min(h00, h10, h11, h01);
          const maxH = Math.max(h00, h10, h11, h01);
          const tileLevel = getTileHeightLevel(map, x, z);
          const slopeDelta = maxH - minH;

          let tileKey: TileAtlasKey = legend.tile;
          if (
            tileKey !== 'water' &&
            tileKey !== 'bridge' &&
            tileKey !== 'stairs' &&
            tileKey !== 'cobble' &&
            tileKey !== 'arena_floor'
          ) {
            if (slopeDelta >= 0.85) {
              tileKey = tileLevel <= 2 && map.id !== 'cueva_eco' ? 'dirt' : 'stone';
            } else if (
              map.snowLine !== undefined &&
              tileLevel >= map.snowLine &&
              (tileKey === 'grass' || tileKey === 'dirt' || tileKey === 'tall_grass')
            ) {
              tileKey = 'snow';
            }
          }

          const y00 = h00 * HEIGHT_UNIT;
          const y10 = h10 * HEIGHT_UNIT;
          const y11 = h11 * HEIGHT_UNIT;
          const y01 = h01 * HEIGHT_UNIT;

          const x0 = x - 0.5;
          const x1 = x + 0.5;
          const z0 = z - 0.5;
          const z1 = z + 0.5;

          positions[vPtr++] = x0; positions[vPtr++] = y01; positions[vPtr++] = z1;
          positions[vPtr++] = x1; positions[vPtr++] = y11; positions[vPtr++] = z1;
          positions[vPtr++] = x1; positions[vPtr++] = y10; positions[vPtr++] = z0;
          positions[vPtr++] = x0; positions[vPtr++] = y00; positions[vPtr++] = z0;

          const useCustomGrass = Boolean(grassMaterial && tileKey === 'grass');
          const useCustomTallGrass = Boolean(tallGrassMaterial && tileKey === 'tall_grass');
          if (useCustomGrass || useCustomTallGrass) {
            const gu0 = (x % 2) * 0.5;
            const gu1 = gu0 + 0.5;
            const gv1 = 1 - (z % 2) * 0.5;
            const gv0 = gv1 - 0.5;
            uvs[uvPtr++] = gu0; uvs[uvPtr++] = gv0;
            uvs[uvPtr++] = gu1; uvs[uvPtr++] = gv0;
            uvs[uvPtr++] = gu1; uvs[uvPtr++] = gv1;
            uvs[uvPtr++] = gu0; uvs[uvPtr++] = gv1;
          } else {
            if (tileKey === 'water') {
              waterUvIndices.push(uvPtr);
            }
            const rect = getTileUv(tileKey);
            uvs[uvPtr++] = rect.u0; uvs[uvPtr++] = rect.v0;
            uvs[uvPtr++] = rect.u1; uvs[uvPtr++] = rect.v0;
            uvs[uvPtr++] = rect.u1; uvs[uvPtr++] = rect.v1;
            uvs[uvPtr++] = rect.u0; uvs[uvPtr++] = rect.v1;
          }

          _e1.set(1, y11 - y01, 0);
          _e2.set(0, y00 - y01, -1);
          _norm.crossVectors(_e1, _e2).normalize();
          const sunDot = Math.max(0, _norm.dot(_sun));
          const checker = (x + z) % 2 === 0 ? 1.0 : 0.96;
          const heightTint = 0.88 + Math.min(0.18, tileLevel * 0.02);
          const shade = Math.min(1.08, (0.58 + sunDot * 0.48) * checker * heightTint);

          for (let k = 0; k < 4; k++) {
            colors[cPtr++] = shade;
            colors[cPtr++] = shade;
            colors[cPtr++] = shade;
          }

          const targetIndices = useCustomGrass ? grassIndices : useCustomTallGrass ? tallGrassIndices : atlasIndices;
          targetIndices.push(
            vertBase,
            vertBase + 1,
            vertBase + 2,
            vertBase,
            vertBase + 2,
            vertBase + 3
          );
          vertBase += 4;
        }
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const mats: THREE.MeshBasicMaterial[] = [material];
      const indices: number[] = [...atlasIndices];
      if (grassMaterial && grassIndices.length > 0) {
        const idx = mats.length;
        mats.push(grassMaterial);
        geo.addGroup(indices.length, grassIndices.length, idx);
        indices.push(...grassIndices);
      }
      if (tallGrassMaterial && tallGrassIndices.length > 0) {
        const idx = mats.length;
        mats.push(tallGrassMaterial);
        geo.addGroup(indices.length, tallGrassIndices.length, idx);
        indices.push(...tallGrassIndices);
      }
      geo.addGroup(0, atlasIndices.length, 0);
      if (indices.length > 0) {
        geo.setIndex(indices);
      }

      const mesh = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
      geo.computeBoundingSphere();
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();

      chunks.push({
        cx,
        cz,
        centerX: (startX + endX) * 0.5,
        centerZ: (startZ + endZ) * 0.5,
        mesh,
        waterUvIndices,
      });
    }
  }

  return chunks;
}

export function updateVisibleTerrainChunks(
  chunks: readonly TerrainChunk[],
  playerX: number,
  playerZ: number,
  viewRadius = 24
): void {
  for (const chunk of chunks) {
    const dx = chunk.centerX - playerX;
    const dz = chunk.centerZ - playerZ;
    chunk.mesh.visible = dx * dx + dz * dz <= viewRadius * viewRadius;
  }
}

export function updateTerrainWaterFrame(chunks: readonly TerrainChunk[], frame: 0 | 1): void {
  const rect = getTileUv(frame === 0 ? 'water' : 'water_1');
  for (const chunk of chunks) {
    if (chunk.waterUvIndices.length === 0) continue;
    const uvAttr = chunk.mesh.geometry.attributes.uv;
    for (const idx of chunk.waterUvIndices) {
      uvAttr.setXY(idx / 2, rect.u0, rect.v0);
      uvAttr.setXY(idx / 2 + 1, rect.u1, rect.v0);
      uvAttr.setXY(idx / 2 + 2, rect.u1, rect.v1);
      uvAttr.setXY(idx / 2 + 3, rect.u0, rect.v1);
    }
    uvAttr.needsUpdate = true;
  }
}
