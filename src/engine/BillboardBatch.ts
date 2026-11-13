import * as THREE from 'three';
import type { PropKind } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';

const _dummy = new THREE.Object3D();

export interface PropInstancePlacement {
  kind: PropKind;
  x: number;
  y: number;
  z: number;
  scale: number;
}

export interface PropBatchGroup {
  kind: PropKind;
  mesh: THREE.InstancedMesh;
  items: PropInstancePlacement[];
}

function getPropDimensions(kind: PropKind): [number, number] {
  switch (kind) {
    case 'oak':
      return [2.45, 2.2];
    case 'birch':
      return [2.55, 2.3];
    case 'pine':
      return [1.54, 2.85];
    case 'snow_pine':
      return [1.83, 2.8];
    case 'mushroom_tree':
      return [2.3, 2.4];
    case 'mushroom_tree_arcane':
      return [2.27, 2.4];
    case 'cave_entrance':
      return [2.4, 2.4];
    case 'well':
    case 'pillar':
      return [1.3, 1.7];
    case 'lamp_post':
      return [0.34, 1.85];
    case 'lamp_wood':
      return [0.57, 1.85];
    case 'lamp_double':
      return [0.68, 1.9];
    case 'lamp_stone':
      return [0.31, 1.85];
    case 'bush':
    case 'bush_arcane':
      return [1.08, 1.0];
    case 'tall_grass_clump':
      return [1.2, 1.0];
    case 'tall_grass_flower':
      return [1.2, 1.05];
    default:
      return [0.95, 0.95];
  }
}

export function createBottomPivotPlaneGeometry(w: number, h: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h * 0.5, 0);
  return geo;
}

export function buildInstancedPropBatches(
  placements: readonly PropInstancePlacement[],
  assets: AssetProvider
): PropBatchGroup[] {
  const grouped = new Map<PropKind, PropInstancePlacement[]>();
  for (const p of placements) {
    let list = grouped.get(p.kind);
    if (!list) {
      list = [];
      grouped.set(p.kind, list);
    }
    list.push(p);
  }

  const groups: PropBatchGroup[] = [];
  for (const [kind, list] of grouped.entries()) {
    const [w, h] = getPropDimensions(kind);
    const geo = createBottomPivotPlaneGeometry(w, h);
    const mat = new THREE.MeshBasicMaterial({
      map: assets.getPropTexture(kind),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const inst = new THREE.InstancedMesh(geo, mat, list.length);
    for (let i = 0; i < list.length; i++) {
      _dummy.position.set(list[i].x, list[i].y, list[i].z);
      _dummy.rotation.set(0, 0, 0);
      _dummy.scale.setScalar(list[i].scale);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    groups.push({ kind, mesh: inst, items: list });
  }

  return groups;
}

export function updatePropBatchAnimation(
  groups: readonly PropBatchGroup[],
  yaw: number,
  time: number,
  playerX: number,
  playerZ: number
): void {
  for (const g of groups) {
    const isGrass = g.kind === 'tall_grass_clump' || g.kind === 'tall_grass_flower';
    const items = g.items;
    const inst = g.mesh;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      _dummy.position.set(item.x, item.y, item.z);
      _dummy.rotation.set(0, yaw, 0);

      if (isGrass) {
        const dist = Math.hypot(item.x - playerX, item.z - playerZ);
        const sway = dist < 1.3
          ? Math.sin(time * 16 + i * 1.7) * 0.28 * Math.max(0, 1.3 - dist) / 1.3
          : Math.sin(time * 2.8 + i * 0.9) * 0.05;
        _dummy.rotation.z = sway;
      }

      _dummy.scale.setScalar(item.scale);
      _dummy.updateMatrix();
      inst.setMatrixAt(i, _dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
}

export function updatePropBatchYaw(
  groups: readonly PropBatchGroup[],
  yaw: number
): void {
  updatePropBatchAnimation(groups, yaw, 0, -999, -999);
}
