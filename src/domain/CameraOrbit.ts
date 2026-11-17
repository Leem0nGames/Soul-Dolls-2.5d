import type { CameraMode } from './types.ts';

export const QUARTER_TURN_RAD = Math.PI * 0.5;
export const FREE_ORBIT_RAD_PER_PX = 0.0075;
export const FIXED_SWIPE_FIRST_PX = 40;
export const FIXED_SWIPE_REPEAT_PX = 88;
export const FREE_ORBIT_DEADZONE_PX = 3;

export function normalizeYawStep(yawRad: number): number {
  const step = Math.round(yawRad / QUARTER_TURN_RAD);
  return ((step % 4) + 4) % 4;
}

export function snapYawToNearestStep(yawRad: number): {
  yawStep: number;
  targetYaw: number;
} {
  const unboundedStep = Math.round(yawRad / QUARTER_TURN_RAD);
  return {
    yawStep: ((unboundedStep % 4) + 4) % 4,
    targetYaw: unboundedStep * QUARTER_TURN_RAD,
  };
}

export interface CameraTouchGestureState {
  mode: CameraMode;
  activePointerId: number | null;
  lastClientX: number;
  accumDx: number;
  hasSteppedInFixedDrag: boolean;
  lastStepDir: -1 | 0 | 1;
  engagedOrbit: boolean;
}

export interface CameraTouchMoveResult {
  stepDelta: -1 | 0 | 1;
  orbitDeltaRad: number;
}

export function createCameraTouchGestureState(
  mode: CameraMode = 'fixed'
): CameraTouchGestureState {
  return {
    mode,
    activePointerId: null,
    lastClientX: 0,
    accumDx: 0,
    hasSteppedInFixedDrag: false,
    lastStepDir: 0,
    engagedOrbit: false,
  };
}

export function setCameraTouchGestureMode(
  state: CameraTouchGestureState,
  mode: CameraMode
): void {
  if (state.mode === mode) return;
  state.mode = mode;
  state.accumDx = 0;
  state.hasSteppedInFixedDrag = false;
  state.lastStepDir = 0;
  state.engagedOrbit = false;
}

export function beginCameraTouch(
  state: CameraTouchGestureState,
  pointerId: number,
  clientX: number
): boolean {
  if (state.activePointerId !== null) return false;
  state.activePointerId = pointerId;
  state.lastClientX = clientX;
  state.accumDx = 0;
  state.hasSteppedInFixedDrag = false;
  state.lastStepDir = 0;
  state.engagedOrbit = false;
  return true;
}

/**
 * Processes horizontal-only touch drag input (vertical Y is strictly ignored so
 * the camera only orbits horizontally and never tilts up or down).
 */
export function moveCameraTouch(
  state: CameraTouchGestureState,
  pointerId: number,
  clientX: number
): CameraTouchMoveResult {
  if (state.activePointerId !== pointerId) {
    return { stepDelta: 0, orbitDeltaRad: 0 };
  }

  const dx = clientX - state.lastClientX;
  state.lastClientX = clientX;
  if (!Number.isFinite(dx) || dx === 0) {
    return { stepDelta: 0, orbitDeltaRad: 0 };
  }

  state.accumDx += dx;

  if (state.mode === 'free_orbit') {
    if (!state.engagedOrbit) {
      if (Math.abs(state.accumDx) < FREE_ORBIT_DEADZONE_PX) {
        return { stepDelta: 0, orbitDeltaRad: 0 };
      }
      state.engagedOrbit = true;
    }
    const orbitDeltaRad = state.accumDx * FREE_ORBIT_RAD_PER_PX;
    state.accumDx = 0;
    return { stepDelta: 0, orbitDeltaRad };
  }

  const dir: -1 | 1 = state.accumDx > 0 ? 1 : -1;
  const threshold =
    state.hasSteppedInFixedDrag && state.lastStepDir === dir
      ? FIXED_SWIPE_REPEAT_PX
      : FIXED_SWIPE_FIRST_PX;

  if (Math.abs(state.accumDx) >= threshold) {
    state.accumDx = 0;
    state.hasSteppedInFixedDrag = true;
    state.lastStepDir = dir;
    return { stepDelta: dir, orbitDeltaRad: 0 };
  }

  return { stepDelta: 0, orbitDeltaRad: 0 };
}

export function endCameraTouch(
  state: CameraTouchGestureState,
  pointerId: number
): boolean {
  if (state.activePointerId !== pointerId) return false;
  state.activePointerId = null;
  state.accumDx = 0;
  state.hasSteppedInFixedDrag = false;
  state.lastStepDir = 0;
  state.engagedOrbit = false;
  return true;
}

export function resetCameraTouch(state: CameraTouchGestureState): void {
  state.activePointerId = null;
  state.accumDx = 0;
  state.hasSteppedInFixedDrag = false;
  state.lastStepDir = 0;
  state.engagedOrbit = false;
}
