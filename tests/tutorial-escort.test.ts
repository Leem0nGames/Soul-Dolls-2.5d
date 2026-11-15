import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import { isInsideBuilding, isTileWalkable } from '../src/domain/TerrainRules.ts';
import {
  expandGridWaypoints,
  TUTORIAL_SPEAKER,
  TUTORIAL_STEPS,
  VILLA_GUIDE_NPC_ID,
  VILLA_GUIDE_REST_AFTER_STARTER,
  VILLA_GUIDE_REST_BEFORE_STARTER,
  VILLA_GUIDE_SPAWN,
  VILLA_PLAYER_SPAWN,
  VILLA_TOUR_LAB_GUIDE_WAYPOINTS,
  VILLA_TOUR_LAB_PLAYER_WAYPOINTS,
  VILLA_TOUR_PEDESTALS_GUIDE_WAYPOINTS,
  VILLA_TOUR_PLAZA_GUIDE_WAYPOINTS,
  VILLA_TOUR_PLAZA_PLAYER_WAYPOINTS,
} from '../src/domain/Tutorial.ts';

describe('Tutorial inicial (Maestro de Marionetas) y Escolta en Villa Origen', () => {
  it('defines Maestro de Marionetas lessons covering movement, combat, and capture mechanics', () => {
    expect(TUTORIAL_SPEAKER).toBe('Maestro de Marionetas');
    expect(TUTORIAL_STEPS.length).toBeGreaterThanOrEqual(4);

    const ids = TUTORIAL_STEPS.map((s) => s.id);
    expect(ids).toContain('movement');
    expect(ids).toContain('combat');
    expect(ids).toContain('capture');

    for (const step of TUTORIAL_STEPS) {
      expect(step.title.trim().length).toBeGreaterThan(0);
      expect(step.dialog.trim().length).toBeGreaterThan(15);
      expect(step.facts.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps Villa Origen guide NPC and unobstructed front tiles for all 3 starter pedestals', () => {
    const villa = MAPS.villa_origen;
    const guide = villa.npcs.find((n) => n.id === VILLA_GUIDE_NPC_ID);
    expect(guide).toBeDefined();
    expect(guide?.x).toBe(VILLA_GUIDE_SPAWN.x);
    expect(guide?.y).toBe(VILLA_GUIDE_SPAWN.y);

    const solidProps = new Set(villa.props.map((p) => `${p.x},${p.z}`));
    for (const sx of [25, 26, 27]) {
      expect(isTileWalkable(villa, sx, 21, sx, 20, solidProps)).toBe(true);
      expect(solidProps.has(`${sx},20`)).toBe(false);
    }
  });

  it('validates synchronized, collision-free Villa Origen escort paths up to Prof. Robledo and pedestals', () => {
    const villa = MAPS.villa_origen;
    const solidProps = new Set(villa.props.map((p) => `${p.x},${p.z}`));

    const plazaGuide = expandGridWaypoints(
      VILLA_GUIDE_SPAWN.x,
      VILLA_GUIDE_SPAWN.y,
      VILLA_TOUR_PLAZA_GUIDE_WAYPOINTS
    );
    const plazaPlayer = expandGridWaypoints(
      VILLA_PLAYER_SPAWN.x,
      VILLA_PLAYER_SPAWN.y,
      VILLA_TOUR_PLAZA_PLAYER_WAYPOINTS
    );

    const plazaSteps = Math.max(plazaGuide.length, plazaPlayer.length);
    for (let i = 0; i < plazaSteps; i++) {
      const g = plazaGuide[Math.min(i, plazaGuide.length - 1)];
      const p = plazaPlayer[Math.min(i, plazaPlayer.length - 1)];
      expect(`${g.x},${g.y}`).not.toBe(`${p.x},${p.y}`);
    }

    const plazaGuideEnd = plazaGuide[plazaGuide.length - 1];
    const plazaPlayerEnd = plazaPlayer[plazaPlayer.length - 1];

    const labGuide = expandGridWaypoints(
      plazaGuideEnd.x,
      plazaGuideEnd.y,
      VILLA_TOUR_LAB_GUIDE_WAYPOINTS
    );
    const labPlayer = expandGridWaypoints(
      plazaPlayerEnd.x,
      plazaPlayerEnd.y,
      VILLA_TOUR_LAB_PLAYER_WAYPOINTS
    );

    const labSteps = Math.max(labGuide.length, labPlayer.length);
    for (let i = 0; i < labSteps; i++) {
      const g = labGuide[Math.min(i, labGuide.length - 1)];
      const p = labPlayer[Math.min(i, labPlayer.length - 1)];
      expect(`${g.x},${g.y}`).not.toBe(`${p.x},${p.y}`);
    }

    const labGuideEnd = labGuide[labGuide.length - 1];
    const labPlayerEnd = labPlayer[labPlayer.length - 1];
    expect(labPlayerEnd.x).toBe(19);
    expect(labPlayerEnd.y).toBe(20);
    expect(labPlayerEnd.dir).toBe('up');

    const pedGuide = expandGridWaypoints(
      labGuideEnd.x,
      labGuideEnd.y,
      VILLA_TOUR_PEDESTALS_GUIDE_WAYPOINTS
    );
    const pedEnd = pedGuide[pedGuide.length - 1];
    expect(pedEnd.x).toBe(VILLA_GUIDE_REST_BEFORE_STARTER.x);
    expect(pedEnd.y).toBe(VILLA_GUIDE_REST_BEFORE_STARTER.y);

    const assertChainWalkable = (
      startX: number,
      startY: number,
      steps: ReturnType<typeof expandGridWaypoints>
    ) => {
      let cx = startX;
      let cy = startY;
      for (const s of steps) {
        expect(isTileWalkable(villa, cx, cy, s.x, s.y, solidProps)).toBe(true);
        expect(isInsideBuilding(villa.buildings, s.x, s.y)).toBe(false);
        expect(villa.warps.some((w) => w.x === s.x && w.y === s.y)).toBe(false);
        expect(villa.signs.some((sg) => sg.x === s.x && sg.y === s.y)).toBe(false);
        expect(
          villa.npcs.some(
            (n) => n.id !== VILLA_GUIDE_NPC_ID && n.x === s.x && n.y === s.y
          )
        ).toBe(false);
        cx = s.x;
        cy = s.y;
      }
    };

    assertChainWalkable(VILLA_GUIDE_SPAWN.x, VILLA_GUIDE_SPAWN.y, [
      ...plazaGuide,
      ...labGuide,
      ...pedGuide,
    ]);
    assertChainWalkable(VILLA_PLAYER_SPAWN.x, VILLA_PLAYER_SPAWN.y, [
      ...plazaPlayer,
      ...labPlayer,
    ]);

    expect(
      isTileWalkable(
        villa,
        VILLA_GUIDE_REST_AFTER_STARTER.x,
        VILLA_GUIDE_REST_AFTER_STARTER.y,
        VILLA_GUIDE_REST_AFTER_STARTER.x,
        VILLA_GUIDE_REST_AFTER_STARTER.y,
        solidProps
      )
    ).toBe(true);
  });
});
