import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { CreatureType, MoveCategory } from '../src/domain/types.ts';
import { AbilityVfxSystem } from '../src/engine/AbilityVfxSystem.ts';

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
    const from = new THREE.Vector3(-2.15, 0.85, 2.0);
    const to = new THREE.Vector3(2.25, 1.15, -2.35);

    for (const type of ALL_TYPES) {
      for (const category of ALL_CATEGORIES) {
        vfx.playMove(type, from, to, category, {
          power: category === 'status' ? 0 : 95,
          fromGroundY: 0.28,
          toGroundY: 0.62,
        });
      }
    }

    vfx.playHealOrBuff(from, 0.28, true);
    vfx.playCaptureBurst(to, 0.62, true);

    // Advance past longest effect lifetime
    for (let i = 0; i < 40; i++) {
      vfx.update(0.05);
    }

    // Quality tier scaling should also work cleanly
    vfx.setQualityTier('low');
    vfx.playMove('chispa', from, to, 'special', { power: 90, fromGroundY: 0.28, toGroundY: 0.62 });
    vfx.update(0.1);
    expect(() => vfx.dispose()).not.toThrow();
  });
});
