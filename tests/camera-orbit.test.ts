import { describe, expect, it } from 'vitest';
import {
  beginCameraTouch,
  createCameraTouchGestureState,
  endCameraTouch,
  FIXED_SWIPE_FIRST_PX,
  FIXED_SWIPE_REPEAT_PX,
  FREE_ORBIT_RAD_PER_PX,
  moveCameraTouch,
  normalizeYawStep,
  QUARTER_TURN_RAD,
  setCameraTouchGestureMode,
  snapYawToNearestStep,
} from '../src/domain/CameraOrbit.ts';
import { CameraRig } from '../src/engine/CameraRig.ts';

describe('CameraOrbit & CameraRig horizontal orbital modes', () => {
  it('normalizes arbitrary yaw radians to nearest cardinal yawStep (0..3)', () => {
    expect(normalizeYawStep(0)).toBe(0);
    expect(normalizeYawStep(0.3)).toBe(0);
    expect(normalizeYawStep(QUARTER_TURN_RAD)).toBe(1);
    expect(normalizeYawStep(QUARTER_TURN_RAD + 0.4)).toBe(1);
    expect(normalizeYawStep(Math.PI)).toBe(2);
    expect(normalizeYawStep(-QUARTER_TURN_RAD)).toBe(3);
    expect(normalizeYawStep(Math.PI * 2)).toBe(0);
  });

  it('snaps to nearest 90-degree angle without multi-turn wraparound when switching back to fixed mode', () => {
    const rig = new CameraRig(16 / 9);
    rig.setCameraMode('free_orbit');
    rig.orbitYaw(2.2); // ~126 deg -> nearest is 90 deg (step 1)
    expect(rig.getYawStep()).toBe(1);

    rig.setCameraMode('fixed');
    expect(rig.getYawStep()).toBe(1);
    expect(rig.getTargetYaw()).toBeCloseTo(QUARTER_TURN_RAD);

    // Negative multi-turn snap
    rig.setCameraMode('free_orbit');
    rig.orbitYaw(-Math.PI - 0.1);
    const snap = snapYawToNearestStep(rig.getTargetYaw());
    rig.setCameraMode('fixed');
    expect(rig.getYawStep()).toBe(snap.yawStep);
    expect(rig.getTargetYaw()).toBeCloseTo(snap.targetYaw);
  });

  it('keeps camera vertical height and pitch fixed during free horizontal orbital rotation', () => {
    const rig = new CameraRig(16 / 9);
    rig.setPreset('overworld');
    rig.setCameraMode('free_orbit');
    rig.snapTo(10, 0.5, 10);
    const initialY = rig.camera.position.y;

    for (const delta of [0.4, 0.8, 1.3, -2.1, 3.0]) {
      rig.orbitYaw(delta);
      rig.follow(10, 0.5, 10, 0.1);
      // Y height stays strictly anchored at focusY + 2.65; only X/Z orbit horizontally
      expect(rig.camera.position.y).toBeCloseTo(initialY, 4);
      const dx = rig.camera.position.x - 10;
      const dz = rig.camera.position.z - 10;
      expect(Math.hypot(dx, dz)).toBeCloseTo(6.4, 2);
    }
  });

  it('rotates 90-degree steps via horizontal touch swipe in fixed mode (replaces L/R HUD buttons)', () => {
    const gesture = createCameraTouchGestureState('fixed');
    expect(beginCameraTouch(gesture, 1, 200)).toBe(true);

    // Small jitter below threshold does not rotate
    expect(moveCameraTouch(gesture, 1, 220)).toEqual({ stepDelta: 0, orbitDeltaRad: 0 });
    // Crossing first threshold triggers 1 step
    expect(moveCameraTouch(gesture, 1, 200 + FIXED_SWIPE_FIRST_PX + 5)).toEqual({
      stepDelta: 1,
      orbitDeltaRad: 0,
    });
    // Modest continuation does not overshoot 180 deg
    expect(moveCameraTouch(gesture, 1, 200 + FIXED_SWIPE_FIRST_PX + 40)).toEqual({
      stepDelta: 0,
      orbitDeltaRad: 0,
    });
    // Deliberate long continuous drag crosses repeat threshold for second 90-deg turn
    expect(
      moveCameraTouch(gesture, 1, 200 + FIXED_SWIPE_FIRST_PX + 5 + FIXED_SWIPE_REPEAT_PX + 2)
    ).toEqual({
      stepDelta: 1,
      orbitDeltaRad: 0,
    });

    // Reversing direction triggers immediately after first-step threshold
    expect(
      moveCameraTouch(
        gesture,
        1,
        200 + FIXED_SWIPE_FIRST_PX + 5 + FIXED_SWIPE_REPEAT_PX + 2 - FIXED_SWIPE_FIRST_PX - 2
      )
    ).toEqual({
      stepDelta: -1,
      orbitDeltaRad: 0,
    });

    // Ignores secondary pointer while primary drag is active
    expect(beginCameraTouch(gesture, 2, 100)).toBe(false);
    expect(moveCameraTouch(gesture, 2, 300)).toEqual({ stepDelta: 0, orbitDeltaRad: 0 });

    expect(endCameraTouch(gesture, 1)).toBe(true);
    expect(beginCameraTouch(gesture, 2, 100)).toBe(true);
  });

  it('emits smooth horizontal yaw deltas in free_orbit mode without vertical tilt', () => {
    const gesture = createCameraTouchGestureState('free_orbit');
    beginCameraTouch(gesture, 5, 100);

    // Within 3px tap deadzone -> no jitter
    expect(moveCameraTouch(gesture, 5, 102)).toEqual({ stepDelta: 0, orbitDeltaRad: 0 });

    // Crosses deadzone -> smooth continuous radians proportional to horizontal dx
    const res = moveCameraTouch(gesture, 5, 150);
    expect(res.stepDelta).toBe(0);
    expect(res.orbitDeltaRad).toBeCloseTo(50 * FREE_ORBIT_RAD_PER_PX);

    // Subsequent horizontal moves apply 1:1 immediately
    const resLeft = moveCameraTouch(gesture, 5, 130);
    expect(resLeft.stepDelta).toBe(0);
    expect(resLeft.orbitDeltaRad).toBeCloseTo(-20 * FREE_ORBIT_RAD_PER_PX);

    setCameraTouchGestureMode(gesture, 'fixed');
    endCameraTouch(gesture, 5);
  });
});
