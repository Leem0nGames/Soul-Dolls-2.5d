/**
 * Fixed 120Hz semi-implicit Euler spring-mass solver with soft displacement saturation
 * and 2D area-preserving volume constraint (zero allocations during simulation updates).
 */

export const SOFT_BODY_FIXED_HZ = 120;
export const SOFT_BODY_FIXED_DT = 1 / SOFT_BODY_FIXED_HZ;
const MAX_SUBSTEPS_PER_CALL = 16;

export interface SoftBodyProfile {
  /** Normalized spring stiffness [0.1..1.0], maps to natural angular frequency */
  stiffness: number;
  /** Normalized damping ratio [0.05..1.0], < 1 produces underdamped elastic bounce */
  damping: number;
  /** 2D cross-sectional area preservation [0..1] (squash & stretch) */
  volumePreservation: number;
  /** Soft upper limit for lateral displacement in normalized sprite coords */
  maxDisplacementX?: number;
  /** Soft upper limit for vertical displacement in normalized sprite coords */
  maxDisplacementY?: number;
  /** Hard clamp for linear velocity */
  maxVelocity?: number;
}

export const DEFAULT_BUST_JIGGLE_PROFILE: SoftBodyProfile = {
  stiffness: 0.8,
  damping: 0.24,
  volumePreservation: 0.9,
  maxDisplacementX: 0.018,
  maxDisplacementY: 0.03,
  maxVelocity: 1.6,
};

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Smooth hyperbolic saturation that prevents harsh clamping artifacts or mesh tearing
 * while preserving linear response around the equilibrium rest pose.
 */
function softLimit(value: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.tanh(value / limit) * limit;
}

/**
 * Computes area-preserving horizontal scale delta (Sx - 1) such that Sx * Sy ≈ 1.
 * When vertical displacement compresses downward (dispY < 0), width expands smoothly;
 * when rebounding upward (dispY > 0), width narrows proportionally.
 */
export function computeVolumePreservationScaleDelta(
  dispY: number,
  preservation: number
): number {
  if (preservation <= 0) return 0;
  const sy = clamp(1 + dispY * 3.5, 0.85, 1.18);
  const sx = 1 / sy;
  return (sx - 1) * clamp(preservation, 0, 1);
}

export class SoftBodySpring120Hz {
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  volumeScaleX = 0;

  private accumulator = 0;
  private omega = 24;
  private k = 576;
  private c = 11.5;
  private volumePreservation = 0.9;
  private maxDispX = 0.018;
  private maxDispY = 0.03;
  private maxVel = 1.6;

  constructor(profile: SoftBodyProfile = DEFAULT_BUST_JIGGLE_PROFILE) {
    this.setProfile(profile);
  }

  setProfile(profile: SoftBodyProfile): void {
    const stiffNorm = clamp(profile.stiffness, 0.1, 1.2);
    const dampNorm = clamp(profile.damping, 0.05, 1.0);
    // Map normalized [0.1..1.0] stiffness to ~[10..27] rad/s natural frequency
    this.omega = 8 + stiffNorm * 20;
    this.k = this.omega * this.omega;
    // Underdamped ratio zeta in [0.10..0.72] for lively yet cleanly settling rebound
    const zeta = 0.08 + dampNorm * 0.64;
    this.c = 2 * zeta * this.omega;
    this.volumePreservation = clamp(profile.volumePreservation, 0, 1);
    this.maxDispX = Math.max(0.002, profile.maxDisplacementX ?? 0.018);
    this.maxDispY = Math.max(0.002, profile.maxDisplacementY ?? 0.03);
    this.maxVel = Math.max(0.1, profile.maxVelocity ?? 1.6);
  }

  reset(): void {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.volumeScaleX = 0;
    this.accumulator = 0;
  }

  injectImpulse(dvx: number, dvy: number): void {
    this.vx = clamp(this.vx + dvx, -this.maxVel, this.maxVel);
    this.vy = clamp(this.vy + dvy, -this.maxVel, this.maxVel);
  }

  /**
   * Advances simulation on a fixed 120Hz timestep with zero heap allocations.
   * externalForceX/Y represent inertial pseudo-forces (-m * torsoAcceleration).
   */
  update(dt: number, externalForceX = 0, externalForceY = 0): void {
    if (dt <= 0) return;
    // Cap accumulator so tab pauses never cause a spiral of death
    this.accumulator = Math.min(
      this.accumulator + dt,
      SOFT_BODY_FIXED_DT * MAX_SUBSTEPS_PER_CALL
    );

    let steps = 0;
    while (this.accumulator >= SOFT_BODY_FIXED_DT && steps < MAX_SUBSTEPS_PER_CALL) {
      this.stepFixed(SOFT_BODY_FIXED_DT, externalForceX, externalForceY);
      this.accumulator -= SOFT_BODY_FIXED_DT;
      steps += 1;
    }

    this.volumeScaleX = computeVolumePreservationScaleDelta(
      this.y,
      this.volumePreservation
    );
  }

  private stepFixed(dt: number, fx: number, fy: number): void {
    // Semi-implicit (Symplectic) Euler: m * x'' + c * x' + k * (x - x0) = F (with m = 1, x0 = 0)
    const ax = fx - this.k * this.x - this.c * this.vx;
    const ay = fy - this.k * this.y - this.c * this.vy;

    this.vx = clamp(this.vx + ax * dt, -this.maxVel, this.maxVel);
    this.vy = clamp(this.vy + ay * dt, -this.maxVel, this.maxVel);

    this.x = softLimit(this.x + this.vx * dt, this.maxDispX);
    this.y = softLimit(this.y + this.vy * dt, this.maxDispY);
  }
}
