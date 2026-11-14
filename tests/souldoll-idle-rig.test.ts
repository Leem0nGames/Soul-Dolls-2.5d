import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ImpactShockwaveShader } from '../src/engine/BattlePostFx.ts';
import { createBattleSpriteMaterial } from '../src/engine/BattleSpriteMat.ts';
import {
  computeVolumePreservationScaleDelta,
  SOFT_BODY_FIXED_HZ,
  SoftBodySpring120Hz,
} from '../src/engine/SoftBodySpring120Hz.ts';
import {
  computeBreathWave,
  DEFAULT_BREATH_CYCLE_DURATION,
  MAX_THORAX_EXPANSION_RATIO,
  MAX_THORAX_ROTATION_DEG,
  SECONDARY_BREATH_PHASE_OFFSET,
  SoulDollIdleRig,
} from '../src/engine/SoulDollIdleRig.ts';
import { detectSoulDollTorsoAnchor } from '../src/gfx/SoulDollSheets.ts';

describe('SoulDollIdleRig torso-driven breathing & luminosity isolation', () => {
  it('enforces 3.5s cycle duration, expressive thoracic expansion & rotation limits, and [0, 1] C1 breathWeight', () => {
    expect(DEFAULT_BREATH_CYCLE_DURATION).toBe(3.5);
    expect(MAX_THORAX_EXPANSION_RATIO).toBeGreaterThanOrEqual(0.045);
    expect(MAX_THORAX_EXPANSION_RATIO).toBeLessThanOrEqual(0.075);
    expect(MAX_THORAX_ROTATION_DEG).toBeGreaterThanOrEqual(2.5);
    expect(MAX_THORAX_ROTATION_DEG).toBeLessThanOrEqual(4.5);

    const start = computeBreathWave(0);
    const midInhale = computeBreathWave(0.24);
    const peak = computeBreathWave(0.48);
    const midExhale = computeBreathWave(0.66);
    const rest = computeBreathWave(0.94);

    expect(start.value).toBeCloseTo(0, 5);
    expect(midInhale.value).toBeGreaterThan(0.4);
    expect(midInhale.velocity).toBeGreaterThan(0);
    expect(peak.value).toBeCloseTo(1, 3);
    expect(midExhale.velocity).toBeLessThan(0);
    expect(rest.value).toBe(0);
    expect(rest.velocity).toBe(0);

    for (let i = 0; i <= 100; i++) {
      const s = computeBreathWave(i / 100);
      expect(Number.isFinite(s.value)).toBe(true);
      expect(Number.isFinite(s.velocity)).toBe(true);
      expect(s.value).toBeGreaterThanOrEqual(0);
      expect(s.value).toBeLessThanOrEqual(1);
    }

    for (const boundary of [0.42, 0.52, 0.94]) {
      const before = computeBreathWave(boundary - 0.0001);
      const at = computeBreathWave(boundary);
      const after = computeBreathWave(boundary + 0.0001);
      expect(Math.abs(before.value - at.value)).toBeLessThan(0.001);
      expect(Math.abs(after.value - at.value)).toBeLessThan(0.001);
      expect(Math.abs(before.velocity - at.velocity)).toBeLessThan(0.02);
      expect(Math.abs(after.velocity - at.velocity)).toBeLessThan(0.02);
    }
  });

  it('produces elastic 120Hz soft-body jiggle with 2D volume preservation on impulses and settles cleanly to equilibrium', () => {
    expect(SOFT_BODY_FIXED_HZ).toBe(120);
    expect(computeVolumePreservationScaleDelta(-0.02, 0.9)).toBeGreaterThan(0);
    expect(computeVolumePreservationScaleDelta(0.02, 0.9)).toBeLessThan(0);
    expect(computeVolumePreservationScaleDelta(0, 0.9)).toBe(0);

    const rig = new SoulDollIdleRig({
      view: 'front',
      flipX: false,
      cycleDuration: DEFAULT_BREATH_CYCLE_DURATION,
      initialPhase: 0.94,
    });

    rig.injectImpulse(0.4, -0.78, 0.24);

    let minY = 0;
    let maxY = 0;
    let minJiggleY = 0;
    let maxJiggleY = 0;
    let maxVolX = 0;
    for (let i = 0; i < 60; i++) {
      rig.update(1 / 60, false);
      const st = rig.getState();
      expect(Number.isFinite(st.recoilX)).toBe(true);
      expect(Number.isFinite(st.recoilY)).toBe(true);
      expect(Number.isFinite(st.jiggleX)).toBe(true);
      expect(Number.isFinite(st.jiggleY)).toBe(true);
      expect(Number.isFinite(st.volumeScaleX)).toBe(true);
      minY = Math.min(minY, st.recoilY);
      maxY = Math.max(maxY, st.recoilY);
      minJiggleY = Math.min(minJiggleY, st.jiggleY);
      maxJiggleY = Math.max(maxJiggleY, st.jiggleY);
      maxVolX = Math.max(maxVolX, st.volumeScaleX);
    }

    expect(minY).toBeLessThan(-0.003);
    expect(maxY).toBeGreaterThan(0.0003);
    // Bust jiggle deflects noticeably downward, rebounds upward, and preserves volume
    expect(minJiggleY).toBeLessThan(-0.012);
    expect(maxJiggleY).toBeGreaterThan(0.004);
    expect(maxVolX).toBeGreaterThan(0.03);

    // Damps cleanly back to rest (keeping breathing paused)
    for (let i = 0; i < 240; i++) {
      rig.update(1 / 60, false);
    }
    const settled = rig.getState();
    expect(Math.abs(settled.recoilVelY)).toBeLessThan(0.005);
    expect(Math.abs(settled.recoilY)).toBeLessThan(0.006);
    expect(Math.abs(settled.jiggleY)).toBeLessThan(0.0005);
    expect(Math.abs(settled.jiggleVelY)).toBeLessThan(0.005);
    expect(Math.abs(settled.volumeScaleX)).toBeLessThan(0.002);

    // Fixed 120Hz solver produces identical trajectories at 30fps and 120fps
    const spring30 = new SoftBodySpring120Hz();
    const spring120 = new SoftBodySpring120Hz();
    spring30.injectImpulse(0, -0.8);
    spring120.injectImpulse(0, -0.8);
    for (let i = 0; i < 15; i++) spring30.update(1 / 30);
    for (let i = 0; i < 60; i++) spring120.update(1 / 120);
    expect(Math.abs(spring30.y - spring120.y)).toBeLessThan(1e-6);
    expect(Math.abs(spring30.volumeScaleX - spring120.volumeScaleX)).toBeLessThan(1e-6);
  });

  it('composes POSE_ACTUAL = POSE_BASE * BREATH_QUAT without frame accumulation and returns to exact neutral base pose across >= 3 and 12 cycles', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const matHandle = createBattleSpriteMaterial(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matHandle.material);
    const cameraPos = new THREE.Vector3(-4, 2.5, 6);

    const rig60 = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.5, initialPhase: 0 });
    const rig30 = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.5, initialPhase: 0 });
    const rig120 = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.5, initialPhase: 0 });

    // Record exact base pose quaternion (at breathWeight === 0)
    mesh.position.set(1.2, 0, -0.8);
    mesh.lookAt(cameraPos.x, mesh.position.y, cameraPos.z);
    const baseQuat = mesh.quaternion.clone();

    // Run 3 full cycles on mesh via lookAt + applyToMesh
    const threeCyclesSteps = Math.round(3.5 * 3 * 60);
    let maxRotDegObserved = 0;
    for (let i = 0; i < threeCyclesSteps; i++) {
      rig60.update(1 / 60, true);
      mesh.lookAt(cameraPos.x, mesh.position.y, cameraPos.z);
      rig60.applyToMesh(mesh, matHandle);
      maxRotDegObserved = Math.max(maxRotDegObserved, rig60.getBreathRotationDeg());
    }

    expect(maxRotDegObserved).toBeGreaterThanOrEqual(2.5);
    expect(maxRotDegObserved).toBeLessThanOrEqual(4.5);
    expect(rig60.getBreathWeight()).toBeCloseTo(0, 5);
    expect(mesh.quaternion.angleTo(baseQuat)).toBeLessThan(1e-5);

    // Continue through 12 total cycles and check FPS independence (30 vs 60 vs 120 FPS)
    const remaining9CyclesSec = 3.5 * 9;
    for (let i = 0; i < Math.round(remaining9CyclesSec * 60); i++) {
      rig60.update(1 / 60, true);
      mesh.lookAt(cameraPos.x, mesh.position.y, cameraPos.z);
      rig60.applyToMesh(mesh, matHandle);
    }
    for (let i = 0; i < Math.round(3.5 * 12 * 30); i++) rig30.update(1 / 30, true);
    for (let i = 0; i < Math.round(3.5 * 12 * 120); i++) rig120.update(1 / 120, true);

    expect(mesh.quaternion.angleTo(baseQuat)).toBeLessThan(1e-5);
    for (const st of [rig30.getState(), rig60.getState(), rig120.getState()]) {
      expect(st.breathWeight).toBeCloseTo(0, 5);
      expect(st.secondaryWeight).toBeCloseTo(0, 5);
      expect(st.rotationDeg).toBeCloseTo(0, 5);
      expect(st.recoilX).toBe(0);
      expect(st.recoilY).toBe(0);
    }

    // Mid-inspiration FPS independence check (phase ~ 0.46)
    const peak30 = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.5, initialPhase: 0 });
    const peak120 = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.5, initialPhase: 0 });
    const peakDur = 3.5 * 0.46;
    for (let t = 0; t < peakDur; t += 1 / 30) peak30.update(1 / 30, true);
    for (let t = 0; t < peakDur; t += 1 / 120) peak120.update(1 / 120, true);
    expect(peak120.getBreathWeight()).toBeCloseTo(1, 3);
    expect(Math.abs(peak30.getBreathWeight() - peak120.getBreathWeight())).toBeLessThan(0.02);

    mesh.geometry.dispose();
    matHandle.material.dispose();
    tex.dispose();
  });

  it('uses unified linear thoracic vertex deformation with zero independent lobe centers', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const matHandle = createBattleSpriteMaterial(tex);
    const rig = new SoulDollIdleRig({
      view: 'back',
      flipX: true,
      cycleDuration: 3.5,
      initialPhase: 0.45,
    });
    rig.setAnchor({ torsoX: 0.44, bustY: 0.64, charHeight: 0.88 });
    rig.update(1 / 60, true);
    rig.applyToMaterial(matHandle);

    const u = matHandle.material.uniforms;
    expect(u.uFlipSign.value).toBe(-1);
    expect(u.uIsBack.value).toBe(1);
    expect(u.uTorsoAnchor.value.x).toBeCloseTo(0.56, 5);
    expect(u.uTorsoAnchor.value.y).toBeCloseTo(0.64, 5);
    expect(u.uCharHeight.value).toBeCloseTo(0.88, 5);
    expect(u.uBreathWeight.value).toBeGreaterThan(0.95);
    expect(u.uBreathWeight.value).toBeLessThanOrEqual(1);

    const frag = matHandle.material.fragmentShader;
    const vert = matHandle.material.vertexShader;
    expect(vert).toContain('uBreathWeight');
    expect(vert).toContain('uSecondaryWeight');
    expect(vert).toContain('uBustJiggle');
    expect(vert).toContain('uVolumeScale');
    expect(vert).toContain('bustSoftMask');
    expect(vert).toContain('ribVertBand');
    expect(vert).toContain('dx * ribVertBand * thoraxExpand');
    expect(vert).toContain('outerLimbDrape');
    expect(vert).toContain('headCrownBand');
    expect(vert).not.toContain('lobe1');
    expect(vert).not.toContain('lobe2');
    expect(vert).not.toContain('lateralDir');
    expect(vert).not.toContain('uBustExpand');
    expect(u.uSecondaryWeight.value).toBe(rig.getSecondaryWeight());
    expect(u.uBustJiggle.value.y).toBe(rig.getState().jiggleY);
    expect(u.uVolumeScale.value).toBe(rig.getState().volumeScaleX);
    expect(frag).toContain('vec2 sampleUv = clamp(vUv,');
    expect(frag).toContain('smoothstep(0.45, 0.60, texel.a)');
    expect(frag).toContain('#include <tonemapping_fragment>');
    expect(frag).toContain('#include <colorspace_fragment>');
    expect(matHandle.material.premultipliedAlpha).toBe(false);

    matHandle.material.dispose();
    tex.dispose();
  });

  it('offsets secondary element phase smoothly behind primary thorax breath and returns to zero at cycle end', () => {
    expect(SECONDARY_BREATH_PHASE_OFFSET).toBeGreaterThan(0);
    expect(SECONDARY_BREATH_PHASE_OFFSET).toBeLessThanOrEqual(0.1);

    const rig = new SoulDollIdleRig({
      view: 'front',
      cycleDuration: DEFAULT_BREATH_CYCLE_DURATION,
      initialPhase: 0,
    });
    expect(rig.getBreathWeight()).toBe(0);
    expect(rig.getSecondaryWeight()).toBe(0);

    // Mid-inhale: secondary elements trail slightly behind primary thorax expansion
    rig.update(DEFAULT_BREATH_CYCLE_DURATION * 0.25, true);
    expect(rig.getBreathWeight()).toBeGreaterThan(rig.getSecondaryWeight());
    expect(rig.getSecondaryWeight()).toBeGreaterThan(0);

    // Mid-exhale: secondary elements buoyantly trail above primary thorax contraction
    rig.update(DEFAULT_BREATH_CYCLE_DURATION * 0.45, true);
    expect(rig.getSecondaryWeight()).toBeGreaterThan(rig.getBreathWeight());

    // Finish full cycle: both primary and secondary settle back to exact 0
    rig.update(DEFAULT_BREATH_CYCLE_DURATION * 0.30, true);
    expect(rig.getBreathWeight()).toBeCloseTo(0, 5);
    expect(rig.getSecondaryWeight()).toBeCloseTo(0, 5);
  });

  it('passes all 4 breathing & VFX/lighting isolation checks without modifying character luminosity', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const matHandle = createBattleSpriteMaterial(tex);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), matHandle.material);
    mesh.lookAt(0, 0, 5);
    const baseQuat = mesh.quaternion.clone();

    // Case 1: Breathing OFF, VFX/Flash ON
    const rigOffVfxOn = new SoulDollIdleRig({
      view: 'front',
      cycleDuration: 3.5,
      initialPhase: 0.25,
      breathingEnabled: false,
    });
    rigOffVfxOn.update(0.5, true);
    mesh.quaternion.copy(baseQuat);
    rigOffVfxOn.applyToMesh(mesh, matHandle);
    matHandle.setFlash(0.4);
    expect(matHandle.material.uniforms.uBreathWeight.value).toBe(0);
    expect(mesh.quaternion.angleTo(baseQuat)).toBe(0);
    expect(matHandle.material.uniforms.uFlash.value).toBeCloseTo(0.4, 5);

    // Case 2: Breathing ON, VFX OFF (full cycle must never touch opacity/flash/dissolve)
    matHandle.setFlash(0);
    const rigOnVfxOff = new SoulDollIdleRig({
      view: 'front',
      cycleDuration: 3.5,
      initialPhase: 0,
      breathingEnabled: true,
    });
    for (let i = 0; i < 210; i++) {
      rigOnVfxOff.update(1 / 60, true);
      mesh.quaternion.copy(baseQuat);
      rigOnVfxOff.applyToMesh(mesh, matHandle);
      expect(matHandle.material.uniforms.uOpacity.value).toBe(1);
      expect(matHandle.material.uniforms.uFlash.value).toBe(0);
      expect(matHandle.material.uniforms.uDissolve.value).toBe(0);
    }

    // Case 3: Both Breathing ON & VFX/Dim ON — ImpactShockwaveShader vignette does not darken character UV radii (<= 0.50)
    expect(ImpactShockwaveShader.fragmentShader).toContain('smoothstep(0.54, 1.02, length(vUv - 0.5))');
    // Verify smoothstep(0.54, 1.02, r) evaluates to 0 for typical character positions (r <= 0.50)
    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    expect(smoothstep(0.54, 1.02, 0.35)).toBe(0);
    expect(smoothstep(0.54, 1.02, 0.48)).toBe(0);

    // Case 4: Both OFF — neutral pose and untouched lighting/color uniforms
    rigOnVfxOff.setBreathingEnabled(false);
    mesh.quaternion.copy(baseQuat);
    rigOnVfxOff.applyToMesh(mesh, matHandle);
    expect(matHandle.material.uniforms.uBreathWeight.value).toBe(0);
    expect(matHandle.material.uniforms.uOpacity.value).toBe(1);
    expect(matHandle.material.uniforms.uFlash.value).toBe(0);
    expect(mesh.quaternion.angleTo(baseQuat)).toBe(0);

    mesh.geometry.dispose();
    matHandle.material.dispose();
    tex.dispose();
  });

  it('detects upper torso centerline and neck-notch bustY away from trailing hair', () => {
    const w = 64;
    const h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 255;
          rgba[idx + 1] = 255;
          rgba[idx + 2] = 255;
          rgba[idx + 3] = 255;
        }
      }
    };

    fillRect(19, 6, 33, 15);
    fillRect(23, 16, 29, 18);
    fillRect(18, 19, 34, 34);
    fillRect(46, 15, 60, 36);
    fillRect(20, 38, 32, 59);

    const anchor = detectSoulDollTorsoAnchor(rgba, w, h, 58);
    expect(anchor.torsoX).toBeLessThan(0.45);
    expect(anchor.torsoX).toBeGreaterThanOrEqual(0.39);
    expect(anchor.bustY).toBeGreaterThanOrEqual(0.61);
    expect(anchor.bustY).toBeLessThanOrEqual(0.66);
    expect(anchor.charHeight).toBeCloseTo(58 / 64, 3);
  });

  it('ignores detached swinging props/censers at leg height via head/neck spine tracking', () => {
    const w = 64;
    const h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 255;
          rgba[idx + 1] = 255;
          rgba[idx + 2] = 255;
          rgba[idx + 3] = 255;
        }
      }
    };

    fillRect(26, 6, 40, 15);
    fillRect(30, 16, 36, 18);
    fillRect(26, 19, 40, 36);
    fillRect(28, 37, 38, 59);
    fillRect(2, 30, 14, 55);

    const anchor = detectSoulDollTorsoAnchor(rgba, w, h, 58);
    expect(anchor.torsoX).toBeGreaterThanOrEqual(0.49);
    expect(anchor.torsoX).toBeLessThanOrEqual(0.56);
  });

  it('detects unbiased symmetric torsoX for symmetric characters', () => {
    const w = 64;
    const h = 64;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const fillRect = (x0: number, y0: number, x1: number, y1: number) => {
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const idx = (y * w + x) * 4;
          rgba[idx] = 255;
          rgba[idx + 1] = 255;
          rgba[idx + 2] = 255;
          rgba[idx + 3] = 255;
        }
      }
    };

    fillRect(25, 6, 38, 15);
    fillRect(29, 16, 34, 18);
    fillRect(25, 19, 38, 35);
    fillRect(27, 36, 36, 59);

    const anchor = detectSoulDollTorsoAnchor(rgba, w, h, 58);
    expect(anchor.torsoX).toBeCloseTo(0.5, 2);
  });
});
