import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
  computeStabFrameUvRect,
  evaluateMeleeStabPhase,
  getAttackSheetSpecForSpecies,
  mapStabProgressToFrame,
  MELEE_ADVANCE_DURATION,
  MELEE_STAB_DURATION,
  MELEE_STAB_IMPACT_FRAME,
  MELEE_STAB_SHEET_PATH,
  MELEE_STAB_TOTAL_DURATION,
  PLACEHOLDER_ATTACK_SHEET_PATH,
  SOULDOLL_15_ATTACK_SHEET_PATH,
  SOULDOLL_PORTRAIT_PLACEHOLDER_PATH,
} from '../src/domain/MeleeStabTiming.ts';
import {
  getSpeciesAttackSpec,
  hasSpeciesAnimationRole,
  SPECIES_ANIMATION_REGISTRY,
} from '../src/data/animations.ts';
import {
  createFallbackStabTexture,
  createMeleeStabMaterial,
} from '../src/engine/MeleeStabSprite.ts';

describe('MeleeStabTiming', () => {
  it('exposes the uploaded attack asset paths', () => {
    expect(MELEE_STAB_SHEET_PATH).toBe('/assets/attacks/special_attack_15.webp');
    expect(SOULDOLL_15_ATTACK_SHEET_PATH).toBe('/assets/attacks/special_attack_15.webp');
    expect(PLACEHOLDER_ATTACK_SHEET_PATH).toBe(
      '/assets/aistudio/004-special_attack-v1_5431e7bd.png'
    );
    expect(SOULDOLL_PORTRAIT_PLACEHOLDER_PATH).toBe(
      '/assets/aistudio/004-portrait-frame_5c78ef77.png'
    );
  });

  it('selects dedicated attack sheets for SoulDolls #01 and #15 and fallback 5x5 for others', () => {
    const s15 = getAttackSheetSpecForSpecies(15);
    expect(s15.path).toBe('/assets/attacks/special_attack_15.webp');
    expect(s15.cols).toBe(4);
    expect(s15.rows).toBe(5);
    expect(s15.totalFrames).toBe(20);
    expect(s15.impactFrame).toBe(9);
    expect(s15.aspectRatio).toBeCloseTo(16 / 9);

    const s01 = getAttackSheetSpecForSpecies(1);
    expect(s01.path).toBe('/assets/attacks/physical_attack_01.webp');
    expect(s01.cols).toBe(4);
    expect(s01.rows).toBe(7);
    expect(s01.totalFrames).toBe(27);
    expect(s01.impactFrame).toBe(12);
    expect(s01.aspectRatio).toBe(640 / 360);
    expect(s01.facing).toBe('left');

    const defaultSpec = getAttackSheetSpecForSpecies(2);
    expect(defaultSpec.path).toBe('/assets/aistudio/004-special_attack-v1_5431e7bd.png');
    expect(defaultSpec.cols).toBe(5);
    expect(defaultSpec.rows).toBe(5);
    expect(defaultSpec.totalFrames).toBe(25);
    expect(defaultSpec.impactFrame).toBe(11);
    expect(defaultSpec.aspectRatio).toBe(1);
  });

  it('maps 4x5 top-down grid cells accurately with flipY=true UV orientation and horizontal mirror', () => {
    const f0 = computeStabFrameUvRect(0, false);
    expect(f0.row).toBe(0);
    expect(f0.col).toBe(0);
    expect(f0.uMin).toBeCloseTo(0);
    expect(f0.vMin).toBeCloseTo(0.8);
    expect(f0.uSize).toBeCloseTo(0.25);
    expect(f0.vSize).toBeCloseTo(0.2);

    const f9Mirrored = computeStabFrameUvRect(MELEE_STAB_IMPACT_FRAME, true);
    expect(f9Mirrored.row).toBe(2);
    expect(f9Mirrored.col).toBe(1);
    expect(f9Mirrored.uMin).toBeCloseTo(0.5);
    expect(f9Mirrored.uSize).toBeCloseTo(-0.25);
    expect(f9Mirrored.vMin).toBeCloseTo(0.4);
    expect(f9Mirrored.vSize).toBeCloseTo(0.2);

    const f19 = computeStabFrameUvRect(19, false);
    expect(f19.row).toBe(4);
    expect(f19.col).toBe(3);
    expect(f19.uMin).toBeCloseTo(0.75);
    expect(f19.vMin).toBeCloseTo(0);
  });

  it('progresses monotonically across all 20 frames and triggers impact precisely at frame 9', () => {
    const visited = new Set<number>();
    let prev = -1;
    for (let i = 0; i <= 200; i++) {
      const f = mapStabProgressToFrame(i / 200);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(19);
      prev = f;
      visited.add(f);
    }
    expect(visited.size).toBe(20);
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
    handle.setFrame(9, true);
    handle.setOpacity(0.75);
    handle.setElementEffect('#FF8FB8', 0.9);

    const rect = handle.material.uniforms.uFrameRect.value as THREE.Vector4;
    expect(rect.x).toBeCloseTo(0.5);
    expect(rect.y).toBeCloseTo(0.4);
    expect(rect.z).toBeCloseTo(-0.25);
    expect(rect.w).toBeCloseTo(0.2);
    expect(handle.material.uniforms.uOpacity.value).toBeCloseTo(0.75);
    expect(handle.material.uniforms.uElementGlow.value).toBeCloseTo(0.9);

    handle.material.dispose();
    tex.dispose();
  });

  it('tracks registered animation roles per species in SPECIES_ANIMATION_REGISTRY', () => {
    expect(SPECIES_ANIMATION_REGISTRY.length).toBeGreaterThanOrEqual(2);
    expect(hasSpeciesAnimationRole(1, 'physical_attack')).toBe(true);
    expect(hasSpeciesAnimationRole(1, 'special_attack')).toBe(false);
    expect(hasSpeciesAnimationRole(15, 'physical_attack')).toBe(true);
    expect(hasSpeciesAnimationRole(15, 'special_attack')).toBe(false);
    expect(hasSpeciesAnimationRole(undefined, 'physical_attack')).toBe(false);
    expect(getSpeciesAttackSpec(1, 'physical_attack').path).toBe(
      '/assets/attacks/physical_attack_01.webp'
    );
    expect(getSpeciesAttackSpec(15, 'physical_attack').path).toBe(
      '/assets/attacks/special_attack_15.webp'
    );
  });
});
