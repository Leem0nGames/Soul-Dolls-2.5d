import { ALL_HOUSES, type HouseDef } from '../../domain/Housing.ts';
import type { MapDef, TileLegendEntry } from '../../domain/types.ts';
import { hexToNumber, PALETTE } from '../../gfx/Palette.ts';
import { DEFAULT_LEGEND } from './mapBuilder.ts';

export const INTERIOR_LEGEND: Record<string, TileLegendEntry> = {
  ...DEFAULT_LEGEND,
  p: { tile: 'planks', solid: false },
  K: { tile: 'stone', solid: false },
  R: { tile: 'arena_floor', solid: false },
  D: { tile: 'bridge', solid: false },
};

function makeInteriorPair(house: HouseDef): [MapDef, MapDef] {
  // Floor 1 (Planta Baja): Sala de Estar (left/center) + Cocina (right) + Escalera (top-right)
  const pbGrid = [
    '##################',
    '#ppppppppppKKKKKK#',
    '#ppppppppppKKKK^K#',
    '#ppRRRRRRppKKKKKK#',
    '#ppRRRRRRppKKKKKK#',
    '#ppRRRRRRppKKKKKK#',
    '#ppRRRRRRppKKKKKK#',
    '#ppRRRRRRppKKKKKK#',
    '#ppppppppppKKKKKK#',
    '#ppppppppppKKKKKK#',
    '#ppppppppppKKKKKK#',
    '#pppppppDDppppppp#',
    '##################',
  ];
  const pbHeights = pbGrid.map((row) => '1'.repeat(row.length));

  const floor1: MapDef = {
    id: house.floor1MapId,
    nameKey: house.floor1MapId,
    biome: 'meadow',
    music: 'town',
    isInterior: true,
    skyTopColor: hexToNumber(PALETTE.abyssInk),
    skyBottomColor: hexToNumber(PALETTE.cryptInk),
    fogColor: hexToNumber(PALETTE.abyssInk),
    grid: pbGrid,
    heights: pbHeights,
    legend: INTERIOR_LEGEND,
    buildings: [],
    props: [
      // Sala de Estar: Pared de Logros, Cofre, Libreros, Sofá, Mesita y Plantas
      { kind: 'bookshelf', x: 2, z: 1 },
      { kind: 'achievements_wall', x: 5, z: 1 },
      { kind: 'bookshelf', x: 8, z: 1 },
      { kind: 'chest', x: 2, z: 4 },
      { kind: 'sofa', x: 5, z: 5 },
      { kind: 'dining_table', x: 5, z: 7 },
      { kind: 'house_plant', x: 1, z: 10 },
      { kind: 'house_plant', x: 16, z: 10 },
      // Separador Cocina / Barra
      { kind: 'kitchen_counter', x: 10, z: 5 },
      { kind: 'kitchen_counter', x: 10, z: 6 },
      // Cocina: Estufa, Encimeras, Comedor y Escalera arriba
      { kind: 'stove', x: 11, z: 1 },
      { kind: 'kitchen_counter', x: 12, z: 1 },
      { kind: 'kitchen_counter', x: 13, z: 1 },
      { kind: 'dining_table', x: 13, z: 6 },
      { kind: 'bench', x: 13, z: 7 },
      { kind: 'stair_up', x: 15, z: 1 },
    ],
    decoration: {
      seed: 700,
      treeDensity: 0,
      bushDensity: 0,
      flowerDensity: 0,
      rockDensity: 0,
      mushroomDensity: 0,
      treeKinds: [],
    },
    warps: [
      {
        x: 8,
        y: 11,
        targetMap: house.cityMapId,
        targetX: house.exteriorDoorX,
        targetY: house.exteriorDoorY + 1,
        dir: 'down',
        doorStyle: 'interior',
      },
      {
        x: 9,
        y: 11,
        targetMap: house.cityMapId,
        targetX: house.exteriorDoorX,
        targetY: house.exteriorDoorY + 1,
        dir: 'down',
        doorStyle: 'interior',
      },
      {
        x: 15,
        y: 2,
        targetMap: house.floor2MapId,
        targetX: 11,
        targetY: 3,
        dir: 'left',
        doorStyle: 'interior',
      },
    ],
    npcs: [],
    signs: [],
  };

  // Floor 2 (Planta Alta / Habitación): Cama (curar equipo), Cofre, Librero, Escalera de bajada
  const habGrid = [
    '##############',
    '#pppppppppppp#',
    '#pRRRRRRppp^p#',
    '#pRRRRRRppppp#',
    '#pRRRRRRppppp#',
    '#pRRRRRRppppp#',
    '#pRRRRRRppppp#',
    '#pppppppppppp#',
    '#pppppppppppp#',
    '##############',
  ];
  const habHeights = habGrid.map((row) => '1'.repeat(row.length));

  const floor2: MapDef = {
    id: house.floor2MapId,
    nameKey: house.floor2MapId,
    biome: 'meadow',
    music: 'town',
    isInterior: true,
    skyTopColor: hexToNumber(PALETTE.abyssInk),
    skyBottomColor: hexToNumber(PALETTE.cryptInk),
    fogColor: hexToNumber(PALETTE.abyssInk),
    grid: habGrid,
    heights: habHeights,
    legend: INTERIOR_LEGEND,
    buildings: [],
    props: [
      { kind: 'house_plant', x: 1, z: 1 },
      { kind: 'bed', x: 3, z: 3 },
      { kind: 'dining_table', x: 5, z: 3 },
      { kind: 'bookshelf', x: 6, z: 1 },
      { kind: 'chest', x: 9, z: 1 },
      { kind: 'stair_down', x: 11, z: 1 },
      { kind: 'sofa', x: 6, z: 6 },
      { kind: 'house_plant', x: 1, z: 7 },
    ],
    decoration: {
      seed: 701,
      treeDensity: 0,
      bushDensity: 0,
      flowerDensity: 0,
      rockDensity: 0,
      mushroomDensity: 0,
      treeKinds: [],
    },
    warps: [
      {
        x: 11,
        y: 2,
        targetMap: house.floor1MapId,
        targetX: 15,
        targetY: 3,
        dir: 'down',
        doorStyle: 'interior',
      },
    ],
    npcs: [],
    signs: [],
  };

  return [floor1, floor2];
}

export const HOUSE_INTERIOR_MAPS: Record<string, MapDef> = {};
for (const house of ALL_HOUSES) {
  const [f1, f2] = makeInteriorPair(house);
  HOUSE_INTERIOR_MAPS[f1.id] = f1;
  HOUSE_INTERIOR_MAPS[f2.id] = f2;
}
