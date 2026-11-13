import * as THREE from 'three';
import { createRng } from '../core/Rng.ts';
import { PALETTE } from '../gfx/Palette.ts';
import type { DisposableRegistry } from './Disposables.ts';

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createGradientSkyTexture(
  topColor: number,
  bottomColor: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, toCssHex(topColor));
  grad.addColorStop(0.68, toCssHex(bottomColor));
  grad.addColorStop(1, toCssHex(bottomColor));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

export function createCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };

  px(4, 8, 24, 5, PALETTE.boneGray);
  px(3, 6, 26, 5, PALETTE.porcelain);
  px(7, 3, 10, 6, PALETTE.warmWhite);
  px(15, 4, 9, 6, PALETTE.warmWhite);
  px(11, 2, 7, 4, PALETTE.warmWhite);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export interface CloudDriftItem {
  mesh: THREE.Mesh;
  speed: number;
  minX: number;
  maxX: number;
}

export function buildCloudBillboards(
  scene: THREE.Scene,
  disposables: DisposableRegistry,
  centerX: number,
  centerZ: number,
  spread: number,
  count: number,
  seed: number,
  heightY = 12
): CloudDriftItem[] {
  const tex = createCloudTexture();
  const geo = new THREE.PlaneGeometry(5.5, 2.75);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: false,
  });
  disposables.track(tex);
  disposables.track(geo);
  disposables.track(mat);

  const rng = createRng(seed);
  const clouds: CloudDriftItem[] = [];
  const minX = centerX - spread;
  const maxX = centerX + spread;

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const x = minX + rng.next() * spread * 2;
    const z = centerZ - spread + rng.next() * spread * 2;
    const y = heightY + rng.next() * 3.5;
    const scale = 0.8 + rng.next() * 0.9;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    clouds.push({
      mesh,
      speed: 0.35 + rng.next() * 0.45,
      minX,
      maxX,
    });
  }

  return clouds;
}

export function updateCloudBillboards(
  clouds: readonly CloudDriftItem[],
  yaw: number,
  dt: number
): void {
  for (let i = 0; i < clouds.length; i++) {
    const c = clouds[i];
    c.mesh.position.x += c.speed * dt;
    if (c.mesh.position.x > c.maxX) {
      c.mesh.position.x = c.minX;
    }
    c.mesh.rotation.y = yaw;
  }
}
