import * as THREE from 'three';
import {
  BattleCameraScript,
  DEFAULT_BATTLE_POSE,
  type BattleShotKind,
  type CameraPose,
} from '../domain/BattleCameraScript.ts';

const _camDelta = new THREE.Vector3();

export class BattleCamera {
  readonly script = new BattleCameraScript();
  private pose: CameraPose = {
    pos: { ...DEFAULT_BATTLE_POSE.pos },
    lookAt: { ...DEFAULT_BATTLE_POSE.lookAt },
    fov: DEFAULT_BATTLE_POSE.fov,
    timeScale: 1,
  };
  private kickElapsed = 0;
  private kickDuration = 0;
  private kickStrength = 0;
  private kickRoll = 0;

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  init(isBoss: boolean, playIntro: boolean): void {
    this.script.setBossIntensity(isBoss);
    if (playIntro) {
      this.script.playImmediate('intro_crane', isBoss ? 1.15 : 0.9, true);
    } else {
      this.script.playImmediate('idle', 0.1, false);
    }
    this.script.step(0, this.pose);
    this.applyPose();
  }

  skipIntro(): boolean {
    return this.script.cancelActive();
  }

  enqueueShot(kind: BattleShotKind, duration: number, cancelable = true): void {
    this.script.enqueueShot(kind, duration, cancelable);
  }

  playImmediate(kind: BattleShotKind, duration: number, cancelable = true): void {
    this.script.playImmediate(kind, duration, cancelable);
  }

  triggerShake(amplitude: number, decay = 7.5): void {
    this.script.triggerShake(amplitude, decay);
  }

  triggerHitStop(seconds: number): void {
    this.script.triggerHitStop(seconds);
  }

  triggerImpactKick(strength: number, duration = 0.24, roll = 0): void {
    this.kickElapsed = 0.0001;
    this.kickDuration = Math.max(0.06, duration);
    this.kickStrength = Math.max(0, strength);
    this.kickRoll = roll;
  }

  isHitStopped(): boolean {
    return this.script.isHitStopped();
  }

  getTimeScale(): number {
    return this.pose.timeScale;
  }

  update(dt: number): void {
    this.script.step(dt, this.pose);
    if (this.kickElapsed > 0) {
      this.kickElapsed += dt;
      if (this.kickElapsed >= this.kickDuration) {
        this.kickElapsed = 0;
        this.kickStrength = 0;
        this.kickRoll = 0;
      }
    }
    this.applyPose();
  }

  private getPortraitBlend(): number {
    const aspect = this.camera.aspect;
    if (aspect >= 1) return 0;
    return Math.min(1, Math.max(0, (1 - aspect) / 0.55));
  }

  private getAdaptiveFov(baseFov: number): number {
    const aspect = this.camera.aspect;
    if (aspect >= 1) return baseFov;
    return Math.min(
      66,
      THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(baseFov * 0.5)) *
              Math.min(1.42, 0.98 / Math.max(0.5, aspect))
          )
      )
    );
  }

  private applyPose(): void {
    const isVictoryOrbit = this.script.getCurrentShot() === 'victory_orbit';
    const rawPortrait = this.getPortraitBlend();
    const portraitT = isVictoryOrbit ? 0 : rawPortrait;

    let px = this.pose.pos.x - 1.1 * portraitT;
    let py = this.pose.pos.y - 0.27 * portraitT;
    let pz = this.pose.pos.z + 0.55 * portraitT;
    let lx = this.pose.lookAt.x - 0.52 * portraitT;
    let ly = this.pose.lookAt.y - 0.32 * portraitT;
    let lz = this.pose.lookAt.z + 0.1 * portraitT;

    if (isVictoryOrbit) {
      const fx = this.pose.lookAt.x - this.pose.pos.x;
      const fz = this.pose.lookAt.z - this.pose.pos.z;
      const len = Math.hypot(fx, fz) || 1;
      const fwdX = fx / len;
      const fwdZ = fz / len;
      // Horizontal right vector = forward x up = (-fwdZ, 0, fwdX)
      const rightX = -fwdZ;
      const rightZ = fwdX;

      if (rawPortrait > 0.05) {
        // Portrait mobile: pull back slightly & aim lower so SoulDoll stands in upper showcase above bottom result sheet
        px -= fwdX * (0.95 * rawPortrait);
        pz -= fwdZ * (0.95 * rawPortrait);
        py += 0.12 * rawPortrait;
        ly -= 0.58 * rawPortrait;
      } else {
        // Landscape/desktop: shift camera aim slightly right so SoulDoll orbits cleanly in left half beside result card
        const sideShift = 0.78;
        px += rightX * sideShift;
        pz += rightZ * sideShift;
        lx += rightX * sideShift;
        lz += rightZ * sideShift;
      }
    }

    let kickEnvelope = 0;
    if (this.kickElapsed > 0 && this.kickStrength > 0) {
      const kt = Math.min(1, this.kickElapsed / this.kickDuration);
      kickEnvelope = (1 - kt) * (1 - kt);
      const dx = lx - px;
      const dy = ly - py;
      const dz = lz - pz;
      const len = Math.hypot(dx, dy, dz) || 1;
      const push = this.kickStrength * kickEnvelope;
      px += (dx / len) * push;
      py += (dy / len) * push * 0.35;
      pz += (dz / len) * push;
    }

    this.camera.position.set(px, py, pz);
    const targetFov = this.getAdaptiveFov(this.pose.fov);
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(lx, ly, lz);
    if (kickEnvelope > 0 && this.kickRoll !== 0) {
      this.camera.rotateZ(this.kickRoll * kickEnvelope);
    }
    this.camera.updateMatrixWorld();
  }

  /**
   * Computes a world-space scale for a normalized SoulDoll sprite (256x256 bottom-aligned)
   * so that at default battle framing it occupies ~targetViewportRatio of screen height
   * consistently regardless of internal pixelation resolution, adapted cleanly for portrait.
   */
  computeNormalizedSpriteScale(
    stationPos: THREE.Vector3,
    targetViewportRatio: number
  ): number {
    const portraitT = this.getPortraitBlend();
    _camDelta.set(
      stationPos.x - (DEFAULT_BATTLE_POSE.pos.x - 1.1 * portraitT),
      stationPos.y - (DEFAULT_BATTLE_POSE.pos.y - 0.27 * portraitT),
      stationPos.z - (DEFAULT_BATTLE_POSE.pos.z + 0.55 * portraitT)
    );
    const dist = _camDelta.length();
    const fov = this.getAdaptiveFov(DEFAULT_BATTLE_POSE.fov);
    const vpHeightWorld = 2 * dist * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    const aspect = this.camera.aspect;
    const adjustedRatio =
      aspect < 1
        ? targetViewportRatio * Math.max(0.66, Math.min(1, 0.48 + aspect * 0.48))
        : targetViewportRatio;
    return adjustedRatio * vpHeightWorld;
  }

  /**
   * Computes a world-space scale for a 32x32 sprite so that at default framing
   * it occupies ~targetViewportRatio of screen height (capped cleanly in portrait),
   * snapped to an integer multiple of 32px at the current internal render resolution.
   */
  computeIntegerPixelScale(
    stationPos: THREE.Vector3,
    targetViewportRatio: number,
    internalHeight: number
  ): number {
    const portraitT = this.getPortraitBlend();
    _camDelta.set(
      stationPos.x - (DEFAULT_BATTLE_POSE.pos.x - 1.1 * portraitT),
      stationPos.y - (DEFAULT_BATTLE_POSE.pos.y - 0.27 * portraitT),
      stationPos.z - (DEFAULT_BATTLE_POSE.pos.z + 0.55 * portraitT)
    );
    const dist = _camDelta.length();
    const fov = this.getAdaptiveFov(DEFAULT_BATTLE_POSE.fov);
    const vpHeightWorld = 2 * dist * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
    const h = Math.max(144, internalHeight);
    const aspect = this.camera.aspect;
    const adjustedRatio =
      aspect < 1
        ? Math.min(targetViewportRatio, targetViewportRatio * aspect * 1.4)
        : targetViewportRatio;
    const idealPx = adjustedRatio * h;
    const snappedPx = Math.max(32, Math.round(idealPx / 32) * 32);
    return (snappedPx / h) * vpHeightWorld;
  }
}
