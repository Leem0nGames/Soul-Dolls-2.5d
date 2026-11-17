import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import { isInsideBuilding, isTileWalkable } from '../src/domain/TerrainRules.ts';
import {
  expandGridWaypoints,
  LAB_GUIDE_NPC_ID,
  LAB_GUIDE_REST_BEFORE_STARTER,
  LAB_GUIDE_SPAWN,
  LAB_PLAYER_SPAWN,
  LAB_TOUR_PEDESTALS_GUIDE_WAYPOINTS,
  LAB_TOUR_PROF_GUIDE_WAYPOINTS,
  LAB_TOUR_PROF_PLAYER_WAYPOINTS,
  TUTORIAL_SPEAKER,
  TUTORIAL_STEPS,
  VILLA_GUIDE_NPC_ID,
  VILLA_GUIDE_REST_AFTER_STARTER,
  VILLA_GUIDE_REST_BEFORE_STARTER,
  VILLA_GUIDE_SPAWN,
  VILLA_PLAYER_SPAWN,
  VILLA_TOUR_LAB_GUIDE_WAYPOINTS,
  VILLA_TOUR_LAB_PLAYER_WAYPOINTS,
  VILLA_TOUR_PLAZA_GUIDE_WAYPOINTS,
  VILLA_TOUR_PLAZA_PLAYER_WAYPOINTS,
} from '../src/domain/Tutorial.ts';
import type { MapDef } from '../src/domain/types.ts';

function assertWalkableChain(
  map: MapDef,
  solidProps: Set<string>,
  startX: number,
  startY: number,
  steps: ReturnType<typeof expandGridWaypoints>,
  excludeNpcIds: string[]
) {
  let cx = startX;
  let cy = startY;
  for (const s of steps) {
    expect(isTileWalkable(map, cx, cy, s.x, s.y, solidProps)).toBe(true);
    expect(isInsideBuilding(map.buildings, s.x, s.y)).toBe(false);
    expect(map.warps.some((w) => w.x === s.x && w.y === s.y)).toBe(false);
    expect(map.signs.some((sg) => sg.x === s.x && sg.y === s.y)).toBe(false);
    expect(
      map.npcs.some((n) => !excludeNpcIds.includes(n.id) && n.x === s.x && n.y === s.y)
    ).toBe(false);
    cx = s.x;
    cy = s.y;
  }
}

describe('Tutorial inicial, Escolta de Guía Lía y Laboratorio interior del Prof. Robledo', () => {
  it('defines Maestro de Marionetas lessons covering movement, combat, lab guide, and workshop', () => {
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

    const lastStep = TUTORIAL_STEPS.find((s) => s.id === 'capture')!;
    expect(lastStep.dialog.toLowerCase()).toContain('laboratorio');
  });

  it('places Prof. Robledo and all 3 starter pedestals inside laboratorio_origen with bidirectional warps', () => {
    const villa = MAPS.villa_origen;
    const lab = MAPS.laboratorio_origen;
    expect(lab).toBeDefined();
    expect(lab.isInterior).toBe(true);

    // Outdoor Villa Origen no longer holds Prof. Robledo or starter pedestals
    expect(villa.npcs.some((n) => n.id === 'prof_robledo')).toBe(false);
    expect(villa.npcs.some((n) => n.starterIndex !== undefined)).toBe(false);

    // Bidirectional warps at Villa Origen Lab door (19, 18) <-> laboratorio_origen
    const enterWarp = villa.warps.find((w) => w.targetMap === 'laboratorio_origen');
    expect(enterWarp).toBeDefined();
    expect(enterWarp?.x).toBe(19);
    expect(enterWarp?.y).toBe(18);
    expect(isTileWalkable(villa, 19, 19, enterWarp!.x, enterWarp!.y)).toBe(true);

    const exitWarps = lab.warps.filter((w) => w.targetMap === 'villa_origen');
    expect(exitWarps.length).toBeGreaterThanOrEqual(1);
    for (const w of exitWarps) {
      expect(isTileWalkable(lab, w.x, w.y - 1, w.x, w.y)).toBe(true);
      expect(isTileWalkable(villa, w.targetX, w.targetY, w.targetX, w.targetY)).toBe(true);
    }

    // Inside laboratorio_origen: Prof. Robledo, Guia Lia, 3 starter pedestals, and interactive console
    const prof = lab.npcs.find((n) => n.id === 'prof_robledo');
    const labGuide = lab.npcs.find((n) => n.id === LAB_GUIDE_NPC_ID);
    const starters = lab.npcs.filter((n) => n.starterIndex !== undefined);
    expect(prof?.role).toBe('professor');
    expect(labGuide?.role).toBe('trainer');
    expect(starters.map((s) => s.starterIndex)).toEqual([0, 1, 2]);
    expect(lab.props.some((p) => p.kind === 'lab_console')).toBe(true);

    // Every starter pedestal inside the Lab has an unobstructed front tile directly south
    const solidProps = new Set(lab.props.map((p) => `${p.x},${p.z}`));
    for (const st of starters) {
      expect(isTileWalkable(lab, st.x, st.y + 2, st.x, st.y + 1, solidProps)).toBe(true);
      expect(lab.npcs.some((n) => n.x === st.x && n.y === st.y + 1)).toBe(false);
    }
  });

  it('validates synchronized, collision-free escort paths in Villa Origen up to the Lab door and inside the Lab', () => {
    const villa = MAPS.villa_origen;
    const solidVillaProps = new Set(villa.props.map((p) => `${p.x},${p.z}`));

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

    const labDoorGuide = expandGridWaypoints(
      plazaGuideEnd.x,
      plazaGuideEnd.y,
      VILLA_TOUR_LAB_GUIDE_WAYPOINTS
    );
    const labDoorPlayer = expandGridWaypoints(
      plazaPlayerEnd.x,
      plazaPlayerEnd.y,
      VILLA_TOUR_LAB_PLAYER_WAYPOINTS
    );

    const labDoorSteps = Math.max(labDoorGuide.length, labDoorPlayer.length);
    for (let i = 0; i < labDoorSteps; i++) {
      const g = labDoorGuide[Math.min(i, labDoorGuide.length - 1)];
      const p = labDoorPlayer[Math.min(i, labDoorPlayer.length - 1)];
      expect(`${g.x},${g.y}`).not.toBe(`${p.x},${p.y}`);
    }

    const labDoorPlayerEnd = labDoorPlayer[labDoorPlayer.length - 1];
    expect(labDoorPlayerEnd.x).toBe(19);
    expect(labDoorPlayerEnd.y).toBe(19);
    expect(labDoorPlayerEnd.dir).toBe('up');

    assertWalkableChain(villa, solidVillaProps, VILLA_GUIDE_SPAWN.x, VILLA_GUIDE_SPAWN.y, [
      ...plazaGuide,
      ...labDoorGuide,
    ], [VILLA_GUIDE_NPC_ID]);
    assertWalkableChain(villa, solidVillaProps, VILLA_PLAYER_SPAWN.x, VILLA_PLAYER_SPAWN.y, [
      ...plazaPlayer,
      ...labDoorPlayer,
    ], [VILLA_GUIDE_NPC_ID]);

    expect(
      isTileWalkable(
        villa,
        VILLA_GUIDE_REST_BEFORE_STARTER.x,
        VILLA_GUIDE_REST_BEFORE_STARTER.y,
        VILLA_GUIDE_REST_BEFORE_STARTER.x,
        VILLA_GUIDE_REST_BEFORE_STARTER.y,
        solidVillaProps
      )
    ).toBe(true);
    expect(
      isTileWalkable(
        villa,
        VILLA_GUIDE_REST_AFTER_STARTER.x,
        VILLA_GUIDE_REST_AFTER_STARTER.y,
        VILLA_GUIDE_REST_AFTER_STARTER.x,
        VILLA_GUIDE_REST_AFTER_STARTER.y,
        solidVillaProps
      )
    ).toBe(true);

    // Interior Laboratory Escort (laboratorio_origen)
    const lab = MAPS.laboratorio_origen;
    const solidLabProps = new Set(lab.props.map((p) => `${p.x},${p.z}`));

    const inProfGuide = expandGridWaypoints(
      LAB_GUIDE_SPAWN.x,
      LAB_GUIDE_SPAWN.y,
      LAB_TOUR_PROF_GUIDE_WAYPOINTS
    );
    const inProfPlayer = expandGridWaypoints(
      LAB_PLAYER_SPAWN.x,
      LAB_PLAYER_SPAWN.y,
      LAB_TOUR_PROF_PLAYER_WAYPOINTS
    );
    const inProfSteps = Math.max(inProfGuide.length, inProfPlayer.length);
    for (let i = 0; i < inProfSteps; i++) {
      const g = inProfGuide[Math.min(i, inProfGuide.length - 1)];
      const p = inProfPlayer[Math.min(i, inProfPlayer.length - 1)];
      expect(`${g.x},${g.y}`).not.toBe(`${p.x},${p.y}`);
    }

    const inProfGuideEnd = inProfGuide[inProfGuide.length - 1];
    const inPedGuide = expandGridWaypoints(
      inProfGuideEnd.x,
      inProfGuideEnd.y,
      LAB_TOUR_PEDESTALS_GUIDE_WAYPOINTS
    );
    const inPedEnd = inPedGuide[inPedGuide.length - 1];
    expect(inPedEnd.x).toBe(LAB_GUIDE_REST_BEFORE_STARTER.x);
    expect(inPedEnd.y).toBe(LAB_GUIDE_REST_BEFORE_STARTER.y);

    assertWalkableChain(lab, solidLabProps, LAB_GUIDE_SPAWN.x, LAB_GUIDE_SPAWN.y, [
      ...inProfGuide,
      ...inPedGuide,
    ], [LAB_GUIDE_NPC_ID]);
    assertWalkableChain(
      lab,
      solidLabProps,
      LAB_PLAYER_SPAWN.x,
      LAB_PLAYER_SPAWN.y,
      inProfPlayer,
      [LAB_GUIDE_NPC_ID]
    );
  });
});
