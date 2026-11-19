import * as THREE from 'three';

export const CLIFF_Z_NEAR_CUT = 2.4;
export const CLIFF_Z_FOCUS_MARGIN = 0.14;
export const CLIFF_Z_CORRIDOR_RADIUS = 1.75;
export const CLIFF_Z_MIN_REL_Y = 0.35;
export const CLIFF_Z_EDGE_MARGIN = 0.08;
export const CLIFF_Z_PIXEL_SNAP = 16.0;

const _cliffZFocusPosUniform = { value: new THREE.Vector3() };
const _cliffZParamsUniform = {
  value: new THREE.Vector4(
    CLIFF_Z_NEAR_CUT,
    CLIFF_Z_FOCUS_MARGIN,
    CLIFF_Z_CORRIDOR_RADIUS,
    1.0
  ),
};
const _cliffZMinRelYUniform = { value: CLIFF_Z_MIN_REL_Y };

export interface CliffZDepthUpdateOptions {
  nearCutZ?: number;
  focusMarginZ?: number;
  corridorRadius?: number;
  strength?: number;
  minRelY?: number;
}

export function updateCliffZDepthUniforms(
  focusPos: { x: number; y: number; z: number },
  opts: CliffZDepthUpdateOptions = {}
): void {
  _cliffZFocusPosUniform.value.set(focusPos.x, focusPos.y, focusPos.z);
  _cliffZParamsUniform.value.set(
    opts.nearCutZ ?? CLIFF_Z_NEAR_CUT,
    opts.focusMarginZ ?? CLIFF_Z_FOCUS_MARGIN,
    opts.corridorRadius ?? CLIFF_Z_CORRIDOR_RADIUS,
    Math.max(0, Math.min(1, opts.strength ?? 1.0))
  );
  if (opts.minRelY !== undefined) {
    _cliffZMinRelYUniform.value = opts.minRelY;
  }
}

export interface CliffZDepthCutoffEvalParams {
  cameraPos: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  focusPos: { x: number; y: number; z: number };
  fragWorldPos: { x: number; y: number; z: number };
  isCliff90: boolean;
  nearCutZ?: number;
  focusMarginZ?: number;
  corridorRadius?: number;
  minRelY?: number;
  strength?: number;
}

export interface CliffZDepthCutoffEvalResult {
  cut: boolean;
  rim: boolean;
  fragViewZ: number;
  focusViewZ: number;
}

/**
 * Pure reference evaluator matching the GLSL camera Z-axis hard cut-off for
 * 90-degree cliff geometry (used by deterministic unit tests).
 */
export function evaluateCliffZDepthCutoff(
  params: CliffZDepthCutoffEvalParams
): CliffZDepthCutoffEvalResult {
  const cam = new THREE.Vector3(params.cameraPos.x, params.cameraPos.y, params.cameraPos.z);
  const tgt = new THREE.Vector3(params.cameraTarget.x, params.cameraTarget.y, params.cameraTarget.z);
  const viewMat = new THREE.Matrix4().lookAt(cam, tgt, new THREE.Vector3(0, 1, 0));
  viewMat.setPosition(cam);
  viewMat.invert();

  const fragView = new THREE.Vector3(
    params.fragWorldPos.x,
    params.fragWorldPos.y,
    params.fragWorldPos.z
  ).applyMatrix4(viewMat);
  const focusView = new THREE.Vector3(
    params.focusPos.x,
    params.focusPos.y,
    params.focusPos.z
  ).applyMatrix4(viewMat);

  const fragViewZ = -fragView.z;
  const focusViewZ = -focusView.z;
  const strength = params.strength ?? 1.0;

  if (!params.isCliff90 || strength <= 0.001) {
    return { cut: false, rim: false, fragViewZ, focusViewZ };
  }

  const nearCutZ = params.nearCutZ ?? CLIFF_Z_NEAR_CUT;
  const focusMarginZ = params.focusMarginZ ?? CLIFF_Z_FOCUS_MARGIN;
  const corridorRadius = params.corridorRadius ?? CLIFF_Z_CORRIDOR_RADIUS;
  const minRelY = params.minRelY ?? CLIFF_Z_MIN_REL_Y;

  const dx = (fragView.x - focusView.x) * 0.84;
  const dy = (fragView.y - focusView.y) * 1.15;
  const corridorDist = Math.hypot(dx, dy);

  const qFragZ = Math.floor(fragViewZ * CLIFF_Z_PIXEL_SNAP + 0.5) / CLIFF_Z_PIXEL_SNAP;
  const qCorridorDist = Math.floor(corridorDist * CLIFF_Z_PIXEL_SNAP + 0.5) / CLIFF_Z_PIXEL_SNAP;

  const nearSliceCut = qFragZ < nearCutZ;
  const corridorDepthCut =
    qFragZ < focusViewZ - focusMarginZ &&
    params.fragWorldPos.y >= params.focusPos.y + minRelY &&
    qCorridorDist < corridorRadius;

  const cut = nearSliceCut || corridorDepthCut;
  if (cut) {
    return { cut: true, rim: false, fragViewZ, focusViewZ };
  }

  const nearSliceEdge = qFragZ < nearCutZ + CLIFF_Z_EDGE_MARGIN;
  const corridorEdge =
    qFragZ < focusViewZ - focusMarginZ + CLIFF_Z_EDGE_MARGIN &&
    params.fragWorldPos.y >= params.focusPos.y + minRelY - 0.06 &&
    qCorridorDist < corridorRadius + CLIFF_Z_EDGE_MARGIN;

  return {
    cut: false,
    rim: nearSliceEdge || corridorEdge,
    fragViewZ,
    focusViewZ,
  };
}

export interface InjectCliffZDepthOptions {
  /** When true, reads `vCliffMeta.x` (only 90-degree cliff faces); otherwise treats all fragments on the material as 90-degree cliff geometry. */
  useCliffMetaAttr: boolean;
}

export function injectCliffZDepthCutoff(
  shader: THREE.WebGLProgramParametersWithUniforms,
  opts: InjectCliffZDepthOptions
): void {
  shader.uniforms.uCliffZFocusPos = _cliffZFocusPosUniform;
  shader.uniforms.uCliffZParams = _cliffZParamsUniform;
  shader.uniforms.uCliffZMinRelY = _cliffZMinRelYUniform;

  if (!shader.vertexShader.includes('vCliffCutViewPos')) {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCliffZFocusPos;
         varying vec3 vCliffCutWorldPos;
         varying vec3 vCliffCutViewPos;
         varying vec3 vCliffCutFocusViewPos;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
         vec4 cliffCutWorld = vec4(transformed, 1.0);
         #ifdef USE_INSTANCING
           cliffCutWorld = instanceMatrix * cliffCutWorld;
         #endif
         cliffCutWorld = modelMatrix * cliffCutWorld;
         vCliffCutWorldPos = cliffCutWorld.xyz;
         vCliffCutViewPos = (viewMatrix * cliffCutWorld).xyz;
         vCliffCutFocusViewPos = (viewMatrix * vec4(uCliffZFocusPos, 1.0)).xyz;`
      );
  }

  if (!shader.fragmentShader.includes('uCliffZParams')) {
    const cliffFlagExpr = opts.useCliffMetaAttr ? 'step(0.5, vCliffMeta.x)' : '1.0';
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uCliffZFocusPos;
         uniform vec4 uCliffZParams;
         uniform float uCliffZMinRelY;
         varying vec3 vCliffCutWorldPos;
         varying vec3 vCliffCutViewPos;
         varying vec3 vCliffCutFocusViewPos;`
      )
      .replace(
        '#include <alphatest_fragment>',
        `#include <alphatest_fragment>
         float cliffHardCutRim = 0.0;
         float cliffIs90Wall = ${cliffFlagExpr};
         if (uCliffZParams.w > 0.001 && cliffIs90Wall > 0.5) {
           float cliffFragViewZ = -vCliffCutViewPos.z;
           float cliffFocusViewZ = -vCliffCutFocusViewPos.z;
           vec2 cliffCorridorDelta = vCliffCutViewPos.xy - vCliffCutFocusViewPos.xy;
           float cliffCorridorDist = length(cliffCorridorDelta * vec2(0.84, 1.15));

           float cliffQFragZ = floor(cliffFragViewZ * ${CLIFF_Z_PIXEL_SNAP.toFixed(1)} + 0.5) / ${CLIFF_Z_PIXEL_SNAP.toFixed(1)};
           float cliffQCorridor = floor(cliffCorridorDist * ${CLIFF_Z_PIXEL_SNAP.toFixed(1)} + 0.5) / ${CLIFF_Z_PIXEL_SNAP.toFixed(1)};

           bool cliffNearSlice = cliffQFragZ < uCliffZParams.x;
           bool cliffCorridorCut = (cliffQFragZ < cliffFocusViewZ - uCliffZParams.y)
             && (vCliffCutWorldPos.y >= uCliffZFocusPos.y + uCliffZMinRelY)
             && (cliffQCorridor < uCliffZParams.z);

           if (cliffNearSlice || cliffCorridorCut) {
             discard;
           }

           bool cliffNearEdge = cliffQFragZ < uCliffZParams.x + ${CLIFF_Z_EDGE_MARGIN.toFixed(2)};
           bool cliffCorridorEdge = (cliffQFragZ < cliffFocusViewZ - uCliffZParams.y + ${CLIFF_Z_EDGE_MARGIN.toFixed(2)})
             && (vCliffCutWorldPos.y >= uCliffZFocusPos.y + uCliffZMinRelY - 0.06)
             && (cliffQCorridor < uCliffZParams.z + ${CLIFF_Z_EDGE_MARGIN.toFixed(2)});
           if (cliffNearEdge || cliffCorridorEdge) {
             cliffHardCutRim = 1.0;
           }
         }`
      )
      .replace(
        '#include <dithering_fragment>',
        `if (cliffHardCutRim > 0.5) {
           gl_FragColor.rgb *= 0.68;
         }
         #include <dithering_fragment>`
      );
  }
}
