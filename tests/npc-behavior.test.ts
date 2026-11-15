import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import {
  createNpcBehaviorState,
  directionToward,
  engageNpcLook,
  FOLLOW_LOOK_RANGE_TILES,
  hasTrainerLineOfSight,
  stepNpcBehavior,
} from '../src/domain/NpcBehavior.ts';
import { isInsideBuilding, isTileWalkable } from '../src/domain/TerrainRules.ts';

describe('NPC Patrol, Follow-Look, and CSS Bounce Marker', () => {
  it('validates every patrolling NPC waypoint path across all maps is walkable and unobstructed', () => {
    let patrolCount = 0;

    for (const map of Object.values(MAPS)) {
      const solidProps = new Set(map.props.map((p) => `${p.x},${p.z}`));

      for (const npc of map.npcs) {
        const wps = npc.patrol?.waypoints;
        if (!wps || wps.length === 0) continue;
        patrolCount += 1;
        expect(wps.length).toBeGreaterThanOrEqual(2);

        for (let i = 0; i < wps.length; i++) {
          const a = wps[i];
          const b = wps[(i + 1) % wps.length];
          const minX = Math.min(a.x, b.x);
          const maxX = Math.max(a.x, b.x);
          const minY = Math.min(a.y, b.y);
          const maxY = Math.max(a.y, b.y);

          for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
              expect(isTileWalkable(map, x, y, x, y, solidProps)).toBe(true);
              expect(isInsideBuilding(map.buildings, x, y)).toBe(false);
              expect(map.warps.some((w) => w.x === x && w.y === y)).toBe(false);
              expect(map.signs.some((s) => s.x === x && s.y === y)).toBe(false);
            }
          }
        }
      }
    }

    expect(patrolCount).toBeGreaterThanOrEqual(7);
  });

  it('advances patrolling NPC along waypoints with walk animation frames and pauses', () => {
    const state = createNpcBehaviorState(10, 10, 'down', 0.2);
    const patrol = {
      waypoints: [
        { x: 10, y: 10 },
        { x: 12, y: 10 },
        { x: 12, y: 11 },
      ],
      speed: 2.0,
      pauseSec: 0.5,
    };

    // Wait out initial pause
    stepNpcBehavior(state, {
      dt: 0.25,
      patrol,
      playerX: 0,
      playerY: 0,
      paused: false,
      canStepTo: () => true,
    });
    expect(state.moving).toBe(false);

    // Next step initiates movement toward (12, 10) -> right
    stepNpcBehavior(state, {
      dt: 0.1,
      patrol,
      playerX: 0,
      playerY: 0,
      paused: false,
      canStepTo: () => true,
    });
    expect(state.moving).toBe(true);
    expect(state.dir).toBe('right');
    expect(state.moveToX).toBe(11);

    // Finish first tile (0.5s at speed 2.0) and verify step onto (11,10)
    for (let i = 0; i < 6; i++) {
      stepNpcBehavior(state, {
        dt: 0.1,
        patrol,
        playerX: 0,
        playerY: 0,
        paused: false,
        canStepTo: () => true,
      });
    }
    expect(state.gridX).toBeGreaterThanOrEqual(11);
  });

  it('turns NPC toward player when talked to and keeps watching nearby player afterward', () => {
    const state = createNpcBehaviorState(20, 20, 'down', 0);
    const patrol = {
      waypoints: [
        { x: 20, y: 20 },
        { x: 22, y: 20 },
      ],
      speed: 2.0,
      pauseSec: 0.5,
    };

    // Talk from the left
    engageNpcLook(state, 19, 20, true);
    expect(state.dir).toBe('left');
    expect(state.lookAtPlayerTimer).toBeGreaterThan(0);

    // Player walks north of the NPC (within FOLLOW_LOOK_RANGE_TILES)
    stepNpcBehavior(state, {
      dt: 0.5,
      patrol,
      lookAtPlayerAfterTalk: true,
      playerX: 20,
      playerY: 18,
      paused: false,
      canStepTo: () => true,
    });
    expect(state.dir).toBe('up');
    expect(state.moving).toBe(false);

    // Player walks east of the NPC (within range)
    stepNpcBehavior(state, {
      dt: 0.5,
      patrol,
      lookAtPlayerAfterTalk: true,
      playerX: 23,
      playerY: 20,
      paused: false,
      canStepTo: () => true,
    });
    expect(state.dir).toBe('right');

    // Player walks out of follow-look range -> timer clears and patrol resumes
    stepNpcBehavior(state, {
      dt: 0.1,
      patrol,
      lookAtPlayerAfterTalk: true,
      playerX: 20 + FOLLOW_LOOK_RANGE_TILES + 2,
      playerY: 20,
      paused: false,
      canStepTo: () => true,
    });
    expect(state.lookAtPlayerTimer).toBe(0);
    expect(state.moving).toBe(true);
    expect(directionToward(10, 10, 10, 10, 'down')).toBe('down');
  });

  it('blocks trainer line of sight across walls, obstacles, or wrong facing', () => {
    // Clear path within sightRange
    expect(hasTrainerLineOfSight(10, 10, 'right', 4, 13, 10, () => true)).toBe(true);
    // Out of sightRange
    expect(hasTrainerLineOfSight(10, 10, 'right', 2, 13, 10, () => true)).toBe(false);
    // Wrong direction
    expect(hasTrainerLineOfSight(10, 10, 'left', 5, 13, 10, () => true)).toBe(false);
    // Wall/building blocking tile (11, 10) -> (12, 10)
    expect(
      hasTrainerLineOfSight(
        10,
        10,
        'right',
        5,
        13,
        10,
        (_fx, _fy, nx, ny) => !(nx === 12 && ny === 10)
      )
    ).toBe(false);
  });
});
