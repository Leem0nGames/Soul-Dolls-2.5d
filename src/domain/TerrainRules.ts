import type { BuildingPlacement, Direction, MapDef } from './types.ts';

export const HEIGHT_UNIT = 0.5;

export function getTileHeightLevel(map: MapDef, x: number, y: number): number {
  const row = map.heights[y];
  if (!row) return 0;
  const ch = row[x];
  if (!ch) return 0;
  const n = Number(ch);
  return Number.isFinite(n) ? Math.max(0, Math.min(9, n)) : 0;
}

export function getTileWorldY(map: MapDef, x: number, y: number): number {
  return getTileHeightLevel(map, x, y) * HEIGHT_UNIT;
}

/** Bilinearly interpolated world Y for smooth walking over heightfields */
export function sampleInterpolatedHeight(
  map: MapDef,
  wx: number,
  wz: number
): number {
  const h = map.heights.length;
  const w = map.heights[0]?.length ?? 0;
  if (w === 0 || h === 0) return 0;

  const cx = Math.max(0, Math.min(w - 1, wx));
  const cz = Math.max(0, Math.min(h - 1, wz));
  const x0 = Math.floor(cx);
  const z0 = Math.floor(cz);
  const x1 = Math.min(w - 1, x0 + 1);
  const z1 = Math.min(h - 1, z0 + 1);
  const tx = cx - x0;
  const tz = cz - z0;

  const h00 = getTileWorldY(map, x0, z0);
  const h10 = getTileWorldY(map, x1, z0);
  const h01 = getTileWorldY(map, x0, z1);
  const h11 = getTileWorldY(map, x1, z1);

  const top = h00 + (h10 - h00) * tx;
  const bot = h01 + (h11 - h01) * tx;
  return top + (bot - top) * tz;
}

export function isInsideBuilding(
  buildings: readonly BuildingPlacement[],
  x: number,
  y: number
): boolean {
  for (const b of buildings) {
    if (x >= b.x && x < b.x + b.width && y >= b.z && y < b.z + b.depth) {
      return true;
    }
  }
  return false;
}

export function isTileWalkable(
  map: MapDef,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  blockedDynamic?: ReadonlySet<string>
): boolean {
  const height = map.grid.length;
  const width = map.grid[0]?.length ?? 0;
  if (toY < 0 || toY >= height || toX < 0 || toX >= width) {
    return false;
  }

  const targetChar = map.grid[toY][toX];
  const targetLegend = map.legend[targetChar];
  if (!targetLegend || targetLegend.solid || targetLegend.tile === 'water') {
    return false;
  }

  if (isInsideBuilding(map.buildings, toX, toY)) {
    return false;
  }

  if (map.props.some((p) => p.x === toX && p.z === toY)) {
    return false;
  }

  if (map.signs.some((s) => s.x === toX && s.y === toY)) {
    return false;
  }

  if (blockedDynamic?.has(`${toX},${toY}`)) {
    return false;
  }

  const fromChar = map.grid[fromY]?.[fromX] ?? '.';
  const fromLegend = map.legend[fromChar];
  const isRamp = Boolean(targetLegend.ramp || fromLegend?.ramp || targetLegend.tile === 'stairs' || fromLegend?.tile === 'stairs');

  const hFrom = getTileHeightLevel(map, fromX, fromY);
  const hTo = getTileHeightLevel(map, toX, toY);
  const maxStep = isRamp ? 2 : 1;

  return Math.abs(hTo - hFrom) <= maxStep;
}

/**
 * Converts a camera-relative D-pad input ('up'|'down'|'left'|'right')
 * into world-grid delta and character facing direction based on camera yaw step (0..3).
 * CameraRig yaw=+90deg (step 1) places camera at +X looking -X (West).
 */
export function cameraRelativeMove(
  inputDir: Direction,
  yawStep: number
): { dx: number; dy: number; dir: Direction } {
  const normStep = ((yawStep % 4) + 4) % 4;
  // Base clockwise order: up=(0,-1), right=(1,0), down=(0,1), left=(-1,0)
  const dirs: readonly Direction[] = ['up', 'right', 'down', 'left'];
  const vecs: readonly [number, number][] = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];
  const inputIdx = dirs.indexOf(inputDir);
  const worldIdx = (inputIdx - normStep + 4) % 4;
  return {
    dx: vecs[worldIdx][0],
    dy: vecs[worldIdx][1],
    dir: dirs[worldIdx],
  };
}

/**
 * Converts a character's world facing direction into the sprite direction
 * relative to the current camera yaw step (0..3).
 */
export function relativeSpriteDir(worldDir: Direction, yawStep: number): Direction {
  const normStep = ((yawStep % 4) + 4) % 4;
  const dirs: readonly Direction[] = ['up', 'right', 'down', 'left'];
  const idx = dirs.indexOf(worldDir);
  return dirs[(idx + normStep) % 4];
}
