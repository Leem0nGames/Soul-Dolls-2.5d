import type { BattleSpriteMaterialHandle } from './BattleSpriteMat.ts';

export interface SoulDollRigAnchor {
  /** Normalized horizontal center of torso/spine in unflipped [0..1] image coords */
  torsoX: number;
  /** Normalized vertical bust center within character height [0..1] (0 = feet, 1 = head top) */
  bustY: number;
  /** Character opaque height fraction inside the 256x256 frame */
  charHeight: number;
}

export const DEFAULT_SOULDOLL_ANCHOR: SoulDollRigAnchor = {
  torsoX: 0.5,
  bustY: 0.635,
  charHeight: 0.96,
};

export interface SoulDollIdleRigOptions {
  view: 'front' | 'back';
  flipX?: boolean;
  cycleDuration?: number;
  initialPhase?: number;
  sensitivity?: number;
}

export interface BreathSample {
  value: number;
  velocity: number;
}

/**
 * Custom ultra-smooth sinusoidal ease-in-out breathing curve with C1/C2 continuity
 * and silky-smooth inflection points at bottom trough (0) and top peak (1).
 */
export function computeBreathWave(phase: number): BreathSample {
  const p = ((phase % 1) + 1) % 1;

  // Custom smooth sinusoidal ease-in-out mapping: u in [0, 1] -> [0, 1]
  // Using sin^2 shaping for infinite zero-derivative smoothness at inflection points 0 and 1.
  let u = 0;
  let du_dp = 0;
  const cycleDur = 1.0;

  if (p < 0.42) {
    const t = p / 0.42;
    // Smoother-step sine inhale: sin^2(t * pi / 2)
    const s = Math.sin(t * Math.PI * 0.5);
    u = s * s;
    du_dp = (2.0 * s * Math.cos(t * Math.PI * 0.5) * (Math.PI * 0.5)) / 0.42;
  } else if (p < 0.52) {
    // Gentle crest hold at peak (value = 1, velocity = 0)
    u = 1.0;
    du_dp = 0;
  } else if (p < 0.94) {
    const t = (p - 0.52) / 0.42;
    // Smooth cosine exhale: 0.5 + 0.5 * cos(t * pi)
    u = 0.5 + 0.5 * Math.cos(t * Math.PI);
    du_dp = (-0.5 * Math.PI * Math.sin(t * Math.PI)) / 0.42;
  } else {
    // Calm trough pause at base pose (value = 0, velocity = 0)
    u = 0;
    du_dp = 0;
  }

  return { value: u, velocity: du_dp * cycleDur };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Grounded breathing + 2nd-order damped spring controller for SoulDoll thoracic/bust motion.
 * Computes deformation deterministically from the base pose with FPS-independent substeps.
 */
export class SoulDollIdleRig {
  private view: 'front' | 'back';
  private flipX: boolean;
  private cycleDuration: number;
  private phase: number;
  private sensitivity: number;
  private anchor: SoulDollRigAnchor = { ...DEFAULT_SOULDOLL_ANCHOR };

  private breath = 0;
  private breathVel = 0;

  // 2nd-order damped spring states (normalized sprite units)
  private bustX = 0;
  private bustVelX = 0;
  private bustY = 0;
  private bustVelY = 0;
  private bustExpand = 0;
  private bustVelExpand = 0;

  constructor(options: SoulDollIdleRigOptions) {
    this.view = options.view;
    this.flipX = options.flipX ?? false;
    this.cycleDuration = Math.max(1.8, options.cycleDuration ?? 3.35);
    this.phase = ((options.initialPhase ?? 0) % 1 + 1) % 1;
    this.sensitivity = options.sensitivity ?? 1.0;

    const initial = computeBreathWave(this.phase);
    this.breath = initial.value;
    this.breathVel = initial.velocity / this.cycleDuration;
  }

  setView(view: 'front' | 'back', flipX = this.flipX): void {
    this.view = view;
    this.flipX = flipX;
  }

  setAnchor(anchor: Partial<SoulDollRigAnchor>): void {
    if (anchor.torsoX !== undefined) {
      this.anchor.torsoX = clamp(anchor.torsoX, 0.36, 0.64);
    }
    if (anchor.bustY !== undefined) {
      this.anchor.bustY = clamp(anchor.bustY, 0.56, 0.69);
    }
    if (anchor.charHeight !== undefined) {
      this.anchor.charHeight = clamp(anchor.charHeight, 0.35, 0.99);
    }
  }

  injectImpulse(impulseX: number, impulseY: number, impulseExpand = 0): void {
    const scale = this.view === 'back' ? 0.35 * this.sensitivity : this.sensitivity;
    this.bustVelX = clamp(this.bustVelX + impulseX * 0.12 * scale, -0.4, 0.4);
    this.bustVelY = clamp(this.bustVelY + impulseY * 0.2 * scale, -0.6, 0.6);
    this.bustVelExpand = clamp(this.bustVelExpand + impulseExpand * 0.14 * scale, -0.45, 0.45);
  }

  resetSprings(): void {
    this.bustX = 0;
    this.bustVelX = 0;
    this.bustY = 0;
    this.bustVelY = 0;
    this.bustExpand = 0;
    this.bustVelExpand = 0;
  }

  update(dt: number, animateBreathing = true): void {
    if (dt <= 0) return;

    // Fine fixed-cap substeps guarantee FPS-independent deterministic integration
    const subSteps = Math.min(48, Math.max(1, Math.ceil(dt * 120)));
    const stepDt = dt / subSteps;

    const sens = this.sensitivity;
    const kY = 136;
    const cY = 12.2;
    const kX = 136;
    const cX = 14.0;
    const kExp = 136;
    const cExp = 14.0;

    for (let i = 0; i < subSteps; i++) {
      if (animateBreathing) {
        this.phase = (this.phase + stepDt / this.cycleDuration) % 1;
        const sample = computeBreathWave(this.phase);
        this.breath = sample.value;
        this.breathVel = sample.velocity / this.cycleDuration;
      }

      // Subtle, synchronized thoracic rise & balanced volume settle (returns cleanly to 0)
      const targetY = (this.breath * 0.0042 - this.breathVel * 0.0014) * sens;
      const targetX = 0;
      const targetExpand = (this.breath * 0.0075 - this.breathVel * 0.0012) * sens;

      const ay = kY * (targetY - this.bustY) - cY * this.bustVelY;
      this.bustVelY += ay * stepDt;
      this.bustY += this.bustVelY * stepDt;

      const ax = kX * (targetX - this.bustX) - cX * this.bustVelX;
      this.bustVelX += ax * stepDt;
      this.bustX += this.bustVelX * stepDt;

      const aExp = kExp * (targetExpand - this.bustExpand) - cExp * this.bustVelExpand;
      this.bustVelExpand += aExp * stepDt;
      this.bustExpand += this.bustVelExpand * stepDt;
    }

    this.bustY = clamp(this.bustY, -0.02, 0.02);
    this.bustX = clamp(this.bustX, -0.012, 0.012);
    this.bustExpand = clamp(this.bustExpand, -0.018, 0.026);
  }

  applyToMaterial(handle: BattleSpriteMaterialHandle): void {
    const screenTorsoX = this.flipX ? 1 - this.anchor.torsoX : this.anchor.torsoX;
    handle.setIdleDeform(
      this.breath,
      this.bustX,
      this.bustY,
      this.bustExpand,
      screenTorsoX,
      this.anchor.bustY,
      this.anchor.charHeight,
      this.flipX ? -1 : 1,
      this.view === 'back' ? 1 : 0
    );
  }

  getState(): {
    breath: number;
    bustX: number;
    bustY: number;
    bustExpand: number;
    bustVelY: number;
  } {
    return {
      breath: this.breath,
      bustX: this.bustX,
      bustY: this.bustY,
      bustExpand: this.bustExpand,
      bustVelY: this.bustVelY,
    };
  }
}
