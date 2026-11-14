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

  isHitStopped(): boolean {
    return this.script.isHitStopped();
  }

  getTimeScale(): number {
    return this.pose.timeScale;
  }

  update(dt: number): void {
    this.script.step(dt, this.pose);
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
    const portraitT =
      this.script.getCurrentShot() === 'victory_orbit' ? 0 : this.getPortraitBlend();
    const px = this.pose.pos.x - 1.1 * portraitT;
    const py = this.pose.pos.y - 0.27 * portraitT;
    const pz = this.pose.pos.z + 0.55 * portraitT;
    const lx = this.pose.lookAt.x - 0.52 * portraitT;
    const ly = this.pose.lookAt.y - 0.32 * portraitT;
    const lz = this.pose.lookAt.z + 0.1 * portraitT;

    this.camera.position.set(px, py, pz);
    const targetFov = this.getAdaptiveFov(this.pose.fov);
    if (Math.abs(this.camera.fov - targetFov) > 0.02) {
      this.camera.fov = targetFov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(lx, ly, lz);
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
