import * as THREE from 'three';
import type { Direction } from '../domain/types.ts';

export const OCCLUSION_INNER_RADIUS = 0.70;
export const OCCLUSION_OUTER_RADIUS = 1.65;
export const OCCLUSION_DEPTH_FADE = 0.48;
export const OCCLUSION_FOCUS_HEIGHT = 0.78;
export const OCCLUSION_LEAD_IDLE = 0.25;
export const OCCLUSION_LEAD_MOVING = 0.50;
export const OCCLUSION_TERRAIN_MIN_REL_Y = 0.35;

const _cameraPosUniform = { value: new THREE.Vector3() };
const _focusPosUniform = { value: new THREE.Vector3() };
const _paramsUniform = {
  value: new THREE.Vector4(
    OCCLUSION_INNER_RADIUS,
    OCCLUSION_OUTER_RADIUS,
    1.0,
    OCCLUSION_DEPTH_FADE
  ),
};

export interface OcclusionCutoutOptions {
  /** Minimum world-Y relative to focusPos.y for fragments to be affected (-999 for all heights). */
  minRelY?: number;
}

export function getDirectionLeadTarget(
  dir: Direction,
  moving: boolean
): { x: number; z: number } {
  const dist = moving ? OCCLUSION_LEAD_MOVING : OCCLUSION_LEAD_IDLE;
  switch (dir) {
    case 'up':
      return { x: 0, z: -dist };
    case 'down':
      return { x: 0, z: dist };
    case 'left':
      return { x: -dist, z: 0 };
    case 'right':
      return { x: dist, z: 0 };
  }
}

export function updateCameraOcclusionUniforms(
  cameraPos: { x: number; y: number; z: number },
  focusPos: { x: number; y: number; z: number },
  strength = 1.0
): void {
  _cameraPosUniform.value.set(cameraPos.x, cameraPos.y, cameraPos.z);
  _focusPosUniform.value.set(focusPos.x, focusPos.y, focusPos.z);
  _paramsUniform.value.set(
    OCCLUSION_INNER_RADIUS,
    OCCLUSION_OUTER_RADIUS,
    Math.max(0, Math.min(1, strength)),
    OCCLUSION_DEPTH_FADE
  );
}

/**
 * Pure reference evaluator matching the GLSL cutout math (used for deterministic tests).
 */
export function evaluateOcclusionReveal(params: {
  cameraPos: { x: number; y: number; z: number };
  focusPos: { x: number; y: number; z: number };
  fragPos: { x: number; y: number; z: number };
  minRelY?: number;
  strength?: number;
  innerRadius?: number;
  outerRadius?: number;
  depthFade?: number;
}): number {
  const strength = params.strength ?? 1.0;
  const minRelY = params.minRelY ?? -999;
  const innerR = params.innerRadius ?? OCCLUSION_INNER_RADIUS;
  const outerR = params.outerRadius ?? OCCLUSION_OUTER_RADIUS;
  const depthFade = params.depthFade ?? OCCLUSION_DEPTH_FADE;

  if (strength <= 0.001) return 0;
  if (params.fragPos.y < params.focusPos.y + minRelY) return 0;

  const fx = params.focusPos.x - params.cameraPos.x;
  const fy = params.focusPos.y - params.cameraPos.y;
  const fz = params.focusPos.z - params.cameraPos.z;
  const distFocus = Math.hypot(fx, fy, fz);
  if (distFocus <= 0.0001) return 0;

  const dx = fx / distFocus;
  const dy = fy / distFocus;
  const dz = fz / distFocus;

  const rx = params.fragPos.x - params.cameraPos.x;
  const ry = params.fragPos.y - params.cameraPos.y;
  const rz = params.fragPos.z - params.cameraPos.z;
  const projT = rx * dx + ry * dy + rz * dz;

  if (projT <= 0.15 || projT >= distFocus - 0.06) return 0;

  const edgeHigh = distFocus - 0.06;
  const edgeLow = distFocus - depthFade;
  const tDepth = Math.max(0, Math.min(1, (projT - edgeHigh) / (edgeLow - edgeHigh)));
  const depthMask = tDepth * tDepth * (3 - 2 * tDepth);

  const scale = distFocus / projT;
  const onPlaneX = params.cameraPos.x + rx * scale;
  const onPlaneY = params.cameraPos.y + ry * scale;
  const onPlaneZ = params.cameraPos.z + rz * scale;
  const planeDist = Math.hypot(
    onPlaneX - params.focusPos.x,
    onPlaneY - params.focusPos.y,
    onPlaneZ - params.focusPos.z
  );

  const norm = Math.max(0, Math.min(1, (outerR - planeDist) / Math.max(outerR - innerR, 0.001)));
  const smooth = norm * norm * norm * (norm * (norm * 6 - 15) + 10);
  return smooth * depthMask * strength;
}

/**
 * Patches a Three.js built-in material (Standard, Lambert, Basic) so objects between
 * the camera and the player open a smooth circular see-through window with a wide
 * quintic feather and soft rim blend (preserving shadows and depth sorting).
 */
export function attachCameraOcclusionCutout<T extends THREE.Material>(
  mat: T,
  opts: OcclusionCutoutOptions = {}
): T {
  if (mat.userData.__camOcclusionAttached) {
    return mat;
  }
  mat.userData.__camOcclusionAttached = true;

  const minRelY = opts.minRelY ?? -999.0;
  const prevOnBeforeCompile = mat.onBeforeCompile;
  const prevCacheKey = mat.customProgramCacheKey;

  mat.customProgramCacheKey = () => {
    const base = prevCacheKey ? prevCacheKey.call(mat) : '';
    return `${base}|cam_occ_${minRelY.toFixed(2)}`;
  };

  mat.onBeforeCompile = (shader, renderer) => {
    if (prevOnBeforeCompile) {
      prevOnBeforeCompile.call(mat, shader, renderer);
    }

    shader.uniforms.uOcclusionCameraPos = _cameraPosUniform;
    shader.uniforms.uOcclusionFocusPos = _focusPosUniform;
    shader.uniforms.uOcclusionParams = _paramsUniform;
    shader.uniforms.uOcclusionMinRelY = { value: minRelY };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         varying vec3 vOcclusionWorldPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec4 occWorldPos = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           occWorldPos = instanceMatrix * occWorldPos;
         #endif
         occWorldPos = modelMatrix * occWorldPos;
         vOcclusionWorldPos = occWorldPos.xyz;`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uOcclusionCameraPos;
         uniform vec3 uOcclusionFocusPos;
         uniform vec4 uOcclusionParams;
         uniform float uOcclusionMinRelY;
         varying vec3 vOcclusionWorldPos;`
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
         float occEdgeReveal = 0.0;
         if (uOcclusionParams.z > 0.001 && vOcclusionWorldPos.y >= uOcclusionFocusPos.y + uOcclusionMinRelY) {
           vec3 occToFocus = uOcclusionFocusPos - uOcclusionCameraPos;
           float occDistFocus = length(occToFocus);
           vec3 occDir = occToFocus / max(occDistFocus, 0.0001);
           vec3 occToFrag = vOcclusionWorldPos - uOcclusionCameraPos;
           float occProjT = dot(occToFrag, occDir);
           if (occProjT > 0.15 && occProjT < occDistFocus - 0.06) {
             float occDepthMask = smoothstep(occDistFocus - 0.06, occDistFocus - uOcclusionParams.w, occProjT);
             vec3 occOnPlane = uOcclusionCameraPos + occToFrag * (occDistFocus / occProjT);
             float occPlaneDist = length(occOnPlane - uOcclusionFocusPos);
             float occNorm = clamp((uOcclusionParams.y - occPlaneDist) / max(uOcclusionParams.y - uOcclusionParams.x, 0.001), 0.0, 1.0);
             float occSmooth = occNorm * occNorm * occNorm * (occNorm * (occNorm * 6.0 - 15.0) + 10.0);
             float occReveal = occSmooth * occDepthMask * uOcclusionParams.z;
             occEdgeReveal = occReveal;
             float occIgn = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
             if (occReveal >= 0.999 || (occReveal > 0.001 && occReveal > occIgn)) {
               discard;
             }
           }
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (occEdgeReveal > 0.001) {
           gl_FragColor.rgb = mix(gl_FragColor.rgb, gl_FragColor.rgb * 0.78 + vec3(0.16, 0.18, 0.22), occEdgeReveal * 0.42);
         }
         #include <dithering_fragment>`
      );
  };

  mat.needsUpdate = true;
  return mat;
}
