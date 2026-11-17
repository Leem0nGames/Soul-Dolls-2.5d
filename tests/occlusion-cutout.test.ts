import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  attachCameraOcclusionCutout,
  evaluateOcclusionReveal,
  getDirectionLeadTarget,
  OCCLUSION_INNER_RADIUS,
  OCCLUSION_LEAD_IDLE,
  OCCLUSION_LEAD_MOVING,
  OCCLUSION_OUTER_RADIUS,
  OCCLUSION_TERRAIN_MIN_REL_Y,
} from '../src/engine/OcclusionCutout.ts';

describe('Camera Occlusion Cutout', () => {
  const cameraPos = { x: 0, y: 2.65, z: 6.4 };
  const focusPos = { x: 0, y: 0.78, z: 0 };

  it('fully reveals fragments directly between the camera and the player within the inner circle', () => {
    // Wall 2 tiles closer to camera directly along the view ray
    const t = 2 / 6.4;
    const midRay = {
      x: 0,
      y: focusPos.y + (cameraPos.y - focusPos.y) * t,
      z: 2,
    };

    expect(
      evaluateOcclusionReveal({
        cameraPos,
        focusPos,
        fragPos: midRay,
      })
    ).toBeCloseTo(1, 5);
  });

  it('produces a smooth monotonic quintic feather between inner and outer radii without harsh steps', () => {
    const zPos = 3.0;
    const t = (cameraPos.z - zPos) / (cameraPos.z - focusPos.z);
    const centerY = cameraPos.y + (focusPos.y - cameraPos.y) * t;

    // Evaluate across exact radial distances on the focus plane
    const samples: number[] = [];
    for (let planeR = 0; planeR <= OCCLUSION_OUTER_RADIUS + 0.2; planeR += 0.15) {
      const worldX = planeR * t;
      const reveal = evaluateOcclusionReveal({
        cameraPos,
        focusPos,
        fragPos: { x: worldX, y: centerY, z: zPos },
      });
      samples.push(reveal);
    }

    expect(samples[0]).toBeCloseTo(1, 5);
    expect(samples[samples.length - 1]).toBe(0);

    // Strictly non-increasing from center outward
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-6);
    }

    // Mid-feather point lies strictly between 0 and 1
    const midPlaneR = (OCCLUSION_INNER_RADIUS + OCCLUSION_OUTER_RADIUS) * 0.5;
    const midReveal = evaluateOcclusionReveal({
      cameraPos,
      focusPos,
      fragPos: { x: midPlaneR * t, y: centerY, z: zPos },
    });
    expect(midReveal).toBeGreaterThan(0.2);
    expect(midReveal).toBeLessThan(0.8);
  });

  it('never cuts objects behind the player or low walkable ground under the player feet', () => {
    // Behind player (z = -2)
    expect(
      evaluateOcclusionReveal({
        cameraPos,
        focusPos,
        fragPos: { x: 0, y: 1.5, z: -2 },
      })
    ).toBe(0);

    // Flat ground at y = 0 ahead of player toward camera using terrain minRelY filter
    expect(
      evaluateOcclusionReveal({
        cameraPos,
        focusPos,
        fragPos: { x: 0, y: 0, z: 1.5 },
        minRelY: OCCLUSION_TERRAIN_MIN_REL_Y,
      })
    ).toBe(0);

    // Elevated cliff rising above the player toward camera (y = 1.6) DOES open cleanly
    expect(
      evaluateOcclusionReveal({
        cameraPos,
        focusPos,
        fragPos: { x: 0, y: 1.6, z: 3.0 },
        minRelY: OCCLUSION_TERRAIN_MIN_REL_Y,
      })
    ).toBeGreaterThan(0.5);
  });

  it('leads slightly ahead in the player movement direction so the path forward stays visible', () => {
    expect(getDirectionLeadTarget('up', false)).toEqual({ x: 0, z: -OCCLUSION_LEAD_IDLE });
    expect(getDirectionLeadTarget('up', true)).toEqual({ x: 0, z: -OCCLUSION_LEAD_MOVING });
    expect(getDirectionLeadTarget('right', true)).toEqual({ x: OCCLUSION_LEAD_MOVING, z: 0 });
  });

  it('chains existing onBeforeCompile hooks (like billboard wind) safely', () => {
    const mat = new THREE.MeshLambertMaterial();
    let baseHookCalled = false;
    mat.customProgramCacheKey = () => 'base_wind';
    mat.onBeforeCompile = () => {
      baseHookCalled = true;
    };

    attachCameraOcclusionCutout(mat, { minRelY: -999 });
    // Calling a second time is idempotent
    attachCameraOcclusionCutout(mat, { minRelY: -999 });

    expect(mat.customProgramCacheKey()).toContain('base_wind');
    expect(mat.customProgramCacheKey()).toContain('cam_occ_-999.00');

    const fakeShader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}',
      fragmentShader:
        '#include <common>\nvoid main() {\n#include <alphatest_fragment>\n#include <dithering_fragment>\n}',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;

    mat.onBeforeCompile(fakeShader, {} as THREE.WebGLRenderer);

    expect(baseHookCalled).toBe(true);
    expect(fakeShader.uniforms.uOcclusionCameraPos).toBeDefined();
    expect(fakeShader.uniforms.uOcclusionFocusPos).toBeDefined();
    expect(fakeShader.uniforms.uOcclusionParams).toBeDefined();
    expect(fakeShader.uniforms.uOcclusionMinRelY.value).toBe(-999);
    expect(fakeShader.vertexShader).toContain('vOcclusionWorldPos');
    expect(fakeShader.fragmentShader).toContain('occEdgeReveal');
  });
});
