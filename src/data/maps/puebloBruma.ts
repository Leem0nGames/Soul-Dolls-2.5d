import type { MapDef } from '../../domain/types.ts';
import { hexToNumber, PALETTE } from '../../gfx/Palette.ts';
import {
  addHill,
  addPerimeterMountains,
  carveRoad,
  createZoneCanvas,
  DEFAULT_LEGEND,
  fillRect,
  finalizeZone,
} from './mapBuilder.ts';

function buildPuebloBruma() {
  const z = createZoneCanvas(48, 48, '.', 1);

  addPerimeterMountains(z, 5, 7, '#');
  addHill(z, 10, 10, 7, 3);
  addHill(z, 38, 10, 7, 3);

  // Lower promenade terrace (height 1)
  fillRect(z, 12, 30, 24, 13, '=', 1);
  // Mid plaza terrace (height 3) with Healing Center & Shop
  fillRect(z, 10, 16, 28, 14, '=', 3);
  // Stairs connecting height 1 -> height 3
  fillRect(z, 23, 29, 2, 2, '^', 2);

  // Upper lookout terrace (height 5)
  fillRect(z, 14, 7, 20, 8, '=', 5);
  fillRect(z, 23, 15, 2, 2, '^', 4);

  // South warp road -> Ruta 1
  carveRoad(z, 23, 30, 23, 47, 2, '=', 1);
  // East warp road -> Ruta 2 (step down smoothly from plaza 3 -> 2)
  carveRoad(z, 36, 23, 47, 23, 2, '=', 2);
  fillRect(z, 37, 23, 2, 2, '^', 2);

  // Water canal & flowers
  fillRect(z, 12, 33, 6, 4, '~', 0);
  fillRect(z, 30, 33, 5, 4, '*', 1);

  return finalizeZone(z);
}

const built = buildPuebloBruma();

export const MAP_PUEBLO_BRUMA: MapDef = {
  id: 'pueblo_bruma',
  nameKey: 'pueblo_bruma',
  biome: 'forest',
  music: 'town',
  skyTopColor: hexToNumber(PALETTE.deepAbyss),
  skyBottomColor: hexToNumber(PALETTE.iceCyan),
  fogColor: hexToNumber(PALETTE.frostedGlass),
  snowLine: 8,
  grid: built.grid,
  heights: built.heights,
  legend: DEFAULT_LEGEND,
  buildings: [
    { kind: 'center', x: 13, z: 17, width: 5, depth: 4, facing: 'down' },
    { kind: 'shop', x: 30, z: 17, width: 5, depth: 4, facing: 'down' },
    { kind: 'house_blue', x: 16, z: 8, width: 4, depth: 3, facing: 'down' },
    { kind: 'house_red', x: 28, z: 8, width: 4, depth: 3, facing: 'down' },
  ],
  props: [
    { kind: 'well', x: 23, z: 23 },
    { kind: 'lamp_double', x: 19, z: 22 },
    { kind: 'lamp_double', x: 28, z: 22 },
    { kind: 'lamp_post', x: 22, z: 38 },
    { kind: 'lamp_post', x: 26, z: 38 },
    { kind: 'lamp_wood', x: 36, z: 22 },
    { kind: 'lamp_wood', x: 36, z: 25 },
    { kind: 'lamp_stone', x: 21, z: 12 },
    { kind: 'lamp_stone', x: 26, z: 12 },
    { kind: 'bench', x: 20, z: 26 },
    { kind: 'bench', x: 27, z: 26 },
    { kind: 'flower_patch', x: 12, z: 22 },
    { kind: 'flower_patch', x: 35, z: 21 },
    { kind: 'mushroom_tree', x: 11, z: 28 },
    { kind: 'mushroom_tree_arcane', x: 36, z: 28 },
  ],
  decoration: {
    seed: 303,
    treeDensity: 0.12,
    bushDensity: 0.08,
    flowerDensity: 0.08,
    rockDensity: 0.03,
    mushroomDensity: 0.02,
    treeKinds: ['oak', 'birch', 'mushroom_tree'],
  },
  warps: [
    { x: 23, y: 47, targetMap: 'ruta_1', targetX: 23, targetY: 2, dir: 'down' },
    { x: 24, y: 47, targetMap: 'ruta_1', targetX: 24, targetY: 2, dir: 'down' },
    { x: 47, y: 23, targetMap: 'ruta_2', targetX: 2, targetY: 24, dir: 'right' },
    { x: 47, y: 24, targetMap: 'ruta_2', targetX: 2, targetY: 25, dir: 'right' },
  ],
  npcs: [
    {
      id: 'healer_clara',
      name: 'Enfermera Clara',
      role: 'healer',
      x: 15,
      y: 22,
      dir: 'down',
      dialogKey: 'healer_clara',
      healOnTalk: true,
    },
    {
      id: 'merchant_mateo',
      name: 'Mercader Mateo',
      role: 'merchant',
      x: 32,
      y: 22,
      dir: 'down',
      dialogKey: 'merchant_mateo',
      shopStock: [
        'pocion',
        'superpocion',
        'hiperpocion',
        'antidoto',
        'despertar',
        'antiparalizador',
        'revivir',
        'capsula',
        'supercapsula',
        'ultracapsula',
        'piedra_chispa',
        'piedra_brasa',
        'piedra_flora',
        'repelente',
        'cuerda_huida',
        'fragmento_alma',
      ],
    },
    {
      id: 'bruma_npc_1',
      name: 'Sabio Tomás',
      role: 'npc',
      x: 24,
      y: 12,
      dir: 'down',
      dialogKey: 'villager_bruma_1',
    },
    {
      id: 'bruma_npc_2',
      name: 'Guía Nora',
      role: 'npc',
      x: 39,
      y: 22,
      dir: 'left',
      dialogKey: 'villager_bruma_2',
    },
  ],
  signs: [{ x: 21, y: 31, textKey: 'sign_bruma' }],
};
