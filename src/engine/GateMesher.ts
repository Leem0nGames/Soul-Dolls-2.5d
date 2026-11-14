import * as THREE from 'three';
import { getTileWorldY } from '../domain/TerrainRules.ts';
import type { MapDef, WarpDef } from '../domain/types.ts';
import type { RoofTextureKind } from '../gfx/AssetProvider.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import { getTileUv } from './AtlasBuilder.ts';

type GateExitDir = 'north' | 'south' | 'west' | 'east';

interface GatePlacement {
  centerX: number;
  centerZ: number;
  groundY: number;
  yaw: number;
  style: 'arch_gate' | 'cave_portal';
  roofKind: RoofTextureKind;
  accentColor: number;
}

interface QuadBuilder {
  positions: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createQuadBuilder(): QuadBuilder {
  return { positions: [], uvs: [], colors: [], indices: [] };
}

function buildGeometry(qb: QuadBuilder): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(qb.positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(qb.uvs), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(qb.colors), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(qb.indices), 1));
  geo.computeBoundingSphere();
  return geo;
}

function pushQuad(
  qb: QuadBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  texKey: TileAtlasKey,
  rTint: number,
  gTint: number,
  bTint: number
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

function pushTiledQuad(
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

function pushTriangle(
  qb: QuadBuilder,
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  texKey: TileAtlasKey,
  rTint: number,
  gTint: number,
  bTint: number
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

function pushBox(
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

function pushColorBox(
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

function clusterWarps(map: MapDef): GatePlacement[] {
  const h = map.grid.length;
  const w = map.grid[0]?.length ?? 0;
  const visited = new Set<number>();
  const placements: GatePlacement[] = [];

  for (let i = 0; i < map.warps.length; i++) {
    if (visited.has(i)) continue;
    const queue: WarpDef[] = [map.warps[i]];
    visited.add(i);

    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      for (let j = 0; j < map.warps.length; j++) {
        if (visited.has(j)) continue;
        const other = map.warps[j];
        if (
          other.targetMap === cur.targetMap &&
          Math.abs(other.x - cur.x) + Math.abs(other.y - cur.y) <= 1
        ) {
          visited.add(j);
          queue.push(other);
        }
      }
    }

    let sumX = 0;
    let sumY = 0;
    for (const item of queue) {
      sumX += item.x;
      sumY += item.y;
    }
    const avgX = sumX / queue.length;
    const avgY = sumY / queue.length;

    let exitDir: GateExitDir = 'north';
    if (queue.some((item) => item.y === 0)) exitDir = 'north';
    else if (queue.some((item) => item.y === h - 1)) exitDir = 'south';
    else if (queue.some((item) => item.x === 0)) exitDir = 'west';
    else if (queue.some((item) => item.x === w - 1)) exitDir = 'east';

    let centerX = avgX;
    let centerZ = avgY;
    let yaw = 0;
    if (exitDir === 'north') {
      centerZ = -0.15;
      yaw = 0;
    } else if (exitDir === 'south') {
      centerZ = h - 1 + 0.15;
      yaw = Math.PI;
    } else if (exitDir === 'west') {
      centerX = -0.15;
      yaw = Math.PI * 0.5;
    } else {
      centerX = w - 1 + 0.15;
      yaw = -Math.PI * 0.5;
    }

    const isCave = map.id === 'cueva_eco' || queue[0].targetMap === 'cueva_eco';
    const roofKind: RoofTextureKind =
      map.biome === 'meadow' && map.id === 'villa_origen'
        ? 'patina'
        : map.biome === 'mountain' || map.biome === 'arena'
          ? 'indigo'
          : 'wood';

    const groundY = getTileWorldY(map, Math.round(avgX), Math.round(avgY));
    const accentColor = isCave
      ? map.id === 'cueva_eco'
        ? 0x76e8ff
        : 0xffc663
      : 0xffd573;

    placements.push({
      centerX,
      centerZ,
      groundY,
      yaw,
      style: isCave ? 'cave_portal' : 'arch_gate',
      roofKind,
      accentColor,
    });
  }

  return placements;
}

function buildArchGateGroup(
  p: GatePlacement,
  atlasMaterial: THREE.MeshBasicMaterial,
  getRoofTexture: (kind: RoofTextureKind) => THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(p.centerX, p.groundY, p.centerZ);
  group.rotation.y = p.yaw;

  const qb = createQuadBuilder();
  const rqb = createQuadBuilder();
  const glowQb = createQuadBuilder();

  // 1. Cut-stone foundation plinths (left & right, clear of 2-tile road [-1.0 .. 1.0])
  for (const side of [-1, 1] as const) {
    const sx0 = side < 0 ? -1.86 : 1.10;
    const sx1 = side < 0 ? -1.10 : 1.86;
    pushBox(qb, sx0, sx1, -0.75, 0.62, -0.50, 0.50, 'wall_brick', 0.92);
    // Stepped stone cap
    pushBox(qb, sx0 - 0.06, sx1 + 0.06, 0.62, 0.78, -0.56, 0.56, 'stone', 1.05);

    // Low stone curb + timber wing guardrails extending outward into the foliage
    const wx0 = side < 0 ? -3.15 : 1.86;
    const wx1 = side < 0 ? -1.86 : 3.15;
    pushBox(qb, wx0, wx1, -0.75, 0.34, -0.22, 0.22, 'stone', 0.90);
    pushBox(qb, wx0, wx1, 0.56, 0.72, -0.11, 0.11, 'planks', 0.98);
    // Wing end post
    const ex0 = side < 0 ? -3.22 : 2.94;
    const ex1 = side < 0 ? -2.94 : 3.22;
    pushBox(qb, ex0, ex1, 0.34, 1.18, -0.18, 0.18, 'log', 0.95);

    // 2. Heavy timber main pillars (opening clear up to y = 2.85)
    const px0 = side < 0 ? -1.68 : 1.28;
    const px1 = side < 0 ? -1.28 : 1.68;
    pushBox(qb, px0, px1, 0.78, 2.92, -0.34, 0.34, 'log', 0.96);

    // 3. Decorative diagonal knee braces connecting inner pillar face to crossbeam
    const innerX = side < 0 ? -1.28 : 1.28;
    const braceReach = side < 0 ? -0.72 : 0.72;
    const xA = Math.min(innerX, braceReach);
    const xB = Math.max(innerX, braceReach);
    pushBox(qb, xA, xB, 2.42, 2.64, -0.16, 0.16, 'planks', 0.88);
    pushBox(
      qb,
      side < 0 ? -1.28 : 1.06,
      side < 0 ? -1.06 : 1.28,
      2.12,
      2.42,
      -0.14,
      0.14,
      'planks',
      0.86
    );

    // 4. Iron lantern brackets & glowing hanging lanterns (both sides of the gate)
    const bx0 = side < 0 ? -1.28 : 1.00;
    const bx1 = side < 0 ? -1.00 : 1.28;
    pushBox(qb, bx0, bx1, 2.28, 2.38, -0.06, 0.06, 'stone', 0.65);
    const lx = side < 0 ? -1.04 : 1.04;
    // Lantern cap & base
    pushBox(qb, lx - 0.13, lx + 0.13, 2.16, 2.26, -0.13, 0.13, 'stone', 0.70);
    pushBox(qb, lx - 0.11, lx + 0.11, 1.84, 1.92, -0.11, 0.11, 'stone', 0.70);
    // Warm amber emissive lantern core
    pushColorBox(glowQb, lx - 0.09, lx + 0.09, 1.92, 2.16, -0.09, 0.09, 1.0, 0.84, 0.42);
  }

  // 5. Heavy timber crossbeam lintel + decorative route crest plaque
  pushBox(qb, -2.06, 2.06, 2.66, 3.00, -0.40, 0.40, 'log', 0.98);
  pushBox(qb, -0.78, 0.78, 2.30, 2.68, -0.44, 0.44, 'planks', 1.04, [1.05, 0.92, 0.72]);

  // 6. Pitched shingled gable canopy roof + ridge beam
  const rx0 = -2.38;
  const rx1 = 2.38;
  const rz0 = -0.84;
  const rz1 = 0.84;
  const yEave = 2.98;
  const yPeak = 3.86;
  pushTiledQuad(rqb, [rx0, yEave, rz1], [rx1, yEave, rz1], [rx1, yPeak, 0], [rx0, yPeak, 0], 2, 1, 1.02);
  pushTiledQuad(rqb, [rx1, yEave, rz0], [rx0, yEave, rz0], [rx0, yPeak, 0], [rx1, yPeak, 0], 2, 1, 0.82);

  // Gable end triangles + ridge timber beam
  pushTriangle(qb, [rx0, yEave, rz0], [rx0, yEave, rz1], [rx0, yPeak, 0], 'planks', 0.85, 0.85, 0.85);
  pushTriangle(qb, [rx1, yEave, rz1], [rx1, yEave, rz0], [rx1, yPeak, 0], 'planks', 0.90, 0.90, 0.90);
  pushBox(qb, -2.44, 2.44, 3.80, 3.96, -0.10, 0.10, 'log', 1.05);

  const archMesh = new THREE.Mesh(buildGeometry(qb), atlasMaterial);
  archMesh.matrixAutoUpdate = false;
  archMesh.updateMatrix();
  group.add(archMesh);

  const roofMat = new THREE.MeshBasicMaterial({
    map: getRoofTexture(p.roofKind),
    vertexColors: true,
  });
  const roofMesh = new THREE.Mesh(buildGeometry(rqb), roofMat);
  roofMesh.matrixAutoUpdate = false;
  roofMesh.updateMatrix();
  group.add(roofMesh);

  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(buildGeometry(glowQb), glowMat);
  glowMesh.matrixAutoUpdate = false;
  glowMesh.updateMatrix();
  group.add(glowMesh);

  group.matrixAutoUpdate = false;
  group.updateMatrix();
  return group;
}

function buildCavePortalGroup(
  p: GatePlacement,
  atlasMaterial: THREE.MeshBasicMaterial
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(p.centerX, p.groundY, p.centerZ);
  group.rotation.y = p.yaw;

  const qb = createQuadBuilder();
  const darkQb = createQuadBuilder();
  const glowQb = createQuadBuilder();

  // 1. Massive flanking crag pillars + outer rock buttresses
  for (const side of [-1, 1] as const) {
    const ix0 = side < 0 ? -2.25 : 1.06;
    const ix1 = side < 0 ? -1.06 : 2.25;
    pushBox(qb, ix0, ix1, -0.75, 2.95, -1.35, 0.65, 'stone', 0.92, [0.85, 0.86, 0.92]);

    const ox0 = side < 0 ? -3.05 : 2.10;
    const ox1 = side < 0 ? -2.10 : 3.05;
    pushBox(qb, ox0, ox1, -0.75, 2.05, -1.05, 0.45, 'stone', 0.84, [0.82, 0.84, 0.90]);

    // Inner chamfered keystone bracket
    const kx0 = side < 0 ? -1.08 : 0.68;
    const kx1 = side < 0 ? -0.68 : 1.08;
    pushBox(qb, kx0, kx1, 2.28, 2.80, -0.95, 0.58, 'stone', 0.72, [0.78, 0.80, 0.88]);

    // Crystal / torch sconce on pillar front
    const sx = side < 0 ? -1.42 : 1.42;
    pushBox(qb, sx - 0.16, sx + 0.16, 1.35, 1.62, 0.60, 0.86, 'stone', 0.75);
    const cr = ((p.accentColor >> 16) & 0xff) / 255;
    const cg = ((p.accentColor >> 8) & 0xff) / 255;
    const cb = (p.accentColor & 0xff) / 255;
    pushColorBox(glowQb, sx - 0.11, sx + 0.11, 1.62, 2.02, 0.64, 0.82, cr, cg, cb);
  }

  // 2. Vaulted stone arch lintel & stepped upper ridge cap
  pushBox(qb, -2.55, 2.55, 2.75, 3.72, -1.45, 0.75, 'stone', 0.94, [0.85, 0.86, 0.92]);
  pushBox(qb, -1.85, 1.85, 3.72, 4.35, -1.25, 0.48, 'stone', 0.98, [0.88, 0.88, 0.95]);

  // 3. Deep shadowed tunnel interior behind the opening (-Z direction)
  pushColorBox(darkQb, -1.14, 1.14, -0.45, 2.82, -2.95, -2.45, 0.03, 0.02, 0.05);
  pushColorBox(darkQb, -1.25, -1.04, -0.45, 2.82, -2.95, -0.15, 0.04, 0.03, 0.06);
  pushColorBox(darkQb, 1.04, 1.25, -0.45, 2.82, -2.95, -0.15, 0.04, 0.03, 0.06);
  pushColorBox(darkQb, -1.25, 1.25, 2.66, 2.90, -2.95, -0.15, 0.03, 0.02, 0.05);

  const rockMesh = new THREE.Mesh(buildGeometry(qb), atlasMaterial);
  rockMesh.matrixAutoUpdate = false;
  rockMesh.updateMatrix();
  group.add(rockMesh);

  const darkMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const darkMesh = new THREE.Mesh(buildGeometry(darkQb), darkMat);
  darkMesh.matrixAutoUpdate = false;
  darkMesh.updateMatrix();
  group.add(darkMesh);

  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(buildGeometry(glowQb), glowMat);
  glowMesh.matrixAutoUpdate = false;
  glowMesh.updateMatrix();
  group.add(glowMesh);

  group.matrixAutoUpdate = false;
  group.updateMatrix();
  return group;
}

/**
 * Builds composite 3D route archways and mountain cave portals at every map-to-map warp.
 */
export function buildMapGatesGroup(
  map: MapDef,
  atlasMaterial: THREE.MeshBasicMaterial,
  getRoofTexture: (kind: RoofTextureKind) => THREE.CanvasTexture
): THREE.Group | null {
  const placements = clusterWarps(map);
  if (placements.length === 0) return null;

  const root = new THREE.Group();
  for (const p of placements) {
    const gate =
      p.style === 'cave_portal'
        ? buildCavePortalGroup(p, atlasMaterial)
        : buildArchGateGroup(p, atlasMaterial, getRoofTexture);
    root.add(gate);
  }
  root.matrixAutoUpdate = false;
  root.updateMatrix();
  return root;
}
