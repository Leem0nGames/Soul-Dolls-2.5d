import type { MapDef } from '../../domain/types.ts';
import { hexToNumber, PALETTE } from '../../gfx/Palette.ts';
import { INTERIOR_LEGEND } from './houseInteriors.ts';

const tallerGrid = [
  '#########################',
  '#KKKKKKpppppppppp#pppppp#',
  '#KKKKKKpppppppppp#pppppp#',
  '#KKKKKKppRRRRRRpp#pRRRRp#',
  '#KKKKKKppRRRRRRppppRRRRp#',
  '#KKKKKKppRRRRRRppppRRRRp#',
  '#KKKKKKppRRRRRRppppRRRRp#',
  '#KKKKKKppRRRRRRppppRRRRp#',
  '#KKKKKKpppppppppp#pRRRRp#',
  '#pppppppppppppppp#pppppp#',
  '#pppppppppppppppp#pppppp#',
  '#pppppppDDppppppp#pppppp#',
  '#########################',
];

const tallerHeights = tallerGrid.map((row) => '1'.repeat(row.length));

export const MAP_TALLER_ORIGEN: MapDef = {
  id: 'taller_origen',
  nameKey: 'taller_origen',
  biome: 'meadow',
  music: 'town',
  isInterior: true,
  skyTopColor: hexToNumber(PALETTE.abyssInk),
  skyBottomColor: hexToNumber(PALETTE.cryptInk),
  fogColor: hexToNumber(PALETTE.abyssInk),
  grid: tallerGrid,
  heights: tallerHeights,
  legend: INTERIOR_LEGEND,
  buildings: [],
  props: [
    // Zona izquierda: Fragua de hierro y bronce + Yunque de Templado
    { kind: 'lamp_wood', x: 1, z: 1 },
    { kind: 'forge_hearth', x: 2, z: 1 },
    { kind: 'anvil_bench', x: 4, z: 3 },
    // Zona central: Escritorio de Planos y Biblioteca Técnica
    { kind: 'blueprint_desk', x: 7, z: 1 },
    { kind: 'bookshelf', x: 9, z: 1 },
    // Zona derecha: Mesa de Ensamblaje de Marionetas, Maniquíes y Cristales Ki
    { kind: 'doll_worktable', x: 11, z: 3 },
    { kind: 'mannequin_rack', x: 15, z: 1 },
    { kind: 'lamp_wood', x: 16, z: 1 },
    { kind: 'capsule_pedestal', x: 15, z: 4 },
    { kind: 'crystal', x: 15, z: 7 },
    { kind: 'house_plant', x: 1, z: 10 },
    { kind: 'house_plant', x: 16, z: 10 },
    // Ala Este: Códice de Habilidades, Altar de Técnicas y Arena de Entrenamiento
    { kind: 'bookshelf', x: 18, z: 1 },
    { kind: 'skill_altar', x: 20, z: 2 },
    { kind: 'crystal', x: 22, z: 1 },
    { kind: 'training_dummy', x: 22, z: 6 },
    { kind: 'house_plant', x: 18, z: 10 },
    { kind: 'lamp_stone', x: 23, z: 10 },
  ],
  decoration: {
    seed: 715,
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
      targetMap: 'villa_origen',
      targetX: 30,
      targetY: 18,
      dir: 'down',
      doorStyle: 'interior',
    },
    {
      x: 9,
      y: 11,
      targetMap: 'villa_origen',
      targetX: 31,
      targetY: 18,
      dir: 'down',
      doorStyle: 'interior',
    },
  ],
  npcs: [
    {
      id: 'artesano_gael',
      name: 'Artesano Gael',
      role: 'artisan',
      x: 5,
      y: 4,
      dir: 'down',
      dialogKey: 'artesano_gael',
      lookAtPlayerAfterTalk: true,
    },
    {
      id: 'taller_asistente_iris',
      name: 'Forjadora Iris',
      role: 'healer',
      x: 12,
      y: 5,
      dir: 'left',
      dialogKey: 'iris_workshop_greeting',
      lookAtPlayerAfterTalk: true,
    },
    {
      id: 'taller_maestra_lyra',
      name: 'Maestra Lyra',
      role: 'scholar',
      x: 19,
      y: 5,
      dir: 'left',
      dialogKey: 'lyra_workshop_greeting',
      lookAtPlayerAfterTalk: true,
    },
  ],
  signs: [],
};
