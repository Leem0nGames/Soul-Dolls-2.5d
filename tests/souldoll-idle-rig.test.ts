import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createBattleSpriteMaterial } from '../src/engine/BattleSpriteMat.ts';
import {
  computeBreathWave,
  SoulDollIdleRig,
} from '../src/engine/SoulDollIdleRig.ts';
import { detectSoulDollTorsoAnchor } from '../src/gfx/SoulDollSheets.ts';

describe('SoulDollIdleRig grounded breathing & bust physics', () => {
  it('generates an asymmetric organic breathing waveform bounded in [0, 1]', () => {
    const start = computeBreathWave(0);
    const midInhale = computeBreathWave(0.18);
    const peak = computeBreathWave(0.36);
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
  });

  it('reacts physically to vertical/lateral impulses and damps smoothly back to equilibrium', () => {
    const rig = new SoulDollIdleRig({
      view: 'front',
      flipX: false,
      cycleDuration: 3.5,
      initialPhase: 0.92,
    });

    rig.injectImpulse(0.4, -0.85, 0.25);

    let minY = 0;
    let maxY = 0;
    for (let i = 0; i < 45; i++) {
      rig.update(1 / 60, true);
      const st = rig.getState();
      expect(Number.isFinite(st.bustX)).toBe(true);
      expect(Number.isFinite(st.bustY)).toBe(true);
      expect(Number.isFinite(st.bustExpand)).toBe(true);
      minY = Math.min(minY, st.bustY);
      maxY = Math.max(maxY, st.bustY);
    }

    // Should deflect downward first, then rebound subtly upward
    expect(minY).toBeLessThan(-0.004);
    expect(maxY).toBeGreaterThan(0.0005);

    // After settling (keeping breathing paused so spring settles to static breath rest), velocity converges to 0
    for (let i = 0; i < 240; i++) {
      rig.update(1 / 60, false);
    }
    const settled = rig.getState();
    expect(Math.abs(settled.bustVelY)).toBeLessThan(0.005);
    expect(Math.abs(settled.bustY)).toBeLessThan(0.006);
  });

  it('stays stable under large dt hitches and writes uniforms cleanly to BattleSpriteMaterial', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const matHandle = createBattleSpriteMaterial(tex);
    const rig = new SoulDollIdleRig({
      view: 'back',
      flipX: true,
      cycleDuration: 3.2,
      initialPhase: 0.25,
    });
    rig.setAnchor({ torsoX: 0.44, bustY: 0.64, charHeight: 0.88 });
    rig.injectImpulse(-0.6, -1.0, 0.3);
    rig.update(0.25, true);
    rig.applyToMaterial(matHandle);

    const u = matHandle.material.uniforms;
    expect(u.uFlipSign.value).toBe(-1);
    expect(u.uIsBack.value).toBe(1);
    // FlipX mirrors torsoX from 0.44 -> 0.56 in screen space
    expect(u.uTorsoAnchor.value.x).toBeCloseTo(0.56, 5);
    expect(u.uTorsoAnchor.value.y).toBeCloseTo(0.64, 5);
    expect(u.uCharHeight.value).toBeCloseTo(0.88, 5);
    expect(Math.abs(u.uBustOffset.value.y)).toBeLessThanOrEqual(0.028);

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

    // Head (y: 6..15 -> charY ~0.76..0.90)
    fillRect(19, 6, 33, 15);
    // Narrow neck notch around y=16..18 (charY ~0.70..0.74)
    fillRect(23, 16, 29, 18);
    // Bust/chest torso around y=19..28 (charY ~0.55..0.69) + trailing hair far right (x: 46..60)
    fillRect(18, 19, 34, 34);
    fillRect(46, 15, 60, 36);
    // Legs shifted left (x: 20..32)
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

    // Centered body at x = 28..38 (center ~0.52)
    fillRect(26, 6, 40, 15);
    fillRect(30, 16, 36, 18);
    fillRect(26, 19, 40, 36);
    fillRect(28, 37, 38, 59);
    // Heavy swinging censer & smoke far left at lower height (x = 2..14, y = 30..55)
    fillRect(2, 30, 14, 55);

    const anchor = detectSoulDollTorsoAnchor(rgba, w, h, 58);
    expect(anchor.torsoX).toBeGreaterThanOrEqual(0.49);
    expect(anchor.torsoX).toBeLessThanOrEqual(0.56);
  });

  it('maintains C1 breath continuity, returns to exact base pose over 12 cycles with zero drift, and is FPS-independent', () => {
    // 1. C1 continuity check around segment boundaries (0.36, 0.44, 0.88)
    for (const boundary of [0.36, 0.44, 0.88]) {
      const before = computeBreathWave(boundary - 0.0001);
      const at = computeBreathWave(boundary);
      const after = computeBreathWave(boundary + 0.0001);
      expect(Math.abs(before.value - at.value)).toBeLessThan(0.001);
      expect(Math.abs(after.value - at.value)).toBeLessThan(0.001);
      expect(Math.abs(before.velocity - at.velocity)).toBeLessThan(0.01);
      expect(Math.abs(after.velocity - at.velocity)).toBeLessThan(0.01);
    }

    // 2. 12 consecutive cycles without accumulation drift & clean return to base pose
    const cycleDuration = 3.35;
    const rig60 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });
    const rig30 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });
    const rig120 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });

    const totalSec = cycleDuration * 12;
    for (let i = 0; i < Math.round(totalSec * 60); i++) rig60.update(1 / 60, true);
    for (let i = 0; i < Math.round(totalSec * 30); i++) rig30.update(1 / 30, true);
    for (let i = 0; i < Math.round(totalSec * 120); i++) rig120.update(1 / 120, true);

    // Compare mid-cycle inspiration pose across 30/60/120 FPS
    const rigPeak30 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });
    const rigPeak60 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });
    const rigPeak120 = new SoulDollIdleRig({ view: 'front', cycleDuration, initialPhase: 0 });
    const peakDur = cycleDuration * 0.40;
    for (let t = 0; t < peakDur; t += 1 / 30) rigPeak30.update(1 / 30, true);
    for (let t = 0; t < peakDur; t += 1 / 60) rigPeak60.update(1 / 60, true);
    for (let t = 0; t < peakDur; t += 1 / 120) rigPeak120.update(1 / 120, true);

    const p30 = rigPeak30.getState();
    const p60 = rigPeak60.getState();
    const p120 = rigPeak120.getState();
    expect(p60.breath).toBeCloseTo(1, 3);
    expect(p60.bustExpand).toBeGreaterThan(0);
    expect(p60.bustExpand).toBeLessThan(0.015);
    expect(Math.abs(p30.bustY - p120.bustY)).toBeLessThan(0.0005);
    expect(Math.abs(p30.bustExpand - p120.bustExpand)).toBeLessThan(0.0005);

    // At end of 12 full cycles (phase = 0, settled pause [0.88..1.0]), springs are back near 0
    for (const s of [rig30.getState(), rig60.getState(), rig120.getState()]) {
      expect(s.bustX).toBe(0);
      expect(Math.abs(s.bustY)).toBeLessThan(0.0006);
      expect(Math.abs(s.bustExpand)).toBeLessThan(0.0006);
    }
  });

  it('uses strictly symmetric bilateral shader deformation and stable color-space output', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const matHandle = createBattleSpriteMaterial(tex);
    const rig = new SoulDollIdleRig({ view: 'front', cycleDuration: 3.35, initialPhase: 0.4 });
    rig.update(1 / 60, true);
    rig.applyToMaterial(matHandle);

    const frag = matHandle.material.fragmentShader;
    const vert = matHandle.material.vertexShader;
    // No independent lobe centers/weights that deform left & right unevenly
    expect(frag).not.toContain('lobeNear');
    expect(frag).not.toContain('lobeFar');
    expect(vert).toContain('thoraxMask');
    expect(frag).toContain('wChest');
    // Standard Three.js color pipeline parity (prevents brightness drop when bypassing OutputPass)
    expect(frag).toContain('#include <tonemapping_fragment>');
    expect(frag).toContain('#include <colorspace_fragment>');

    // Lighting/material uniforms untouched by breathing updates
    expect(matHandle.material.uniforms.uOpacity.value).toBe(1);
    expect(matHandle.material.uniforms.uFlash.value).toBe(0);
    expect(matHandle.material.uniforms.uDissolve.value).toBe(0);
    expect(matHandle.material.uniforms.map.value).toBe(tex);

    matHandle.material.dispose();
    tex.dispose();
  });
});
