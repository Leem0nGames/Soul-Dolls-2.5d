import * as THREE from 'three';

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

  private baseFov = 58;

  constructor(aspect: number) {
    this.camera = new THREE.PerspectiveCamera(58, aspect, 0.3, 48);
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
    this.baseFov = mode === 'battle' ? 44 : 58;
    this.applyAdaptiveFov();
  }

  rotateStep(delta: -1 | 1): void {
    this.yawStep = ((this.yawStep + delta) % 4 + 4) % 4;
    this.targetYaw += delta * (Math.PI * 0.5);
  }

  getYawStep(): number {
    return this.yawStep;
  }

  getCurrentYaw(): number {
    return this.currentYaw;
  }

  resetYaw(): void {
    this.yawStep = 0;
    this.currentYaw = 0;
    this.targetYaw = 0;
  }

  snapTo(x: number, y: number, z: number): void {
    this.focusX = x;
    this.focusY = y;
    this.focusZ = z;
    this.currentYaw = this.targetYaw;
    this.applyCameraTransform(x, y, z);
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
    this.currentYaw = THREE.MathUtils.damp(this.currentYaw, this.targetYaw, 12, dt);
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
    const dist = 6.4;
    const heightOffset = 2.65;
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
