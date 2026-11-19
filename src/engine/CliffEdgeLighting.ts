import * as THREE from 'three';
import type { BattleBiome, TimePhase } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export interface CliffEdgeLightingUniforms {
  uCliffLightDir: { value: THREE.Vector3 };
  uCliffFillDir: { value: THREE.Vector3 };
  uCliffKeyColor: { value: THREE.Color };
  uCliffShadowColor: { value: THREE.Color };
  uCliffHighlightStrength: { value: number };
  uCliffShadowStrength: { value: number };
}

export interface CliffEdgeLightingUpdate {
  biome?: BattleBiome;
  sunLight?: THREE.DirectionalLight | null;
  timePhase?: TimePhase;
  isCave?: boolean;
}

interface BiomeLightingPreset {
  keyColor: THREE.Color;
  shadowColor: THREE.Color;
  highlightStrength: number;
  shadowStrength: number;
}

function getBiomeLightingPreset(biome: BattleBiome, isCave = false): BiomeLightingPreset {
  if (isCave || biome === 'cave') {
    return {
      keyColor: new THREE.Color(PALETTE.etherealOrchid),
      shadowColor: new THREE.Color(PALETTE.deepAmethyst),
      highlightStrength: 0.56,
      shadowStrength: 0.48,
    };
  }
  switch (biome) {
    case 'forest':
      return {
        keyColor: new THREE.Color(PALETTE.paleGold),
        shadowColor: new THREE.Color(PALETTE.deepAbyss),
        highlightStrength: 0.54,
        shadowStrength: 0.46,
      };
    case 'snow':
      return {
        keyColor: new THREE.Color(PALETTE.iceCyan),
        shadowColor: new THREE.Color(PALETTE.ashPurple),
        highlightStrength: 0.58,
        shadowStrength: 0.44,
      };
    case 'mountain':
      return {
        keyColor: new THREE.Color(PALETTE.resonantGold),
        shadowColor: new THREE.Color(PALETTE.stoneShadow),
        highlightStrength: 0.52,
        shadowStrength: 0.48,
      };
    case 'coast':
      return {
        keyColor: new THREE.Color(PALETTE.warmWhite),
        shadowColor: new THREE.Color(PALETTE.oceanicTeal),
        highlightStrength: 0.54,
        shadowStrength: 0.42,
      };
    case 'arena':
      return {
        keyColor: new THREE.Color(PALETTE.brightBrass),
        shadowColor: new THREE.Color(PALETTE.smokedWood),
        highlightStrength: 0.50,
        shadowStrength: 0.45,
      };
    case 'meadow':
    default:
      return {
        keyColor: new THREE.Color(PALETTE.paleGold),
        shadowColor: new THREE.Color(PALETTE.darkSlate),
        highlightStrength: 0.52,
        shadowStrength: 0.45,
      };
  }
}

const DEFAULT_LIGHT_DIR = new THREE.Vector3(7.5, 13.5, 5.8).normalize();
const DEFAULT_FILL_DIR = new THREE.Vector3(-4.5, 8.5, -5.0).normalize();
const _tmpDir = new THREE.Vector3();

export function attachCliffEdgeDirectionalLighting<T extends THREE.Material>(
  mat: T,
  biome: BattleBiome = 'meadow',
  isCave = false
): T {
  if (mat.userData.__cliffEdgeLitAttached) {
    updateCliffEdgeDirectionalLighting(mat, { biome, isCave });
    return mat;
  }
  mat.userData.__cliffEdgeLitAttached = true;

  const preset = getBiomeLightingPreset(biome, isCave);
  const uniforms: CliffEdgeLightingUniforms = {
    uCliffLightDir: { value: DEFAULT_LIGHT_DIR.clone() },
    uCliffFillDir: { value: DEFAULT_FILL_DIR.clone() },
    uCliffKeyColor: { value: preset.keyColor.clone() },
    uCliffShadowColor: { value: preset.shadowColor.clone() },
    uCliffHighlightStrength: { value: preset.highlightStrength },
    uCliffShadowStrength: { value: preset.shadowStrength },
  };
  mat.userData.__cliffEdgeLitUniforms = uniforms;

  const prevOnBeforeCompile = mat.onBeforeCompile;
  const prevCacheKey = mat.customProgramCacheKey;

  mat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(mat) : '';
    return `${base}|cliff_edge_lit_v1`;
  };

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(mat, shader, renderer);
    }

    shader.uniforms.uCliffLightDir = uniforms.uCliffLightDir;
    shader.uniforms.uCliffFillDir = uniforms.uCliffFillDir;
    shader.uniforms.uCliffKeyColor = uniforms.uCliffKeyColor;
    shader.uniforms.uCliffShadowColor = uniforms.uCliffShadowColor;
    shader.uniforms.uCliffHighlightStrength = uniforms.uCliffHighlightStrength;
    shader.uniforms.uCliffShadowStrength = uniforms.uCliffShadowStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCliffLightDir;
         uniform vec3 uCliffFillDir;
         varying vec3 vCliffViewLightDir;
         varying vec3 vCliffViewFillDir;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vCliffViewLightDir = normalize((viewMatrix * vec4(uCliffLightDir, 0.0)).xyz);
         vCliffViewFillDir = normalize((viewMatrix * vec4(uCliffFillDir, 0.0)).xyz);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCliffKeyColor;
         uniform vec3 uCliffShadowColor;
         uniform float uCliffHighlightStrength;
         uniform float uCliffShadowStrength;
         varying vec3 vCliffViewLightDir;
         varying vec3 vCliffViewFillDir;`
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
         vec3 cliffPerturbedN = normalize(normal);
         float cliffKeyDot = dot(cliffPerturbedN, normalize(vCliffViewLightDir));
         float cliffFillDot = dot(cliffPerturbedN, normalize(vCliffViewFillDir));

         // Crisp 4-step pixel-art directional highlights on normal-mapped vegetation & stone facets
         float cliffHiRaw = smoothstep(0.18, 0.78, cliffKeyDot);
         float cliffHiQuant = floor(cliffHiRaw * 3.0 + 0.35) / 3.0;
         float cliffRimFill = smoothstep(0.35, 0.88, cliffFillDot) * 0.32;

         // Deepen downward-facing & occluded undersides for sculpted diorama contrast
         float cliffShRaw = smoothstep(0.08, -0.62, cliffKeyDot);
         float cliffShQuant = floor(cliffShRaw * 3.0 + 0.35) / 3.0;

         reflectedLight.directDiffuse += diffuseColor.rgb * uCliffKeyColor * (cliffHiQuant * uCliffHighlightStrength + cliffRimFill * uCliffHighlightStrength);
         reflectedLight.indirectDiffuse *= (1.0 - cliffShQuant * uCliffShadowStrength);
         reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, reflectedLight.indirectDiffuse * uCliffShadowColor, cliffShQuant * 0.52);`
      );
  };

  mat.needsUpdate = true;
  return mat;
}

export function updateCliffEdgeDirectionalLighting(
  mat: THREE.Material,
  opts: CliffEdgeLightingUpdate
): void {
  const uniforms = mat.userData.__cliffEdgeLitUniforms as CliffEdgeLightingUniforms | undefined;
  if (!uniforms) return;

  const biome = opts.biome ?? 'meadow';
  const isCave = Boolean(opts.isCave || biome === 'cave');
  const preset = getBiomeLightingPreset(biome, isCave);

  uniforms.uCliffKeyColor.value.copy(preset.keyColor);
  uniforms.uCliffShadowColor.value.copy(preset.shadowColor);

  let hiMult = 1.0;
  let shMult = 1.0;
  if (opts.timePhase === 'dusk') {
    uniforms.uCliffKeyColor.value.lerp(new THREE.Color(PALETTE.coralRed), 0.38);
    uniforms.uCliffShadowColor.value.lerp(new THREE.Color(PALETTE.deepAmethyst), 0.32);
    hiMult = 1.08;
    shMult = 1.08;
  } else if (opts.timePhase === 'night') {
    uniforms.uCliffKeyColor.value.lerp(new THREE.Color(PALETTE.kiCyan), 0.48);
    uniforms.uCliffShadowColor.value.lerp(new THREE.Color(PALETTE.nightshade), 0.55);
    hiMult = 0.72;
    shMult = 1.18;
  } else if (opts.timePhase === 'morning') {
    uniforms.uCliffKeyColor.value.lerp(new THREE.Color(PALETTE.warmWhite), 0.28);
    hiMult = 0.96;
  }

  uniforms.uCliffHighlightStrength.value = preset.highlightStrength * hiMult;
  uniforms.uCliffShadowStrength.value = Math.min(0.75, preset.shadowStrength * shMult);

  if (opts.sunLight) {
    _tmpDir.copy(opts.sunLight.position).sub(opts.sunLight.target.position);
    if (_tmpDir.lengthSq() > 1e-5) {
      _tmpDir.normalize();
      uniforms.uCliffLightDir.value.copy(_tmpDir);
      // Counter-azimuth sky rim fill so shaded North/West faces retain sculpted normal relief
      uniforms.uCliffFillDir.value.set(-_tmpDir.x * 0.75, Math.max(0.5, _tmpDir.y * 0.85), -_tmpDir.z * 0.75).normalize();
    }
    if (opts.sunLight.color) {
      uniforms.uCliffKeyColor.value.lerp(opts.sunLight.color, 0.35);
    }
  }
}
