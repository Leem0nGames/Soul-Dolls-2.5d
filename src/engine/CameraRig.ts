import * as THREE from 'three';
import {
  normalizeYawStep,
  QUARTER_TURN_RAD,
  snapYawToNearestStep,
} from '../domain/CameraOrbit.ts';
import type { CameraMode } from '../domain/types.ts';

const _target = new THREE.Vector3();

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private focusX = 0;
  private focusY = 0;
  private focusZ = 0;

  private yawStep = 0; // 0..3 => 0, 90, 180, 270 deg
  private currentYaw = 0;
  private targetYaw = 0;
  private mode: 'overworld' | 'battle' = 'overworld';
  private cameraMode: CameraMode = 'fixed';

  private baseFov = 58;
  private cameraLabEnabled = false;
  private targetDistance = 6.4;
  private currentDistance = 6.4;
  private targetHeight = 2.65;
  private currentHeight = 2.65;
  private cameraLabFov = 58;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.3, 56);
    this.snapTo(0, 0, 0);
  }

  private applyAdaptiveFov(): void {
    const aspect = this.camera.aspect;
    const fov =
      aspect < 1
        ? Math.min(
            78,
            THREE.MathUtils.radToDeg(
              2 *
                Math.atan(
                  Math.tan(THREE.MathUtils.degToRad(this.baseFov * 0.5)) *
                    Math.min(1.65, 1.02 / Math.max(0.5, aspect))
                )
            )
          )
        : this.baseFov;
    if (Math.abs(this.camera.fov - fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  setAspect(aspect: number): void {
    if (Math.abs(this.camera.aspect - aspect) > 0.001) {
      this.camera.aspect = aspect;
      this.applyAdaptiveFov();
      this.camera.updateProjectionMatrix();
    }
  }

  setPreset(mode: 'overworld' | 'battle'): void {
    this.mode = mode;
    this.baseFov = mode === 'battle' ? 44 : this.cameraLabEnabled ? this.cameraLabFov : 58;
    if (mode === 'overworld') {
      this.currentDistance = this.targetDistance;
      this.currentHeight = this.targetHeight;
    }
    this.applyAdaptiveFov();
  }

  setCameraLabConfig(config: { enabled: boolean; fov: number; distance: number; height: number }): void {
    this.cameraLabEnabled = config.enabled;
    this.cameraLabFov = THREE.MathUtils.clamp(config.fov, 35, 75);
    this.targetDistance = config.enabled ? THREE.MathUtils.clamp(config.distance, 4, 14) : 6.4;
    this.targetHeight = config.enabled ? THREE.MathUtils.clamp(config.height, 1.5, 8) : 2.65;
    if (this.mode === 'overworld') {
      this.baseFov = config.enabled ? this.cameraLabFov : 58;
      this.applyAdaptiveFov();
    }
  }

  setCameraMode(mode: CameraMode): void {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    if (mode === 'fixed') {
      const snapped = snapYawToNearestStep(this.targetYaw);
      this.yawStep = snapped.yawStep;
      this.targetYaw = snapped.targetYaw;
    }
  }

  getCameraMode(): CameraMode {
    return this.cameraMode;
  }

  rotateStep(delta: -1 | 1): void {
    const baseStep = Math.round(this.targetYaw / QUARTER_TURN_RAD);
    const nextStep = baseStep + delta;
    this.yawStep = ((nextStep % 4) + 4) % 4;
    this.targetYaw = nextStep * QUARTER_TURN_RAD;
  }

  /** Horizontal-only continuous orbital rotation around the focus point (no vertical pitch). */
  orbitYaw(deltaRad: number): void {
    if (!Number.isFinite(deltaRad) || deltaRad === 0) return;
    this.targetYaw += deltaRad;
    this.yawStep = normalizeYawStep(this.targetYaw);
  }

  getYawStep(): number {
    return this.yawStep;
  }

  getCurrentYaw(): number {
    return this.currentYaw;
  }

  getTargetYaw(): number {
    return this.targetYaw;
  }

  resetYaw(): void {
    this.yawStep = 0;
    this.currentYaw = 0;
    this.targetYaw = 0;
  }

  snapTo(
    x: number,
    y: number,
    z: number,
    sampleTerrainY?: (wx: number, wz: number) => number
  ): void {
    this.focusX = x;
    this.focusY = y;
    this.focusZ = z;
    this.currentYaw = this.targetYaw;
    this.applyCameraTransform(x, y, z, sampleTerrainY);
  }

  follow(
    x: number,
    y: number,
    z: number,
    dt: number,
    sampleTerrainY?: (wx: number, wz: number) => number
  ): void {
    this.focusX = THREE.MathUtils.damp(this.focusX, x, 10, dt);
    this.focusY = THREE.MathUtils.damp(this.focusY, y, 10, dt);
    this.focusZ = THREE.MathUtils.damp(this.focusZ, z, 10, dt);
    const yawDamp = this.cameraMode === 'free_orbit' ? 16 : 12;
    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, this.targetYaw, yawDamp, dt);
    if (this.mode === 'overworld') {
      this.currentDistance = THREE.MathUtils.damp(this.currentDistance, this.targetDistance, 12, dt);
      this.currentHeight = THREE.MathUtils.damp(this.currentHeight, this.targetHeight, 12, dt);
    }
    this.applyCameraTransform(this.focusX, this.focusY, this.focusZ, sampleTerrainY);
  }

  private applyCameraTransform(
    fx: number,
    fy: number,
    fz: number,
    sampleTerrainY?: (wx: number, wz: number) => number
  ): void {
    if (this.mode === 'battle') {
      this.camera.position.set(fx, fy + 2.3, fz + 6.8);
      _target.set(fx, fy + 0.9, fz);
      this.camera.lookAt(_target);
      return;
    }

    // Low third-person camera: ~6.4 units behind, ~2.6 units above (~15-18 deg pitch)
    const dist = this.currentDistance;
    const heightOffset = this.currentHeight;
    const sinY = Math.sin(this.currentYaw);
    const cosY = Math.cos(this.currentYaw);

    const camX = fx + sinY * dist;
    const camZ = fz + cosY * dist;
    let camY = fy + heightOffset;

    if (sampleTerrainY) {
      const groundUnderCam = sampleTerrainY(camX, camZ);
      if (camY < groundUnderCam + 1.15) {
        camY = groundUnderCam + 1.15;
      }
    }

    this.camera.position.set(camX, camY, camZ);
    // Look slightly ahead/above player so hills & horizon show clearly
    _target.set(fx - sinY * 1.4, fy + 1.0, fz - cosY * 1.4);
    this.camera.lookAt(_target);
  }
}
