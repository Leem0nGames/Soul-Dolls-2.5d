import * as THREE from 'three';
import type { FxQualityTier } from '../domain/FxPool.ts';
import type { CreatureType, MoveCategory } from '../domain/types.ts';
import { DisposableRegistry } from './Disposables.ts';

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _tmpStart = new THREE.Vector3();
const _tmpEnd = new THREE.Vector3();
const _gatePos = new THREE.Vector3();

const GLSL_NOISE_LIB = /* glsl */ `
  float vfxHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }
  float vfxNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = vfxHash(i);
    float b = vfxHash(i + vec2(1.0, 0.0));
    float c = vfxHash(i + vec2(0.0, 1.0));
    float d = vfxHash(i + vec2(1.0, 1.0));
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  float vfxFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 3; i++) {
      v += amp * vfxNoise(p);
      p = p * 2.03 + vec2(17.1, 31.7);
      amp *= 0.5;
    }
    return v;
  }
`;

interface ActiveVfxItem {
  object: THREE.Object3D;
  elapsed: number;
  delay: number;
  life: number;
  materials: THREE.ShaderMaterial[];
  ownedGeometries: THREE.BufferGeometry[];
  onUpdate: (t: number, dt: number) => void;
}

export const DEFAULT_VFX_SPRITE_SCALE = 1.6;

export interface VfxScaleMetrics {
  raw: number;
  body: number;
  silhouette: number;
  ground: number;
}

export function computeVfxScaleMetrics(
  spriteScale = DEFAULT_VFX_SPRITE_SCALE
): VfxScaleMetrics {
  const safeScale = Math.max(0.6, Math.min(6.0, spriteScale));
  const raw = safeScale / DEFAULT_VFX_SPRITE_SCALE;
  return {
    raw,
    body: 1 + (raw - 1) * 0.88,
    silhouette: 1 + (raw - 1) * 0.65,
    ground: 1 + (raw - 1) * 0.32,
  };
}

export interface MoveVfxOptions {
  power?: number;
  fromGroundY?: number;
  toGroundY?: number;
  fromScale?: number;
  toScale?: number;
}

interface TypeColorPair {
  core: number;
  outer: number;
  accent: number;
}

function getTypeColors(type: CreatureType): TypeColorPair {
  switch (type) {
    case 'brasa':
      return { core: 0xfff6d2, outer: 0xff5a24, accent: 0xc2234b };
    case 'marea':
      return { core: 0xebffff, outer: 0x35e0ff, accent: 0x1a78c2 };
    case 'flora':
      return { core: 0xf2ffd2, outer: 0x43e07d, accent: 0x8ad842 };
    case 'chispa':
      return { core: 0xffffff, outer: 0xffd919, accent: 0x6ce8ff };
    case 'roca':
      return { core: 0xfff3d0, outer: 0xf0a63a, accent: 0x9c5a25 };
    case 'brisa':
      return { core: 0xf6ffff, outer: 0x7ef2e4, accent: 0x5fe3d2 };
    case 'umbra':
      return { core: 0xf5dcff, outer: 0xa06bff, accent: 0xe23e66 };
    case 'comun':
    default:
      return { core: 0xfffaf0, outer: 0xf4d073, accent: 0x5fe3d2 };
  }
}

function buildHelixTubeGeometry(): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = [];
  const turns = 2.5;
  const steps = 36;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const angle = t * Math.PI * 2 * turns;
    const env = Math.sin(t * Math.PI);
    const r = 0.22 + 0.14 * env;
    pts.push(new THREE.Vector3(Math.cos(angle) * r, t - 0.5, Math.sin(angle) * r));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  return new THREE.TubeGeometry(curve, 36, 0.042, 6, false);
}

export class AbilityVfxSystem {
  private readonly disposables = new DisposableRegistry();
  private readonly group = new THREE.Group();
  private readonly items: ActiveVfxItem[] = [];
  private qualityTier: FxQualityTier = 'high';
  private clockTime = 0;

  // Shared unit geometries (disposed once on teardown)
  private readonly unitPlaneGeo: THREE.PlaneGeometry;
  private readonly unitBeamGeo: THREE.CylinderGeometry;
  private readonly unitHelixGeo: THREE.TubeGeometry;
  private readonly unitOrbGeo: THREE.SphereGeometry;
  private readonly unitConeGeo: THREE.ConeGeometry;
  private readonly unitVortexGeo: THREE.CylinderGeometry;
  private readonly unitSlashGeo: THREE.RingGeometry;
  private readonly unitAccretionGeo: THREE.RingGeometry;
  private readonly unitTorusGeo: THREE.TorusGeometry;
  private readonly unitShardGeo: THREE.OctahedronGeometry;

  constructor(scene: THREE.Scene) {
    this.group.renderOrder = 12;
    scene.add(this.group);

    this.unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
    this.unitPlaneGeo.rotateX(-Math.PI / 2);

    this.unitBeamGeo = new THREE.CylinderGeometry(0.18, 0.1, 1, 14, 10, true);
    this.unitHelixGeo = buildHelixTubeGeometry();
    this.unitOrbGeo = new THREE.SphereGeometry(0.5, 16, 12);
    this.unitConeGeo = new THREE.ConeGeometry(0.32, 1.0, 5, 1);
    this.unitConeGeo.translate(0, 0.5, 0);
    this.unitVortexGeo = new THREE.CylinderGeometry(0.95, 0.22, 1.0, 18, 4, true);
    this.unitVortexGeo.translate(0, 0.5, 0);

    this.unitSlashGeo = new THREE.RingGeometry(0.46, 1.0, 28, 1, -Math.PI * 0.62, Math.PI * 1.24);
    this.unitAccretionGeo = new THREE.RingGeometry(0.28, 1.35, 36, 1);
    this.unitAccretionGeo.rotateX(-Math.PI / 2);

    this.unitTorusGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 28);
    this.unitTorusGeo.rotateX(Math.PI / 2);
    this.unitShardGeo = new THREE.OctahedronGeometry(0.13, 0);

    this.disposables.track(this.unitPlaneGeo);
    this.disposables.track(this.unitBeamGeo);
    this.disposables.track(this.unitHelixGeo);
    this.disposables.track(this.unitOrbGeo);
    this.disposables.track(this.unitConeGeo);
    this.disposables.track(this.unitVortexGeo);
    this.disposables.track(this.unitSlashGeo);
    this.disposables.track(this.unitAccretionGeo);
    this.disposables.track(this.unitTorusGeo);
    this.disposables.track(this.unitShardGeo);
  }

  setQualityTier(tier: FxQualityTier): void {
    this.qualityTier = tier;
  }

  getActiveCount(): number {
    return this.items.length;
  }

  private addItem(item: ActiveVfxItem): void {
    if (item.delay > 0) {
      item.object.visible = false;
    }
    this.group.add(item.object);
    this.items.push(item);
  }

  private createBeamMaterial(
    coreHex: number,
    outerHex: number,
    speed = 8.0,
    freq = 5.0
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
        uSpeed: { value: speed },
        uFreq: { value: freq },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float env = sin(uv.y * 3.14159265);
          float pulse = sin(uv.y * 16.0 - uTime * 24.0) * 0.06 * env;
          pos += normal * pulse;
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        uniform float uSpeed;
        uniform float uFreq;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE_LIB}

        void main() {
          float headReveal = 1.0 - smoothstep(uProgress * 2.2 - 0.35, uProgress * 2.2, vUv.y);
          float dissolveCut = smoothstep(0.55, 1.0, uProgress);
          float n = vfxFbm(vec2(vUv.x * 4.5 + uTime * 0.9, vUv.y * uFreq - uTime * uSpeed));
          float ends = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.84, vUv.y);
          float facing = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
          float coreMask = smoothstep(0.42, 0.9, facing + n * 0.24);
          float streak = smoothstep(0.16 + dissolveCut * 0.72, 0.94, n + facing * 0.48);
          float alpha = headReveal * ends * streak * (1.0 - dissolveCut * 0.85);
          vec3 col = mix(uOuterColor * 1.25, uCoreColor * 2.15, coreMask);
          gl_FragColor = vec4(col, clamp(alpha * 1.2, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createScorchCraterMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProgress;
        varying vec2 vUv;
        ${GLSL_NOISE_LIB}

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float n = vfxFbm(p * 4.2);
          float fadeIn = smoothstep(0.0, 0.12, uProgress);
          float fadeOut = 1.0 - smoothstep(0.58, 1.0, uProgress);
          float crater = (1.0 - smoothstep(0.18, 0.78 + n * 0.18, r)) * 0.72;
          gl_FragColor = vec4(0.04, 0.025, 0.06, crater * fadeIn * fadeOut);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
  }

  private createLightPoolMaterial(colorHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uColor: { value: new THREE.Color(colorHex) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uProgress;
        uniform vec3 uColor;
        varying vec2 vUv;
        void main() {
          float r = length(vUv * 2.0 - 1.0);
          float falloff = pow(max(0.0, 1.0 - r), 2.2);
          float env = smoothstep(0.0, 0.14, uProgress) * (1.0 - smoothstep(0.35, 1.0, uProgress));
          gl_FragColor = vec4(uColor * 1.45, falloff * env * 0.65);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createGroundDecalMaterial(
    coreHex: number,
    outerHex: number,
    mode: 'rune' | 'shockwave' | 'fissure'
  ): THREE.ShaderMaterial {
    const modeId = mode === 'rune' ? 0 : mode === 'shockwave' ? 1 : 2;
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
        uMode: { value: modeId },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        uniform int uMode;
        varying vec2 vUv;
        ${GLSL_NOISE_LIB}

        void main() {
          vec2 p = vUv * 2.0 - 1.0;
          float r = length(p);
          float a = atan(p.y, p.x);
          float fadeIn = smoothstep(0.0, 0.15, uProgress);
          float fadeOut = 1.0 - smoothstep(0.55, 1.0, uProgress);
          float lifeMask = fadeIn * fadeOut;
          float outerMask = 1.0 - smoothstep(0.86, 1.0, r);

          float intensity = 0.0;
          float coreMix = 0.0;

          if (uMode == 0) {
            float ring1 = smoothstep(0.055, 0.0, abs(r - 0.84));
            float ring2 = smoothstep(0.048, 0.0, abs(r - 0.56));
            float ring3 = smoothstep(0.035, 0.0, abs(r - 0.28));
            float segs = step(0.22, sin(a * 8.0 + uTime * 3.8));
            float tri1 = smoothstep(0.08, 0.0, abs(r - (0.58 + 0.18 * cos(a * 3.0 - uTime * 2.4))));
            float tri2 = smoothstep(0.08, 0.0, abs(r - (0.58 + 0.18 * cos(a * 3.0 + uTime * 2.4 + 3.14159))));
            float glow = (1.0 - smoothstep(0.0, 0.85, r)) * 0.32;
            intensity = ring1 * (0.65 + 0.45 * segs) + ring2 + ring3 + (tri1 + tri2) * 0.8 + glow;
            coreMix = clamp(ring1 + tri1 * 0.55, 0.0, 1.0);
          } else if (uMode == 1) {
            float expand = mix(0.16, 0.92, pow(uProgress, 0.52));
            float n = vfxFbm(vec2(a * 2.5 + uTime * 0.5, r * 7.0 - uTime * 6.0));
            float ring = smoothstep(0.14, 0.0, abs(r - expand + (n - 0.5) * 0.08));
            float innerWave = smoothstep(0.09, 0.0, abs(r - expand * 0.62)) * 0.72;
            intensity = (ring * 1.55 + innerWave + (1.0 - smoothstep(0.0, expand, r)) * 0.22);
            coreMix = clamp(ring, 0.0, 1.0);
          } else {
            float n = vfxFbm(p * 4.5 + vec2(0.0, uTime * 0.35));
            float crackRay = pow(max(0.0, 1.0 - abs(sin(a * 5.0 + n * 3.8))), 6.0);
            float crackRay2 = pow(max(0.0, 1.0 - abs(cos(a * 3.0 - n * 3.1))), 8.0);
            float radialSpread = 1.0 - smoothstep(uProgress * 1.18 - 0.2, uProgress * 1.18 + 0.08, r);
            float centerFlash = (1.0 - smoothstep(0.0, 0.38, r)) * (1.0 - uProgress * 0.6);
            intensity = ((crackRay + crackRay2 * 0.85) * radialSpread * 1.7 + centerFlash * 1.05);
            coreMix = clamp(crackRay * 0.75 + centerFlash, 0.0, 1.0);
          }

          vec3 col = mix(uOuterColor * 1.25, uCoreColor * 2.0, coreMix);
          float alpha = clamp(intensity * outerMask * lifeMask, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createAccretionDiskMaterial(coreHex: number, outerHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      vertexShader: /* glsl */ `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec3 vLocalPos;
        ${GLSL_NOISE_LIB}

        void main() {
          float r = length(vLocalPos.xz);
          float a = atan(vLocalPos.z, vLocalPos.x);
          float spiral = sin(a * 4.0 + log(max(0.15, r)) * 9.0 - uTime * 11.0);
          float n = vfxFbm(vec2(a * 2.0 - uTime * 2.5, r * 4.0));
          float band = smoothstep(0.28, 0.55, r) * (1.0 - smoothstep(0.95, 1.35, r));
          float fade = smoothstep(0.0, 0.14, uProgress) * (1.0 - smoothstep(0.62, 1.0, uProgress));
          float hot = clamp((spiral * 0.5 + 0.5) * 0.7 + n * 0.45, 0.0, 1.0);
          vec3 col = mix(uOuterColor * 1.2, uCoreColor * 2.1, hot);
          gl_FragColor = vec4(col, clamp(band * (0.55 + hot * 0.7) * fade, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createOrbMaterial(
    coreHex: number,
    outerHex: number,
    distortAmp = 0.08,
    invertCore = false
  ): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
        uDistort: { value: distortAmp },
        uInvertCore: { value: invertCore ? 1.0 : 0.0 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uDistort;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          float wave = sin(position.x * 8.0 + uTime * 12.0) * cos(position.y * 8.0 - uTime * 10.0);
          vec3 pos = position + normal * (wave * uDistort);
          vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        uniform float uInvertCore;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE_LIB}

        void main() {
          float n = vfxFbm(vUv * 5.0 + vec2(uTime * 1.4, -uTime * 1.9));
          float ndotv = clamp(abs(dot(normalize(vViewNormal), normalize(vViewDir))), 0.0, 1.0);
          float rim = pow(1.0 - ndotv, 2.0);
          float fadeOut = 1.0 - smoothstep(0.68, 1.0, uProgress);

          if (uInvertCore > 0.5) {
            vec3 voidCol = vec3(0.02, 0.015, 0.05);
            vec3 rimCol = mix(uOuterColor * 1.35, uCoreColor * 2.2, smoothstep(0.4, 0.95, rim + n * 0.25));
            vec3 col = mix(voidCol, rimCol, smoothstep(0.25, 0.9, rim + n * 0.15));
            float alpha = clamp((0.82 + rim * 0.45) * fadeOut, 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
          } else {
            vec3 col = mix(uOuterColor * 1.25, uCoreColor * 2.1, clamp(ndotv * 0.75 + n * 0.4, 0.0, 1.0));
            float alpha = clamp((0.55 + rim * 0.75 + n * 0.25) * fadeOut, 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
          }
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: invertCore ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
  }

  private createSlashMaterial(coreHex: number, outerHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vLocalPos;
        void main() {
          vLocalPos = position.xy;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec2 vLocalPos;
        ${GLSL_NOISE_LIB}

        void main() {
          float r = length(vLocalPos);
          float a = atan(vLocalPos.y, vLocalPos.x);
          float normA = clamp((a + 1.95) / 3.9, 0.0, 1.0);
          float band = smoothstep(0.46, 0.82, r) * (1.0 - smoothstep(0.84, 1.0, r));
          float sweep = smoothstep(uProgress * 1.25 - 0.55, uProgress * 1.25, normA) *
                        (1.0 - smoothstep(uProgress * 1.25, uProgress * 1.25 + 0.14, normA));
          float n = vfxFbm(vec2(normA * 6.0 - uTime * 3.0, r * 5.0));
          float fade = 1.0 - smoothstep(0.62, 1.0, uProgress);
          float core = smoothstep(0.68, 0.94, r + n * 0.12);
          vec3 col = mix(uOuterColor * 1.3, uCoreColor * 2.3, core);
          float alpha = clamp((band * (0.45 + sweep * 0.95) + n * 0.2 * band) * fade, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createSpireMaterial(coreHex: number, outerHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewNormal = normalize(normalMatrix * normal);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;
        ${GLSL_NOISE_LIB}

        void main() {
          float ndotv = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
          float rim = pow(1.0 - ndotv, 1.65);
          float veins = vfxFbm(vec2(vUv.x * 5.0, vUv.y * 7.0 - uTime * 2.8));
          float tipGlow = smoothstep(0.32, 1.0, vUv.y);
          float dissolve = smoothstep(0.56, 1.0, uProgress);
          float alpha = clamp((0.55 + rim * 0.65) * (1.0 - dissolve), 0.0, 1.0);
          vec3 col = mix(uOuterColor * 1.2, uCoreColor * 2.15, clamp(rim * 0.75 + tipGlow * 0.45 + veins * 0.25, 0.0, 1.0));
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private createVortexMaterial(coreHex: number, outerHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec2 vUv;
        ${GLSL_NOISE_LIB}

        void main() {
          float spiral = vfxFbm(vec2(vUv.x * 4.0 + vUv.y * 3.0 - uTime * 4.8, vUv.y * 5.0 - uTime * 3.4));
          float ribbons = smoothstep(0.34, 0.82, spiral);
          float ends = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
          float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
          vec3 col = mix(uOuterColor * 1.25, uCoreColor * 2.0, smoothstep(0.55, 0.9, spiral));
          gl_FragColor = vec4(col, clamp(ribbons * ends * fadeOut * 1.2, 0.0, 1.0));
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private buildLightningGeometry(
    from: THREE.Vector3,
    to: THREE.Vector3,
    segments: number,
    jitter: number,
    halfWidth: number,
    branchCount: number,
    branchReach = 1
  ): THREE.BufferGeometry {
    const positions: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const appendBoltStrip = (
      start: THREE.Vector3,
      end: THREE.Vector3,
      segs: number,
      jit: number,
      width: number,
      ptsOut?: THREE.Vector3[]
    ) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const p = new THREE.Vector3().lerpVectors(start, end, t);
        if (i > 0 && i < segs) {
          const env = Math.sin(t * Math.PI);
          p.x += (Math.random() - 0.5) * jit * env;
          p.y += (Math.random() - 0.5) * jit * 0.75 * env;
          p.z += (Math.random() - 0.5) * jit * env;
        }
        pts.push(p);
        ptsOut?.push(p);
      }

      for (let pass = 0; pass < 2; pass++) {
        const baseVert = positions.length / 3;
        for (let i = 0; i <= segs; i++) {
          const cur = pts[i];
          const prev = pts[Math.max(0, i - 1)];
          const next = pts[Math.min(segs, i + 1)];
          _dir.subVectors(next, prev).normalize();
          if (pass === 0) {
            _side.crossVectors(_dir, _up);
            if (_side.lengthSq() < 0.001) _side.set(1, 0, 0);
            _side.normalize();
          } else {
            _perp.crossVectors(_dir, _side).normalize();
            _side.copy(_perp);
          }

          const taper = 1.0 - (i / segs) * 0.35;
          const w = width * taper;
          positions.push(
            cur.x - _side.x * w,
            cur.y - _side.y * w,
            cur.z - _side.z * w,
            cur.x + _side.x * w,
            cur.y + _side.y * w,
            cur.z + _side.z * w
          );
          const u = i / segs;
          uvs.push(u, 0, u, 1);
        }

        for (let i = 0; i < segs; i++) {
          const a = baseVert + i * 2;
          const b = a + 1;
          const c = a + 2;
          const d = a + 3;
          indices.push(a, b, c, b, d, c);
        }
      }
    };

    const mainPts: THREE.Vector3[] = [];
    appendBoltStrip(from, to, segments, jitter, halfWidth, mainPts);

    for (let b = 0; b < branchCount; b++) {
      const idx = Math.max(
        1,
        Math.min(mainPts.length - 2, Math.floor(((b + 1) / (branchCount + 1)) * mainPts.length))
      );
      const anchor = mainPts[idx];
      _tmpEnd.set(
        anchor.x + (Math.random() - 0.5) * 1.5 * branchReach,
        anchor.y - 0.3 * branchReach + (Math.random() - 0.5) * 0.9 * branchReach,
        anchor.z + (Math.random() - 0.5) * 1.5 * branchReach
      );
      appendBoltStrip(anchor, _tmpEnd, 6, jitter * 0.55, halfWidth * 0.55);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geo.setIndex(indices);
    geo.computeBoundingSphere();
    return geo;
  }

  private createLightningMaterial(coreHex: number, outerHex: number): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uCoreColor: { value: new THREE.Color(coreHex) },
        uOuterColor: { value: new THREE.Color(outerHex) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uProgress;
        uniform vec3 uCoreColor;
        uniform vec3 uOuterColor;
        varying vec2 vUv;

        void main() {
          float distFromCenter = abs(vUv.y - 0.5) * 2.0;
          float core = 1.0 - smoothstep(0.05, 0.36, distFromCenter);
          float halo = 1.0 - smoothstep(0.08, 1.0, distFromCenter);
          float reveal = 1.0 - smoothstep(uProgress * 2.8 - 0.25, uProgress * 2.8, vUv.x);
          float flicker = 0.72 + 0.28 * sin(uTime * 72.0 + vUv.x * 26.0);
          float fade = 1.0 - smoothstep(0.45, 1.0, uProgress);
          vec3 col = mix(uOuterColor * 1.4, uCoreColor * 2.4, core);
          float alpha = clamp((halo * 0.9 + core * 0.9) * reveal * flicker * fade, 0.0, 1.0);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
  }

  private spawnGroundDecal(
    x: number,
    groundY: number,
    z: number,
    maxScale: number,
    life: number,
    colors: TypeColorPair,
    mode: 'rune' | 'shockwave' | 'fissure',
    spinSpeed = 1.2,
    delay = 0
  ): void {
    const mat = this.createGroundDecalMaterial(colors.core, colors.outer, mode);
    const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
    mesh.position.set(x, groundY + (mode === 'fissure' ? 0.048 : 0.042), z);
    mesh.scale.setScalar(0.15);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const s =
          mode === 'rune'
            ? maxScale * (0.65 + 0.35 * Math.min(1, t * 4.5))
            : maxScale * (0.28 + 0.72 * Math.pow(t, 0.45));
        mesh.scale.setScalar(s);
        mesh.rotation.y += dt * spinSpeed;
      },
    });
  }

  private spawnScorchCrater(
    x: number,
    groundY: number,
    z: number,
    maxScale: number,
    life: number,
    delay = 0
  ): void {
    const mat = this.createScorchCraterMaterial();
    const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
    mesh.position.set(x, groundY + 0.032, z);
    mesh.scale.setScalar(maxScale * 0.5);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t) => {
        mesh.scale.setScalar(maxScale * (0.55 + 0.45 * Math.min(1, t * 4)));
      },
    });
  }

  private spawnLightPool(
    x: number,
    groundY: number,
    z: number,
    scale: number,
    life: number,
    colorHex: number,
    delay = 0
  ): void {
    const mat = this.createLightPoolMaterial(colorHex);
    const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
    mesh.position.set(x, groundY + 0.038, z);
    mesh.scale.setScalar(scale);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t) => {
        mesh.scale.setScalar(scale * (0.8 + 0.35 * Math.sin(t * Math.PI)));
      },
    });
  }

  private spawnLinearBeam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    life: number,
    colors: TypeColorPair,
    speed = 8.5,
    delay = 0,
    withHelix = true
  ): void {
    _dir.subVectors(to, from);
    const dist = Math.max(0.2, _dir.length());
    _dir.normalize();
    _mid.addVectors(from, to).multiplyScalar(0.5);

    const group = new THREE.Group();
    group.position.copy(_mid);
    group.quaternion.setFromUnitVectors(_up, _dir);

    const beamMat = this.createBeamMaterial(colors.core, colors.outer, speed, 5.5);
    const beamMesh = new THREE.Mesh(this.unitBeamGeo, beamMat);
    beamMesh.scale.set(radius, dist, radius);
    group.add(beamMesh);

    const mats: THREE.ShaderMaterial[] = [beamMat];
    let helixMesh: THREE.Mesh | null = null;
    if (withHelix && this.qualityTier !== 'low') {
      const helixMat = this.createBeamMaterial(colors.core, colors.accent, speed * 1.25, 4.0);
      helixMesh = new THREE.Mesh(this.unitHelixGeo, helixMat);
      helixMesh.scale.set(radius * 1.15, dist, radius * 1.15);
      group.add(helixMesh);
      mats.push(helixMat);
    }

    this.addItem({
      object: group,
      elapsed: 0,
      delay,
      life,
      materials: mats,
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const widthPulse = 1.0 - t * 0.32 + Math.sin(t * Math.PI * 5) * 0.08;
        beamMesh.scale.set(radius * widthPulse, dist, radius * widthPulse);
        if (helixMesh) {
          helixMesh.rotation.y += dt * 14;
          helixMesh.scale.set(radius * 1.15 * widthPulse, dist, radius * 1.15 * widthPulse);
        }
      },
    });
  }

  private spawnGateRings(
    from: THREE.Vector3,
    to: THREE.Vector3,
    count: number,
    radius: number,
    life: number,
    colors: TypeColorPair,
    baseDelay = 0.04
  ): void {
    if (this.qualityTier === 'low') return;
    _dir.subVectors(to, from).normalize();
    for (let i = 0; i < count; i++) {
      const frac = (i + 1) / (count + 1);
      _gatePos.lerpVectors(from, to, frac);
      const mat = this.createBeamMaterial(colors.core, colors.outer, 6.0, 3.0);
      const mesh = new THREE.Mesh(this.unitTorusGeo, mat);
      mesh.position.copy(_gatePos);
      mesh.quaternion.setFromUnitVectors(_up, _dir);
      mesh.scale.setScalar(radius * 0.35);

      this.addItem({
        object: mesh,
        elapsed: 0,
        delay: baseDelay + i * 0.045,
        life,
        materials: [mat],
        ownedGeometries: [],
        onUpdate: (t, dt) => {
          const s = radius * (0.45 + 0.75 * Math.pow(t, 0.45));
          mesh.scale.setScalar(s);
          mesh.rotateY(dt * 8);
        },
      });
    }
  }

  private spawnProjectileOrb(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    life: number,
    colors: TypeColorPair,
    arcHeight = 0.35,
    invertCore = false,
    delay = 0
  ): void {
    const mat = this.createOrbMaterial(colors.core, colors.outer, 0.095, invertCore);
    const mesh = new THREE.Mesh(this.unitOrbGeo, mat);
    mesh.position.copy(from);
    mesh.scale.setScalar(radius);

    const f = from.clone();
    const target = to.clone();
    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const travelT = Math.min(1, t / 0.76);
        mesh.position.lerpVectors(f, target, travelT);
        mesh.position.y += Math.sin(travelT * Math.PI) * arcHeight;
        mesh.rotation.y += dt * 8;
        const burstScale = t > 0.76 ? radius * (1 + ((t - 0.76) / 0.24) * 1.55) : radius;
        mesh.scale.setScalar(burstScale);
      },
    });
  }

  private spawnImpactSphere(
    pos: THREE.Vector3,
    maxRadius: number,
    life: number,
    colors: TypeColorPair,
    invertCore = false,
    delay = 0
  ): void {
    const mat = this.createOrbMaterial(colors.core, colors.outer, 0.065, invertCore);
    const mesh = new THREE.Mesh(this.unitOrbGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.15);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const s = maxRadius * (0.2 + 0.8 * Math.pow(t, 0.42));
        mesh.scale.setScalar(s);
        mesh.rotation.y += dt * 5;
      },
    });
  }

  private spawnSlashArc(
    pos: THREE.Vector3,
    scale: number,
    tiltX: number,
    tiltZ: number,
    life: number,
    colors: TypeColorPair,
    delay = 0
  ): void {
    const mat = this.createSlashMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(this.unitSlashGeo, mat);
    mesh.position.copy(pos);
    mesh.rotation.set(tiltX, 0.5, tiltZ);
    mesh.scale.setScalar(scale * 0.7);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        mesh.scale.setScalar(scale * (0.72 + 0.48 * Math.pow(t, 0.45)));
        mesh.rotation.z += dt * 10.5;
      },
    });
  }

  private spawnEruptingSpires(
    centerX: number,
    groundY: number,
    centerZ: number,
    count: number,
    maxHeight: number,
    radiusSpread: number,
    life: number,
    colors: TypeColorPair,
    delay = 0,
    widthScale = 1
  ): void {
    const actualCount =
      this.qualityTier === 'high'
        ? count
        : this.qualityTier === 'medium'
          ? Math.max(2, Math.ceil(count * 0.7))
          : Math.max(1, Math.floor(count * 0.5));

    const cluster = new THREE.Group();
    cluster.position.set(centerX, groundY, centerZ);
    const mat = this.createSpireMaterial(colors.core, colors.outer);
    const spires: Array<{ mesh: THREE.Mesh; targetH: number; baseW: number }> = [];

    for (let i = 0; i < actualCount; i++) {
      const a = (i / actualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.45;
      const dist =
        i === 0 && actualCount >= 3
          ? 0.14 * widthScale
          : radiusSpread * (0.52 + Math.random() * 0.48);
      const spire = new THREE.Mesh(this.unitConeGeo, mat);
      spire.position.set(Math.cos(a) * dist, -0.04, Math.sin(a) * dist);
      spire.rotation.set((Math.random() - 0.5) * 0.44, a, (Math.random() - 0.5) * 0.44);
      const targetH = maxHeight * (0.72 + Math.random() * 0.45);
      const baseW = (0.65 + Math.random() * 0.45) * widthScale;
      spire.scale.set(baseW, 0.05, baseW);
      cluster.add(spire);
      spires.push({ mesh: spire, targetH, baseW });
    }

    this.addItem({
      object: cluster,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t) => {
        const rise = Math.min(1, Math.pow(t * 4.0, 0.52));
        const shrink = t > 0.65 ? 1 - ((t - 0.65) / 0.35) * 0.38 : 1;
        for (const s of spires) {
          s.mesh.scale.set(s.baseW * shrink, s.targetH * rise, s.baseW * shrink);
        }
      },
    });
  }

  private spawnDebrisShards(
    centerX: number,
    groundY: number,
    centerZ: number,
    count: number,
    life: number,
    colors: TypeColorPair,
    delay = 0,
    sizeScale = 1,
    heightScale = sizeScale
  ): void {
    const actualCount =
      this.qualityTier === 'high' ? count : this.qualityTier === 'medium' ? Math.ceil(count * 0.6) : 2;
    const group = new THREE.Group();
    const mat = this.createSpireMaterial(colors.core, colors.outer);
    const shards: Array<{
      mesh: THREE.Mesh;
      vx: number;
      vy: number;
      vz: number;
      spinX: number;
      spinY: number;
      baseScale: number;
    }> = [];

    for (let i = 0; i < actualCount; i++) {
      const a = (i / actualCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const spd = (1.6 + Math.random() * 2.2) * sizeScale;
      const baseScale = (0.75 + Math.random() * 0.7) * sizeScale;
      const mesh = new THREE.Mesh(this.unitShardGeo, mat);
      mesh.position.set(centerX, groundY + 0.35 * heightScale, centerZ);
      mesh.scale.setScalar(baseScale);
      group.add(mesh);
      shards.push({
        mesh,
        vx: Math.cos(a) * spd,
        vy: (2.8 + Math.random() * 2.5) * heightScale,
        vz: Math.sin(a) * spd,
        spinX: (Math.random() - 0.5) * 14,
        spinY: (Math.random() - 0.5) * 14,
        baseScale,
      });
    }

    this.addItem({
      object: group,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        for (const s of shards) {
          s.vy -= 9.5 * heightScale * dt;
          s.mesh.position.x += s.vx * dt;
          s.mesh.position.y = Math.max(groundY + 0.06, s.mesh.position.y + s.vy * dt);
          s.mesh.position.z += s.vz * dt;
          s.mesh.rotation.x += s.spinX * dt;
          s.mesh.rotation.y += s.spinY * dt;
          if (t > 0.65) {
            s.mesh.scale.setScalar(s.baseScale * Math.max(0.05, 1 - (t - 0.65) / 0.35));
          }
        }
      },
    });
  }

  private spawnVortexCone(
    centerX: number,
    groundY: number,
    centerZ: number,
    radius: number,
    height: number,
    life: number,
    colors: TypeColorPair,
    delay = 0
  ): void {
    const mat = this.createVortexMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(this.unitVortexGeo, mat);
    mesh.position.set(centerX, groundY, centerZ);
    mesh.scale.set(radius * 0.5, height * 0.4, radius * 0.5);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const grow = Math.min(1, Math.pow(t * 2.8, 0.52));
        mesh.scale.set(radius * grow, height * grow, radius * grow);
        mesh.rotation.y += dt * 9.5;
      },
    });
  }

  private spawnLightningBolt(
    from: THREE.Vector3,
    to: THREE.Vector3,
    life: number,
    colors: TypeColorPair,
    branches = 3,
    delay = 0,
    scale = 1
  ): void {
    const actualBranches = this.qualityTier === 'low' ? 1 : branches;
    const geo = this.buildLightningGeometry(
      from,
      to,
      14,
      0.62 * scale,
      0.09 * scale,
      actualBranches,
      scale
    );
    const mat = this.createLightningMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(geo, mat);

    this.addItem({
      object: mesh,
      elapsed: 0,
      delay,
      life,
      materials: [mat],
      ownedGeometries: [geo],
      onUpdate: () => {},
    });
  }

  private spawnAccretionDisk(
    pos: THREE.Vector3,
    maxScale: number,
    life: number,
    colors: TypeColorPair,
    delay = 0
  ): void {
    const group = new THREE.Group();
    group.position.copy(pos);
    group.rotation.set(0.32, 0, -0.22);

    const diskMat = this.createAccretionDiskMaterial(colors.core, colors.outer);
    const diskMesh = new THREE.Mesh(this.unitAccretionGeo, diskMat);
    group.add(diskMesh);

    const haloMat = this.createBeamMaterial(colors.core, colors.accent, 6.5, 4.0);
    const haloMesh = new THREE.Mesh(this.unitTorusGeo, haloMat);
    group.add(haloMesh);

    this.addItem({
      object: group,
      elapsed: 0,
      delay,
      life,
      materials: [diskMat, haloMat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const s = maxScale * (0.35 + 0.65 * Math.sin(Math.min(1, t * 1.45) * Math.PI * 0.5));
        group.scale.setScalar(s);
        diskMesh.rotation.y += dt * 8;
        haloMesh.rotation.y -= dt * 11;
      },
    });
  }

  playMove(
    type: CreatureType,
    from: THREE.Vector3,
    to: THREE.Vector3,
    category: MoveCategory,
    opts?: MoveVfxOptions
  ): void {
    const colors = getTypeColors(type);
    const power = opts?.power ?? (category === 'status' ? 0 : 60);
    const isHeavy = power >= 80;
    const intensity = power >= 90 ? 1.32 : power >= 70 ? 1.14 : 0.95;
    const fromScale = opts?.fromScale ?? DEFAULT_VFX_SPRITE_SCALE;
    const toScale = opts?.toScale ?? DEFAULT_VFX_SPRITE_SCALE;
    const fromM = computeVfxScaleMetrics(fromScale);
    const toM = computeVfxScaleMetrics(toScale);
    const avgSilhouette = (fromM.silhouette + toM.silhouette) * 0.5;
    const fromGroundY = opts?.fromGroundY ?? Math.max(0, from.y - fromScale * 0.48);
    const toGroundY = opts?.toGroundY ?? Math.max(0, to.y - toScale * 0.48);

    if (category === 'status') {
      this.spawnGroundDecal(
        from.x,
        fromGroundY,
        from.z,
        2.45 * fromM.ground,
        0.74,
        colors,
        'rune',
        1.9,
        0
      );
      this.spawnLightPool(
        from.x,
        fromGroundY,
        from.z,
        2.2 * fromM.ground,
        0.62,
        colors.outer,
        0.04
      );
      this.spawnVortexCone(
        from.x,
        fromGroundY,
        from.z,
        0.88 * fromM.silhouette,
        1.95 * fromM.body,
        0.64,
        colors,
        0.04
      );
      this.spawnGroundDecal(
        to.x,
        toGroundY,
        to.z,
        1.9 * toM.ground,
        0.58,
        colors,
        'shockwave',
        -1.2,
        0.14
      );
      return;
    }

    // Phase 1: Casting sigil + muzzle light pulse for special attacks
    if (category === 'special') {
      this.spawnGroundDecal(
        from.x,
        fromGroundY,
        from.z,
        1.9 * intensity * fromM.ground,
        0.54,
        colors,
        'rune',
        2.5,
        0
      );
      this.spawnLightPool(
        from.x,
        fromGroundY,
        from.z,
        1.8 * intensity * fromM.ground,
        0.42,
        colors.outer,
        0
      );
    }

    // Phase 2 & 3: Choreographed travel + delayed detonation
    const impactDelay = category === 'special' ? 0.16 : 0.04;

    switch (type) {
      case 'brasa':
        if (category === 'special') {
          if (isHeavy) {
            // Overhead Meteor Comet slamming down onto target
            _tmpStart.set(
              to.x - 1.2 * toM.silhouette,
              to.y + 4.4 * toM.ground,
              to.z + 0.8 * toM.silhouette
            );
            this.spawnProjectileOrb(
              _tmpStart,
              to,
              0.55 * intensity * toM.silhouette,
              0.36,
              colors,
              0.25 * toM.silhouette,
              false,
              0.04
            );
            this.spawnLinearBeam(
              _tmpStart,
              to,
              1.25 * intensity * toM.silhouette,
              0.42,
              colors,
              10.5,
              0.06,
              true
            );
          } else {
            this.spawnProjectileOrb(
              from,
              to,
              0.42 * intensity * avgSilhouette,
              0.44,
              colors,
              0.48 * avgSilhouette,
              false,
              0.03
            );
            this.spawnLinearBeam(
              from,
              to,
              1.08 * intensity * avgSilhouette,
              0.44,
              colors,
              9.2,
              0.04,
              true
            );
          }
          this.spawnScorchCrater(to.x, toGroundY, to.z, 2.75 * intensity * toM.ground, 0.88, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.9 * intensity * toM.ground, 0.74, colors, 'fissure', 0.3, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 3.0 * intensity * toM.ground, 0.58, colors.outer, impactDelay);
          this.spawnImpactSphere(to, 1.3 * intensity * toM.body, 0.44, colors, false, impactDelay);
          this.spawnDebrisShards(to.x, toGroundY, to.z, 8, 0.62, colors, impactDelay, toM.silhouette, toM.body);
        } else {
          this.spawnSlashArc(to, 1.28 * intensity * toM.silhouette, 0.65, -0.45, 0.36, colors, 0);
          this.spawnScorchCrater(to.x, toGroundY, to.z, 2.1 * intensity * toM.ground, 0.68, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.35 * intensity * toM.ground, 0.56, colors, 'fissure', 0.6, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.3 * intensity * toM.ground, 0.45, colors.outer, impactDelay);
          this.spawnDebrisShards(to.x, toGroundY, to.z, 5, 0.48, colors, impactDelay, toM.silhouette, toM.body);
        }
        break;

      case 'marea':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.32 * intensity * avgSilhouette, 0.52, colors, 9.8, 0.03, true);
          this.spawnGateRings(from, to, 3, 0.72 * intensity * avgSilhouette, 0.38, colors, 0.03);
          this.spawnEruptingSpires(to.x, toGroundY, to.z, 7, 1.55 * intensity * toM.body, 0.72 * toM.silhouette, 0.76, colors, impactDelay, toM.silhouette);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.7 * intensity * toM.ground, 0.66, colors, 'shockwave', 1.2, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.8 * intensity * toM.ground, 0.56, colors.outer, impactDelay);
          this.spawnDebrisShards(to.x, toGroundY, to.z, 7, 0.55, colors, impactDelay + 0.06, toM.silhouette, toM.body);
        } else {
          this.spawnSlashArc(to, 1.28 * intensity * toM.silhouette, -0.5, 0.55, 0.36, colors, 0);
          this.spawnVortexCone(to.x, toGroundY, to.z, 0.98 * intensity * toM.silhouette, 1.7 * intensity * toM.body, 0.54, colors, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.35 * intensity * toM.ground, 0.54, colors, 'shockwave', 1.4, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.3 * intensity * toM.ground, 0.44, colors.outer, impactDelay);
        }
        break;

      case 'flora':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.12 * intensity * avgSilhouette, 0.5, colors, 7.8, 0.03, true);
          this.spawnVortexCone(to.x, toGroundY, to.z, 1.08 * intensity * toM.silhouette, 1.98 * intensity * toM.body, 0.7, colors, impactDelay);
          this.spawnEruptingSpires(to.x, toGroundY, to.z, 5, 1.15 * intensity * toM.body, 0.65 * toM.silhouette, 0.64, colors, impactDelay + 0.04, toM.silhouette);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.55 * intensity * toM.ground, 0.7, colors, 'rune', -1.8, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.5 * intensity * toM.ground, 0.55, colors.outer, impactDelay);
        } else {
          this.spawnSlashArc(to, 1.22 * intensity * toM.silhouette, 0.55, 0.35, 0.34, colors, 0);
          this.spawnEruptingSpires(to.x, toGroundY, to.z, 4, 1.28 * intensity * toM.body, 0.55 * toM.silhouette, 0.58, colors, impactDelay, toM.silhouette);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.15 * intensity * toM.ground, 0.52, colors, 'shockwave', 1.0, impactDelay);
        }
        break;

      case 'chispa':
        if (category === 'special') {
          this.spawnLightningBolt(from, to, 0.4, colors, 4, 0.02, avgSilhouette);
          _tmpStart.set(to.x, to.y + 4.4 * toM.ground, to.z);
          this.spawnLightningBolt(_tmpStart, to, 0.44, colors, 3, impactDelay * 0.7, toM.silhouette);
          this.spawnScorchCrater(to.x, toGroundY, to.z, 2.4 * intensity * toM.ground, 0.75, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.8 * intensity * toM.ground, 0.6, colors, 'shockwave', 2.8, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 3.1 * intensity * toM.ground, 0.48, colors.outer, impactDelay);
          this.spawnImpactSphere(to, 1.15 * intensity * toM.body, 0.32, colors, false, impactDelay);
          this.spawnDebrisShards(to.x, toGroundY, to.z, 6, 0.44, colors, impactDelay, toM.silhouette, toM.body);
        } else {
          this.spawnLightningBolt(from, to, 0.34, colors, 2, 0, avgSilhouette);
          this.spawnSlashArc(to, 1.22 * intensity * toM.silhouette, 0.35, -0.7, 0.32, colors, 0.03);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.25 * intensity * toM.ground, 0.48, colors, 'shockwave', 2.4, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.3 * intensity * toM.ground, 0.38, colors.outer, impactDelay);
        }
        break;

      case 'roca':
        if (category === 'special') {
          this.spawnProjectileOrb(from, to, 0.48 * intensity * avgSilhouette, 0.42, colors, 0.78 * avgSilhouette, false, 0.02);
        }
        this.spawnScorchCrater(to.x, toGroundY, to.z, 2.8 * intensity * toM.ground, 0.92, impactDelay);
        this.spawnGroundDecal(to.x, toGroundY, to.z, 2.95 * intensity * toM.ground, 0.78, colors, 'fissure', 0.2, impactDelay);
        this.spawnEruptingSpires(to.x, toGroundY, to.z, 6, 1.65 * intensity * toM.body, 0.75 * toM.silhouette, 0.76, colors, impactDelay, toM.silhouette);
        this.spawnLightPool(to.x, toGroundY, to.z, 2.6 * intensity * toM.ground, 0.5, colors.outer, impactDelay);
        this.spawnDebrisShards(to.x, toGroundY, to.z, 8, 0.65, colors, impactDelay + 0.03, toM.silhouette, toM.body);
        break;

      case 'brisa':
        this.spawnSlashArc(to, 1.32 * intensity * toM.silhouette, 0.68, -0.52, 0.34, colors, 0);
        this.spawnSlashArc(to, 1.32 * intensity * toM.silhouette, -0.68, 0.52, 0.36, colors, 0.06);
        this.spawnSlashArc(to, 1.22 * intensity * toM.silhouette, 0.1, 0.0, 0.34, colors, 0.12);
        this.spawnVortexCone(to.x, toGroundY, to.z, 1.18 * intensity * toM.silhouette, 2.15 * intensity * toM.body, 0.64, colors, 0.05);
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.02 * intensity * avgSilhouette, 0.44, colors, 11.0, 0.02, true);
        }
        this.spawnLightPool(to.x, toGroundY, to.z, 2.4 * intensity * toM.ground, 0.48, colors.outer, 0.08);
        break;

      case 'umbra':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.15 * intensity * avgSilhouette, 0.5, colors, 8.2, 0.03, true);
          this.spawnScorchCrater(to.x, toGroundY, to.z, 2.85 * intensity * toM.ground, 0.9, impactDelay);
          this.spawnImpactSphere(to, 1.18 * intensity * toM.body, 0.68, colors, true, impactDelay);
          this.spawnAccretionDisk(to, 1.45 * intensity * toM.silhouette, 0.68, colors, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.75 * intensity * toM.ground, 0.72, colors, 'rune', -2.6, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.8 * intensity * toM.ground, 0.58, colors.outer, impactDelay);
        } else {
          this.spawnSlashArc(to, 1.38 * intensity * toM.silhouette, 0.48, -0.55, 0.38, colors, 0);
          this.spawnAccretionDisk(to, 1.1 * intensity * toM.silhouette, 0.48, colors, impactDelay);
          this.spawnScorchCrater(to.x, toGroundY, to.z, 2.2 * intensity * toM.ground, 0.65, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.35 * intensity * toM.ground, 0.56, colors, 'fissure', -1.8, impactDelay);
        }
        break;

      case 'comun':
      default:
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.28 * intensity * avgSilhouette, 0.48, colors, 9.5, 0.02, true);
          this.spawnGateRings(from, to, 3, 0.75 * intensity * avgSilhouette, 0.36, colors, 0.02);
          this.spawnImpactSphere(to, 1.2 * intensity * toM.body, 0.44, colors, false, impactDelay);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.55 * intensity * toM.ground, 0.58, colors, 'shockwave', 1.6, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.6 * intensity * toM.ground, 0.48, colors.outer, impactDelay);
        } else {
          this.spawnSlashArc(to, 1.18 * intensity * toM.silhouette, 0.58, -0.42, 0.3, colors, 0);
          this.spawnSlashArc(to, 1.18 * intensity * toM.silhouette, -0.58, 0.42, 0.32, colors, 0.05);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.1 * intensity * toM.ground, 0.46, colors, 'shockwave', 1.2, impactDelay);
          this.spawnLightPool(to.x, toGroundY, to.z, 2.0 * intensity * toM.ground, 0.36, colors.outer, impactDelay);
        }
        break;
    }
  }

  playCaptureBurst(
    pos: THREE.Vector3,
    groundY: number,
    caught: boolean,
    targetScale = DEFAULT_VFX_SPRITE_SCALE
  ): void {
    const m = computeVfxScaleMetrics(targetScale);
    const colors: TypeColorPair = caught
      ? { core: 0xfffaf0, outer: 0xf4d073, accent: 0x5fe3d2 }
      : { core: 0xfffaf0, outer: 0x9b6bff, accent: 0xc2234b };
    this.spawnGroundDecal(
      pos.x,
      groundY,
      pos.z,
      2.45 * m.ground,
      0.74,
      colors,
      caught ? 'rune' : 'shockwave',
      2.2,
      0
    );
    this.spawnLightPool(pos.x, groundY, pos.z, 2.5 * m.ground, 0.6, colors.outer, 0);
    if (caught) {
      this.spawnVortexCone(
        pos.x,
        groundY,
        pos.z,
        0.95 * m.silhouette,
        2.1 * m.body,
        0.66,
        colors,
        0
      );
      this.spawnImpactSphere(pos, 1.2 * m.body, 0.5, colors, false, 0.04);
      this.spawnDebrisShards(pos.x, groundY, pos.z, 6, 0.55, colors, 0.06, m.silhouette, m.body);
    }
  }

  playHealOrBuff(
    pos: THREE.Vector3,
    groundY: number,
    isPositive: boolean,
    targetScale = DEFAULT_VFX_SPRITE_SCALE
  ): void {
    const m = computeVfxScaleMetrics(targetScale);
    const colors: TypeColorPair = isPositive
      ? { core: 0xd9fbf7, outer: 0x5fe3d2, accent: 0xf4d073 }
      : { core: 0xf0d6ff, outer: 0x9b6bff, accent: 0xc2234b };
    this.spawnGroundDecal(
      pos.x,
      groundY,
      pos.z,
      2.1 * m.ground,
      0.64,
      colors,
      'rune',
      isPositive ? 1.8 : -1.8,
      0
    );
    this.spawnLightPool(pos.x, groundY, pos.z, 2.0 * m.ground, 0.5, colors.outer, 0);
    this.spawnVortexCone(
      pos.x,
      groundY,
      pos.z,
      0.76 * m.silhouette,
      1.72 * m.body,
      0.56,
      colors,
      0.02
    );
  }

  update(dt: number): void {
    if (dt <= 0 || this.items.length === 0) return;
    this.clockTime += dt;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.elapsed += dt;
      if (item.elapsed < item.delay) {
        continue;
      }
      if (!item.object.visible) {
        item.object.visible = true;
      }

      const activeAge = item.elapsed - item.delay;
      if (activeAge >= item.life) {
        this.group.remove(item.object);
        for (const m of item.materials) m.dispose();
        for (const g of item.ownedGeometries) g.dispose();
        this.items.splice(i, 1);
        continue;
      }

      const t = activeAge / item.life;
      for (const m of item.materials) {
        if (m.uniforms.uTime) m.uniforms.uTime.value = this.clockTime;
        if (m.uniforms.uProgress) m.uniforms.uProgress.value = t;
      }
      item.onUpdate(t, dt);
    }
  }

  dispose(): void {
    for (const item of this.items) {
      this.group.remove(item.object);
      for (const m of item.materials) m.dispose();
      for (const g of item.ownedGeometries) g.dispose();
    }
    this.items.length = 0;
    this.disposables.disposeAll();
  }
}
