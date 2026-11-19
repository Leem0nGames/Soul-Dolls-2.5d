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

function buildCrystalCavern() {
  const z = createZoneCanvas(48, 48, 'stone', 2);

  addPerimeterMountains(z, 6, 8, '#');
  addHill(z, 12, 18, 8, 8, '#');
  addHill(z, 34, 18, 8, 8, '#');

  // Crystal pathing
  carveRoad(z, 23, 47, 23, 24, 2, 'cobble', 2);
  carveRoad(z, 23, 24, 23, 0, 2, 'cobble', 3);

  // Floating crystal chambers
  fillRect(z, 14, 20, 8, 8, 'sand', 2);
  fillRect(z, 28, 20, 8, 8, 'sand', 2);
  fillRect(z, 18, 8, 12, 8, 'sand', 3);

  carveMapPass(z, {
    x: 23,
    y: 47,
    exitDir: 'south',
    roadTile: 'cobble',
    height: 2,
    depth: 6,
    shoulderWidth: 2,
    slopeWidth: 3,
    shoulderTile: 'stone',
  });
  carveMapPass(z, {
    x: 23,
    y: 0,
    exitDir: 'north',
    roadTile: 'cobble',
    height: 3,
    depth: 6,
    shoulderWidth: 2,
    slopeWidth: 3,
    shoulderTile: 'stone',
  });

  return finalizeZone(z);
}

const built = buildCrystalCavern();

export const MAP_CRYSTAL_CAVERN: MapDef = {
  id: 'crystal_cavern',
  nameKey: 'crystal_cavern',
  biome: 'cave',
  music: 'cave',
  isInterior: false,
  skyTopColor: hexToNumber(PALETTE.abyssInk),
  skyBottomColor: hexToNumber(PALETTE.nightshade),
  fogColor: hexToNumber(PALETTE.cryptInk),
  grid: built.grid,
  heights: built.heights,
  legend: DEFAULT_LEGEND,
  buildings: [],
  props: [
    { kind: 'crystal', x: 16, y: 22 } as any,
    { kind: 'crystal', x: 30, y: 22 } as any,
    { kind: 'crystal', x: 22, y: 12 } as any,
    { kind: 'crystal', x: 24, y: 12 } as any,
    { kind: 'lamp_double', x: 20, y: 30 } as any,
    { kind: 'lamp_double', x: 26, y: 30 } as any,
  ],
  decoration: {
    seed: 999,
    treeDensity: 0,
    bushDensity: 0,
    flowerDensity: 0.1,
    rockDensity: 0.2,
    mushroomDensity: 0.1,
    treeKinds: [],
  },
  warps: [
    { x: 23, y: 47, targetMap: 'cueva_eco', targetX: 23, targetY: 2, dir: 'down' },
    { x: 24, y: 47, targetMap: 'cueva_eco', targetX: 24, targetY: 2, dir: 'down' },
    { x: 23, y: 0, targetMap: 'arena_cumbre', targetX: 23, targetY: 45, dir: 'up' },
    { x: 24, y: 0, targetMap: 'arena_cumbre', targetX: 24, targetY: 45, dir: 'up' },
  ],
  npcs: [
    {
      id: 'npc_crystal_scholar',
      name: 'Investigadora Iris',
      role: 'scholar',
      x: 23,
      y: 25,
      dir: 'down',
      dialogKey: 'scholar',
      sightRange: 3,
    },
  ],
  signs: [{ x: 22, y: 44, textKey: 'sign_crystal' }],
  pickups: [
    { id: 'crystal_gem_pickup', x: 20, y: 14, itemId: 'gema_poder', quantity: 2 },
  ],
  encounters: ENCOUNTERS.cueva_eco,
};
