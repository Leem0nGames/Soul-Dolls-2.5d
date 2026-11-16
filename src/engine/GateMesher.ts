import * as THREE from 'three';
import { getTileWorldY } from '../domain/TerrainRules.ts';
import type { MapDef, WarpDef } from '../domain/types.ts';
import type { RoofTextureKind } from '../gfx/AssetProvider.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import {
  buildGeometryFromQuadBuilder,
  createQuadBuilder,
  pushColorBox,
  pushTiledBox,
  pushTiledQuad,
  pushTriangle,
  type QuadBuilder,
} from './QuadGeometry.ts';

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

function clusterWarps(map: MapDef): GatePlacement[] {
  if (map.isInterior) return [];
  const h = map.grid.length;
  const w = map.grid[0]?.length ?? 0;
  const edgeWarps = map.warps.filter(
    (warp) =>
      !warp.houseId &&
      warp.doorStyle !== 'building' &&
      warp.doorStyle !== 'interior'
  );
  const visited = new Set<number>();
  const placements: GatePlacement[] = [];

  for (let i = 0; i < edgeWarps.length; i++) {
    if (visited.has(i)) continue;
    const queue: WarpDef[] = [edgeWarps[i]];
    visited.add(i);

    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      for (let j = 0; j < edgeWarps.length; j++) {
        if (visited.has(j)) continue;
        const other = edgeWarps[j];
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

function pushGateBox(
  qb: QuadBuilder,
  wallBuilders: Map<TileAtlasKey, QuadBuilder> | null,
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
  let targetQb = qb;
  if (wallBuilders) {
    let wqb = wallBuilders.get(texKey);
    if (!wqb) {
      wqb = createQuadBuilder();
      wallBuilders.set(texKey, wqb);
    }
    targetQb = wqb;
  }
  pushTiledBox(targetQb, x0, x1, y0, y1, z0, z1, shade, tint);
}

function buildArchGateGroup(
  p: GatePlacement,
  atlasMaterial: THREE.Material,
  getRoofTexture: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getRoofNormalTexture?: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getWallTexture?: (key: TileAtlasKey) => THREE.CanvasTexture,
  getWallNormalTexture?: (key: TileAtlasKey) => THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(p.centerX, p.groundY, p.centerZ);
  group.rotation.y = p.yaw;

  const qb = createQuadBuilder();
  const wallBuilders = getWallTexture ? new Map<TileAtlasKey, QuadBuilder>() : null;
  const rqb = createQuadBuilder();
  const glowQb = createQuadBuilder();

  // 1. Fieldstone foundation plinths (left & right, clear of 2-tile road [-1.0 .. 1.0])
  for (const side of [-1, 1] as const) {
    const sx0 = side < 0 ? -1.86 : 1.10;
    const sx1 = side < 0 ? -1.10 : 1.86;
    pushGateBox(qb, wallBuilders, sx0, sx1, -0.75, 0.62, -0.50, 0.50, 'wall_fieldstone', 0.96);
    // Stepped cut stone cap
    pushGateBox(qb, wallBuilders, sx0 - 0.06, sx1 + 0.06, 0.62, 0.78, -0.56, 0.56, 'stone', 1.04);

    // Low mossy stone curb + timber wing guardrails extending outward into the foliage
    const wx0 = side < 0 ? -3.15 : 1.86;
    const wx1 = side < 0 ? -1.86 : 3.15;
    pushGateBox(qb, wallBuilders, wx0, wx1, -0.75, 0.34, -0.22, 0.22, 'mossy_stone', 0.95);
    pushGateBox(qb, wallBuilders, wx0, wx1, 0.56, 0.72, -0.11, 0.11, 'planks', 0.98);
    // Wing end post
    const ex0 = side < 0 ? -3.22 : 2.94;
    const ex1 = side < 0 ? -2.94 : 3.22;
    pushGateBox(qb, wallBuilders, ex0, ex1, 0.34, 1.18, -0.18, 0.18, 'log', 0.96);

    // 2. Heavy timber main pillars (opening clear up to y = 2.85)
    const px0 = side < 0 ? -1.68 : 1.28;
    const px1 = side < 0 ? -1.28 : 1.68;
    pushGateBox(qb, wallBuilders, px0, px1, 0.78, 2.92, -0.34, 0.34, 'log', 0.98);

    // 3. Decorative diagonal knee braces connecting inner pillar face to crossbeam
    const innerX = side < 0 ? -1.28 : 1.28;
    const braceReach = side < 0 ? -0.72 : 0.72;
    const xA = Math.min(innerX, braceReach);
    const xB = Math.max(innerX, braceReach);
    pushGateBox(qb, wallBuilders, xA, xB, 2.42, 2.64, -0.16, 0.16, 'planks', 0.92);
    pushGateBox(
      qb,
      wallBuilders,
      side < 0 ? -1.28 : 1.06,
      side < 0 ? -1.06 : 1.28,
      2.12,
      2.42,
      -0.14,
      0.14,
      'planks',
      0.90
    );

    // 4. Iron lantern brackets & glowing hanging lanterns (both sides of the gate)
    const bx0 = side < 0 ? -1.28 : 1.00;
    const bx1 = side < 0 ? -1.00 : 1.28;
    pushGateBox(qb, wallBuilders, bx0, bx1, 2.28, 2.38, -0.06, 0.06, 'wall_iron', 0.85);
    const lx = side < 0 ? -1.04 : 1.04;
    // Lantern cap & base
    pushGateBox(qb, wallBuilders, lx - 0.13, lx + 0.13, 2.16, 2.26, -0.13, 0.13, 'wall_iron', 0.88);
    pushGateBox(qb, wallBuilders, lx - 0.11, lx + 0.11, 1.84, 1.92, -0.11, 0.11, 'wall_iron', 0.88);
    // Warm amber HDR emissive lantern core (triggers soft bloom above 1.04 threshold)
    pushColorBox(glowQb, lx - 0.09, lx + 0.09, 1.92, 2.16, -0.09, 0.09, 1.45, 1.22, 0.58);
  }

  // 5. Heavy timber crossbeam lintel + decorative route crest plaque
  pushGateBox(qb, wallBuilders, -2.06, 2.06, 2.66, 3.00, -0.40, 0.40, 'log', 0.98);
  pushGateBox(qb, wallBuilders, -0.78, 0.78, 2.30, 2.68, -0.44, 0.44, 'planks', 1.04, [1.05, 0.92, 0.72]);

  // 6. Pitched shingled gable canopy roof + ridge beam
  const rx0 = -2.38;
  const rx1 = 2.38;
  const rz0 = -0.84;
  const rz1 = 0.84;
  const yEave = 2.98;
  const yPeak = 3.86;
  pushTiledQuad(rqb, [rx0, yEave, rz1], [rx1, yEave, rz1], [rx1, yPeak, 0], [rx0, yPeak, 0], 2, 1, 1.02);
  pushTiledQuad(rqb, [rx1, yEave, rz0], [rx0, yEave, rz0], [rx0, yPeak, 0], [rx1, yPeak, 0], 2, 1, 0.88);

  // Gable end triangles + ridge timber beam
  pushTriangle(qb, [rx0, yEave, rz0], [rx0, yEave, rz1], [rx0, yPeak, 0], 'planks', 0.90, 0.90, 0.90);
  pushTriangle(qb, [rx1, yEave, rz1], [rx1, yEave, rz0], [rx1, yPeak, 0], 'planks', 0.94, 0.94, 0.94);
  pushGateBox(qb, wallBuilders, -2.44, 2.44, 3.80, 3.96, -0.10, 0.10, 'log', 1.05);

  if (wallBuilders && getWallTexture) {
    for (const [wKey, wqb] of wallBuilders.entries()) {
      if (wqb.indices.length === 0) continue;
      const wMat = new THREE.MeshStandardMaterial({
        map: getWallTexture(wKey),
        normalMap: getWallNormalTexture ? getWallNormalTexture(wKey) : null,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.85,
        metalness: 0.05,
        vertexColors: true,
      });
      const wMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(wqb), wMat);
      wMesh.matrixAutoUpdate = false;
      wMesh.updateMatrix();
      group.add(wMesh);
    }
  }

  if (qb.indices.length > 0) {
    const archMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(qb), atlasMaterial);
    archMesh.matrixAutoUpdate = false;
    archMesh.updateMatrix();
    group.add(archMesh);
  }

  const roofMat = new THREE.MeshStandardMaterial({
    map: getRoofTexture(p.roofKind),
    normalMap: getRoofNormalTexture ? getRoofNormalTexture(p.roofKind) : null,
    normalScale: new THREE.Vector2(1.05, 1.05),
    roughness: 0.9,
    metalness: 0.04,
    vertexColors: true,
  });
  const roofMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(rqb), roofMat);
  roofMesh.matrixAutoUpdate = false;
  roofMesh.updateMatrix();
  group.add(roofMesh);

  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(glowQb), glowMat);
  glowMesh.matrixAutoUpdate = false;
  glowMesh.updateMatrix();
  group.add(glowMesh);

  group.matrixAutoUpdate = false;
  group.updateMatrix();
  return group;
}

function buildCavePortalGroup(
  p: GatePlacement,
  atlasMaterial: THREE.Material,
  getWallTexture?: (key: TileAtlasKey) => THREE.CanvasTexture,
  getWallNormalTexture?: (key: TileAtlasKey) => THREE.CanvasTexture
): THREE.Group {
  const group = new THREE.Group();
  group.position.set(p.centerX, p.groundY, p.centerZ);
  group.rotation.y = p.yaw;

  const qb = createQuadBuilder();
  const wallBuilders = getWallTexture ? new Map<TileAtlasKey, QuadBuilder>() : null;
  const darkQb = createQuadBuilder();
  const glowQb = createQuadBuilder();

  // 1. Massive flanking crag pillars + outer rock buttresses
  for (const side of [-1, 1] as const) {
    const ix0 = side < 0 ? -2.25 : 1.06;
    const ix1 = side < 0 ? -1.06 : 2.25;
    pushGateBox(qb, wallBuilders, ix0, ix1, -0.75, 2.95, -1.35, 0.65, 'cliff_rock', 0.96, [0.92, 0.92, 0.98]);

    const ox0 = side < 0 ? -3.05 : 2.10;
    const ox1 = side < 0 ? -2.10 : 3.05;
    pushGateBox(qb, wallBuilders, ox0, ox1, -0.75, 2.05, -1.05, 0.45, 'cliff_rock', 0.90, [0.90, 0.90, 0.96]);

    // Inner chamfered keystone bracket
    const kx0 = side < 0 ? -1.08 : 0.68;
    const kx1 = side < 0 ? -0.68 : 1.08;
    pushGateBox(qb, wallBuilders, kx0, kx1, 2.28, 2.80, -0.95, 0.58, 'cracked_stone', 0.88, [0.88, 0.90, 0.96]);

    // Crystal / torch sconce on pillar front
    const sx = side < 0 ? -1.42 : 1.42;
    pushGateBox(qb, wallBuilders, sx - 0.16, sx + 0.16, 1.35, 1.62, 0.60, 0.86, 'wall_crypt', 0.92);
    const cr = (((p.accentColor >> 16) & 0xff) / 255) * 1.45;
    const cg = (((p.accentColor >> 8) & 0xff) / 255) * 1.45;
    const cb = ((p.accentColor & 0xff) / 255) * 1.45;
    pushColorBox(glowQb, sx - 0.11, sx + 0.11, 1.62, 2.02, 0.64, 0.82, cr, cg, cb);
  }

  // 2. Vaulted stone arch lintel & stepped upper ridge cap
  pushGateBox(qb, wallBuilders, -2.55, 2.55, 2.75, 3.72, -1.45, 0.75, 'cracked_stone', 0.96, [0.90, 0.90, 0.96]);
  pushGateBox(qb, wallBuilders, -1.85, 1.85, 3.72, 4.35, -1.25, 0.48, 'cliff_rock', 1.0, [0.92, 0.92, 0.98]);

  // 3. Deep shadowed tunnel interior behind the opening (-Z direction)
  pushColorBox(darkQb, -1.14, 1.14, -0.45, 2.82, -2.95, -2.45, 0.03, 0.02, 0.05);
  pushColorBox(darkQb, -1.25, -1.04, -0.45, 2.82, -2.95, -0.15, 0.04, 0.03, 0.06);
  pushColorBox(darkQb, 1.04, 1.25, -0.45, 2.82, -2.95, -0.15, 0.04, 0.03, 0.06);
  pushColorBox(darkQb, -1.25, 1.25, 2.66, 2.90, -2.95, -0.15, 0.03, 0.02, 0.05);

  if (wallBuilders && getWallTexture) {
    for (const [wKey, wqb] of wallBuilders.entries()) {
      if (wqb.indices.length === 0) continue;
      const wMat = new THREE.MeshStandardMaterial({
        map: getWallTexture(wKey),
        normalMap: getWallNormalTexture ? getWallNormalTexture(wKey) : null,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.85,
        metalness: 0.05,
        vertexColors: true,
      });
      const wMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(wqb), wMat);
      wMesh.matrixAutoUpdate = false;
      wMesh.updateMatrix();
      group.add(wMesh);
    }
  }

  if (qb.indices.length > 0) {
    const rockMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(qb), atlasMaterial);
    rockMesh.matrixAutoUpdate = false;
    rockMesh.updateMatrix();
    group.add(rockMesh);
  }

  const darkMat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const darkMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(darkQb), darkMat);
  darkMesh.matrixAutoUpdate = false;
  darkMesh.updateMatrix();
  group.add(darkMesh);

  const glowMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    toneMapped: false,
  });
  const glowMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(glowQb), glowMat);
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
  atlasMaterial: THREE.Material,
  getRoofTexture: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getRoofNormalTexture?: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getWallTexture?: (key: TileAtlasKey) => THREE.CanvasTexture,
  getWallNormalTexture?: (key: TileAtlasKey) => THREE.CanvasTexture
): THREE.Group | null {
  const placements = clusterWarps(map);
  if (placements.length === 0) return null;

  const root = new THREE.Group();
  for (const p of placements) {
    const gate =
      p.style === 'cave_portal'
        ? buildCavePortalGroup(p, atlasMaterial, getWallTexture, getWallNormalTexture)
        : buildArchGateGroup(p, atlasMaterial, getRoofTexture, getRoofNormalTexture, getWallTexture, getWallNormalTexture);
    root.add(gate);
  }
  root.matrixAutoUpdate = false;
  root.updateMatrix();
  return root;
}
