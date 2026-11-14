import * as THREE from 'three';
import type { FxQualityTier } from '../domain/FxPool.ts';
import type { CreatureType, MoveCategory } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';
import { DisposableRegistry } from './Disposables.ts';

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _side = new THREE.Vector3();
const _perp = new THREE.Vector3();
const _tmpStart = new THREE.Vector3();
const _tmpEnd = new THREE.Vector3();

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
  age: number;
  life: number;
  materials: THREE.ShaderMaterial[];
  ownedGeometries: THREE.BufferGeometry[];
  onUpdate: (t: number, dt: number) => void;
}

export interface MoveVfxOptions {
  power?: number;
  fromGroundY?: number;
  toGroundY?: number;
}

interface TypeColorPair {
  core: number;
  outer: number;
  accent: number;
}

function getTypeColors(type: CreatureType): TypeColorPair {
  switch (type) {
    case 'brasa':
      return { core: 0xfff3c4, outer: 0xff5a2a, accent: 0xc2234b };
    case 'marea':
      return { core: 0xe6ffff, outer: 0x38d9f5, accent: 0x1a78c2 };
    case 'flora':
      return { core: 0xeaffc7, outer: 0x43d97b, accent: 0x7a8b3f };
    case 'chispa':
      return { core: 0xffffff, outer: 0xffd700, accent: 0x6ce8ff };
    case 'roca':
      return { core: 0xfff0c8, outer: 0xe8a84a, accent: 0x8a6a3b };
    case 'brisa':
      return { core: 0xf4ffff, outer: 0x85eadd, accent: 0x5fe3d2 };
    case 'umbra':
      return { core: 0xf0d6ff, outer: 0x9b6bff, accent: 0xc2234b };
    case 'comun':
    default:
      return { core: 0xfff9f0, outer: 0xf4d073, accent: 0x5fe3d2 };
  }
}

export class AbilityVfxSystem {
  private readonly disposables = new DisposableRegistry();
  private readonly group = new THREE.Group();
  private readonly items: ActiveVfxItem[] = [];
  private qualityTier: FxQualityTier = 'high';
  private clockTime = 0;

  // Shared unit geometries (disposed once when AbilityVfxSystem disposes)
  private readonly unitPlaneGeo: THREE.PlaneGeometry;
  private readonly unitBeamGeo: THREE.CylinderGeometry;
  private readonly unitOrbGeo: THREE.SphereGeometry;
  private readonly unitConeGeo: THREE.ConeGeometry;
  private readonly unitVortexGeo: THREE.CylinderGeometry;
  private readonly unitSlashGeo: THREE.RingGeometry;
  private readonly unitRingGeo: THREE.RingGeometry;
  private readonly unitTorusGeo: THREE.TorusGeometry;

  constructor(scene: THREE.Scene) {
    this.group.renderOrder = 12;
    scene.add(this.group);

    this.unitPlaneGeo = new THREE.PlaneGeometry(1, 1);
    this.unitPlaneGeo.rotateX(-Math.PI / 2);

    this.unitBeamGeo = new THREE.CylinderGeometry(0.18, 0.1, 1, 14, 10, true);
    this.unitOrbGeo = new THREE.SphereGeometry(0.5, 16, 12);
    this.unitConeGeo = new THREE.ConeGeometry(0.32, 1.0, 5, 1);
    this.unitConeGeo.translate(0, 0.5, 0); // bottom-center pivot for ground-erupting spires
    this.unitVortexGeo = new THREE.CylinderGeometry(0.95, 0.22, 1.0, 18, 4, true);
    this.unitVortexGeo.translate(0, 0.5, 0);

    this.unitSlashGeo = new THREE.RingGeometry(0.48, 1.0, 26, 1, -Math.PI * 0.62, Math.PI * 1.24);
    this.unitRingGeo = new THREE.RingGeometry(0.68, 1.0, 28, 1);
    this.unitRingGeo.rotateX(-Math.PI / 2);
    this.unitTorusGeo = new THREE.TorusGeometry(0.8, 0.08, 8, 28);
    this.unitTorusGeo.rotateX(Math.PI / 2);

    this.disposables.track(this.unitPlaneGeo);
    this.disposables.track(this.unitBeamGeo);
    this.disposables.track(this.unitOrbGeo);
    this.disposables.track(this.unitConeGeo);
    this.disposables.track(this.unitVortexGeo);
    this.disposables.track(this.unitSlashGeo);
    this.disposables.track(this.unitRingGeo);
    this.disposables.track(this.unitTorusGeo);
  }

  setQualityTier(tier: FxQualityTier): void {
    this.qualityTier = tier;
  }

  private addItem(item: ActiveVfxItem): void {
    this.group.add(item.object);
    this.items.push(item);
  }

  private createBeamMaterial(coreHex: number, outerHex: number, speed = 7.5, freq = 5.0): THREE.ShaderMaterial {
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
        uniform float uProgress;
        varying vec2 vUv;
        varying vec3 vViewNormal;
        varying vec3 vViewDir;

        void main() {
          vUv = uv;
          vec3 pos = position;
          float env = sin(uv.y * 3.14159265);
          float pulse = sin(uv.y * 14.0 - uTime * 22.0) * 0.055 * env;
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
          float headReveal = 1.0 - smoothstep(uProgress * 2.1 - 0.35, uProgress * 2.1, vUv.y);
          float dissolveCut = smoothstep(0.55, 1.0, uProgress);
          float n = vfxFbm(vec2(vUv.x * 4.5 + uTime * 0.8, vUv.y * uFreq - uTime * uSpeed));
          float ends = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.82, vUv.y);
          float facing = abs(dot(normalize(vViewNormal), normalize(vViewDir)));
          float coreMask = smoothstep(0.45, 0.92, facing + n * 0.22);
          float streak = smoothstep(0.18 + dissolveCut * 0.72, 0.95, n + facing * 0.45);
          float alpha = headReveal * ends * streak * (1.0 - dissolveCut * 0.85);
          vec3 col = mix(uOuterColor, uCoreColor, coreMask);
          gl_FragColor = vec4(col * (1.25 + coreMask * 0.9), clamp(alpha * 1.15, 0.0, 1.0));
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
          float fadeIn = smoothstep(0.0, 0.16, uProgress);
          float fadeOut = 1.0 - smoothstep(0.55, 1.0, uProgress);
          float lifeMask = fadeIn * fadeOut;
          float outerMask = 1.0 - smoothstep(0.86, 1.0, r);

          float intensity = 0.0;
          float coreMix = 0.0;

          if (uMode == 0) {
            // Arcane geometric casting rune circle
            float ring1 = smoothstep(0.05, 0.0, abs(r - 0.84));
            float ring2 = smoothstep(0.045, 0.0, abs(r - 0.56));
            float ring3 = smoothstep(0.035, 0.0, abs(r - 0.28));
            float segs = step(0.25, sin(a * 8.0 + uTime * 3.4));
            float tri1 = smoothstep(0.08, 0.0, abs(r - (0.58 + 0.18 * cos(a * 3.0 - uTime * 2.2))));
            float tri2 = smoothstep(0.08, 0.0, abs(r - (0.58 + 0.18 * cos(a * 3.0 + uTime * 2.2 + 3.14159))));
            float glow = (1.0 - smoothstep(0.0, 0.85, r)) * 0.28;
            intensity = ring1 * (0.65 + 0.35 * segs) + ring2 + ring3 + (tri1 + tri2) * 0.75 + glow;
            coreMix = clamp(ring1 + tri1 * 0.5, 0.0, 1.0);
          } else if (uMode == 1) {
            // Expanding plasma shockwave ring
            float expand = mix(0.18, 0.9, pow(uProgress, 0.55));
            float n = vfxFbm(vec2(a * 2.5 + uTime * 0.5, r * 7.0 - uTime * 6.0));
            float ring = smoothstep(0.14, 0.0, abs(r - expand + (n - 0.5) * 0.08));
            float innerWave = smoothstep(0.09, 0.0, abs(r - expand * 0.62)) * 0.65;
            intensity = (ring * 1.4 + innerWave + (1.0 - smoothstep(0.0, expand, r)) * 0.22);
            coreMix = clamp(ring, 0.0, 1.0);
          } else {
            // Ground fissure cracks radiating from impact center
            float n = vfxFbm(p * 4.5 + vec2(0.0, uTime * 0.35));
            float crackRay = pow(max(0.0, 1.0 - abs(sin(a * 5.0 + n * 3.8))), 6.0);
            float crackRay2 = pow(max(0.0, 1.0 - abs(cos(a * 3.0 - n * 3.1))), 8.0);
            float radialSpread = 1.0 - smoothstep(uProgress * 1.15 - 0.2, uProgress * 1.15 + 0.08, r);
            float centerFlash = (1.0 - smoothstep(0.0, 0.38, r)) * (1.0 - uProgress * 0.6);
            intensity = ((crackRay + crackRay2 * 0.8) * radialSpread * 1.55 + centerFlash * 0.9);
            coreMix = clamp(crackRay * 0.7 + centerFlash, 0.0, 1.0);
          }

          vec3 col = mix(uOuterColor, uCoreColor, coreMix);
          float alpha = clamp(intensity * outerMask * lifeMask, 0.0, 1.0);
          gl_FragColor = vec4(col * 1.3, alpha);
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
            // Singularity void core: dark abyssal center + blazing event horizon rim
            vec3 voidCol = vec3(0.03, 0.02, 0.06);
            vec3 rimCol = mix(uOuterColor, uCoreColor, smoothstep(0.4, 0.95, rim + n * 0.25));
            vec3 col = mix(voidCol, rimCol * 1.6, smoothstep(0.25, 0.9, rim + n * 0.15));
            float alpha = clamp((0.75 + rim * 0.5) * fadeOut, 0.0, 1.0);
            gl_FragColor = vec4(col, alpha);
          } else {
            vec3 col = mix(uOuterColor, uCoreColor, clamp(ndotv * 0.75 + n * 0.4, 0.0, 1.0));
            float alpha = clamp((0.55 + rim * 0.75 + n * 0.25) * fadeOut, 0.0, 1.0);
            gl_FragColor = vec4(col * (1.15 + rim * 0.6), alpha);
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
          float a = atan(vLocalPos.y, vLocalPos.x); // -0.62*PI .. +0.62*PI
          float normA = clamp((a + 1.95) / 3.9, 0.0, 1.0);
          float band = smoothstep(0.48, 0.82, r) * (1.0 - smoothstep(0.84, 1.0, r));
          float sweep = smoothstep(uProgress * 1.25 - 0.55, uProgress * 1.25, normA) *
                        (1.0 - smoothstep(uProgress * 1.25, uProgress * 1.25 + 0.14, normA));
          float n = vfxFbm(vec2(normA * 6.0 - uTime * 3.0, r * 5.0));
          float fade = 1.0 - smoothstep(0.65, 1.0, uProgress);
          float core = smoothstep(0.7, 0.94, r + n * 0.12);
          vec3 col = mix(uOuterColor, uCoreColor, core);
          float alpha = clamp((band * (0.45 + sweep * 0.95) + n * 0.2 * band) * fade, 0.0, 1.0);
          gl_FragColor = vec4(col * 1.5, alpha);
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
          float rim = pow(1.0 - ndotv, 1.7);
          float veins = vfxFbm(vec2(vUv.x * 5.0, vUv.y * 7.0 - uTime * 2.5));
          float tipGlow = smoothstep(0.35, 1.0, vUv.y);
          float dissolve = smoothstep(0.58, 1.0, uProgress);
          float alpha = clamp((0.55 + rim * 0.65) * (1.0 - dissolve), 0.0, 1.0);
          vec3 col = mix(uOuterColor, uCoreColor, clamp(rim * 0.75 + tipGlow * 0.4 + veins * 0.25, 0.0, 1.0));
          gl_FragColor = vec4(col * 1.3, alpha);
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
          float spiral = vfxFbm(vec2(vUv.x * 4.0 + vUv.y * 3.0 - uTime * 4.5, vUv.y * 5.0 - uTime * 3.2));
          float ribbons = smoothstep(0.36, 0.82, spiral);
          float ends = smoothstep(0.0, 0.14, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
          float fadeOut = 1.0 - smoothstep(0.6, 1.0, uProgress);
          vec3 col = mix(uOuterColor, uCoreColor, smoothstep(0.55, 0.9, spiral));
          gl_FragColor = vec4(col * 1.4, clamp(ribbons * ends * fadeOut * 1.2, 0.0, 1.0));
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
    branchCount: number
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

      // Build two perpendicular crossed ribbons so lightning reads crisply from every angle
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
      const idx = Math.max(1, Math.min(mainPts.length - 2, Math.floor((0.25 + b * 0.25) * mainPts.length)));
      const anchor = mainPts[idx];
      _tmpEnd.set(
        anchor.x + (Math.random() - 0.5) * 1.4,
        anchor.y - 0.35 + (Math.random() - 0.5) * 0.9,
        anchor.z + (Math.random() - 0.5) * 1.4
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
          float core = 1.0 - smoothstep(0.05, 0.38, distFromCenter);
          float halo = 1.0 - smoothstep(0.1, 1.0, distFromCenter);
          float reveal = 1.0 - smoothstep(uProgress * 2.6 - 0.25, uProgress * 2.6, vUv.x);
          float flicker = 0.72 + 0.28 * sin(uTime * 68.0 + vUv.x * 24.0);
          float fade = 1.0 - smoothstep(0.48, 1.0, uProgress);
          vec3 col = mix(uOuterColor, uCoreColor, core);
          float alpha = clamp((halo * 0.9 + core * 0.8) * reveal * flicker * fade, 0.0, 1.0);
          gl_FragColor = vec4(col * (1.4 + core * 1.1), alpha);
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
    spinSpeed = 1.2
  ): void {
    const mat = this.createGroundDecalMaterial(colors.core, colors.outer, mode);
    const mesh = new THREE.Mesh(this.unitPlaneGeo, mat);
    mesh.position.set(x, groundY + 0.045, z);
    mesh.scale.setScalar(0.15);

    this.addItem({
      object: mesh,
      age: 0,
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

  private spawnLinearBeam(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    life: number,
    colors: TypeColorPair,
    speed = 8.0
  ): void {
    _dir.subVectors(to, from);
    const dist = Math.max(0.2, _dir.length());
    _dir.normalize();
    _mid.addVectors(from, to).multiplyScalar(0.5);

    const mat = this.createBeamMaterial(colors.core, colors.outer, speed, 5.5);
    const mesh = new THREE.Mesh(this.unitBeamGeo, mat);
    mesh.position.copy(_mid);
    mesh.quaternion.setFromUnitVectors(_up, _dir);
    mesh.scale.set(radius, dist, radius);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t) => {
        const widthPulse = 1.0 - t * 0.35 + Math.sin(t * Math.PI * 5) * 0.08;
        mesh.scale.set(radius * widthPulse, dist, radius * widthPulse);
      },
    });
  }

  private spawnProjectileOrb(
    from: THREE.Vector3,
    to: THREE.Vector3,
    radius: number,
    life: number,
    colors: TypeColorPair,
    arcHeight = 0.35,
    invertCore = false
  ): void {
    const mat = this.createOrbMaterial(colors.core, colors.outer, 0.09, invertCore);
    const mesh = new THREE.Mesh(this.unitOrbGeo, mat);
    mesh.position.copy(from);
    mesh.scale.setScalar(radius);

    const f = from.clone();
    const target = to.clone();
    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const travelT = Math.min(1, t / 0.78);
        mesh.position.lerpVectors(f, target, travelT);
        mesh.position.y += Math.sin(travelT * Math.PI) * arcHeight;
        mesh.rotation.y += dt * 7;
        const burstScale = t > 0.78 ? radius * (1 + ((t - 0.78) / 0.22) * 1.4) : radius;
        mesh.scale.setScalar(burstScale);
      },
    });
  }

  private spawnImpactSphere(
    pos: THREE.Vector3,
    maxRadius: number,
    life: number,
    colors: TypeColorPair,
    invertCore = false
  ): void {
    const mat = this.createOrbMaterial(colors.core, colors.outer, 0.06, invertCore);
    const mesh = new THREE.Mesh(this.unitOrbGeo, mat);
    mesh.position.copy(pos);
    mesh.scale.setScalar(0.15);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const s = maxRadius * (0.2 + 0.8 * Math.pow(t, 0.42));
        mesh.scale.setScalar(s);
        mesh.rotation.y += dt * 4;
      },
    });
  }

  private spawnSlashArc(
    pos: THREE.Vector3,
    scale: number,
    tiltX: number,
    tiltZ: number,
    life: number,
    colors: TypeColorPair
  ): void {
    const mat = this.createSlashMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(this.unitSlashGeo, mat);
    mesh.position.copy(pos);
    mesh.rotation.set(tiltX, 0.5, tiltZ);
    mesh.scale.setScalar(scale * 0.7);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        mesh.scale.setScalar(scale * (0.72 + 0.45 * Math.pow(t, 0.45)));
        mesh.rotation.z += dt * 9.5;
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
    colors: TypeColorPair
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
      const dist = i === 0 && actualCount >= 3 ? 0.15 : radiusSpread * (0.55 + Math.random() * 0.45);
      const spire = new THREE.Mesh(this.unitConeGeo, mat);
      spire.position.set(Math.cos(a) * dist, -0.04, Math.sin(a) * dist);
      spire.rotation.set((Math.random() - 0.5) * 0.42, a, (Math.random() - 0.5) * 0.42);
      const targetH = maxHeight * (0.72 + Math.random() * 0.45);
      const baseW = 0.65 + Math.random() * 0.45;
      spire.scale.set(baseW, 0.05, baseW);
      cluster.add(spire);
      spires.push({ mesh: spire, targetH, baseW });
    }

    this.addItem({
      object: cluster,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t) => {
        const rise = Math.min(1, Math.pow(t * 3.8, 0.55));
        const shrink = t > 0.65 ? 1 - ((t - 0.65) / 0.35) * 0.35 : 1;
        for (const s of spires) {
          s.mesh.scale.set(s.baseW * shrink, s.targetH * rise, s.baseW * shrink);
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
    colors: TypeColorPair
  ): void {
    const mat = this.createVortexMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(this.unitVortexGeo, mat);
    mesh.position.set(centerX, groundY, centerZ);
    mesh.scale.set(radius * 0.5, height * 0.4, radius * 0.5);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const grow = Math.min(1, Math.pow(t * 2.6, 0.55));
        mesh.scale.set(radius * grow, height * grow, radius * grow);
        mesh.rotation.y += dt * 8.5;
      },
    });
  }

  private spawnLightningBolt(
    from: THREE.Vector3,
    to: THREE.Vector3,
    life: number,
    colors: TypeColorPair,
    branches = 3
  ): void {
    const actualBranches = this.qualityTier === 'low' ? 1 : branches;
    const geo = this.buildLightningGeometry(from, to, 12, 0.58, 0.085, actualBranches);
    const mat = this.createLightningMaterial(colors.core, colors.outer);
    const mesh = new THREE.Mesh(geo, mat);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [geo],
      onUpdate: () => {},
    });
  }

  private spawnAccretionTorus(
    pos: THREE.Vector3,
    maxScale: number,
    life: number,
    colors: TypeColorPair
  ): void {
    const mat = this.createBeamMaterial(colors.core, colors.outer, 6.0, 4.0);
    const mesh = new THREE.Mesh(this.unitTorusGeo, mat);
    mesh.position.copy(pos);
    mesh.rotation.set(0.32, 0, -0.22);
    mesh.scale.setScalar(0.3);

    this.addItem({
      object: mesh,
      age: 0,
      life,
      materials: [mat],
      ownedGeometries: [],
      onUpdate: (t, dt) => {
        const s = maxScale * (0.4 + 0.6 * Math.sin(Math.min(1, t * 1.4) * Math.PI * 0.5));
        mesh.scale.setScalar(s);
        mesh.rotation.y += dt * 10;
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
    const intensity = power >= 90 ? 1.3 : power >= 70 ? 1.12 : 0.95;
    const fromGroundY = opts?.fromGroundY ?? Math.max(0, from.y - 0.55);
    const toGroundY = opts?.toGroundY ?? Math.max(0, to.y - 0.55);

    if (category === 'status') {
      // Arcane casting rune circle under caster + ascending soul aura vortex
      this.spawnGroundDecal(from.x, fromGroundY, from.z, 2.35, 0.72, colors, 'rune', 1.8);
      this.spawnVortexCone(from.x, fromGroundY, from.z, 0.85, 1.85, 0.62, colors);
      this.spawnGroundDecal(to.x, toGroundY, to.z, 1.85, 0.6, colors, 'shockwave', -1.2);
      return;
    }

    // Caster ground rune sigil for special attacks
    if (category === 'special') {
      this.spawnGroundDecal(from.x, fromGroundY, from.z, 1.8 * intensity, 0.52, colors, 'rune', 2.4);
    }

    switch (type) {
      case 'brasa':
        if (category === 'special') {
          this.spawnProjectileOrb(from, to, 0.42 * intensity, 0.5, colors, 0.45);
          this.spawnLinearBeam(from, to, 1.1 * intensity, 0.46, colors, 9.0);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.8 * intensity, 0.72, colors, 'fissure', 0.4);
          this.spawnImpactSphere(to, 1.25 * intensity, 0.42, colors);
        } else {
          this.spawnSlashArc(to, 1.25 * intensity, 0.65, -0.45, 0.36, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.3 * intensity, 0.56, colors, 'fissure', 0.6);
          this.spawnImpactSphere(to, 1.0 * intensity, 0.34, colors);
        }
        break;

      case 'marea':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.35 * intensity, 0.54, colors, 9.5);
          this.spawnEruptingSpires(to.x, toGroundY, to.z, 5, 1.45 * intensity, 0.65, 0.72, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.6 * intensity, 0.64, colors, 'shockwave', 1.2);
        } else {
          this.spawnSlashArc(to, 1.25 * intensity, -0.5, 0.55, 0.36, colors);
          this.spawnVortexCone(to.x, toGroundY, to.z, 0.95 * intensity, 1.65 * intensity, 0.52, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.3 * intensity, 0.52, colors, 'shockwave', 1.4);
        }
        break;

      case 'flora':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.1 * intensity, 0.52, colors, 7.5);
          this.spawnVortexCone(to.x, toGroundY, to.z, 1.05 * intensity, 1.9 * intensity, 0.68, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.5 * intensity, 0.68, colors, 'rune', -1.8);
        } else {
          this.spawnSlashArc(to, 1.2 * intensity, 0.55, 0.35, 0.34, colors);
          this.spawnEruptingSpires(to.x, toGroundY, to.z, 4, 1.25 * intensity, 0.55, 0.58, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.1 * intensity, 0.52, colors, 'shockwave', 1.0);
        }
        break;

      case 'chispa':
        if (category === 'special') {
          this.spawnLightningBolt(from, to, 0.42, colors, 3);
          _tmpStart.set(to.x, to.y + 3.4, to.z);
          this.spawnLightningBolt(_tmpStart, to, 0.48, colors, 2);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.7 * intensity, 0.58, colors, 'shockwave', 2.8);
          this.spawnImpactSphere(to, 1.1 * intensity, 0.32, colors);
        } else {
          this.spawnLightningBolt(from, to, 0.34, colors, 2);
          this.spawnSlashArc(to, 1.2 * intensity, 0.35, -0.7, 0.32, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.2 * intensity, 0.48, colors, 'shockwave', 2.4);
        }
        break;

      case 'roca':
        this.spawnGroundDecal(to.x, toGroundY, to.z, 2.9 * intensity, 0.78, colors, 'fissure', 0.2);
        this.spawnEruptingSpires(to.x, toGroundY, to.z, 5, 1.55 * intensity, 0.72, 0.72, colors);
        if (category === 'special') {
          this.spawnProjectileOrb(from, to, 0.45 * intensity, 0.46, colors, 0.7);
        } else {
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.4 * intensity, 0.5, colors, 'shockwave', 0.5);
        }
        break;

      case 'brisa':
        this.spawnSlashArc(to, 1.3 * intensity, 0.65, -0.5, 0.36, colors);
        this.spawnSlashArc(to, 1.3 * intensity, -0.65, 0.5, 0.4, colors);
        this.spawnVortexCone(to.x, toGroundY, to.z, 1.15 * intensity, 2.1 * intensity, 0.62, colors);
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.0 * intensity, 0.44, colors, 10.5);
        }
        break;

      case 'umbra':
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.15 * intensity, 0.52, colors, 8.0);
          this.spawnImpactSphere(to, 1.15 * intensity, 0.65, colors, true);
          this.spawnAccretionTorus(to, 1.35 * intensity, 0.62, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.7 * intensity, 0.7, colors, 'rune', -2.6);
        } else {
          this.spawnSlashArc(to, 1.35 * intensity, 0.48, -0.55, 0.38, colors);
          this.spawnAccretionTorus(to, 1.05 * intensity, 0.44, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.3 * intensity, 0.54, colors, 'fissure', -1.8);
        }
        break;

      case 'comun':
      default:
        if (category === 'special') {
          this.spawnLinearBeam(from, to, 1.25 * intensity, 0.5, colors, 9.0);
          this.spawnImpactSphere(to, 1.15 * intensity, 0.42, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.5 * intensity, 0.58, colors, 'shockwave', 1.6);
        } else {
          this.spawnSlashArc(to, 1.15 * intensity, 0.55, -0.4, 0.32, colors);
          this.spawnSlashArc(to, 1.15 * intensity, -0.55, 0.4, 0.34, colors);
          this.spawnGroundDecal(to.x, toGroundY, to.z, 2.0 * intensity, 0.45, colors, 'shockwave', 1.2);
        }
        break;
    }
  }

  playCaptureBurst(pos: THREE.Vector3, groundY: number, caught: boolean): void {
    const colors: TypeColorPair = caught
      ? { core: 0xfff9f0, outer: 0xf4d073, accent: 0x5fe3d2 }
      : { core: 0xfff9f0, outer: 0x9b6bff, accent: 0xc2234b };
    this.spawnGroundDecal(pos.x, groundY, pos.z, 2.4, 0.72, colors, caught ? 'rune' : 'shockwave', 2.2);
    if (caught) {
      this.spawnVortexCone(pos.x, groundY, pos.z, 0.9, 2.0, 0.65, colors);
      this.spawnImpactSphere(pos, 1.15, 0.48, colors);
    }
  }

  playHealOrBuff(pos: THREE.Vector3, groundY: number, isPositive: boolean): void {
    const colors: TypeColorPair = isPositive
      ? { core: 0xd9fbf7, outer: 0x5fe3d2, accent: 0xf4d073 }
      : { core: 0xf0d6ff, outer: 0x9b6bff, accent: 0xc2234b };
    void PALETTE;
    this.spawnGroundDecal(pos.x, groundY, pos.z, 2.0, 0.62, colors, 'rune', isPositive ? 1.8 : -1.8);
    this.spawnVortexCone(pos.x, groundY, pos.z, 0.72, 1.65, 0.54, colors);
  }

  update(dt: number): void {
    if (dt <= 0 || this.items.length === 0) return;
    this.clockTime += dt;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.age += dt;
      if (item.age >= item.life) {
        this.group.remove(item.object);
        for (const m of item.materials) m.dispose();
        for (const g of item.ownedGeometries) g.dispose();
        this.items.splice(i, 1);
        continue;
      }

      const t = item.age / item.life;
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
