import { describe, expect, it } from 'vitest';
import { FxPool, MAX_FX_PARTICLES } from '../src/domain/FxPool.ts';

function sampleOpts(life = 1.0) {
  return {
    x: 0,
    y: 1,
    z: 0,
    vx: 1,
    vy: 2,
    vz: -1,
    ay: -4,
    life,
    sizeStart: 0.3,
    sizeEnd: 0.05,
    r: 1,
    g: 0.5,
    b: 0.2,
  };
}

describe('FxPool', () => {
  it('enforces capacity cap and recycles slots cleanly without exceeding MAX_FX_PARTICLES', () => {
    const pool = new FxPool(MAX_FX_PARTICLES);
    expect(pool.capacity).toBe(MAX_FX_PARTICLES);

    for (let i = 0; i < MAX_FX_PARTICLES + 120; i++) {
      expect(pool.spawn(sampleOpts(1.0))).toBe(true);
    }

    expect(pool.getActiveCount()).toBe(MAX_FX_PARTICLES);
    expect(pool.slots.length).toBe(MAX_FX_PARTICLES);
  });

  it('clamps requested capacity to MAX_FX_PARTICLES', () => {
    const pool = new FxPool(9999);
    expect(pool.capacity).toBe(MAX_FX_PARTICLES);
  });

  it('advances physics and expires particles after their lifetime', () => {
    const pool = new FxPool(16);
    pool.spawn(sampleOpts(0.5));
    expect(pool.getActiveCount()).toBe(1);

    pool.update(0.25);
    expect(pool.getActiveCount()).toBe(1);
    expect(pool.slots[0].x).toBeCloseTo(0.25);
    expect(pool.slots[0].vy).toBeCloseTo(1.0);

    pool.update(0.3);
    expect(pool.getActiveCount()).toBe(0);
    expect(pool.slots[0].active).toBe(false);
  });

  it('scales spawn counts down for medium and low quality tiers', () => {
    const pool = new FxPool(100);
    pool.setQualityTier('high');
    expect(pool.scaleCount(20)).toBe(20);

    pool.setQualityTier('medium');
    expect(pool.scaleCount(20)).toBe(10);

    pool.setQualityTier('low');
    expect(pool.scaleCount(20)).toBe(7);
    expect(pool.scaleCount(1)).toBe(1);
    expect(pool.scaleCount(0)).toBe(0);
  });
});
