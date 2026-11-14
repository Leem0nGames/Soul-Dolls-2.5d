import * as THREE from 'three';
import {
  FxPool,
  MAX_FX_PARTICLES,
  type FxQualityTier,
  type ParticleSpawnOpts,
} from '../domain/FxPool.ts';
import type { BattleBiome, CreatureType, MoveCategory } from '../domain/types.ts';
import { hexToNumber, hexToRgb01, PALETTE } from '../gfx/Palette.ts';
import { AbilityVfxSystem, type MoveVfxOptions } from './AbilityVfxSystem.ts';
import { DisposableRegistry } from './Disposables.ts';

const _dummy = new THREE.Object3D();
const _color = new THREE.Color();

export interface BurstOptions {
  count: number;
  speedMin: number;
  speedMax: number;
  lifeMin: number;
  lifeMax: number;
  sizeStart: number;
  sizeEnd: number;
  colorHex: number;
  gravity?: number;
  spreadY?: number;
  spin?: number;
}

export interface RingOptions {
  count: number;
  radius: number;
  speed: number;
  life: number;
  sizeStart: number;
  sizeEnd: number;
  colorHex: number;
  vy?: number;
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(8, 8, 1, 8, 8, 8);
  grad.addColorStop(0, 'rgba(255,249,240,1)');
  grad.addColorStop(0.45, 'rgba(255,249,240,0.85)');
  grad.addColorStop(1, 'rgba(255,249,240,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function getTypeRgb(type: CreatureType): [number, number, number] {
  switch (type) {
    case 'brasa':
      return hexToRgb01(PALETTE.coralRed);
    case 'marea':
      return hexToRgb01(PALETTE.kiCyan);
    case 'flora':
      return hexToRgb01(PALETTE.emerald);
    case 'chispa':
      return hexToRgb01(PALETTE.uiGold);
    case 'roca':
      return hexToRgb01(PALETTE.sandDesert);
    case 'brisa':
      return hexToRgb01(PALETTE.iceCyan);
    case 'umbra':
      return hexToRgb01(PALETTE.soulViolet);
    case 'comun':
    default:
      return hexToRgb01(PALETTE.porcelain);
  }
}

export class FxSystem {
  readonly pool = new FxPool(MAX_FX_PARTICLES);
  readonly mesh: THREE.InstancedMesh;
  readonly abilityVfx: AbilityVfxSystem;
  private disposables = new DisposableRegistry();
  private flashCb?: (colorCss: string, durationMs: number) => void;
  private ambientAccum = 0;
  private seedState = 0x1234567;

  constructor(scene: THREE.Scene) {
    this.abilityVfx = new AbilityVfxSystem(scene);
    const tex = createSparkTexture();
    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_FX_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;

    // Initialize instanceColor buffer
    _color.setRGB(1, 1, 1);
    for (let i = 0; i < MAX_FX_PARTICLES; i++) {
      this.mesh.setColorAt(i, _color);
    }
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }

    scene.add(this.mesh);
    this.disposables.track(tex);
    this.disposables.track(geo);
    this.disposables.track(mat);
  }

  private rand(): number {
    this.seedState = (this.seedState * 1664525 + 1013904223) >>> 0;
    return this.seedState / 4294967296;
  }

  setQualityTier(tier: FxQualityTier): void {
    this.pool.setQualityTier(tier);
    this.abilityVfx.setQualityTier(tier);
  }

  setFlashCallback(cb: (colorCss: string, durationMs: number) => void): void {
    this.flashCb = cb;
  }

  flash(colorCss: string, durationMs: number): void {
    this.flashCb?.(colorCss, durationMs);
  }

  burst(pos: THREE.Vector3, opts: BurstOptions): void {
    const count = this.pool.scaleCount(opts.count);
    _color.setHex(opts.colorHex);
    const spreadY = opts.spreadY ?? 1.0;

    for (let i = 0; i < count; i++) {
      const theta = this.rand() * Math.PI * 2;
      const phi = (this.rand() - 0.35) * Math.PI * spreadY;
      const speed = opts.speedMin + this.rand() * (opts.speedMax - opts.speedMin);
      const life = opts.lifeMin + this.rand() * (opts.lifeMax - opts.lifeMin);

      this.pool.spawn({
        x: pos.x + (this.rand() - 0.5) * 0.25,
        y: pos.y + (this.rand() - 0.5) * 0.25,
        z: pos.z + (this.rand() - 0.5) * 0.25,
        vx: Math.cos(theta) * Math.cos(phi) * speed,
        vy: Math.sin(phi) * speed + 0.5,
        vz: Math.sin(theta) * Math.cos(phi) * speed,
        ay: opts.gravity ?? -3.2,
        life,
        sizeStart: opts.sizeStart,
        sizeEnd: opts.sizeEnd,
        r: _color.r,
        g: _color.g,
        b: _color.b,
        spin: opts.spin ?? (this.rand() - 0.5) * 6,
      });
    }
  }

  stream(
    from: THREE.Vector3,
    to: THREE.Vector3,
    count: number,
    colorHex: number,
    duration = 0.34,
    size = 0.28
  ): void {
    const scaled = this.pool.scaleCount(count);
    _color.setHex(colorHex);
    const invDur = 1 / Math.max(0.08, duration);

    for (let i = 0; i < scaled; i++) {
      const jitterX = (this.rand() - 0.5) * 0.45;
      const jitterY = (this.rand() - 0.5) * 0.45;
      const jitterZ = (this.rand() - 0.5) * 0.45;
      const tBias = 0.8 + this.rand() * 0.35;

      this.pool.spawn({
        x: from.x + jitterX * 0.3,
        y: from.y + jitterY * 0.3,
        z: from.z + jitterZ * 0.3,
        vx: (to.x - from.x + jitterX) * invDur * tBias,
        vy: (to.y - from.y + jitterY) * invDur * tBias,
        vz: (to.z - from.z + jitterZ) * invDur * tBias,
        life: duration * (0.85 + this.rand() * 0.3),
        sizeStart: size,
        sizeEnd: size * 0.15,
        r: _color.r,
        g: _color.g,
        b: _color.b,
        spin: 4,
      });
    }
  }

  trail(pos: THREE.Vector3, opts: ParticleSpawnOpts): void {
    this.pool.spawn(opts);
    void pos;
  }

  ring(center: THREE.Vector3, opts: RingOptions): void {
    const count = this.pool.scaleCount(opts.count);
    _color.setHex(opts.colorHex);
    for (let i = 0; i < count; i++) {
      const angle = (i / Math.max(1, count)) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      this.pool.spawn({
        x: center.x + cos * opts.radius,
        y: center.y,
        z: center.z + sin * opts.radius,
        vx: cos * opts.speed,
        vy: opts.vy ?? 0.35,
        vz: sin * opts.speed,
        life: opts.life,
        sizeStart: opts.sizeStart,
        sizeEnd: opts.sizeEnd,
        r: _color.r,
        g: _color.g,
        b: _color.b,
      });
    }
  }

  playTypeMove(
    type: CreatureType,
    from: THREE.Vector3,
    to: THREE.Vector3,
    category: MoveCategory,
    opts?: MoveVfxOptions
  ): void {
    this.abilityVfx.playMove(type, from, to, category, opts);
    const [r, g, b] = getTypeRgb(type);
    const hex =
      (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);

    if (category === 'status') {
      this.ring(from, {
        count: 18,
        radius: 0.3,
        speed: 1.9,
        life: 0.55,
        sizeStart: 0.24,
        sizeEnd: 0.04,
        colorHex: hex,
        vy: 1.1,
      });
      this.ring(to, {
        count: 16,
        radius: 0.55,
        speed: -0.9,
        life: 0.5,
        sizeStart: 0.22,
        sizeEnd: 0.05,
        colorHex: hex,
        vy: 0.9,
      });
      return;
    }

    if (category === 'special') {
      this.stream(from, to, 24, hex, 0.32, 0.3);
    }

    switch (type) {
      case 'brasa':
        this.burst(to, {
          count: 28,
          speedMin: 1.6,
          speedMax: 3.8,
          lifeMin: 0.35,
          lifeMax: 0.65,
          sizeStart: 0.34,
          sizeEnd: 0.05,
          colorHex: hexToNumber(PALETTE.coralRed),
          gravity: 1.4,
        });
        this.burst(to, {
          count: 12,
          speedMin: 0.9,
          speedMax: 2.2,
          lifeMin: 0.25,
          lifeMax: 0.45,
          sizeStart: 0.24,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.paleGold),
          gravity: 2.0,
        });
        break;

      case 'marea':
        this.ring(to, {
          count: 20,
          radius: 0.15,
          speed: 2.8,
          life: 0.45,
          sizeStart: 0.24,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.kiCyan),
          vy: 0.3,
        });
        this.burst(to, {
          count: 22,
          speedMin: 1.4,
          speedMax: 3.2,
          lifeMin: 0.3,
          lifeMax: 0.55,
          sizeStart: 0.26,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.frostedGlass),
          gravity: -5.0,
        });
        break;

      case 'flora':
        this.ring(to, {
          count: 22,
          radius: 0.65,
          speed: -0.8,
          life: 0.6,
          sizeStart: 0.28,
          sizeEnd: 0.08,
          colorHex: hexToNumber(PALETTE.moss),
          vy: 1.2,
        });
        this.burst(to, {
          count: 16,
          speedMin: 1.0,
          speedMax: 2.5,
          lifeMin: 0.4,
          lifeMax: 0.7,
          sizeStart: 0.24,
          sizeEnd: 0.05,
          colorHex: hexToNumber(PALETTE.emerald),
          gravity: -1.4,
        });
        break;

      case 'chispa':
        this.flash('rgba(252, 237, 184, 0.35)', 120);
        this.burst(to, {
          count: 30,
          speedMin: 2.6,
          speedMax: 5.5,
          lifeMin: 0.18,
          lifeMax: 0.36,
          sizeStart: 0.3,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.uiGold),
          gravity: 0,
        });
        break;

      case 'roca':
        this.burst(to, {
          count: 24,
          speedMin: 1.5,
          speedMax: 3.4,
          lifeMin: 0.35,
          lifeMax: 0.65,
          sizeStart: 0.32,
          sizeEnd: 0.08,
          colorHex: hexToNumber(PALETTE.sandDesert),
          gravity: -7.5,
        });
        this.ring(to, {
          count: 14,
          radius: 0.2,
          speed: 2.4,
          life: 0.4,
          sizeStart: 0.28,
          sizeEnd: 0.05,
          colorHex: hexToNumber(PALETTE.woodHighlight),
          vy: 0.2,
        });
        break;

      case 'brisa':
        this.stream(
          new THREE.Vector3(to.x - 1.5, to.y + 0.8, to.z + 0.6),
          new THREE.Vector3(to.x + 1.5, to.y - 0.3, to.z - 0.6),
          22,
          hexToNumber(PALETTE.iceCyan),
          0.26,
          0.25
        );
        this.ring(to, {
          count: 16,
          radius: 0.25,
          speed: 3.0,
          life: 0.35,
          sizeStart: 0.22,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.frostedGlass),
          vy: 0.7,
        });
        break;

      case 'umbra':
        this.ring(to, {
          count: 20,
          radius: 0.85,
          speed: -1.8,
          life: 0.45,
          sizeStart: 0.32,
          sizeEnd: 0.06,
          colorHex: hexToNumber(PALETTE.soulViolet),
          vy: 0.4,
        });
        this.burst(to, {
          count: 18,
          speedMin: 1.0,
          speedMax: 2.6,
          lifeMin: 0.35,
          lifeMax: 0.6,
          sizeStart: 0.28,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.royalPurple),
          gravity: 0.6,
        });
        break;

      case 'comun':
      default:
        this.burst(to, {
          count: 22,
          speedMin: 2.0,
          speedMax: 4.0,
          lifeMin: 0.2,
          lifeMax: 0.4,
          sizeStart: 0.3,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.paleGold),
          gravity: -1.5,
        });
        break;
    }
  }

  emitAmbient(biome: BattleBiome, dt: number): void {
    const rate =
      this.pool.getQualityTier() === 'high'
        ? 11
        : this.pool.getQualityTier() === 'medium'
          ? 6
          : 3;
    this.ambientAccum += dt * rate;
    while (this.ambientAccum >= 1) {
      this.ambientAccum -= 1;
      const x = (this.rand() - 0.5) * 11;
      const z = (this.rand() - 0.5) * 9;

      switch (biome) {
        case 'meadow': {
          const [r, g, b] = hexToRgb01(PALETTE.paleGold);
          this.pool.spawn({
            x,
            y: 0.5 + this.rand() * 2.5,
            z,
            vx: 0.25 + this.rand() * 0.3,
            vy: 0.12 + this.rand() * 0.2,
            vz: (this.rand() - 0.5) * 0.2,
            life: 2.4,
            sizeStart: 0.11,
            sizeEnd: 0.03,
            r,
            g,
            b,
          });
          break;
        }
        case 'forest': {
          const [r, g, b] = hexToRgb01(PALETTE.moss);
          this.pool.spawn({
            x,
            y: 3.4 + this.rand() * 1.2,
            z,
            vx: -0.35 + (this.rand() - 0.5) * 0.3,
            vy: -0.55 - this.rand() * 0.3,
            vz: (this.rand() - 0.5) * 0.25,
            life: 3.0,
            sizeStart: 0.16,
            sizeEnd: 0.08,
            r,
            g,
            b,
            spin: 2.5,
          });
          break;
        }
        case 'mountain': {
          const [r, g, b] = hexToRgb01(PALETTE.frostedGlass);
          this.pool.spawn({
            x,
            y: 3.8 + this.rand() * 1.4,
            z,
            vx: -0.45,
            vy: -0.8 - this.rand() * 0.3,
            vz: 0.15,
            life: 2.8,
            sizeStart: 0.13,
            sizeEnd: 0.05,
            r,
            g,
            b,
          });
          break;
        }
        case 'cave': {
          const [r, g, b] = hexToRgb01(PALETTE.etherealOrchid);
          this.pool.spawn({
            x,
            y: 0.4 + this.rand() * 2.6,
            z,
            vx: (this.rand() - 0.5) * 0.15,
            vy: 0.15 + this.rand() * 0.18,
            vz: (this.rand() - 0.5) * 0.15,
            life: 2.6,
            sizeStart: 0.12,
            sizeEnd: 0.02,
            r,
            g,
            b,
          });
          break;
        }
        case 'arena': {
          const [r, g, b] = hexToRgb01(PALETTE.resonantGold);
          this.pool.spawn({
            x,
            y: 0.3 + this.rand() * 1.2,
            z,
            vx: (this.rand() - 0.5) * 0.35,
            vy: 0.9 + this.rand() * 0.7,
            vz: (this.rand() - 0.5) * 0.35,
            life: 1.6,
            sizeStart: 0.15,
            sizeEnd: 0.03,
            r,
            g,
            b,
          });
          break;
        }
      }
    }
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.abilityVfx.update(dt);
    this.pool.update(dt);
    let activeIdx = 0;
    const slots = this.pool.slots;

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      if (!s.active) continue;
      const t = s.age / s.life;
      const size = s.sizeStart + (s.sizeEnd - s.sizeStart) * t;
      if (size <= 0.002) continue;

      _dummy.position.set(s.x, s.y, s.z);
      _dummy.lookAt(cameraPos);
      _dummy.rotateZ(s.angle);
      _dummy.scale.setScalar(size);
      _dummy.updateMatrix();
      this.mesh.setMatrixAt(activeIdx, _dummy.matrix);

      const fade = 1 - t * t;
      _color.setRGB(s.r * fade, s.g * fade, s.b * fade);
      this.mesh.setColorAt(activeIdx, _color);
      activeIdx += 1;
    }

    this.mesh.count = activeIdx;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose(): void {
    this.pool.clear();
    this.abilityVfx.dispose();
    this.disposables.disposeAll();
  }
}
