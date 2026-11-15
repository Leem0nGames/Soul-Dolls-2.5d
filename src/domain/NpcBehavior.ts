import type { CharacterFrame, Direction, NpcPatrolDef } from './types.ts';

export interface NpcBehaviorState {
  homeX: number;
  homeY: number;
  defaultDir: Direction;
  gridX: number;
  gridY: number;
  dir: Direction;
  moving: boolean;
  moveFromX: number;
  moveFromY: number;
  moveToX: number;
  moveToY: number;
  moveProgress: number;
  walkFrame: CharacterFrame;
  walkAnimTimer: number;
  pauseTimer: number;
  waypointIndex: number;
  lookAtPlayerTimer: number;
  wanderCursor: number;
}

export const FOLLOW_LOOK_DURATION_SEC = 12;
export const FOLLOW_LOOK_RANGE_TILES = 5;

export function createNpcBehaviorState(
  x: number,
  y: number,
  dir: Direction,
  initialPauseSec = 0.8
): NpcBehaviorState {
  return {
    homeX: x,
    homeY: y,
    defaultDir: dir,
    gridX: x,
    gridY: y,
    dir,
    moving: false,
    moveFromX: x,
    moveFromY: y,
    moveToX: x,
    moveToY: y,
    moveProgress: 0,
    walkFrame: 0,
    walkAnimTimer: 0,
    pauseTimer: initialPauseSec,
    waypointIndex: 0,
    lookAtPlayerTimer: 0,
    wanderCursor: 0,
  };
}

export function manhattanDistance(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function directionToward(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  fallback: Direction = 'down'
): Direction {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (dx === 0 && dy === 0) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  return dy < 0 ? 'up' : 'down';
}

export function directionDelta(dir: Direction): [number, number] {
  switch (dir) {
    case 'up':
      return [0, -1];
    case 'down':
      return [0, 1];
    case 'left':
      return [-1, 0];
    case 'right':
      return [1, 0];
  }
}

export function engageNpcLook(
  state: NpcBehaviorState,
  playerX: number,
  playerY: number,
  followAfterTalk: boolean
): void {
  if (state.moving) {
    if (
      state.moveProgress >= 0.5 &&
      !(state.moveToX === playerX && state.moveToY === playerY)
    ) {
      state.gridX = state.moveToX;
      state.gridY = state.moveToY;
    }
    state.moving = false;
    state.moveProgress = 0;
    state.walkFrame = 0;
    state.walkAnimTimer = 0;
    state.moveFromX = state.gridX;
    state.moveFromY = state.gridY;
    state.moveToX = state.gridX;
    state.moveToY = state.gridY;
  }
  state.dir = directionToward(state.gridX, state.gridY, playerX, playerY, state.dir);
  if (followAfterTalk) {
    state.lookAtPlayerTimer = FOLLOW_LOOK_DURATION_SEC;
  }
}

const ORTHOGONAL_DIRS: readonly Direction[] = ['right', 'down', 'left', 'up'];

export function pickNextNpcPatrolStep(
  state: NpcBehaviorState,
  patrol: NpcPatrolDef,
  canStepTo: (fromX: number, fromY: number, toX: number, toY: number) => boolean
): { dx: number; dy: number; dir: Direction } | null {
  const waypoints = patrol.waypoints;
  if (waypoints && waypoints.length >= 2) {
    // Advance past already-reached waypoint
    for (let guard = 0; guard < waypoints.length; guard++) {
      const target = waypoints[state.waypointIndex % waypoints.length];
      if (target.x === state.gridX && target.y === state.gridY) {
        state.waypointIndex = (state.waypointIndex + 1) % waypoints.length;
      } else {
        break;
      }
    }

    const target = waypoints[state.waypointIndex % waypoints.length];
    const dx = target.x - state.gridX;
    const dy = target.y - state.gridY;

    const candidates: Direction[] = [];
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx !== 0) candidates.push(dx > 0 ? 'right' : 'left');
      if (dy !== 0) candidates.push(dy > 0 ? 'down' : 'up');
    } else {
      if (dy !== 0) candidates.push(dy > 0 ? 'down' : 'up');
      if (dx !== 0) candidates.push(dx > 0 ? 'right' : 'left');
    }

    for (const dir of candidates) {
      const [sx, sy] = directionDelta(dir);
      const nx = state.gridX + sx;
      const ny = state.gridY + sy;
      if (canStepTo(state.gridX, state.gridY, nx, ny)) {
        return { dx: sx, dy: sy, dir };
      }
    }
    return null;
  }

  const radius = patrol.radius ?? 0;
  if (radius <= 0) return null;

  for (let i = 0; i < ORTHOGONAL_DIRS.length; i++) {
    const dir = ORTHOGONAL_DIRS[(state.wanderCursor + i) % ORTHOGONAL_DIRS.length];
    const [sx, sy] = directionDelta(dir);
    const nx = state.gridX + sx;
    const ny = state.gridY + sy;
    if (
      Math.abs(nx - state.homeX) <= radius &&
      Math.abs(ny - state.homeY) <= radius &&
      canStepTo(state.gridX, state.gridY, nx, ny)
    ) {
      state.wanderCursor = (state.wanderCursor + i + 1) % ORTHOGONAL_DIRS.length;
      return { dx: sx, dy: sy, dir };
    }
  }
  return null;
}

export function stepNpcBehavior(
  state: NpcBehaviorState,
  opts: {
    dt: number;
    patrol?: NpcPatrolDef;
    lookAtPlayerAfterTalk?: boolean;
    playerX: number;
    playerY: number;
    paused: boolean;
    canStepTo: (fromX: number, fromY: number, toX: number, toY: number) => boolean;
  }
): void {
  const { dt, patrol, lookAtPlayerAfterTalk, playerX, playerY, paused, canStepTo } = opts;

  if (paused) {
    return;
  }

  // Follow-look behavior after player has talked to this NPC
  if (lookAtPlayerAfterTalk && state.lookAtPlayerTimer > 0) {
    const dist = manhattanDistance(state.gridX, state.gridY, playerX, playerY);
    if (dist <= FOLLOW_LOOK_RANGE_TILES) {
      state.lookAtPlayerTimer = Math.max(0, state.lookAtPlayerTimer - dt);
      if (!state.moving) {
        state.dir = directionToward(state.gridX, state.gridY, playerX, playerY, state.dir);
        state.walkFrame = 0;
        if (state.lookAtPlayerTimer === 0 && !patrol) {
          state.dir = state.defaultDir;
        }
        return;
      }
    } else {
      state.lookAtPlayerTimer = 0;
      if (!patrol) {
        state.dir = state.defaultDir;
      }
    }
  }

  if (!patrol) {
    return;
  }

  const speed = patrol.speed ?? 1.45;
  const pauseDuration = patrol.pauseSec ?? 1.3;

  if (state.moving) {
    state.moveProgress += dt * speed;
    state.walkAnimTimer += dt * speed;
    if (state.walkAnimTimer >= 0.25) {
      state.walkAnimTimer -= 0.25;
      state.walkFrame = ((state.walkFrame + 1) % 4) as CharacterFrame;
    }

    if (state.moveProgress >= 1) {
      state.moving = false;
      state.moveProgress = 0;
      state.walkFrame = 0;
      state.walkAnimTimer = 0;
      state.gridX = state.moveToX;
      state.gridY = state.moveToY;
      state.moveFromX = state.gridX;
      state.moveFromY = state.gridY;

      const waypoints = patrol.waypoints;
      if (waypoints && waypoints.length >= 2) {
        const target = waypoints[state.waypointIndex % waypoints.length];
        if (target.x === state.gridX && target.y === state.gridY) {
          state.waypointIndex = (state.waypointIndex + 1) % waypoints.length;
          state.pauseTimer = pauseDuration;
        }
      } else {
        state.pauseTimer = pauseDuration;
      }
    }
    return;
  }

  if (state.pauseTimer > 0) {
    state.pauseTimer = Math.max(0, state.pauseTimer - dt);
    return;
  }

  const next = pickNextNpcPatrolStep(state, patrol, canStepTo);
  if (!next) {
    state.pauseTimer = 0.65;
    return;
  }

  state.dir = next.dir;
  state.moving = true;
  state.moveFromX = state.gridX;
  state.moveFromY = state.gridY;
  state.moveToX = state.gridX + next.dx;
  state.moveToY = state.gridY + next.dy;
  state.moveProgress = 0;
  state.walkAnimTimer = 0;
}

export function hasTrainerLineOfSight(
  trainerX: number,
  trainerY: number,
  facing: Direction,
  sightRange: number,
  playerX: number,
  playerY: number,
  isStepClear: (fromX: number, fromY: number, toX: number, toY: number) => boolean
): boolean {
  if (sightRange <= 0) return false;
  const dx = playerX - trainerX;
  const dy = playerY - trainerY;

  let dist = 0;
  let stepX = 0;
  let stepY = 0;
  if (facing === 'up' && dx === 0 && dy < 0) {
    dist = -dy;
    stepY = -1;
  } else if (facing === 'down' && dx === 0 && dy > 0) {
    dist = dy;
    stepY = 1;
  } else if (facing === 'left' && dy === 0 && dx < 0) {
    dist = -dx;
    stepX = -1;
  } else if (facing === 'right' && dy === 0 && dx > 0) {
    dist = dx;
    stepX = 1;
  } else {
    return false;
  }

  if (dist <= 0 || dist > sightRange) return false;

  let cx = trainerX;
  let cy = trainerY;
  for (let s = 1; s <= dist; s++) {
    const nx = cx + stepX;
    const ny = cy + stepY;
    if (!isStepClear(cx, cy, nx, ny)) {
      return false;
    }
    cx = nx;
    cy = ny;
  }
  return true;
}


