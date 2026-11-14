import type { MapDef } from '../../domain/types.ts';
import { hexToNumber, PALETTE } from '../../gfx/Palette.ts';
import {
  addHill,
  addPerimeterMountains,
  carveMapPass,
  carveRoad,
  createZoneCanvas,
  DEFAULT_LEGEND,
  fillRect,
  finalizeZone,
} from './mapBuilder.ts';

function buildArenaCumbre() {
  const z = createZoneCanvas(48, 48, '.', 3);

  addPerimeterMountains(z, 5, 9, '#');
  addHill(z, 10, 12, 8, 5);
  addHill(z, 38, 12, 8, 5);

  // Grand Arena terrace at height 5
  fillRect(z, 14, 14, 20, 20, 'A', 5);
  carveRoad(z, 23, 34, 23, 47, 2, '=', 3);
  fillRect(z, 23, 33, 2, 3, '^', 4);
  carveRoad(z, 23, 18, 23, 34, 2, '=', 5);

  carveMapPass(z, {
    x: 23,
    y: 47,
    exitDir: 'south',
    roadTile: '=',
    height: 3,
    depth: 8,
    shoulderWidth: 3,
    slopeWidth: 4,
    shoulderTile: '.',
  });

  return finalizeZone(z);
}

const built = buildArenaCumbre();

export const MAP_ARENA_CUMBRE: MapDef = {
  id: 'arena_cumbre',
  nameKey: 'arena_cumbre',
  biome: 'arena',
  music: 'town',
  skyTopColor: hexToNumber(PALETTE.deepAmethyst),
  skyBottomColor: hexToNumber(PALETTE.ghostViolet),
  fogColor: hexToNumber(PALETTE.etherealOrchid),
  snowLine: 6,
  grid: built.grid,
  heights: built.heights,
  legend: DEFAULT_LEGEND,
  buildings: [{ kind: 'arena_hall', x: 21, z: 14, width: 6, depth: 4, facing: 'down' }],
  props: [
    { kind: 'pillar', x: 18, z: 20 },
    { kind: 'pillar', x: 29, z: 20 },
    { kind: 'pillar', x: 18, z: 26 },
    { kind: 'pillar', x: 29, z: 26 },
    { kind: 'pillar', x: 18, z: 31 },
    { kind: 'pillar', x: 29, z: 31 },
    { kind: 'lamp_stone', x: 22, z: 38 },
    { kind: 'lamp_stone', x: 26, z: 38 },
    { kind: 'lamp_double', x: 20, z: 19 },
    { kind: 'lamp_double', x: 27, z: 19 },
    { kind: 'snow_pine', x: 12, z: 30 },
    { kind: 'snow_pine', x: 35, z: 30 },
  ],
  decoration: {
    seed: 606,
    treeDensity: 0.1,
    bushDensity: 0.04,
    flowerDensity: 0.03,
    rockDensity: 0.08,
    mushroomDensity: 0,
    treeKinds: ['snow_pine', 'pine'],
  },
  warps: [
    { x: 23, y: 47, targetMap: 'cueva_eco', targetX: 23, targetY: 2, dir: 'down' },
    { x: 24, y: 47, targetMap: 'cueva_eco', targetX: 24, targetY: 2, dir: 'down' },
  ],
  npcs: [
    {
      id: 'arena_heal',
      name: 'Estación Médica',
      role: 'healer',
      x: 19,
      y: 29,
      dir: 'down',
      dialogKey: 'heal_machine_use',
      healOnTalk: true,
    },
    {
      id: 'arena_guide_npc',
      name: 'Árbitro Leo',
      role: 'npc',
      x: 27,
      y: 31,
      dir: 'left',
      dialogKey: 'arena_guide',
    },
    {
      id: 'npc_arena_discipulo',
      name: 'Discípula Sofía',
      role: 'trainer',
      x: 23,
      y: 25,
      dir: 'down',
      dialogKey: 'trainer',
      trainerId: 'arena_discipulo',
      sightRange: 3,
    },
    {
      id: 'npc_leader_valeria',
      name: 'Líder Valeria',
      role: 'leader',
      x: 23,
      y: 19,
      dir: 'down',
      dialogKey: 'trainer',
      trainerId: 'leader_valeria',
      sightRange: 3,
    },
  ],
  signs: [{ x: 22, y: 40, textKey: 'sign_arena' }],
};
