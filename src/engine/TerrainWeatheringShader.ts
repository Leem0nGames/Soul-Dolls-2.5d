import * as THREE from 'three';
import type { BattleBiome } from '../domain/types.ts';
import { getBiomeCliffWeathering } from './DioramaLayers.ts';

export interface TerrainWeatheringUniforms {
  uWeatheringColor: { value: THREE.Color };
  uWeatheringSecondary: { value: THREE.Color };
  uWeatheringStrength: { value: number };
  uCreviceShadowStrength: { value: number };
}

export function attachTerrainDioramaShader<T extends THREE.Material>(
  mat: T,
  biome: BattleBiome
): T {
  if (mat.userData.__terrainDioramaAttached) {
    updateTerrainDioramaBiome(mat, biome);
    return mat;
  }
  mat.userData.__terrainDioramaAttached = true;

  const profile = getBiomeCliffWeathering(biome);
  const uniforms: TerrainWeatheringUniforms = {
    uWeatheringColor: { value: profile.edgeColor.clone() },
    uWeatheringSecondary: { value: profile.secondaryColor.clone() },
    uWeatheringStrength: { value: profile.strength },
    uCreviceShadowStrength: { value: 0.38 },
  };
  mat.userData.__terrainDioramaUniforms = uniforms;

  const prevOnBeforeCompile = mat.onBeforeCompile;
  const prevCacheKey = mat.customProgramCacheKey;

  mat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(mat) : '';
    return `${base}|terrain_diorama_v1`;
  };

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(mat, shader, renderer);
    }

    shader.uniforms.uWeatheringColor = uniforms.uWeatheringColor;
    shader.uniforms.uWeatheringSecondary = uniforms.uWeatheringSecondary;
    shader.uniforms.uWeatheringStrength = uniforms.uWeatheringStrength;
    shader.uniforms.uCreviceShadowStrength = uniforms.uCreviceShadowStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         attribute vec3 aCliffMeta;
         varying vec3 vCliffMeta;
         varying vec3 vCliffWorldPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vCliffMeta = aCliffMeta;
         vec4 cliffWorld = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           cliffWorld = instanceMatrix * cliffWorld;
         #endif
         cliffWorld = modelMatrix * cliffWorld;
         vCliffWorldPos = cliffWorld.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uWeatheringColor;
         uniform vec3 uWeatheringSecondary;
         uniform float uWeatheringStrength;
         uniform float uCreviceShadowStrength;
         varying vec3 vCliffMeta;
         varying vec3 vCliffWorldPos;

         float cliffHash12(vec2 p) {
           vec3 p3 = fract(vec3(p.xyx) * 0.1031);
           p3 += dot(p3, p3.yzx + 33.33);
           return fract((p3.x + p3.y) * p3.z);
         }

         float cliffQuantizedNoise(vec3 wp) {
           vec3 q = floor(wp * 16.0) / 16.0;
           float n1 = cliffHash12(q.xz * 7.1 + q.yy * 3.7);
           float n2 = cliffHash12(q.xy * 5.3 + q.zy * 4.1);
           return fract(n1 * 0.65 + n2 * 0.35);
         }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         float cliffPixNoise = cliffQuantizedNoise(vCliffWorldPos);
         float cliffBandJitter = (cliffPixNoise - 0.5) * 0.38;

         // Apply crisp pixel-art biome weathering along the top edges of 90-degree cliff faces
         // and exposed plateau cliff lips
         float wallTopBand = vCliffMeta.x * smoothstep(0.18, 0.92, vCliffMeta.y + cliffBandJitter);
         float plateauRimLip = (1.0 - vCliffMeta.x) * smoothstep(0.32, 0.85, vCliffMeta.y + cliffBandJitter * 0.65) * 0.48;
         float weatherMask = clamp(max(wallTopBand, plateauRimLip), 0.0, 1.0);

         // Quantize weathering blend into crisp pixel steps
         float weatherStep = floor(weatherMask * 4.0 + 0.5) / 4.0;
         vec3 weatherCol = mix(uWeatheringSecondary, uWeatheringColor, step(0.45, cliffPixNoise));
         diffuseColor.rgb = mix(diffuseColor.rgb, weatherCol, weatherStep * uWeatheringStrength);

         // Grounded crevice ambient shadow at the base of 90-degree cliffs & block corners
         float baseCrevice = clamp(vCliffMeta.z, 0.0, 1.0);
         float baseStep = floor(baseCrevice * 4.0 + 0.5) / 4.0;
         diffuseColor.rgb *= (1.0 - baseStep * uCreviceShadowStrength);`
      );
  };

  mat.needsUpdate = true;
  return mat;
}

export function updateTerrainDioramaBiome(mat: THREE.Material, biome: BattleBiome): void {
  const uniforms = mat.userData.__terrainDioramaUniforms as TerrainWeatheringUniforms | undefined;
  if (!uniforms) return;
  const profile = getBiomeCliffWeathering(biome);
  uniforms.uWeatheringColor.value.copy(profile.edgeColor);
  uniforms.uWeatheringSecondary.value.copy(profile.secondaryColor);
  uniforms.uWeatheringStrength.value = profile.strength;
}
