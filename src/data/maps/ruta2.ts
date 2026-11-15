import type { MapDef } from '../../domain/types.ts';
import { hexToNumber, PALETTE } from '../../gfx/Palette.ts';
import { ENCOUNTERS } from '../encounters.ts';
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

function buildRuta2() {
  const z = createZoneCanvas(56, 48, ',', 2);

  addPerimeterMountains(z, 5, 8, '#');
  // Mountain ridges & alpine peaks
  addHill(z, 16, 12, 11, 5);
  addHill(z, 42, 14, 12, 6);
  addHill(z, 40, 36, 10, 4);

  // Scenic alpine lake in center-south
  fillRect(z, 20, 26, 14, 11, '~', 1);

  // Mountain pass road from west (0,24) across bridge over lake to north cave (36,0)
  carveRoad(z, 0, 24, 19, 24, 2, '_', 2);
  // Bridge across lake (x=20..33, z=28..29) -> route slightly south then bridge!
  carveRoad(z, 18, 24, 18, 29, 2, '_', 2);
  fillRect(z, 20, 29, 14, 2, 'B', 2); // wooden bridge over lake!
  carveRoad(z, 34, 29, 36, 16, 2, '_', 3);
  fillRect(z, 34, 22, 2, 2, '^', 2);
  carveRoad(z, 36, 16, 36, 0, 2, '_', 4);
  fillRect(z, 36, 12, 2, 2, '^', 3);

  // Tall grass valleys
  fillRect(z, 8, 16, 8, 6, '"', 2);
  fillRect(z, 10, 31, 8, 7, '"', 2);
  fillRect(z, 38, 21, 9, 6, '"', 3);

  // Smooth terraced alpine passes at west & north cave exits
  carveMapPass(z, {
    x: 0,
    y: 24,
    exitDir: 'west',
    roadTile: '_',
    height: 2,
    depth: 8,
    shoulderWidth: 3,
    slopeWidth: 5,
    shoulderTile: ',',
  });
  carveMapPass(z, {
    x: 36,
    y: 0,
    exitDir: 'north',
    roadTile: '_',
    height: 4,
    depth: 8,
    shoulderWidth: 2,
    slopeWidth: 4,
    shoulderTile: ',',
  });

  return finalizeZone(z);
}

const built = buildRuta2();

export const MAP_RUTA_2: MapDef = {
  id: 'ruta_2',
  nameKey: 'ruta_2',
  biome: 'mountain',
  music: 'route',
  skyTopColor: hexToNumber(PALETTE.oldBronze),
  skyBottomColor: hexToNumber(PALETTE.paleGold),
  fogColor: hexToNumber(PALETTE.porcelain),
  snowLine: 7,
  grid: built.grid,
  heights: built.heights,
  legend: DEFAULT_LEGEND,
  buildings: [],
  props: [
    { kind: 'boulder', x: 16, z: 22 },
    { kind: 'boulder', x: 38, z: 14 },
    { kind: 'lamp_stone', x: 19, z: 28 },
    { kind: 'lamp_wood', x: 34, z: 28 },
    { kind: 'pine', x: 12, z: 14 },
    { kind: 'snow_pine', x: 43, z: 10 },
    { kind: 'lamp_stone', x: 2, z: 22 },
    { kind: 'lamp_stone', x: 2, z: 27 },
    { kind: 'lamp_stone', x: 34, z: 4 },
    { kind: 'lamp_stone', x: 39, z: 4 },
  ],
  decoration: {
    seed: 404,
    treeDensity: 0.14,
    bushDensity: 0.08,
    flowerDensity: 0.05,
    rockDensity: 0.1,
    mushroomDensity: 0.02,
    treeKinds: ['pine', 'snow_pine', 'oak'],
  },
  warps: [
    { x: 0, y: 24, targetMap: 'pueblo_bruma', targetX: 45, targetY: 23, dir: 'left' },
    { x: 0, y: 25, targetMap: 'pueblo_bruma', targetX: 45, targetY: 24, dir: 'left' },
    { x: 36, y: 0, targetMap: 'cueva_eco', targetX: 23, targetY: 45, dir: 'up' },
    { x: 37, y: 0, targetMap: 'cueva_eco', targetX: 24, targetY: 45, dir: 'up' },
  ],
  npcs: [
    {
      id: 'npc_ruta2_guarda',
      name: 'Guardabosques Elena',
      role: 'trainer',
      x: 15,
      y: 23,
      dir: 'down',
      dialogKey: 'trainer',
      trainerId: 'ruta2_guarda',
      sightRange: 4,
      patrol: {
        waypoints: [
          { x: 15, y: 23 },
          { x: 15, y: 26 },
        ],
        speed: 1.35,
        pauseSec: 1.5,
      },
      lookAtPlayerAfterTalk: true,
    },
    {
      id: 'npc_ruta2_chispero',
      name: 'Chispero Nico',
      role: 'trainer',
      x: 35,
      y: 19,
      dir: 'right',
      dialogKey: 'trainer',
      trainerId: 'ruta2_chispero',
      sightRange: 4,
      patrol: {
        waypoints: [
          { x: 35, y: 19 },
          { x: 35, y: 21 },
        ],
        speed: 1.35,
        pauseSec: 1.5,
      },
      lookAtPlayerAfterTalk: true,
    },
  ],
  signs: [{ x: 4, y: 23, textKey: 'sign_ruta2' }],
  encounters: ENCOUNTERS.ruta_2,
};
