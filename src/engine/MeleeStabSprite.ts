import * as THREE from 'three';
import {
  computeGridFrameUvRect,
  MELEE_STAB_COLS,
  MELEE_STAB_ROWS,
  MELEE_STAB_SHEET_PATH,
  MELEE_STAB_TOTAL_FRAMES,
} from '../domain/MeleeStabTiming.ts';
import { hexToNumber } from '../gfx/Palette.ts';

const VERTEX_SHADER = `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform sampler2D map;
uniform vec4 uFrameRect;
uniform float uOpacity;
uniform vec3 uElementColor;
uniform float uElementGlow;
uniform float uTintStrength;

varying vec2 vUv;

void main() {
  vec2 cellMin = vec2(min(uFrameRect.x, uFrameRect.x + uFrameRect.z), uFrameRect.y);
  vec2 cellMax = vec2(max(uFrameRect.x, uFrameRect.x + uFrameRect.z), uFrameRect.y + uFrameRect.w);
  vec2 rawUv = uFrameRect.xy + vUv * uFrameRect.zw;
  vec2 inset = vec2(0.0012);
  vec2 sampleUv = clamp(rawUv, cellMin + inset, cellMax - inset);

  vec4 texel = texture2D(map, sampleUv);
  if (texel.a < 0.42) discard;

  // Shift high-chroma violet/magenta slash energy and bright edge glow to the skill's element color
  float maxC = max(texel.r, max(texel.g, texel.b));
  float minC = min(texel.r, min(texel.g, texel.b));
  float chroma = maxC - minC;
  float magentaMask = smoothstep(0.14, 0.42, chroma) * step(texel.g + 0.04, max(texel.r, texel.b));

  vec3 slashColored = uElementColor * (0.45 + maxC * 0.85);
  vec3 color = mix(texel.rgb, slashColored, magentaMask * (0.65 + 0.35 * uElementGlow) * uTintStrength);
  color = mix(
    color,
    uElementColor * 1.15 + vec3(0.18),
    clamp(uElementGlow * 0.34 * uTintStrength, 0.0, 0.42)
  );

  float cleanAlpha = smoothstep(0.42, 0.58, texel.a);
  gl_FragColor = vec4(color, cleanAlpha * uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface MeleeStabMaterialHandle {
  material: THREE.ShaderMaterial;
  setTexture(tex: THREE.Texture): void;
  setFrame(
    frameIndex: number,
    flipX: boolean,
    cols?: number,
    rows?: number,
    totalFrames?: number
  ): void;
  setOpacity(opacity: number): void;
  setElementEffect(hexColor: string, glow: number, tintStrength?: number): void;
}

export function createFallbackStabTexture(): THREE.DataTexture {
  const data = new Uint8Array([0, 0, 0, 0]);
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat);
  tex.needsUpdate = true;
  return tex;
}

export function loadAttackSheetTexture(
  sheetPath: string,
  onLoaded?: (tex: THREE.Texture) => void
): THREE.Texture {
  if (typeof Image === 'undefined') {
    return createFallbackStabTexture();
  }
  const loader = new THREE.TextureLoader();
  const tex = loader.load(sheetPath, (loaded) => {
    loaded.colorSpace = THREE.SRGBColorSpace;
    loaded.magFilter = THREE.NearestFilter;
    loaded.minFilter = THREE.NearestFilter;
    loaded.generateMipmaps = false;
    loaded.needsUpdate = true;
    onLoaded?.(loaded);
  });
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function loadMeleeStabTexture(
  onLoaded?: (tex: THREE.Texture) => void
): THREE.Texture {
  return loadAttackSheetTexture(MELEE_STAB_SHEET_PATH, onLoaded);
}

export function createMeleeStabMaterial(
  initialTexture: THREE.Texture
): MeleeStabMaterialHandle {
  const frameRect = new THREE.Vector4(0, 0.8, 0.2, 0.2);
  const elementColor = new THREE.Color(0x9b6bff);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      map: { value: initialTexture },
      uFrameRect: { value: frameRect },
      uOpacity: { value: 1 },
      uElementColor: { value: elementColor },
      uElementGlow: { value: 0 },
      uTintStrength: { value: 1 },
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
    setFrame(
      frameIndex: number,
      flipX: boolean,
      cols = MELEE_STAB_COLS,
      rows = MELEE_STAB_ROWS,
      totalFrames = MELEE_STAB_TOTAL_FRAMES
    ) {
      const r = computeGridFrameUvRect(frameIndex, cols, rows, totalFrames, flipX);
      frameRect.set(r.uMin, r.vMin, r.uSize, r.vSize);
    },
    setOpacity(opacity: number) {
      material.uniforms.uOpacity.value = Math.max(0, Math.min(1, opacity));
    },
    setElementEffect(hexColor: string, glow: number, tintStrength = 1) {
      elementColor.setHex(hexToNumber(hexColor));
      material.uniforms.uElementGlow.value = Math.max(0, Math.min(1, glow));
      material.uniforms.uTintStrength.value = Math.max(0, Math.min(1, tintStrength));
    },
  };
}

