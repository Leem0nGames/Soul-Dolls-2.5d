import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MOVES } from '../src/data/moves.ts';
import type { CreatureType, MoveCategory } from '../src/domain/types.ts';
import {
  AbilityVfxSystem,
  computeVfxScaleMetrics,
  DEFAULT_VFX_SPRITE_SCALE,
} from '../src/engine/AbilityVfxSystem.ts';
import {
  getMoveImpactProfile,
  getMoveVfxStyle,
  type MoveVfxStyle,
} from '../src/engine/moveVfxProfiles.ts';

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

  it('assigns a distinct non-elemental style to every known move', () => {
    const styles = new Set<string>();
    for (const move of Object.values(MOVES)) {
      const style = getMoveVfxStyle(
        move.id,
        move.category,
        move.effect.kind,
        move.effect.target
      );
      expect(style, `move ${move.id}`).not.toBe('elemental');
      styles.add(style);
    }
    expect(styles.size).toBeGreaterThanOrEqual(15);
  });

  it('spawns signature VFX compositions for different moves of the same type and category', () => {
    const spawnCount = (moveId: string): number => {
      const scene = new THREE.Scene();
      const vfx = new AbilityVfxSystem(scene);
      const move = MOVES[moveId];
      const from = new THREE.Vector3(-2.15, 1.5, 2.0);
      const to = new THREE.Vector3(2.25, 2.0, -2.35);

      vfx.playMove(move.type, from, to, move.category, {
        power: move.power,
        fromGroundY: 0.28,
        toGroundY: 0.62,
        fromScale: 2.59,
        toScale: 3.1,
        moveId: move.id,
        effectKind: move.effect.kind,
        effectTarget: move.effect.target,
      });

      const count = vfx.getActiveCount();
      vfx.dispose();
      return count;
    };

    const impactCount = spawnCount('placaje');
    const pierceCount = spawnCount('golpe_rapido');
    const barrageCount = spawnCount('doble_bofeton');

    expect(impactCount).toBeGreaterThan(0);
    expect(barrageCount).toBeGreaterThan(impactCount);
    expect(pierceCount).not.toBe(impactCount);
  });

  it('scales screen-impact profiles with power and keeps defensive moves restrained', () => {
    const light = getMoveImpactProfile('impact', 45, 'physical');
    const heavy = getMoveImpactProfile('nova', 120, 'special');
    const buff = getMoveImpactProfile('buff', 0, 'status');
    const heal = getMoveImpactProfile('heal', 0, 'status');

    expect(heavy.shake).toBeGreaterThan(light.shake);
    expect(heavy.distortion).toBeGreaterThan(light.distortion);
    expect(heavy.bloom).toBeGreaterThan(light.bloom);
    expect(heavy.flash).toBeGreaterThan(light.flash);
    expect(buff.shake).toBe(0);
    expect(buff.hitStop).toBe(0);
    expect(heal.shake).toBe(0);

    const styles: MoveVfxStyle[] = [
      'impact',
      'slash',
      'pierce',
      'bite',
      'barrage',
      'projectile',
      'beam',
      'meteor',
      'quake',
      'cyclone',
      'nova',
      'lightning',
      'void',
      'haze',
      'drain',
      'heal',
      'shield',
      'buff',
      'debuff',
      'sonic',
      'weather',
      'elemental',
    ];
    for (const style of styles) {
      const p = getMoveImpactProfile(style, 90, 'special');
      for (const value of [
        p.shake,
        p.hitStop,
        p.flash,
        p.distortion,
        p.speedLines,
        p.bloom,
        p.dim,
      ]) {
        expect(Number.isFinite(value), `style ${style}`).toBe(true);
        expect(value, `style ${style}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('plays and cleans up every move-defined VFX style', () => {
    const scene = new THREE.Scene();
    const vfx = new AbilityVfxSystem(scene);
    const from = new THREE.Vector3(-2.15, 1.5, 2.0);
    const to = new THREE.Vector3(2.25, 2.0, -2.35);

    for (const move of Object.values(MOVES)) {
      vfx.playMove(move.type, from, to, move.category, {
        power: move.power,
        fromGroundY: 0.28,
        toGroundY: 0.62,
        fromScale: 2.59,
        toScale: 3.1,
        moveId: move.id,
        effectKind: move.effect.kind,
        effectTarget: move.effect.target,
      });
      expect(vfx.getActiveCount(), `move ${move.id}`).toBeGreaterThan(0);
      for (let i = 0; i < 240; i++) vfx.update(0.05);
      expect(vfx.getActiveCount(), `cleanup ${move.id}`).toBe(0);
    }

    vfx.dispose();
  });
});

