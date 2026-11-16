import * as THREE from 'three';
import { createRng } from '../core/Rng.ts';
import type { DisposableRegistry } from './Disposables.ts';

function toCssHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createGradientSkyTexture(
  topColor: number,
  bottomColor: number,
  horizonColor = bottomColor
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, toCssHex(topColor));
  grad.addColorStop(0.35, toCssHex(bottomColor));
  grad.addColorStop(0.70, toCssHex(horizonColor));
  grad.addColorStop(0.92, toCssHex(horizonColor));
  grad.addColorStop(1, toCssHex(horizonColor));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 64);

  // Soft volumetric base cloud body
  const baseGrad = ctx.createRadialGradient(64, 34, 4, 64, 34, 52);
  baseGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
  baseGrad.addColorStop(0.40, 'rgba(242, 246, 253, 0.90)');
  baseGrad.addColorStop(0.75, 'rgba(215, 226, 242, 0.52)');
  baseGrad.addColorStop(1, 'rgba(195, 210, 230, 0)');
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.ellipse(64, 36, 52, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // Fluffy upper cumulus puffs for rich HD-2D volume
  const puffs = [
    { x: 42, y: 26, r: 22, intensity: 1.0 },
    { x: 86, y: 25, r: 26, intensity: 1.0 },
    { x: 64, y: 20, r: 24, intensity: 1.0 },
    { x: 28, y: 32, r: 16, intensity: 0.85 },
    { x: 100, y: 31, r: 18, intensity: 0.85 },
  ];

  for (const p of puffs) {
    const puffGrad = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, p.r);
    puffGrad.addColorStop(0, `rgba(255, 255, 255, ${p.intensity})`);
    puffGrad.addColorStop(0.5, `rgba(245, 249, 255, ${p.intensity * 0.75})`);
    puffGrad.addColorStop(1, 'rgba(220, 232, 245, 0)');
    ctx.fillStyle = puffGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
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
  count = 24,
  seed: number,
  heightY = 15.0
): CloudDriftItem[] {
  const tex = createCloudTexture();
  const geo = new THREE.PlaneGeometry(9.0, 4.5);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity: 0.92,
    side: THREE.DoubleSide,
    depthWrite: false,
    fog: false,
  });
  disposables.track(tex);
  disposables.track(geo);
  disposables.track(mat);

  const rng = createRng(seed);
  const clouds: CloudDriftItem[] = [];
  const minX = centerX - spread * 1.5;
  const maxX = centerX + spread * 1.5;

  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(geo, mat);
    const x = minX + rng.next() * spread * 3.0;
    const z = centerZ - spread * 1.4 + rng.next() * spread * 2.8;
    const y = heightY + (rng.next() - 0.5) * 4.5;
    const scale = 0.85 + rng.next() * 1.4;
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(scale);
    scene.add(mesh);
    clouds.push({
      mesh,
      speed: 0.22 + rng.next() * 0.38,
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
