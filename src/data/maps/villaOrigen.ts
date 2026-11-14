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

function buildVillaOrigen() {
  const z = createZoneCanvas(48, 48, '.', 2);

  // Rolling perimeter hills and distant mountain backdrop
  addPerimeterMountains(z, 5, 8, '#');
  addHill(z, 10, 10, 8, 3);
  addHill(z, 38, 12, 9, 4);
  addHill(z, 11, 37, 8, 3);
  addHill(z, 37, 36, 9, 4);

  // Village central plateau at height 2
  fillRect(z, 12, 14, 24, 20, '.', 2);
  // Village plaza cobble
  fillRect(z, 17, 20, 14, 11, '=', 2);
  // Pond on east side
  fillRect(z, 31, 24, 5, 5, '~', 1);
  // Flower meadows
  fillRect(z, 13, 25, 3, 4, '*', 2);
  fillRect(z, 31, 16, 4, 3, '*', 2);

  // North exit road to Ruta 1
  carveRoad(z, 23, 0, 23, 21, 2, '=', 2);
  // Subtle stairs approaching north gate
  fillRect(z, 23, 5, 2, 2, '^', 2);
  // Wide grassy pass into Ruta 1 (avoids steep V-trench)
  carveMapPass(z, {
    x: 23,
    y: 0,
    exitDir: 'north',
    roadTile: '=',
    height: 2,
    depth: 8,
    shoulderWidth: 3,
    slopeWidth: 5,
    shoulderTile: '.',
  });

  return finalizeZone(z);
}

const built = buildVillaOrigen();

export const MAP_VILLA_ORIGEN: MapDef = {
  id: 'villa_origen',
  nameKey: 'villa_origen',
  biome: 'meadow',
  music: 'town',
  skyTopColor: hexToNumber(PALETTE.oceanicTeal),
  skyBottomColor: hexToNumber(PALETTE.frostedGlass),
  fogColor: hexToNumber(PALETTE.iceCyan),
  snowLine: 8,
  grid: built.grid,
  heights: built.heights,
  legend: DEFAULT_LEGEND,
  buildings: [
    { kind: 'lab', x: 17, z: 14, width: 5, depth: 4, facing: 'down' },
    { kind: 'house_red', x: 13, z: 19, width: 4, depth: 3, facing: 'down' },
    { kind: 'house_blue', x: 29, z: 14, width: 4, depth: 3, facing: 'down' },
  ],
  props: [
    { kind: 'well', x: 20, z: 24 },
    { kind: 'lamp_wood', x: 22, z: 20 },
    { kind: 'lamp_wood', x: 26, z: 20 },
    { kind: 'lamp_post', x: 22, z: 30 },
    { kind: 'lamp_post', x: 26, z: 30 },
    { kind: 'lamp_stone', x: 30, z: 29 },
    { kind: 'lamp_double', x: 28, z: 21 },
    { kind: 'bench', x: 18, z: 29 },
    { kind: 'fence', x: 13, z: 24 },
    { kind: 'fence', x: 14, z: 24 },
    { kind: 'fence', x: 15, z: 24 },
    { kind: 'oak', x: 14, z: 31 },
    { kind: 'birch', x: 34, z: 31 },
    { kind: 'mushroom_tree', x: 13, z: 29 },
    { kind: 'mushroom_tree_arcane', x: 35, z: 18 },
    { kind: 'lamp_wood', x: 21, z: 3 },
    { kind: 'lamp_wood', x: 26, z: 3 },
    { kind: 'fence', x: 20, z: 2 },
    { kind: 'fence', x: 21, z: 2 },
    { kind: 'fence', x: 26, z: 2 },
    { kind: 'fence', x: 27, z: 2 },
  ],
  decoration: {
    seed: 101,
    treeDensity: 0.14,
    bushDensity: 0.08,
    flowerDensity: 0.06,
    rockDensity: 0.03,
    mushroomDensity: 0.02,
    treeKinds: ['oak', 'birch', 'pine'],
  },
  warps: [
    { x: 23, y: 0, targetMap: 'ruta_1', targetX: 23, targetY: 53, dir: 'up' },
    { x: 24, y: 0, targetMap: 'ruta_1', targetX: 24, targetY: 53, dir: 'up' },
  ],
  npcs: [
    {
      id: 'prof_robledo',
      name: 'Prof. Robledo',
      role: 'professor',
      x: 19,
      y: 19,
      dir: 'down',
      dialogKey: 'prof_welcome',
      healOnTalk: true,
    },
    {
      id: 'starter_0',
      name: 'Soulpot Brasa',
      role: 'npc',
      x: 25,
      y: 19,
      dir: 'down',
      dialogKey: 'starter_prompt',
      starterIndex: 0,
      flagHidden: 'starter_chosen',
    },
    {
      id: 'starter_1',
      name: 'Soulpot Marea',
      role: 'npc',
      x: 26,
      y: 19,
      dir: 'down',
      dialogKey: 'starter_prompt',
      starterIndex: 1,
      flagHidden: 'starter_chosen',
    },
    {
      id: 'starter_2',
      name: 'Soulpot Flora',
      role: 'npc',
      x: 27,
      y: 19,
      dir: 'down',
      dialogKey: 'starter_prompt',
      starterIndex: 2,
      flagHidden: 'starter_chosen',
    },
    {
      id: 'aldeano_origen',
      name: 'Vecina Alba',
      role: 'npc',
      x: 16,
      y: 26,
      dir: 'right',
      dialogKey: 'villager_origen',
    },
  ],
  signs: [{ x: 22, y: 18, textKey: 'sign_origen' }],
};
