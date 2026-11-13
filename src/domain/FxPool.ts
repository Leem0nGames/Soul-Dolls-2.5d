export const MAX_FX_PARTICLES = 400;

export type FxQualityTier = 'high' | 'medium' | 'low';

export interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax: number;
  ay: number;
  az: number;
  age: number;
  life: number;
  sizeStart: number;
  sizeEnd: number;
  r: number;
  g: number;
  b: number;
  spin: number;
  angle: number;
}

export interface ParticleSpawnOpts {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  ax?: number;
  ay?: number;
  az?: number;
  life: number;
  sizeStart: number;
  sizeEnd: number;
  r: number;
  g: number;
  b: number;
  spin?: number;
}

export class FxPool {
  readonly capacity: number;
  readonly slots: ParticleSlot[];
  private cursor = 0;
  private activeCount = 0;
  private qualityTier: FxQualityTier = 'high';

  constructor(capacity = MAX_FX_PARTICLES) {
    this.capacity = Math.max(1, Math.min(MAX_FX_PARTICLES, Math.floor(capacity)));
    this.slots = Array.from({ length: this.capacity }, () => ({
      active: false,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      ax: 0,
      ay: 0,
      az: 0,
      age: 0,
      life: 1,
      sizeStart: 0.1,
      sizeEnd: 0,
      r: 1,
      g: 1,
      b: 1,
      spin: 0,
      angle: 0,
    }));
  }

  setQualityTier(tier: FxQualityTier): void {
    this.qualityTier = tier;
  }

  getQualityTier(): FxQualityTier {
    return this.qualityTier;
  }

  scaleCount(requestedCount: number): number {
    if (requestedCount <= 0) return 0;
    const factor =
      this.qualityTier === 'high' ? 1 : this.qualityTier === 'medium' ? 0.5 : 0.35;
    return Math.min(this.capacity, Math.max(1, Math.round(requestedCount * factor)));
  }

  getActiveCount(): number {
    return this.activeCount;
  }

  spawn(opts: ParticleSpawnOpts): boolean {
    let idx = -1;
    for (let i = 0; i < this.capacity; i++) {
      const probe = (this.cursor + i) % this.capacity;
      if (!this.slots[probe].active) {
        idx = probe;
        break;
      }
    }
    if (idx === -1) {
      // Recycle oldest cursor slot cleanly so capacity is never exceeded
      idx = this.cursor;
    } else {
      this.activeCount += 1;
    }

    const s = this.slots[idx];
    s.active = true;
    s.x = opts.x;
    s.y = opts.y;
    s.z = opts.z;
    s.vx = opts.vx;
    s.vy = opts.vy;
    s.vz = opts.vz;
    s.ax = opts.ax ?? 0;
    s.ay = opts.ay ?? 0;
    s.az = opts.az ?? 0;
    s.age = 0;
    s.life = Math.max(0.05, opts.life);
    s.sizeStart = opts.sizeStart;
    s.sizeEnd = opts.sizeEnd;
    s.r = opts.r;
    s.g = opts.g;
    s.b = opts.b;
    s.spin = opts.spin ?? 0;
    s.angle = 0;

    this.cursor = (idx + 1) % this.capacity;
    return true;
  }

  update(dt: number): void {
    if (dt <= 0) return;
    let alive = 0;
    for (let i = 0; i < this.capacity; i++) {
      const s = this.slots[i];
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.life) {
        s.active = false;
        continue;
      }
      s.vx += s.ax * dt;
      s.vy += s.ay * dt;
      s.vz += s.az * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.z += s.vz * dt;
      s.angle += s.spin * dt;
      alive += 1;
    }
    this.activeCount = alive;
  }

  clear(): void {
    for (let i = 0; i < this.capacity; i++) {
      this.slots[i].active = false;
    }
    this.activeCount = 0;
    this.cursor = 0;
  }
}
