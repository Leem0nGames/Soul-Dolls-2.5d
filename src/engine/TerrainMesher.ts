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
  grassMaterial?: THREE.MeshBasicMaterial
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

          const isTallGrass = legend.tile === 'tall_grass';
          let tileKey: TileAtlasKey = legend.tile;
          if (
            tileKey !== 'water' &&
            tileKey !== 'bridge' &&
            tileKey !== 'stairs' &&
            tileKey !== 'cobble' &&
            tileKey !== 'arena_floor'
          ) {
            if (slopeDelta >= 1.35) {
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

          const useCustomGrass = Boolean(
            grassMaterial && (tileKey === 'grass' || isTallGrass)
          );
          if (useCustomGrass) {
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

          const targetIndices = useCustomGrass ? grassIndices : atlasIndices;
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

const APRON_OUTER_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 10, 16, 28, 44] as const;

function buildSteppedAxisCoords(count: number): { coords: number[]; innerStart: number; innerEnd: number } {
  const coords: number[] = [];
  for (let i = APRON_OUTER_OFFSETS.length - 1; i >= 0; i--) {
    coords.push(-0.5 - APRON_OUTER_OFFSETS[i]);
  }
  const innerStart = coords.length;
  for (let i = 0; i <= count; i++) {
    coords.push(i - 0.5);
  }
  const innerEnd = coords.length - 1;
  for (let i = 0; i < APRON_OUTER_OFFSETS.length; i++) {
    coords.push(count - 0.5 + APRON_OUTER_OFFSETS[i]);
  }
  return { coords, innerStart, innerEnd };
}

/**
 * Builds a seamless outer terrain apron extending 44 units beyond all 4 map borders.
 * Eliminates the open sky void visible behind/beyond map-to-map warp passages while
 * sharing exact boundary vertices with the playable terrain chunks.
 */
export function buildTerrainBorderApron(
  map: MapDef,
  material: THREE.MeshBasicMaterial,
  grassMaterial?: THREE.MeshBasicMaterial
): THREE.Mesh | null {
  const height = map.grid.length;
  const width = map.grid[0]?.length ?? 0;
  if (width === 0 || height === 0) return null;

  const vCols = width + 1;
  const vGrid = buildVertexHeightGrid(map);
  const xAxis = buildSteppedAxisCoords(width);
  const zAxis = buildSteppedAxisCoords(height);

  const cols = xAxis.coords.length - 1;
  const rows = zAxis.coords.length - 1;
  const totalCells = cols * rows - width * height;
  if (totalCells <= 0) return null;

  const positions = new Float32Array(totalCells * 4 * 3);
  const uvs = new Float32Array(totalCells * 4 * 2);
  const colors = new Float32Array(totalCells * 4 * 3);
  const atlasIndices: number[] = [];
  const grassIndices: number[] = [];

  let vPtr = 0;
  let uvPtr = 0;
  let cPtr = 0;
  let vertBase = 0;

  const sampleBorderVertexY = (wx: number, wz: number): number => {
    const vx = Math.max(0, Math.min(width, Math.round(wx + 0.5)));
    const vz = Math.max(0, Math.min(height, Math.round(wz + 0.5)));
    const outX = wx < -0.5 ? -0.5 - wx : wx > width - 0.5 ? wx - (width - 0.5) : 0;
    const outZ = wz < -0.5 ? -0.5 - wz : wz > height - 0.5 ? wz - (height - 0.5) : 0;
    const outDist = Math.max(outX, outZ);
    let baseY = vGrid[vz * vCols + vx] * HEIGHT_UNIT;
    if (outDist >= 5) {
      const t = Math.min(1, (outDist - 5) / 14);
      const undulate = (Math.sin(wx * 0.16 + wz * 0.13) * 0.5 + 0.5) * 0.65;
      baseY += (0.55 + undulate) * t;
    }
    return baseY;
  };

  for (let iz = 0; iz < rows; iz++) {
    const z0 = zAxis.coords[iz];
    const z1 = zAxis.coords[iz + 1];
    const zInside = iz >= zAxis.innerStart && iz < zAxis.innerEnd;
    const midZ = (z0 + z1) * 0.5;
    const outZ = midZ < -0.5 ? -0.5 - midZ : midZ > height - 0.5 ? midZ - (height - 0.5) : 0;

    for (let ix = 0; ix < cols; ix++) {
      const xInside = ix >= xAxis.innerStart && ix < xAxis.innerEnd;
      if (xInside && zInside) continue;

      const x0 = xAxis.coords[ix];
      const x1 = xAxis.coords[ix + 1];
      const midX = (x0 + x1) * 0.5;
      const outX = midX < -0.5 ? -0.5 - midX : midX > width - 0.5 ? midX - (width - 0.5) : 0;
      const outDist = Math.max(outX, outZ);

      // Slightly bend road continuation after 2 tiles behind the gate, then blend into natural terrain
      const bendOffset = outDist > 2 ? Math.round(Math.min(3, (outDist - 2) * 0.65)) : 0;
      const effX = outZ > outX ? midX - bendOffset : midX;
      const effZ = outX > outZ ? midZ - bendOffset : midZ;

      const sampleX = Math.max(0, Math.min(width - 1, Math.floor(effX + 0.5)));
      const sampleZ = Math.max(0, Math.min(height - 1, Math.floor(effZ + 0.5)));

      const ch = map.grid[sampleZ]?.[sampleX] ?? '.';
      const legend = map.legend[ch] ?? { tile: 'grass' as const, solid: false };
      const tileLevel = getTileHeightLevel(map, sampleX, sampleZ);

      let tileKey: TileAtlasKey = legend.tile;
      if (outDist > 5.5 && (tileKey === 'cobble' || tileKey === 'dirt' || (tileKey === 'stone' && !legend.solid))) {
        tileKey = map.id === 'cueva_eco' ? 'stone' : map.biome === 'mountain' ? 'dirt' : 'grass';
      } else if (tileKey === 'tall_grass') {
        tileKey = 'grass';
      } else if (tileKey === 'stairs') {
        tileKey = 'cobble';
      } else if (tileKey === 'bridge') {
        tileKey = 'stone';
      }

      if (
        map.snowLine !== undefined &&
        tileLevel >= map.snowLine &&
        (tileKey === 'grass' || tileKey === 'dirt')
      ) {
        tileKey = 'snow';
      }

      const y00 = sampleBorderVertexY(x0, z0);
      const y10 = sampleBorderVertexY(x1, z0);
      const y11 = sampleBorderVertexY(x1, z1);
      const y01 = sampleBorderVertexY(x0, z1);

      positions[vPtr++] = x0; positions[vPtr++] = y01; positions[vPtr++] = z1;
      positions[vPtr++] = x1; positions[vPtr++] = y11; positions[vPtr++] = z1;
      positions[vPtr++] = x1; positions[vPtr++] = y10; positions[vPtr++] = z0;
      positions[vPtr++] = x0; positions[vPtr++] = y00; positions[vPtr++] = z0;

      const dx = x1 - x0;
      const dz = z1 - z0;
      const useCustomGrass = Boolean(grassMaterial && tileKey === 'grass');
      if (useCustomGrass) {
        const gu0 = (Math.abs(Math.round(x0 + 0.5)) % 2) * 0.5;
        const gu1 = gu0 + dx * 0.5;
        const gv1 = 1 - (Math.abs(Math.round(z0 + 0.5)) % 2) * 0.5;
        const gv0 = gv1 - dz * 0.5;
        uvs[uvPtr++] = gu0; uvs[uvPtr++] = gv0;
        uvs[uvPtr++] = gu1; uvs[uvPtr++] = gv0;
        uvs[uvPtr++] = gu1; uvs[uvPtr++] = gv1;
        uvs[uvPtr++] = gu0; uvs[uvPtr++] = gv1;
      } else {
        const rect = getTileUv(tileKey);
        uvs[uvPtr++] = rect.u0; uvs[uvPtr++] = rect.v0;
        uvs[uvPtr++] = rect.u1; uvs[uvPtr++] = rect.v0;
        uvs[uvPtr++] = rect.u1; uvs[uvPtr++] = rect.v1;
        uvs[uvPtr++] = rect.u0; uvs[uvPtr++] = rect.v1;
      }

      _e1.set(dx, y11 - y01, 0);
      _e2.set(0, y00 - y01, -dz);
      _norm.crossVectors(_e1, _e2).normalize();
      const sunDot = Math.max(0, _norm.dot(_sun));
      const checker = (ix + iz) % 2 === 0 ? 1.0 : 0.96;
      const heightTint = 0.88 + Math.min(0.18, tileLevel * 0.02);
      const shade = Math.min(1.08, (0.58 + sunDot * 0.48) * checker * heightTint);

      for (let k = 0; k < 4; k++) {
        colors[cPtr++] = shade;
        colors[cPtr++] = shade;
        colors[cPtr++] = shade;
      }

      const targetIndices = useCustomGrass ? grassIndices : atlasIndices;
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
  geo.addGroup(0, atlasIndices.length, 0);
  if (indices.length > 0) {
    geo.setIndex(indices);
  }

  const mesh = new THREE.Mesh(geo, mats.length === 1 ? mats[0] : mats);
  geo.computeBoundingSphere();
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}
