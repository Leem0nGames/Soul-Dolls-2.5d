import { describe, expect, it } from 'vitest';
import {
  BattleCameraScript,
  DEFAULT_BATTLE_POSE,
  type CameraPose,
} from '../src/domain/BattleCameraScript.ts';

function cloneDefaultPose(): CameraPose {
  return {
    pos: { ...DEFAULT_BATTLE_POSE.pos },
    lookAt: { ...DEFAULT_BATTLE_POSE.lookAt },
    fov: DEFAULT_BATTLE_POSE.fov,
    timeScale: 1,
  };
}

describe('BattleCameraScript', () => {
  it('transitions from intro_crane back to idle once its duration elapses', () => {
    const script = new BattleCameraScript();
    const pose = cloneDefaultPose();

    script.playImmediate('intro_crane', 0.8, true);
    expect(script.getCurrentShot()).toBe('intro_crane');

    script.step(0.4, pose);
    expect(script.getCurrentShot()).toBe('intro_crane');
    expect(pose.pos.y).toBeGreaterThan(DEFAULT_BATTLE_POSE.pos.y);

    script.step(0.45, pose);
    expect(script.getCurrentShot()).toBe('idle');
    expect(pose.pos.y).toBeCloseTo(DEFAULT_BATTLE_POSE.pos.y, 1);
  });

  it('allows tap-cancel on cancelable shots and advances to queued shots or idle', () => {
    const script = new BattleCameraScript();
    script.playImmediate('intro_crane', 1.0, true);
    script.enqueueShot('attack_player', 0.4, true);
    expect(script.getQueueLength()).toBe(1);

    expect(script.cancelActive()).toBe(true);
    expect(script.getCurrentShot()).toBe('attack_player');
    expect(script.getQueueLength()).toBe(0);

    expect(script.cancelActive()).toBe(true);
    expect(script.getCurrentShot()).toBe('idle');

    // Non-cancelable shot refuses cancelActive
    script.playImmediate('ko_slowmo', 0.7, false);
    expect(script.cancelActive()).toBe(false);
    expect(script.getCurrentShot()).toBe('ko_slowmo');
  });

  it('applies slow-motion during ko_slowmo, tracks hitStop, and persists victory_orbit', () => {
    const script = new BattleCameraScript();
    const pose = cloneDefaultPose();

    script.triggerHitStop(0.06);
    expect(script.isHitStopped()).toBe(true);
    script.step(0.04, pose);
    expect(script.isHitStopped()).toBe(true);
    script.step(0.03, pose);
    expect(script.isHitStopped()).toBe(false);

    script.playImmediate('ko_slowmo', 0.6, false);
    script.step(0.2, pose);
    expect(pose.timeScale).toBeLessThan(0.5);

    script.playImmediate('victory_orbit', 1.0, true);
    script.step(0.1, pose);
    expect(script.getCurrentShot()).toBe('victory_orbit');
    // At t = 0.1s the camera begins blending smoothly from DEFAULT_BATTLE_POSE toward player station (-2.15, 1.08, 2.0)
    expect(pose.lookAt.x).toBeLessThan(DEFAULT_BATTLE_POSE.lookAt.x);
    expect(pose.lookAt.x).toBeGreaterThan(-2.15);

    script.step(2.4, pose);
    expect(script.getCurrentShot()).toBe('victory_orbit');
    expect(pose.lookAt.x).toBeCloseTo(-2.15, 2);
    expect(pose.lookAt.z).toBeCloseTo(2.0, 2);
    expect(pose.timeScale).toBe(1);
  });
});
