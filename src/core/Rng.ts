export interface Rng {
  next(): number;
  int(min: number, max: number): number;
  chance(percent: number): boolean;
  pick<T>(items: readonly T[]): T;
  getState(): number;
}

/** Deterministic mulberry32 PRNG */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  if (state === 0) state = 0x6d2b79f5;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min: number, max: number): number {
      const lo = Math.ceil(min);
      const hi = Math.floor(max);
      return lo + Math.floor(next() * (hi - lo + 1));
    },
    chance(percent: number): boolean {
      return next() * 100 < percent;
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.floor(next() * items.length)];
    },
    getState(): number {
      return state >>> 0;
    },
  };
}
