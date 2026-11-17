import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeGridFrameUvRect,
  computeStabFrameUvRect,
  evaluateAttackAnimPhase,
  evaluateMeleeStabPhase,
  getSpeciesAttackSheetConfig,
  mapSpecies15ProgressToFrame,
  mapStabProgressToFrame,
  MELEE_ADVANCE_DURATION,
  MELEE_STAB_DURATION,
  MELEE_STAB_IMPACT_FRAME,
  MELEE_STAB_SHEET_PATH,
  MELEE_STAB_TOTAL_DURATION,
  SOULDOLL_15_ADVANCE_DURATION,
  SOULDOLL_15_ATTACK_DURATION,
  SOULDOLL_15_ATTACK_SHEET,
  SOULDOLL_15_ATTACK_SHEET_PATH,
  SOULDOLL_15_COLS,
  SOULDOLL_15_IMPACT_FRAME,
  SOULDOLL_15_ROWS,
  SOULDOLL_15_TOTAL_DURATION,
  SOULDOLL_15_TOTAL_FRAMES,
  SOULDOLL_PORTRAIT_PLACEHOLDER_PATH,
} from '../src/domain/MeleeStabTiming.ts';
import {
  createFallbackStabTexture,
  createMeleeStabMaterial,
} from '../src/engine/MeleeStabSprite.ts';

describe('MeleeStabTiming', () => {
  it('exposes the uploaded placeholder asset paths', () => {
    expect(MELEE_STAB_SHEET_PATH).toBe('/assets/aistudio/004-special_attack-v1_5431e7bd.png');
    expect(SOULDOLL_PORTRAIT_PLACEHOLDER_PATH).toBe(
      '/assets/aistudio/004-portrait-frame_5c78ef77.png'
    );
  });

  it('maps 5x5 top-down grid cells accurately with flipY=true UV orientation and horizontal mirror', () => {
    const f0 = computeStabFrameUvRect(0, false);
    expect(f0.row).toBe(0);
    expect(f0.col).toBe(0);
    expect(f0.uMin).toBeCloseTo(0);
    expect(f0.vMin).toBeCloseTo(0.8);
    expect(f0.uSize).toBeCloseTo(0.2);
    expect(f0.vSize).toBeCloseTo(0.2);

    // Frame 11 is [row=2, col=1] — when flipped horizontally (right side of enemy stabbing left),
    // u runs right-to-left from 0.4 down to 0.2 while v spans [0.4, 0.6].
    const f11Mirrored = computeStabFrameUvRect(MELEE_STAB_IMPACT_FRAME, true);
    expect(f11Mirrored.row).toBe(2);
    expect(f11Mirrored.col).toBe(1);
    expect(f11Mirrored.uMin).toBeCloseTo(0.4);
    expect(f11Mirrored.uSize).toBeCloseTo(-0.2);
    expect(f11Mirrored.vMin).toBeCloseTo(0.4);
    expect(f11Mirrored.vSize).toBeCloseTo(0.2);

    const f24 = computeStabFrameUvRect(24, false);
    expect(f24.row).toBe(4);
    expect(f24.col).toBe(4);
    expect(f24.uMin).toBeCloseTo(0.8);
    expect(f24.vMin).toBeCloseTo(0);
  });

  it('progresses monotonically across all 25 frames and triggers impact precisely at frame 11', () => {
    const visited = new Set<number>();
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const f = mapStabProgressToFrame(i / 200);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(24);
      prev = f;
      visited.add(f);
    }
    expect(visited.size).toBe(25);
  });

  it('sequences advance+fade -> right-side stab with elemental glow -> return fade-in', () => {
    const start = evaluateMeleeStabPhase(0);
    expect(start.phase).toBe('advance');
    expect(start.attackerOpacity).toBe(1);
    expect(start.stabVisible).toBe(false);

    const endAdvance = evaluateMeleeStabPhase(MELEE_ADVANCE_DURATION - 0.001);
    expect(endAdvance.phase).toBe('advance');
    expect(endAdvance.advanceLungeT).toBeGreaterThan(0.9);
    expect(endAdvance.attackerOpacity).toBeLessThan(0.05);

    const impactMoment = evaluateMeleeStabPhase(
      MELEE_ADVANCE_DURATION + MELEE_STAB_DURATION * 0.45
    );
    expect(impactMoment.phase).toBe('stab');
    expect(impactMoment.stabVisible).toBe(true);
    expect(impactMoment.attackerOpacity).toBe(0);
    expect(impactMoment.frameIndex).toBe(MELEE_STAB_IMPACT_FRAME);
    expect(impactMoment.impactTriggered).toBe(true);
    expect(impactMoment.elementGlow).toBe(1);

    const returning = evaluateMeleeStabPhase(MELEE_STAB_TOTAL_DURATION - 0.02);
    expect(returning.phase).toBe('return');
    expect(returning.stabVisible).toBe(false);
    expect(returning.attackerOpacity).toBeGreaterThan(0.8);
  });

  it('updates MeleeStabSprite shader uniforms cleanly', () => {
    const tex = createFallbackStabTexture();
    const handle = createMeleeStabMaterial(tex);
    handle.setFrame(11, true);
    handle.setOpacity(0.75);
    handle.setElementEffect('#FF8FB8', 0.9);

    const rect = handle.material.uniforms.uFrameRect.value as THREE.Vector4;
    expect(rect.x).toBeCloseTo(0.4);
    expect(rect.y).toBeCloseTo(0.4);
    expect(rect.z).toBeCloseTo(-0.2);
    expect(rect.w).toBeCloseTo(0.2);
    expect(handle.material.uniforms.uOpacity.value).toBeCloseTo(0.75);
    expect(handle.material.uniforms.uElementGlow.value).toBeCloseTo(0.9);
    expect(handle.material.uniforms.uTintStrength.value).toBeCloseTo(1);

    handle.setFrame(7, false, SOULDOLL_15_COLS, SOULDOLL_15_ROWS, SOULDOLL_15_TOTAL_FRAMES);
    handle.setElementEffect('#F4D073', 1, 0.42);
    expect(rect.x).toBeCloseTo(0.75);
    expect(rect.y).toBeCloseTo(0.6);
    expect(rect.z).toBeCloseTo(0.25);
    expect(rect.w).toBeCloseTo(0.2);
    expect(handle.material.uniforms.uTintStrength.value).toBeCloseTo(0.42);

    handle.material.dispose();
    tex.dispose();
  });

  it('resolves SoulDoll #15 custom 18-frame attack config and leaves other species on default', () => {
    const cfg15 = getSpeciesAttackSheetConfig(15);
    expect(cfg15).not.toBeNull();
    expect(cfg15?.sheetPath).toBe(SOULDOLL_15_ATTACK_SHEET_PATH);
    expect(cfg15?.cols).toBe(4);
    expect(cfg15?.rows).toBe(5);
    expect(cfg15?.totalFrames).toBe(18);
    expect(cfg15?.impactFrame).toBe(7);
    expect(cfg15?.totalDuration).toBeCloseTo(1.36);

    expect(getSpeciesAttackSheetConfig(1)).toBeNull();
    expect(getSpeciesAttackSheetConfig(14)).toBeNull();
  });

  it('progresses monotonically across all 18 valid frames of SoulDoll #15 without touching blank cells', () => {
    const visited = new Set<number>();
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const f = mapSpecies15ProgressToFrame(i / 200);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(SOULDOLL_15_TOTAL_FRAMES);
      prev = f;
      visited.add(f);
    }
    expect(visited.size).toBe(18);

    // Clamping grid UV mapper prevents sampling cells 18 or 19
    const clampedRect = computeGridFrameUvRect(
      19,
      SOULDOLL_15_COLS,
      SOULDOLL_15_ROWS,
      SOULDOLL_15_TOTAL_FRAMES,
      false
    );
    expect(clampedRect.row).toBe(4);
    expect(clampedRect.col).toBe(1);
    expect(clampedRect.uMin).toBeCloseTo(0.25);
    expect(clampedRect.vMin).toBeCloseTo(0);
  });

  it('evaluates SoulDoll #15 recalculated phases with impact at frame 7', () => {
    const start = evaluateAttackAnimPhase(0, SOULDOLL_15_ATTACK_SHEET);
    expect(start.phase).toBe('advance');
    expect(start.impactTriggered).toBe(false);

    const windup = evaluateAttackAnimPhase(
      SOULDOLL_15_ADVANCE_DURATION + SOULDOLL_15_ATTACK_DURATION * 0.2,
      SOULDOLL_15_ATTACK_SHEET
    );
    expect(windup.phase).toBe('stab');
    expect(windup.frameIndex).toBeLessThan(SOULDOLL_15_IMPACT_FRAME);
    expect(windup.impactTriggered).toBe(false);

    const impact = evaluateAttackAnimPhase(
      SOULDOLL_15_ADVANCE_DURATION + SOULDOLL_15_ATTACK_DURATION * 0.4,
      SOULDOLL_15_ATTACK_SHEET
    );
    expect(impact.phase).toBe('stab');
    expect(impact.frameIndex).toBe(SOULDOLL_15_IMPACT_FRAME);
    expect(impact.impactTriggered).toBe(true);
    expect(impact.elementGlow).toBe(1);

    const returning = evaluateAttackAnimPhase(
      SOULDOLL_15_TOTAL_DURATION - 0.02,
      SOULDOLL_15_ATTACK_SHEET
    );
    expect(returning.phase).toBe('return');
    expect(returning.frameIndex).toBe(17);
  });
});

