import * as THREE from 'three';
import type { BattleSpriteMaterialHandle } from './BattleSpriteMat.ts';
import {
  DEFAULT_BUST_JIGGLE_PROFILE,
  SoftBodySpring120Hz,
  type SoftBodyProfile,
} from './SoftBodySpring120Hz.ts';

export const DEFAULT_BREATH_CYCLE_DURATION = 3.5;
export const MAX_THORAX_EXPANSION_RATIO = 0.055; // 5.5% unified ribcage expansion (linear around torso spine)
export const MAX_THORAX_ROTATION_DEG = 3.2; // 3.2 degrees expressive 3D thoracic pitch
export const SECONDARY_BREATH_PHASE_OFFSET = 0.06; // 6% cycle (~0.21s) follow-through lag for secondary silhouette elements

const _localXAxis = new THREE.Vector3(1, 0, 0);
const _breathQuat = new THREE.Quaternion();

export interface SoulDollRigAnchor {
  /** Normalized horizontal center of torso/spine in unflipped [0..1] image coords */
  torsoX: number;
  /** Normalized vertical chest center within character height [0..1] (0 = feet, 1 = head top) */
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
  breathingEnabled?: boolean;
  softBodyProfile?: SoftBodyProfile;
}

export interface BreathSample {
  value: number;
  velocity: number;
}

/**
 * Smooth C1/C2 periodic breathing waveform bounded strictly in [0, 1].
 * Phase 0 returns exact neutral pose (0), crests smoothly at 1, and returns cleanly to 0.
 */
export function computeBreathWave(phase: number): BreathSample {
  const p = ((phase % 1) + 1) % 1;

  let u = 0;
  let du_dp = 0;

  if (p < 0.42) {
    const t = p / 0.42;
    const s = Math.sin(t * Math.PI * 0.5);
    u = s * s;
    du_dp = (2.0 * s * Math.cos(t * Math.PI * 0.5) * (Math.PI * 0.5)) / 0.42;
  } else if (p < 0.52) {
    u = 1.0;
    du_dp = 0;
  } else if (p < 0.94) {
    const t = (p - 0.52) / 0.42;
    u = 0.5 + 0.5 * Math.cos(t * Math.PI);
    du_dp = (-0.5 * Math.PI * Math.sin(t * Math.PI)) / 0.42;
  } else {
    u = 0;
    du_dp = 0;
  }

  return { value: u, velocity: du_dp };
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Single-controller torso-driven idle breathing rig for 2.5D SoulDoll sprites.
 * - Uses one normalized `breathWeight` in [0, 1] driving unified thoracic expansion and quaternion rotation.
 * - Zero independent bust lobe scaling, zero bust inflation, and zero cumulative frame transforms.
 */
export class SoulDollIdleRig {
  private view: 'front' | 'back';
  private flipX: boolean;
  private cycleDuration: number;
  private phase: number;
  private sensitivity: number;
  private breathingEnabled: boolean;
  private anchor: SoulDollRigAnchor = { ...DEFAULT_SOULDOLL_ANCHOR };

  private breathWeight = 0;
  private secondaryWeight = 0;
  private prevBreathVel = 0;
  private time = 0;

  // Fixed 120Hz soft-body spring-mass solver for cohesive chest jiggle & volume preservation
  private readonly bustSpring: SoftBodySpring120Hz;

  // Transient whole-torso landing/hit recoil (returns cleanly to 0)
  private recoilX = 0;
  private recoilVelX = 0;
  private recoilY = 0;
  private recoilVelY = 0;

  constructor(options: SoulDollIdleRigOptions) {
    this.view = options.view;
    this.flipX = options.flipX ?? false;
    this.cycleDuration = Math.max(1.8, options.cycleDuration ?? DEFAULT_BREATH_CYCLE_DURATION);
    this.phase = ((options.initialPhase ?? 0) % 1 + 1) % 1;
    this.sensitivity = options.sensitivity ?? 1.0;
    this.breathingEnabled = options.breathingEnabled ?? true;
    this.bustSpring = new SoftBodySpring120Hz(
      options.softBodyProfile ?? DEFAULT_BUST_JIGGLE_PROFILE
    );

    this.syncBreathWeights();
    this.prevBreathVel = this.breathingEnabled
      ? computeBreathWave(this.phase).velocity / this.cycleDuration
      : 0;
  }

  private syncBreathWeights(): void {
    if (!this.breathingEnabled) {
      this.breathWeight = 0;
      this.secondaryWeight = 0;
      return;
    }
    this.breathWeight = computeBreathWave(this.phase).value;
    this.secondaryWeight = computeBreathWave(
      this.phase - SECONDARY_BREATH_PHASE_OFFSET
    ).value;
  }

  setView(view: 'front' | 'back', flipX = this.flipX): void {
    this.view = view;
    this.flipX = flipX;
  }

  setSoftBodyProfile(profile: SoftBodyProfile): void {
    this.bustSpring.setProfile(profile);
  }

  setBreathingEnabled(enabled: boolean): void {
    this.breathingEnabled = enabled;
    this.syncBreathWeights();
    this.prevBreathVel = enabled
      ? computeBreathWave(this.phase).velocity / this.cycleDuration
      : 0;
    if (!enabled) {
      this.bustSpring.reset();
    }
  }

  isBreathingEnabled(): boolean {
    return this.breathingEnabled;
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

  /**
   * Transient whole-torso recoil and 120Hz soft-body chest jiggle impulse
   * for taps, hops, landings, attacks, and battle impacts.
   */
  injectImpulse(impulseX: number, impulseY: number, jiggleBoost = 0): void {
    const torsoScale = this.view === 'back' ? 0.35 * this.sensitivity : this.sensitivity;
    this.recoilVelX = clamp(this.recoilVelX + impulseX * 0.08 * torsoScale, -0.35, 0.35);
    this.recoilVelY = clamp(this.recoilVelY + impulseY * 0.14 * torsoScale, -0.5, 0.5);

    const softScale = (this.view === 'back' ? 0.32 : 1.0) * this.sensitivity;
    const boost = 1 + clamp(Math.abs(jiggleBoost), 0, 0.6) * 1.4;
    const flipSign = this.flipX ? -1 : 1;
    this.bustSpring.injectImpulse(
      impulseX * flipSign * 0.45 * softScale * boost,
      impulseY * 0.95 * softScale * boost
    );
  }

  resetSprings(): void {
    this.recoilX = 0;
    this.recoilVelX = 0;
    this.recoilY = 0;
    this.recoilVelY = 0;
    this.bustSpring.reset();
  }

  update(dt: number, animateBreathing = true): void {
    if (dt <= 0) return;
    this.time += dt;

    const subSteps = Math.min(48, Math.max(1, Math.ceil(dt * 120)));
    const stepDt = dt / subSteps;

    const k = 140;
    const c = 14.0;
    const inertiaGain = (this.view === 'back' ? 0.28 : 1.0) * 1.55 * this.sensitivity;
    let breathAccelSum = 0;

    for (let i = 0; i < subSteps; i++) {
      if (!this.breathingEnabled) {
        this.breathWeight = 0;
        this.secondaryWeight = 0;
        this.prevBreathVel = 0;
      } else if (animateBreathing) {
        this.phase = (this.phase + stepDt / this.cycleDuration) % 1;
        const sample = computeBreathWave(this.phase);
        this.breathWeight = sample.value;
        this.secondaryWeight = computeBreathWave(
          this.phase - SECONDARY_BREATH_PHASE_OFFSET
        ).value;
        const curVel = sample.velocity / this.cycleDuration;
        const accel = clamp((curVel - this.prevBreathVel) / Math.max(stepDt, 1e-4), -25, 25);
        this.prevBreathVel = curVel;
        breathAccelSum += accel;
      }

      const ax = k * (0 - this.recoilX) - c * this.recoilVelX;
      this.recoilVelX += ax * stepDt;
      this.recoilX += this.recoilVelX * stepDt;

      const ay = k * (0 - this.recoilY) - c * this.recoilVelY;
      this.recoilVelY += ay * stepDt;
      this.recoilY += this.recoilVelY * stepDt;
    }

    this.recoilX = clamp(this.recoilX, -0.012, 0.012);
    this.recoilY = clamp(this.recoilY, -0.016, 0.016);

    const avgBreathAccel = this.breathingEnabled && animateBreathing
      ? breathAccelSum / subSteps
      : 0;
    // Pseudo-force -m * a_thorax feeds the 120Hz soft-body solver
    this.bustSpring.update(dt, 0, -avgBreathAccel * inertiaGain);
  }

  getCycleDuration(): number {
    return this.cycleDuration;
  }

  getBreathWeight(): number {
    return this.breathWeight;
  }

  getSecondaryWeight(): number {
    return this.secondaryWeight;
  }

  getBreathRotationDeg(): number {
    const backScale = this.view === 'back' ? 0.75 : 1.0;
    return this.breathWeight * MAX_THORAX_ROTATION_DEG * backScale;
  }

  getBreathQuaternion(target = new THREE.Quaternion()): THREE.Quaternion {
    const rad = THREE.MathUtils.degToRad(this.getBreathRotationDeg());
    return target.setFromAxisAngle(_localXAxis, -rad);
  }

  applyToMaterial(handle: BattleSpriteMaterialHandle): void {
    const screenTorsoX = this.flipX ? 1 - this.anchor.torsoX : this.anchor.torsoX;
    handle.setTime(this.time);
    handle.setIdleDeform(
      this.breathWeight,
      this.secondaryWeight,
      this.bustSpring.x,
      this.bustSpring.y,
      this.bustSpring.volumeScaleX,
      this.recoilX,
      this.recoilY,
      screenTorsoX,
      this.anchor.bustY,
      this.anchor.charHeight,
      this.flipX ? -1 : 1,
      this.view === 'back' ? 1 : 0
    );
  }

  /**
   * Composes POSE_ACTUAL = POSE_BASE * BREATH_QUAT without accumulating rotations.
   * Caller must set the mesh's base orientation (e.g. via lookAt) immediately prior.
   */
  applyToMesh(mesh: THREE.Object3D, handle: BattleSpriteMaterialHandle): void {
    this.applyToMaterial(handle);
    mesh.quaternion.multiply(this.getBreathQuaternion(_breathQuat));
  }

  getState(): {
    breathWeight: number;
    secondaryWeight: number;
    rotationDeg: number;
    jiggleX: number;
    jiggleY: number;
    jiggleVelY: number;
    volumeScaleX: number;
    recoilX: number;
    recoilY: number;
    recoilVelY: number;
  } {
    return {
      breathWeight: this.breathWeight,
      secondaryWeight: this.secondaryWeight,
      rotationDeg: this.getBreathRotationDeg(),
      jiggleX: this.bustSpring.x,
      jiggleY: this.bustSpring.y,
      jiggleVelY: this.bustSpring.vy,
      volumeScaleX: this.bustSpring.volumeScaleX,
      recoilX: this.recoilX,
      recoilY: this.recoilY,
      recoilVelY: this.recoilVelY,
    };
  }
}
