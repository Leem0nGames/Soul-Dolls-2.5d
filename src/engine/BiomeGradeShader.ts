import * as THREE from 'three';
import type { BattleBiome } from '../domain/types.ts';

export interface BiomeVisualProfile {
  tint: THREE.Vector3;
  lift: THREE.Vector3;
  contrast: number;
  saturation: number;
  vignette: number;
  tiltStrength: number;
  focusY: number;
  focusSpan: number;
}

export interface PostFxOptions {
  bloom: boolean;
  bloomIntensity: number;
  tiltShift: boolean;
  colorGrading: boolean;
  vignette: boolean;
}

export function getBiomeVisualProfile(
  biome: BattleBiome,
  opts: { isInterior?: boolean; isBoss?: boolean; isBattle?: boolean } = {}
): BiomeVisualProfile {
  const isBattle = Boolean(opts.isBattle);
  const focusY = isBattle ? 0.56 : 0.44;
  const focusSpan = isBattle ? 0.23 : 0.22;

  if (opts.isBoss) {
    return {
      tint: new THREE.Vector3(1.06, 0.96, 0.92),
      lift: new THREE.Vector3(0.015, 0.0, 0.018),
      contrast: 1.09,
      saturation: 1.12,
      vignette: 0.19,
      tiltStrength: 0.0022,
      focusY,
      focusSpan,
    };
  }

  if (opts.isInterior) {
    return {
      tint: new THREE.Vector3(1.04, 1.0, 0.94),
      lift: new THREE.Vector3(0.012, 0.006, 0.0),
      contrast: 1.05,
      saturation: 1.06,
      vignette: 0.11,
      tiltStrength: 0.0014,
      focusY: 0.46,
      focusSpan: 0.26,
    };
  }

  switch (biome) {
    case 'forest':
      return {
        tint: new THREE.Vector3(0.97, 1.04, 0.99),
        lift: new THREE.Vector3(0.0, 0.012, 0.01),
        contrast: 1.06,
        saturation: 1.1,
        vignette: 0.12,
        tiltStrength: isBattle ? 0.0023 : 0.0025,
        focusY,
        focusSpan,
      };
    case 'cave':
      return {
        tint: new THREE.Vector3(0.95, 0.96, 1.08),
        lift: new THREE.Vector3(0.01, 0.004, 0.025),
        contrast: 1.1,
        saturation: 1.08,
        vignette: 0.18,
        tiltStrength: isBattle ? 0.002 : 0.0022,
        focusY,
        focusSpan,
      };
    case 'mountain':
    case 'snow':
      return {
        tint: new THREE.Vector3(0.96, 1.01, 1.06),
        lift: new THREE.Vector3(0.004, 0.008, 0.018),
        contrast: 1.07,
        saturation: 1.05,
        vignette: 0.1,
        tiltStrength: isBattle ? 0.0022 : 0.0025,
        focusY,
        focusSpan,
      };
    case 'arena':
      return {
        tint: new THREE.Vector3(1.05, 0.98, 1.03),
        lift: new THREE.Vector3(0.014, 0.004, 0.016),
        contrast: 1.08,
        saturation: 1.11,
        vignette: 0.14,
        tiltStrength: isBattle ? 0.0022 : 0.0023,
        focusY,
        focusSpan,
      };
    case 'coast':
      return {
        tint: new THREE.Vector3(1.0, 1.03, 1.04),
        lift: new THREE.Vector3(0.004, 0.008, 0.012),
        contrast: 1.05,
        saturation: 1.09,
        vignette: 0.09,
        tiltStrength: isBattle ? 0.0022 : 0.0024,
        focusY,
        focusSpan,
      };
    case 'meadow':
    default:
      return {
        tint: new THREE.Vector3(1.03, 1.01, 0.96),
        lift: new THREE.Vector3(0.008, 0.005, 0.0),
        contrast: 1.05,
        saturation: 1.08,
        vignette: 0.09,
        tiltStrength: isBattle ? 0.0022 : 0.0025,
        focusY,
        focusSpan,
      };
  }
}

export const DioramaGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uTiltStrength: { value: 0.0024 },
    uFocusY: { value: 0.44 },
    uFocusSpan: { value: 0.22 },
    uTint: { value: new THREE.Vector3(1.03, 1.01, 0.96) },
    uLift: { value: new THREE.Vector3(0.008, 0.005, 0.0) },
    uContrast: { value: 1.05 },
    uSaturation: { value: 1.08 },
    uVignette: { value: 0.09 },
    uGradeMix: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexelSize;
    uniform float uTiltStrength;
    uniform float uFocusY;
    uniform float uFocusSpan;
    uniform vec3 uTint;
    uniform vec3 uLift;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uVignette;
    uniform float uGradeMix;
    varying vec2 vUv;

    vec3 sampleTiltShift(vec2 uv, float blurAmt) {
      if (blurAmt <= 0.00015) {
        return texture2D(tDiffuse, uv).rgb;
      }
      float aspect = uTexelSize.y / max(0.00001, uTexelSize.x);
      vec2 rad = vec2(blurAmt / max(0.45, aspect), blurAmt);

      vec3 acc = texture2D(tDiffuse, uv).rgb * 0.20;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.92,  0.38) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.92, -0.38) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.38,  0.92) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.38, -0.92) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.45, -0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.45,  0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.45,  0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.45, -0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      return acc;
    }

    vec3 applyFilmicGrade(vec3 col, vec2 uv) {
      vec3 rawCol = max(col, vec3(0.0));
      vec3 graded = rawCol;

      if (uGradeMix > 0.001) {
        // Gentle filmic highlight roll-off (preserves HDR bloom cores smoothly)
        vec3 rolled = rawCol / (1.0 + rawCol * 0.12);
        graded = mix(rawCol, rolled * 1.12, 0.65);

        // Shadow lift & biome tint
        graded = graded * uTint + uLift * (1.0 - clamp(dot(graded, vec3(0.299, 0.587, 0.114)), 0.0, 1.0));

        // Contrast around perceptual mid-gray
        graded = max(vec3(0.0), (graded - 0.38) * uContrast + 0.38);

        // Saturation / vibrance
        float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
        graded = mix(vec3(luma), graded, uSaturation);
        graded = mix(rawCol, graded, uGradeMix);
      }

      // Soft radial vignette
      if (uVignette > 0.001) {
        float dist = length((uv - 0.5) * vec2(1.15, 1.0));
        float vig = smoothstep(0.48, 1.05, dist);
        graded *= 1.0 - vig * uVignette;
      }

      return graded;
    }

    void main() {
      float distFromFocus = abs(vUv.y - uFocusY);
      float coc = smoothstep(uFocusSpan, min(0.95, uFocusSpan + 0.24), distFromFocus);
      float blurAmt = coc * uTiltStrength;

      vec3 col = sampleTiltShift(vUv, blurAmt);
      col = applyFilmicGrade(col, vUv);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
