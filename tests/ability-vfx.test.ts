import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CreatureType, MoveCategory } from '../src/domain/types.ts';
import {
  AbilityVfxSystem,
  computeVfxScaleMetrics,
  DEFAULT_VFX_SPRITE_SCALE,
} from '../src/engine/AbilityVfxSystem.ts';

const ALL_TYPES: CreatureType[] = [
  'brasa',
  'marea',
  'flora',
  'chispa',
  'roca',
  'brisa',
  'umbra',
  'comun',
];
const ALL_CATEGORIES: MoveCategory[] = ['physical', 'special', 'status'];

describe('AbilityVfxSystem Procedural GLSL 3D Effects', () => {
  it('spawns, updates, and cleanly disposes shader VFX for all 8 elemental types and 3 move categories', () => {
    const scene = new THREE.Scene();
    const vfx = new AbilityVfxSystem(scene);
    const from = new THREE.Vector3(-2.15, 1.5, 2.0);
    const to = new THREE.Vector3(2.25, 2.0, -2.35);

    for (const type of ALL_TYPES) {
      for (const category of ALL_CATEGORIES) {
        vfx.playMove(type, from, to, category, {
          power: category === 'status' ? 0 : 95,
          fromGroundY: 0.28,
          toGroundY: 0.62,
          fromScale: 2.59,
          toScale: 3.1,
        });
      }
    }

    vfx.playHealOrBuff(from, 0.28, true, 2.59);
    vfx.playCaptureBurst(to, 0.62, true, 3.1);
    expect(vfx.getActiveCount()).toBeGreaterThan(20);

    // Advance past longest delayed detonation + lifetime
    for (let i = 0; i < 60; i++) {
      vfx.update(0.05);
    }
    expect(vfx.getActiveCount()).toBe(0);

    // Quality tier scaling should also work cleanly
    vfx.setQualityTier('low');
    vfx.playMove('chispa', from, to, 'special', {
      power: 90,
      fromGroundY: 0.28,
      toGroundY: 0.62,
      fromScale: 2.59,
      toScale: 3.1,
    });
    vfx.update(0.1);
    expect(vfx.getActiveCount()).toBeGreaterThan(0);
    expect(() => vfx.dispose()).not.toThrow();
    expect(vfx.getActiveCount()).toBe(0);
  });

  it('scales spawned VFX meshes proportionally to larger battle sprite sizes', () => {
    const baseMetrics = computeVfxScaleMetrics(DEFAULT_VFX_SPRITE_SCALE);
    expect(baseMetrics).toEqual({ raw: 1, body: 1, silhouette: 1, ground: 1 });

    const enemyMetrics = computeVfxScaleMetrics(3.1);
    expect(enemyMetrics.body).toBeGreaterThan(1.7);
    expect(enemyMetrics.silhouette).toBeGreaterThan(1.5);
    expect(enemyMetrics.ground).toBeGreaterThan(1.2);
    expect(enemyMetrics.body).toBeGreaterThan(enemyMetrics.ground);

    const measureVortexHeight = (spriteScale: number): number => {
      const scene = new THREE.Scene();
      const vfx = new AbilityVfxSystem(scene);
      const pos = new THREE.Vector3(2.25, 0.5 + spriteScale * 0.48, -2.35);
      vfx.playHealOrBuff(pos, 0.5, true, spriteScale);
      vfx.update(0.25);

      const vfxGroup = scene.children[0] as THREE.Group;
      let vortexHeight = 0;
      for (const child of vfxGroup.children) {
        if (child instanceof THREE.Mesh && Math.abs(child.scale.y - child.scale.x) > 0.01) {
          vortexHeight = child.scale.y;
        }
      }
      vfx.dispose();
      return vortexHeight;
    };

    const refHeight = measureVortexHeight(DEFAULT_VFX_SPRITE_SCALE);
    const largeHeight = measureVortexHeight(3.1);
    expect(largeHeight / refHeight).toBeCloseTo(enemyMetrics.body, 2);
  });
});

