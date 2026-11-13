export interface ActiveTween {
  active: boolean;
  elapsed: number;
  duration: number;
  onUpdate: ((t: number) => void) | null;
  onDone: (() => void) | null;
}

export class TweenRunner {
  private pool: ActiveTween[] = Array.from({ length: 16 }, () => ({
    active: false,
    elapsed: 0,
    duration: 1,
    onUpdate: null,
    onDone: null,
  }));

  start(durationSec: number, onUpdate: (t: number) => void, onDone?: () => void): void {
    const slot = this.pool.find((s) => !s.active) ?? this.pool[0];
    slot.active = true;
    slot.elapsed = 0;
    slot.duration = Math.max(0.01, durationSec);
    slot.onUpdate = onUpdate;
    slot.onDone = onDone ?? null;
    onUpdate(0);
  }

  update(dt: number): void {
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.elapsed += dt;
      const t = Math.min(1, slot.elapsed / slot.duration);
      slot.onUpdate?.(t);
      if (t >= 1) {
        slot.active = false;
        const done = slot.onDone;
        slot.onUpdate = null;
        slot.onDone = null;
        done?.();
      }
    }
  }

  clear(): void {
    for (const slot of this.pool) {
      slot.active = false;
      slot.onUpdate = null;
      slot.onDone = null;
    }
  }
}
