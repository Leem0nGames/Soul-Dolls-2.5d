import * as THREE from 'three';
import { getTileWorldY } from '../domain/TerrainRules.ts';
import type { BuildingKind, BuildingPlacement, MapDef } from '../domain/types.ts';
import type { RoofTextureKind } from '../gfx/AssetProvider.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import {
  buildGeometryFromQuadBuilder,
  createQuadBuilder,
  pushQuad,
  pushTiledQuad,
  pushTiledQuadKey,
  pushTriangle,
  type QuadBuilder,
} from './QuadGeometry.ts';

function getBuildingPalette(kind: BuildingKind): {
  wall: TileAtlasKey;
  roof: TileAtlasKey;
  roofKind: RoofTextureKind;
  wallHeight: number;
  roofHeight: number;
} {
  switch (kind) {
    case 'house_red':
      return {
        wall: 'wall_plaster',
        roof: 'roof_red',
        roofKind: 'terracotta',
        wallHeight: 2.0,
        roofHeight: 1.2,
      };
    case 'house_blue':
      return {
        wall: 'wall_brick',
        roof: 'roof_slate',
        roofKind: 'slate',
        wallHeight: 2.0,
        roofHeight: 1.2,
      };
    case 'lab':
      return {
        wall: 'wall_vine_brick',
        roof: 'roof_patina',
        roofKind: 'patina',
        wallHeight: 2.3,
        roofHeight: 1.3,
      };
    case 'center':
      return {
        wall: 'palace_tile',
        roof: 'roof_red',
        roofKind: 'terracotta',
        wallHeight: 2.2,
        roofHeight: 1.1,
      };
    case 'shop':
      return {
        wall: 'wall_wood_gold',
        roof: 'roof_wood',
        roofKind: 'wood',
        wallHeight: 2.1,
        roofHeight: 1.1,
      };
    case 'arena_hall':
      return {
        wall: 'wall_castle',
        roof: 'roof_blue',
        roofKind: 'indigo',
        wallHeight: 2.8,
        roofHeight: 1.4,
      };
  }
}

function addBuildingGeometry(
  qb: QuadBuilder,
  wallBuilders: Map<TileAtlasKey, QuadBuilder> | null,
  roofBuilders: Map<RoofTextureKind, QuadBuilder> | null,
  map: MapDef,
  b: BuildingPlacement
): void {
  const pal = getBuildingPalette(b.kind);
  const cx = Math.floor(b.x + b.width * 0.5);
  const cz = Math.floor(b.z + b.depth * 0.5);
  const groundY = getTileWorldY(map, cx, cz);

  const x0 = b.x - 0.5;
  const x1 = b.x + b.width - 0.5;
  const z0 = b.z - 0.5;
  const z1 = b.z + b.depth - 0.5;

  const yBot = groundY - 0.6; // foundation skirt so slopes never gap
  const yTop = groundY + pal.wallHeight;
  const yPeak = yTop + pal.roofHeight;

  const uWidth = Math.max(1, Math.round(x1 - x0));
  const uDepth = Math.max(1, Math.round(z1 - z0));
  const vHeight = Math.max(1, Math.round(yTop - yBot));

  // Front (+Z), Back (-Z), Right (+X), Left (-X) walls
  if (wallBuilders) {
    let wqb = wallBuilders.get(pal.wall);
    if (!wqb) {
      wqb = createQuadBuilder();
      wallBuilders.set(pal.wall, wqb);
    }
    pushTiledQuad(wqb, [x0, yBot, z1], [x1, yBot, z1], [x1, yTop, z1], [x0, yTop, z1], uWidth, vHeight, 1.0);
    pushTiledQuad(wqb, [x1, yBot, z0], [x0, yBot, z0], [x0, yTop, z0], [x1, yTop, z0], uWidth, vHeight, 0.88);
    pushTiledQuad(wqb, [x1, yBot, z1], [x1, yBot, z0], [x1, yTop, z0], [x1, yTop, z1], uDepth, vHeight, 0.94);
    pushTiledQuad(wqb, [x0, yBot, z0], [x0, yBot, z1], [x0, yTop, z1], [x0, yTop, z0], uDepth, vHeight, 0.90);
  } else {
    pushTiledQuadKey(qb, [x0, yBot, z1], [x1, yBot, z1], [x1, yTop, z1], [x0, yTop, z1], pal.wall, uWidth, vHeight, 1.0);
    pushTiledQuadKey(qb, [x1, yBot, z0], [x0, yBot, z0], [x0, yTop, z0], [x1, yTop, z0], pal.wall, uWidth, vHeight, 0.88);
    pushTiledQuadKey(qb, [x1, yBot, z1], [x1, yBot, z0], [x1, yTop, z0], [x1, yTop, z1], pal.wall, uDepth, vHeight, 0.94);
    pushTiledQuadKey(qb, [x0, yBot, z0], [x0, yBot, z1], [x0, yTop, z1], [x0, yTop, z0], pal.wall, uDepth, vHeight, 0.90);
  }

  // Door & windows on front (+Z) face
  const doorW = 0.85;
  const doorH = 1.25;
  const midX = (x0 + x1) * 0.5;
  const zFront = z1 + 0.02;
  pushQuad(
    qb,
    [midX - doorW * 0.5, groundY, zFront],
    [midX + doorW * 0.5, groundY, zFront],
    [midX + doorW * 0.5, groundY + doorH, zFront],
    [midX - doorW * 0.5, groundY + doorH, zFront],
    'door',
    1.0
  );

  if (b.width >= 3) {
    const winSize = 0.75;
    const wy0 = groundY + 0.8;
    const wy1 = wy0 + winSize;
    pushQuad(
      qb,
      [x0 + 0.3, wy0, zFront],
      [x0 + 0.3 + winSize, wy0, zFront],
      [x0 + 0.3 + winSize, wy1, zFront],
      [x0 + 0.3, wy1, zFront],
      'window',
      1.0
    );
    pushQuad(
      qb,
      [x1 - 0.3 - winSize, wy0, zFront],
      [x1 - 0.3, wy0, zFront],
      [x1 - 0.3, wy1, zFront],
      [x1 - 0.3 - winSize, wy1, zFront],
      'window',
      1.0
    );
  }

  // Gabled roof along X axis with slight overhang
  const ov = 0.22;
  const rx0 = x0 - ov;
  const rx1 = x1 + ov;
  const rz0 = z0 - ov;
  const rz1 = z1 + ov;
  const rMidZ = (rz0 + rz1) * 0.5;

  if (roofBuilders) {
    let rqb = roofBuilders.get(pal.roofKind);
    if (!rqb) {
      rqb = createQuadBuilder();
      roofBuilders.set(pal.roofKind, rqb);
    }
    const uRepeat = Math.max(1, Math.round((rx1 - rx0) / 2.2));
    // Front roof slope
    pushTiledQuad(rqb, [rx0, yTop, rz1], [rx1, yTop, rz1], [rx1, yPeak, rMidZ], [rx0, yPeak, rMidZ], uRepeat, 1, 1.0);
    // Back roof slope
    pushTiledQuad(rqb, [rx1, yTop, rz0], [rx0, yTop, rz0], [rx0, yPeak, rMidZ], [rx1, yPeak, rMidZ], uRepeat, 1, 0.88);
  } else {
    // Front roof slope
    pushQuad(qb, [rx0, yTop, rz1], [rx1, yTop, rz1], [rx1, yPeak, rMidZ], [rx0, yPeak, rMidZ], pal.roof, 1.0);
    // Back roof slope
    pushQuad(qb, [rx1, yTop, rz0], [rx0, yTop, rz0], [rx0, yPeak, rMidZ], [rx1, yPeak, rMidZ], pal.roof, 0.88);
  }

  // Gable end triangles
  pushTriangle(qb, [rx0, yTop, rz0], [rx0, yTop, rz1], [rx0, yPeak, rMidZ], pal.wall, 0.90);
  pushTriangle(qb, [rx1, yTop, rz1], [rx1, yTop, rz0], [rx1, yPeak, rMidZ], pal.wall, 0.95);
}

export function buildBuildingsMesh(
  map: MapDef,
  atlasMaterial: THREE.Material,
  getRoofTexture?: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getRoofNormalTexture?: (kind: RoofTextureKind) => THREE.CanvasTexture,
  getWallTexture?: (key: TileAtlasKey) => THREE.CanvasTexture,
  getWallNormalTexture?: (key: TileAtlasKey) => THREE.CanvasTexture
): THREE.Group | null {
  if (map.buildings.length === 0) return null;

  const qb = createQuadBuilder();
  const wallBuilders = getWallTexture ? new Map<TileAtlasKey, QuadBuilder>() : null;
  const roofBuilders = getRoofTexture ? new Map<RoofTextureKind, QuadBuilder>() : null;
  for (const b of map.buildings) {
    addBuildingGeometry(qb, wallBuilders, roofBuilders, map, b);
  }

  const group = new THREE.Group();

  if (wallBuilders && getWallTexture) {
    for (const [wallKey, wqb] of wallBuilders.entries()) {
      if (wqb.indices.length === 0) continue;
      const wallMat = new THREE.MeshStandardMaterial({
        map: getWallTexture(wallKey),
        normalMap: getWallNormalTexture ? getWallNormalTexture(wallKey) : null,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.85,
        metalness: 0.05,
        vertexColors: true,
      });
      const wallMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(wqb), wallMat);
      wallMesh.matrixAutoUpdate = false;
      wallMesh.updateMatrix();
      group.add(wallMesh);
    }
  }

  if (qb.indices.length > 0) {
    const miscMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(qb), atlasMaterial);
    miscMesh.matrixAutoUpdate = false;
    miscMesh.updateMatrix();
    group.add(miscMesh);
  }

  if (roofBuilders && getRoofTexture) {
    for (const [kind, rqb] of roofBuilders.entries()) {
      if (rqb.indices.length === 0) continue;
      const roofMat = new THREE.MeshStandardMaterial({
        map: getRoofTexture(kind),
        normalMap: getRoofNormalTexture ? getRoofNormalTexture(kind) : null,
        normalScale: new THREE.Vector2(1.05, 1.05),
        roughness: 0.9,
        metalness: 0.04,
        vertexColors: true,
      });
      const roofMesh = new THREE.Mesh(buildGeometryFromQuadBuilder(rqb), roofMat);
      roofMesh.matrixAutoUpdate = false;
      roofMesh.updateMatrix();
      group.add(roofMesh);
    }
  }

  group.matrixAutoUpdate = false;
  group.updateMatrix();
  return group;
}
