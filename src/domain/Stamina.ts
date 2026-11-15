export const MAX_STAMINA = 100;
export const WALK_SPEED = 4.4;
export const RUN_SPEED = 7.4;
export const STAMINA_DRAIN_PER_SEC = 28;
export const STAMINA_RECOVER_WALK_PER_SEC = 18;
export const STAMINA_RECOVER_IDLE_PER_SEC = 24;
export const STAMINA_EXHAUST_RECOVER_THRESHOLD = 25;

export interface StaminaState {
  current: number;
  max: number;
  exhausted: boolean;
}

export interface StaminaStepInput {
  dt: number;
  moving: boolean;
  sprintHeld: boolean;
}

export interface StaminaStepResult {
  sprinting: boolean;
  speed: number;
  ratio: number;
}

export function createStaminaState(max = MAX_STAMINA): StaminaState {
  return {
    current: max,
    max,
    exhausted: false,
  };
}

export function stepStamina(
  state: StaminaState,
  input: StaminaStepInput
): StaminaStepResult {
  const dt = Math.max(0, input.dt);
  const canSprint = !state.exhausted && state.current > 0;
  const sprinting = input.moving && input.sprintHeld && canSprint;

  if (sprinting) {
    state.current = Math.max(0, state.current - STAMINA_DRAIN_PER_SEC * dt);
    if (state.current <= 0) {
      state.current = 0;
      state.exhausted = true;
    }
  } else {
    const recoverRate = input.moving
      ? STAMINA_RECOVER_WALK_PER_SEC
      : STAMINA_RECOVER_IDLE_PER_SEC;
    state.current = Math.min(state.max, state.current + recoverRate * dt);
    if (state.exhausted && state.current >= STAMINA_EXHAUST_RECOVER_THRESHOLD) {
      state.exhausted = false;
    }
  }

  const activeSprint = sprinting && !state.exhausted && state.current > 0;
  const speed = Math.min(RUN_SPEED, activeSprint ? RUN_SPEED : WALK_SPEED);
  const ratio = state.max > 0 ? Math.max(0, Math.min(1, state.current / state.max)) : 0;

  return {
    sprinting: activeSprint,
    speed,
    ratio,
  };
}
