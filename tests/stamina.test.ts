import { describe, expect, it } from 'vitest';
import {
  createStaminaState,
  MAX_STAMINA,
  RUN_SPEED,
  STAMINA_EXHAUST_RECOVER_THRESHOLD,
  stepStamina,
  WALK_SPEED,
} from '../src/domain/Stamina.ts';

describe('Overworld Stamina system', () => {
  it('drains stamina while sprinting and caps speed at RUN_SPEED', () => {
    const state = createStaminaState();
    const res = stepStamina(state, { dt: 1.0, moving: true, sprintHeld: true });

    expect(res.sprinting).toBe(true);
    expect(res.speed).toBe(RUN_SPEED);
    expect(state.current).toBeLessThan(MAX_STAMINA);
    expect(state.exhausted).toBe(false);
  });

  it('exhausts stamina when depleted and limits max speed to WALK_SPEED even if sprint is held', () => {
    const state = createStaminaState();

    // Sprint continuously for 3.6s to fully deplete stamina (28/s * 3.6s > 100)
    let lastRes = stepStamina(state, { dt: 0.1, moving: true, sprintHeld: true });
    for (let i = 0; i < 35; i++) {
      lastRes = stepStamina(state, { dt: 0.1, moving: true, sprintHeld: true });
    }

    expect(state.exhausted).toBe(true);
    expect(lastRes.sprinting).toBe(false);
    expect(lastRes.speed).toBe(WALK_SPEED);
    expect(lastRes.speed).toBeLessThan(RUN_SPEED);

    // Next step while still holding sprint remains capped at WALK_SPEED until recovery threshold
    const heldWhileExhausted = stepStamina(state, {
      dt: 0.2,
      moving: true,
      sprintHeld: true,
    });
    expect(state.exhausted).toBe(true);
    expect(heldWhileExhausted.sprinting).toBe(false);
    expect(heldWhileExhausted.speed).toBe(WALK_SPEED);
  });

  it('recovers stamina while walking and restores sprinting once above recovery threshold', () => {
    const state = createStaminaState();
    state.current = 0;
    state.exhausted = true;

    // Walk briefly -> recovers partially, still exhausted below threshold
    const earlyWalk = stepStamina(state, { dt: 0.5, moving: true, sprintHeld: false });
    expect(earlyWalk.speed).toBe(WALK_SPEED);
    expect(state.current).toBeGreaterThan(0);
    expect(state.current).toBeLessThan(STAMINA_EXHAUST_RECOVER_THRESHOLD);
    expect(state.exhausted).toBe(true);

    // Keep walking until above threshold
    const laterWalk = stepStamina(state, { dt: 1.5, moving: true, sprintHeld: false });
    expect(laterWalk.speed).toBe(WALK_SPEED);
    expect(state.current).toBeGreaterThanOrEqual(STAMINA_EXHAUST_RECOVER_THRESHOLD);
    expect(state.exhausted).toBe(false);

    // Sprinting is available again
    const resumeSprint = stepStamina(state, { dt: 0.1, moving: true, sprintHeld: true });
    expect(resumeSprint.sprinting).toBe(true);
    expect(resumeSprint.speed).toBe(RUN_SPEED);
  });

  it('does not drain stamina when standing still even if sprint is held', () => {
    const state = createStaminaState();
    state.current = 50;

    const idle = stepStamina(state, { dt: 1.0, moving: false, sprintHeld: true });
    expect(idle.sprinting).toBe(false);
    expect(state.current).toBeGreaterThan(50);
  });
});
