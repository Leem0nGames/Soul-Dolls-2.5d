import * as THREE from 'three';

const VERTEX_SHADER = `
uniform float uBreath;
uniform vec2 uBustOffset;
uniform float uBustExpand;
uniform vec2 uTorsoAnchor;
uniform float uCharHeight;
uniform float uFlipSign;
uniform float uIsBack;

varying vec2 vUv;
varying vec2 vSpritePos;

void main() {
  vUv = uv;
  // Normalized screen-aligned sprite coords: x in [0, 1], y in [0, 1] (0 = ground, 1 = quad top)
  vec2 sp = vec2(position.x + 0.5, position.y);
  vSpritePos = sp;

  float ch = max(0.32, uCharHeight);
  float charY = clamp((sp.y - 0.0156) / ch, 0.0, 1.0);
  vec3 pos = position;

  // 1. Grounded foot lock: strictly 0 displacement on feet/ankles/lower shins (charY <= 0.24)
  float legRise = smoothstep(0.24, 0.56, charY);
  // Subtle coherent upper-body rise on inhale; head & neck ride rigidly with zero stretching
  float breathLift = legRise * uBreath * 0.0085 * ch;

  // Gentle clavicle/shoulder lift synchronized with inhale
  float collarBand = exp(-pow((charY - (uTorsoAnchor.y + 0.072)) / 0.065, 2.0)) * exp(-pow((sp.x - uTorsoAnchor.x) / 0.145, 2.0));
  breathLift += collarBand * uBreath * 0.0025 * ch;

  // 2. Dual symmetric pectoral lobes for 3/4 profile: guarantees both breasts expand equally and naturally
  float belowCut = smoothstep(uTorsoAnchor.y - 0.135, uTorsoAnchor.y - 0.065, charY);
  float aboveCut = 1.0 - smoothstep(uTorsoAnchor.y + 0.055, uTorsoAnchor.y + 0.105, charY);
  float vertMask = belowCut * aboveCut;

  float frontWeight = mix(1.0, 0.24, uIsBack);
  vec2 lobe1 = vec2(uTorsoAnchor.x - 0.024, uTorsoAnchor.y - 0.002);
  vec2 lobe2 = vec2(uTorsoAnchor.x + 0.024, uTorsoAnchor.y + 0.002);

  vec2 d1 = (sp.xy - lobe1) / vec2(0.046, 0.040);
  vec2 d2 = (sp.xy - lobe2) / vec2(0.046, 0.040);
  float w1 = exp(-dot(d1, d1));
  float w2 = exp(-dot(d2, d2));
  float thoraxMask = clamp(w1 + w2, 0.0, 1.0) * vertMask * frontWeight;

  float expandAmp = uBreath * 0.0055 + uBustExpand * 0.012;
  vec2 dirFromCenter = sp.xy - uTorsoAnchor;
  float distFromCenter = length(dirFromCenter);
  vec2 radialDir = distFromCenter > 0.0001 ? dirFromCenter / distFromCenter : vec2(0.0, 1.0);

  pos.xy += radialDir * thoraxMask * expandAmp + uBustOffset * thoraxMask * 0.28;
  pos.y += breathLift;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
uniform float uDissolve;
uniform float uOpacity;
uniform float uFlash;
uniform float uBreath;
uniform vec2 uBustOffset;
uniform float uBustExpand;
uniform vec2 uTorsoAnchor;
uniform float uCharHeight;
uniform float uFlipSign;
uniform float uIsBack;

varying vec2 vUv;
varying vec2 vSpritePos;

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
  float ch = max(0.32, uCharHeight);
  float charY = clamp((vSpritePos.y - 0.0156) / ch, 0.0, 1.0);
  vec2 charPos = vec2(vSpritePos.x, charY);

  // 3/4 Profile symmetric thoracic & chest envelope centered on sternum with balanced depth weighting
  float frontWeight = mix(1.0, 0.32, uIsBack);
  float belowCut = smoothstep(uTorsoAnchor.y - 0.13, uTorsoAnchor.y - 0.055, charY);
  float aboveCut = 1.0 - smoothstep(uTorsoAnchor.y + 0.052, uTorsoAnchor.y + 0.102, charY);
  float verticalSafe = belowCut * aboveCut;

  vec2 dChest = (charPos - uTorsoAnchor) / vec2(0.115, 0.088);
  float wChest = exp(-dot(dChest, dChest)) * verticalSafe * frontWeight;

  vec2 dirChest = charPos - uTorsoAnchor;
  float distChest = length(dirChest);
  vec2 normChest = distChest > 0.0001 ? dirChest / distChest : vec2(0.0, 1.0);

  // Perfectly symmetrical thoracic expansion multiplier applied equally to both sides in 3/4 view
  vec2 expandVec = normChest * wChest * (uBreath * 0.006 + uBustExpand * 0.014);
  vec2 springDisp = vec2(uBustOffset.x * 0.25, uBustOffset.y * 0.48 + uBreath * 0.0015) * wChest;

  vec2 totalDisp = vec2(expandVec.x + springDisp.x, (expandVec.y + springDisp.y) * ch);
  vec2 sampleUv = clamp(vUv - totalDisp, vec2(0.001), vec2(0.999));

  vec4 texel = texture2D(map, sampleUv);
  if (texel.a < 0.45) discard;
  if (uDissolve > 0.001) {
    float threshold = bayer4x4(floor(sampleUv * 48.0));
    if (threshold < uDissolve) discard;
  }

  vec3 flashLinear = vec3(1.0, 0.948, 0.874);
  vec3 color = mix(texel.rgb, flashLinear, clamp(uFlash, 0.0, 1.0));
  gl_FragColor = vec4(color, texel.a * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface BattleSpriteMaterialHandle {
  material: THREE.ShaderMaterial;
  setTexture(tex: THREE.Texture): void;
  setDissolve(v: number): void;
  setOpacity(v: number): void;
  setFlash(v: number): void;
  setIdleDeform(
    breath: number,
    bustX: number,
    bustY: number,
    bustExpand: number,
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
  const bustOffset = new THREE.Vector2(0, 0);
  const torsoAnchor = new THREE.Vector2(0.5, 0.635);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: initialTexture },
      uDissolve: { value: 0 },
      uOpacity: { value: 1 },
      uFlash: { value: 0 },
      uBreath: { value: 0 },
      uBustOffset: { value: bustOffset },
      uBustExpand: { value: 0 },
      uTorsoAnchor: { value: torsoAnchor },
      uCharHeight: { value: 0.96 },
      uFlipSign: { value: 1 },
      uIsBack: { value: 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    side: THREE.DoubleSide,
  });

  return {
    material,
    setTexture(tex: THREE.Texture) {
      material.uniforms.map.value = tex;
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
    setIdleDeform(
      breath: number,
      bustX: number,
      bustY: number,
      bustExpand: number,
      torsoX: number,
      bustCenterY: number,
      charHeight: number,
      flipSign: number,
      isBack: number
    ) {
      material.uniforms.uBreath.value = breath;
      bustOffset.set(bustX, bustY);
      material.uniforms.uBustExpand.value = bustExpand;
      torsoAnchor.set(torsoX, bustCenterY);
      material.uniforms.uCharHeight.value = charHeight;
      material.uniforms.uFlipSign.value = flipSign;
      material.uniforms.uIsBack.value = isBack;
    },
  };
}
