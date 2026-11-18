import * as THREE from 'three';
import { computeStabFrameUvRect } from '../domain/MeleeStabTiming.ts';

const VERTEX_SHADER = `
uniform float uBreathWeight;
uniform float uSecondaryWeight;
uniform vec2 uBustJiggle;
uniform float uVolumeScale;
uniform vec2 uTorsoRecoil;
uniform vec2 uTorsoAnchor;
uniform float uCharHeight;
uniform float uFlipSign;
uniform float uIsBack;

varying vec2 vUv;

void main() {
  vUv = uv;
  // Normalized screen-aligned sprite coords: x in [0, 1], y in [0, 1] (0 = ground, 1 = quad top).
  float screenX = uFlipSign < 0.0 ? 1.0 - uv.x : uv.x;
  vec2 sp = vec2(screenX, uv.y);

  float ch = max(0.32, uCharHeight);
  float charY = clamp((sp.y - 0.0039) / ch, 0.0, 1.0);
  float bw = clamp(uBreathWeight, 0.0, 1.0);
  float sw = clamp(uSecondaryWeight, 0.0, 1.0);
  float swayLag = sw - bw;
  vec3 pos = position;

  // 1. Grounded foot lock: feet, ankles, and lower shins (charY <= 0.24) remain strictly anchored (0).
  // Smooth anatomical transition across waist into the unified ribcage/upper-torso region.
  float waistToThorax = smoothstep(0.24, 0.48, charY);
  float upperBodyRise = smoothstep(0.24, 0.60, charY);
  float chestArch = smoothstep(0.30, 0.56, charY) * (1.0 - smoothstep(0.70, 0.88, charY));

  // 2. Unified torso-driven thoracic cage envelope centered on the spine axis (uTorsoAnchor.x).
  // Strictly linear scaling in dx (zero per-lobe centers, zero non-linear radial pinch) preserves
  // the exact 3/4 bust silhouette, proportions, separation, and drawn volume on both sides.
  float ribVertBand = smoothstep(0.30, 0.48, charY) * (1.0 - smoothstep(0.74, 0.90, charY));
  float dx = sp.x - uTorsoAnchor.x;
  float frontFactor = mix(1.0, 0.72, uIsBack);

  // Expressive unified thoracic expansion (5.5% max) and heave lift (2.8% upper body + 1.6% chest arch)
  float thoraxExpand = bw * 0.055 * frontFactor;
  float thoraxLift = bw * (upperBodyRise * 0.028 + chestArch * 0.016) * ch;

  // 3. Secondary organic follow-through (phase-offset uSecondaryWeight) on crown/hair,
  // outer shoulder tips, and peripheral drape/sleeves/skirt strictly outside the bust corridor (|dx| >= 0.16).
  float headCrownBand = smoothstep(0.76, 0.94, charY);
  float outerLimbDrape = smoothstep(0.16, 0.34, abs(dx)) * waistToThorax;
  float shoulderTipBand =
    smoothstep(0.62, 0.76, charY) *
    (1.0 - smoothstep(0.84, 0.95, charY)) *
    smoothstep(0.08, 0.22, abs(dx));

  float secondaryX = dx * outerLimbDrape * (sw * 0.012 + swayLag * 0.014) * frontFactor;
  float secondaryY = (
    headCrownBand * (sw * 0.010 + swayLag * 0.008) +
    shoulderTipBand * (sw * 0.009) -
    outerLimbDrape * swayLag * 0.006
  ) * ch;

  // 4. Cohesive 120Hz soft-body chest jiggle & 2D volume preservation centered on torso spine.
  // Neck/clavicle & waist remain strictly pinned (bustBounds -> 0) so meshes never separate.
  float bustVertDist = (charY - uTorsoAnchor.y) / 0.11;
  float bustHorzDist = dx / 0.145;
  float bustBounds =
    smoothstep(uTorsoAnchor.y - 0.15, uTorsoAnchor.y - 0.04, charY) *
    (1.0 - smoothstep(uTorsoAnchor.y + 0.05, uTorsoAnchor.y + 0.14, charY));
  float bustSoftMask =
    exp(-0.5 * (bustVertDist * bustVertDist + bustHorzDist * bustHorzDist)) *
    bustBounds *
    mix(1.0, 0.28, uIsBack);

  float jigglePosX = uBustJiggle.x * bustSoftMask;
  float jigglePosY = uBustJiggle.y * bustSoftMask * ch;
  float jiggleVolX = dx * bustSoftMask * uVolumeScale;

  pos.x += dx * ribVertBand * thoraxExpand + secondaryX + jigglePosX + jiggleVolX + uTorsoRecoil.x * waistToThorax;
  pos.y += thoraxLift + secondaryY + jigglePosY + uTorsoRecoil.y * waistToThorax;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
uniform vec4 uFrameRect;
uniform float uDissolve;
uniform float uOpacity;
uniform float uFlash;
uniform float uTime;
uniform vec2 uTorsoAnchor;
uniform float uCharHeight;
uniform float uFlipSign;
uniform float uIsBack;

varying vec2 vUv;

float bayer4x4(vec2 p) {
  int x = int(mod(p.x, 4.0));
  int y = int(mod(p.y, 4.0));
  int idx = y * 4 + x;
  if (idx == 0) return 0.0 / 16.0;
  if (idx == 1) return 8.0 / 16.0;
  if (idx == 2) return 2.0 / 16.0;
  if (idx == 3) return 10.0 / 16.0;
  if (idx == 4) return 12.0 / 16.0;
  if (idx == 5) return 4.0 / 16.0;
  if (idx == 6) return 14.0 / 16.0;
  if (idx == 7) return 6.0 / 16.0;
  if (idx == 8) return 3.0 / 16.0;
  if (idx == 9) return 11.0 / 16.0;
  if (idx == 10) return 1.0 / 16.0;
  if (idx == 11) return 9.0 / 16.0;
  if (idx == 12) return 15.0 / 16.0;
  if (idx == 13) return 7.0 / 16.0;
  if (idx == 14) return 13.0 / 16.0;
  return 5.0 / 16.0;
}

void main() {
  // Sample strictly at interpolated mesh vUv without fragment-level UV warping,
  // preventing mipmap LOD pumping, cel-outline shimmer, and luminosity flicker across breath phases.
  vec2 baseUv = clamp(vUv, vec2(0.001), vec2(0.999));
  vec2 cellMin = vec2(min(uFrameRect.x, uFrameRect.x + uFrameRect.z), uFrameRect.y);
  vec2 cellMax = vec2(max(uFrameRect.x, uFrameRect.x + uFrameRect.z), uFrameRect.y + uFrameRect.w);
  vec2 inset = vec2(0.0008);
  vec2 sampleUv = clamp(uFrameRect.xy + baseUv * uFrameRect.zw, cellMin + inset, cellMax - inset);

  vec4 texel = texture2D(map, sampleUv);
  if (texel.a < 0.45) discard;
  if (uDissolve > 0.001) {
    float threshold = bayer4x4(floor(sampleUv * 48.0));
    if (threshold < uDissolve) discard;
  }

  // Random, subtle 'flicker' opacity on chest core representing soul instability within marionette
  float screenX = uFlipSign < 0.0 ? 1.0 - vUv.x : vUv.x;
  vec2 sp = vec2(screenX, vUv.y);
  float ch = max(0.32, uCharHeight);
  float charY = clamp((sp.y - 0.0039) / ch, 0.0, 1.0);
  float dx = sp.x - uTorsoAnchor.x;
  float bustVertDist = (charY - uTorsoAnchor.y) / 0.11;
  float bustHorzDist = dx / 0.145;
  float bustBounds = smoothstep(uTorsoAnchor.y - 0.15, uTorsoAnchor.y - 0.04, charY) * (1.0 - smoothstep(uTorsoAnchor.y + 0.05, uTorsoAnchor.y + 0.14, charY));
  float chestCoreMask = exp(-0.5 * (bustVertDist * bustVertDist + bustHorzDist * bustHorzDist)) * bustBounds * mix(1.0, 0.28, uIsBack);

  float soulT = uTime * 15.0;
  float soulNoise = 0.5 + 0.5 * sin(soulT + sin(soulT * 2.2) * 3.8 + sin(soulT * 4.9) * 5.7);
  float soulFlicker = mix(1.0, 0.76 + 0.24 * soulNoise, chestCoreMask);

  // Subtle HD-2D silhouette rim highlight along upper/outer cutout edges
  vec2 rimStep = abs(vec2(uFrameRect.z, uFrameRect.w)) * 0.0055;
  float aUp = texture2D(
    map,
    clamp(sampleUv + vec2(0.0, rimStep.y), cellMin + inset, cellMax - inset)
  ).a;
  float aSide = texture2D(
    map,
    clamp(sampleUv + vec2(rimStep.x * uFlipSign, 0.0), cellMin + inset, cellMax - inset)
  ).a;
  float rimMask = clamp((1.0 - min(aUp, aSide)) * 1.4, 0.0, 1.0) * smoothstep(0.25, 0.9, charY);
  vec3 rimTint = mix(vec3(1.06, 0.98, 0.84), vec3(1.25, 1.15, 0.95), clamp(uFlash, 0.0, 1.0));
  vec3 litTex = texel.rgb + rimTint * rimMask * (0.14 + uFlash * 0.25);

  vec3 flashLinear = vec3(1.0, 0.948, 0.874);
  vec3 color = mix(litTex, flashLinear, clamp(uFlash, 0.0, 1.0));
  float cleanAlpha = smoothstep(0.45, 0.60, texel.a);
  gl_FragColor = vec4(color, cleanAlpha * uOpacity * soulFlicker);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface BattleSpriteMaterialHandle {
  material: THREE.ShaderMaterial;
  setTexture(tex: THREE.Texture): void;
  setFrameRect(uMin: number, vMin: number, uSize: number, vSize: number): void;
  setSheetFrame(frameIndex: number, cols: number, rows: number, flipX?: boolean): void;
  clearFrameRect(): void;
  setDissolve(v: number): void;
  setOpacity(v: number): void;
  setFlash(v: number): void;
  setTime(v: number): void;
  setIdleDeform(
    breathWeight: number,
    secondaryWeight: number,
    jiggleX: number,
    jiggleY: number,
    volumeScale: number,
    recoilX: number,
    recoilY: number,
    torsoX: number,
    bustCenterY: number,
    charHeight: number,
    flipSign: number,
    isBack: number
  ): void;
}

export function createBattleSpriteMaterial(
  initialTexture: THREE.Texture
): BattleSpriteMaterialHandle {
  const bustJiggle = new THREE.Vector2(0, 0);
  const torsoRecoil = new THREE.Vector2(0, 0);
  const torsoAnchor = new THREE.Vector2(0.5, 0.635);
  const frameRect = new THREE.Vector4(0, 0, 1, 1);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: initialTexture },
      uFrameRect: { value: frameRect },
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uBreathWeight: { value: 0 },
      uSecondaryWeight: { value: 0 },
      uBustJiggle: { value: bustJiggle },
      uVolumeScale: { value: 0 },
      uTorsoRecoil: { value: torsoRecoil },
      uTorsoAnchor: { value: torsoAnchor },
      uCharHeight: { value: 0.96 },
      uFlipSign: { value: 1 },
      uIsBack: { value: 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    premultipliedAlpha: false,
    side: THREE.DoubleSide,
  });

  return {
    material,
    setTexture(tex: THREE.Texture) {
      material.uniforms.map.value = tex;
    },
    setFrameRect(uMin: number, vMin: number, uSize: number, vSize: number) {
      frameRect.set(uMin, vMin, uSize, vSize);
    },
    setSheetFrame(frameIndex: number, cols: number, rows: number, flipX = false) {
      const rect = computeStabFrameUvRect(frameIndex, flipX, cols, rows);
      frameRect.set(rect.uMin, rect.vMin, rect.uSize, rect.vSize);
    },
    clearFrameRect() {
      frameRect.set(0, 0, 1, 1);
    },
    setDissolve(v: number) {
      material.uniforms.uDissolve.value = v;
    },
    setOpacity(v: number) {
      material.uniforms.uOpacity.value = v;
    },
    setFlash(v: number) {
      material.uniforms.uFlash.value = v;
    },
    setTime(v: number) {
      material.uniforms.uTime.value = v;
    },
    setIdleDeform(
      breathWeight: number,
      secondaryWeight: number,
      jiggleX: number,
      jiggleY: number,
      volumeScale: number,
      recoilX: number,
      recoilY: number,
      torsoX: number,
      bustCenterY: number,
      charHeight: number,
      flipSign: number,
      isBack: number
    ) {
      material.uniforms.uBreathWeight.value = breathWeight;
      material.uniforms.uSecondaryWeight.value = secondaryWeight;
      bustJiggle.set(jiggleX, jiggleY);
      material.uniforms.uVolumeScale.value = volumeScale;
      torsoRecoil.set(recoilX, recoilY);
      torsoAnchor.set(torsoX, bustCenterY);
      material.uniforms.uCharHeight.value = charHeight;
      material.uniforms.uFlipSign.value = flipSign;
      material.uniforms.uIsBack.value = isBack;
    },
  };
}
