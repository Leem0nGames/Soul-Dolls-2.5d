import * as THREE from 'three';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import { getTileUv } from './AtlasBuilder.ts';

export interface QuadBuilder {
  positions: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

export function createQuadBuilder(): QuadBuilder {
  return { positions: [], uvs: [], colors: [], indices: [] };
}

export function buildGeometryFromQuadBuilder(qb: QuadBuilder): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(qb.positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(qb.uvs), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(qb.colors), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(qb.indices), 1));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

export function pushQuad(
  qb: QuadBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  texKey: TileAtlasKey,
  rTint: number,
  gTint = rTint,
  bTint = rTint
): void {
  const base = qb.positions.length / 3;
  qb.positions.push(...p0, ...p1, ...p2, ...p3);
  const r = getTileUv(texKey);
  qb.uvs.push(r.u0, r.v0, r.u1, r.v0, r.u1, r.v1, r.u0, r.v1);
  for (let i = 0; i < 4; i++) {
    qb.colors.push(rTint, gTint, bTint);
  }
  qb.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function pushTiledQuad(
  qb: QuadBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  uRepeat: number,
  vRepeat: number,
  shade: number
): void {
  const base = qb.positions.length / 3;
  qb.positions.push(...p0, ...p1, ...p2, ...p3);
  qb.uvs.push(0, 0, uRepeat, 0, uRepeat, vRepeat, 0, vRepeat);
  for (let i = 0; i < 4; i++) {
    qb.colors.push(shade, shade, shade);
  }
  qb.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

export function pushTriangle(
  qb: QuadBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  texKey: TileAtlasKey,
  rTint: number,
  gTint = rTint,
  bTint = rTint
): void {
  const base = qb.positions.length / 3;
  qb.positions.push(...p0, ...p1, ...p2);
  const r = getTileUv(texKey);
  qb.uvs.push(r.u0, r.v0, r.u1, r.v0, (r.u0 + r.u1) * 0.5, r.v1);
  for (let i = 0; i < 3; i++) {
    qb.colors.push(rTint, gTint, bTint);
  }
  qb.indices.push(base, base + 1, base + 2);
}

export function pushBox(
  qb: QuadBuilder,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  texKey: TileAtlasKey,
  shade = 1,
  tint: [number, number, number] = [1, 1, 1]
): void {
  const [tr, tg, tb] = tint;
  // Front (+Z)
  pushQuad(qb, [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], texKey, 0.96 * shade * tr, 0.96 * shade * tg, 0.96 * shade * tb);
  // Back (-Z)
  pushQuad(qb, [x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], texKey, 0.80 * shade * tr, 0.80 * shade * tg, 0.80 * shade * tb);
  // Right (+X)
  pushQuad(qb, [x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], texKey, 0.88 * shade * tr, 0.88 * shade * tg, 0.88 * shade * tb);
  // Left (-X)
  pushQuad(qb, [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], texKey, 0.84 * shade * tr, 0.84 * shade * tg, 0.84 * shade * tb);
  // Top (+Y)
  pushQuad(qb, [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], texKey, 1.04 * shade * tr, 1.04 * shade * tg, 1.04 * shade * tb);
  // Bottom (-Y)
  pushQuad(qb, [x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], texKey, 0.62 * shade * tr, 0.62 * shade * tg, 0.62 * shade * tb);
}

export function pushColorBox(
  qb: QuadBuilder,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  r: number,
  g: number,
  b: number
): void {
  const push = (
    p0: [number, number, number],
    p1: [number, number, number],
    p2: [number, number, number],
    p3: [number, number, number],
    s: number
  ) => {
    const base = qb.positions.length / 3;
    qb.positions.push(...p0, ...p1, ...p2, ...p3);
    qb.uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) qb.colors.push(r * s, g * s, b * s);
    qb.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  push([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 1.0);
  push([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0.9);
  push([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 0.92);
  push([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.92);
  push([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 1.0);
  push([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.78);
}
