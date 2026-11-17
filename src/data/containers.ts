import type { BodyContainerDef, CreatureType, DollWeaponKind } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export const SHARDS_PER_CONTAINER = 5;

export const BODY_CONTAINERS: Record<string, BodyContainerDef> = {
  cuerpo_aprendiz: {
    id: 'cuerpo_aprendiz',
    name: 'Cuerpo Madera Ki',
    rarity: 'common',
    price: 350,
    affinityTypes: ['comun', 'brisa'],
    ratios: { head: 20, torso: 40, arms: 20, legs: 20 },
    description: 'Armazón equilibrado de madera tallada para cualquier alma.',
    accentColor: PALETTE.oldBronze,
  },
  cuerpo_maga: {
    id: 'cuerpo_maga',
    name: 'Armazón de Maga',
    rarity: 'common',
    price: 750,
    affinityTypes: ['brasa', 'chispa'],
    ratios: { head: 30, torso: 35, arms: 20, legs: 15 },
    description: 'Cuerpo rúnico que concentra el Ki en la cabeza y canaliza hechizos.',
    accentColor: PALETTE.coralRed,
  },
  cuerpo_priest: {
    id: 'cuerpo_priest',
    name: 'Relicario Priest',
    rarity: 'common',
    price: 750,
    affinityTypes: ['flora', 'marea'],
    ratios: { head: 25, torso: 40, arms: 15, legs: 20 },
    description: 'Contenedor sagrado de torso robusto y gran flujo vital.',
    accentColor: PALETTE.emerald,
  },
  cuerpo_paladin: {
    id: 'cuerpo_paladin',
    name: 'Armadura Paladín',
    rarity: 'rare',
    price: 1200,
    affinityTypes: ['roca', 'brasa'],
    ratios: { head: 15, torso: 45, arms: 25, legs: 15 },
    description: 'Cuerpo acorazado con torso y brazos reforzados para combate físico.',
    accentColor: PALETTE.tarnishedGold,
  },
  cuerpo_bruja: {
    id: 'cuerpo_bruja',
    name: 'Maniquí Witch',
    rarity: 'rare',
    price: 1100,
    affinityTypes: ['comun', 'umbra'],
    ratios: { head: 28, torso: 32, arms: 22, legs: 18 },
    description: 'Estructura arcana neutral ideal para almas de bruja y sombra.',
    accentColor: PALETTE.soulViolet,
  },
  cuerpo_asesina: {
    id: 'cuerpo_asesina',
    name: 'Bastidor Céfiro',
    rarity: 'rare',
    price: 1150,
    affinityTypes: ['brisa', 'chispa', 'marea'],
    ratios: { head: 18, torso: 32, arms: 25, legs: 25 },
    description: 'Cuerpo ligero con extremidades ágiles de alta movilidad.',
    accentColor: PALETTE.kiCyan,
  },
  cuerpo_titan: {
    id: 'cuerpo_titan',
    name: 'Coloso de Obsidiana',
    rarity: 'epic',
    price: 2200,
    affinityTypes: ['roca', 'umbra'],
    ratios: { head: 15, torso: 50, arms: 20, legs: 15 },
    description: 'Cuerpo contenedor legendario cuyo torso absorbe impactos masivos.',
    accentColor: PALETTE.resonantGold,
  },
  cuerpo_automata: {
    id: 'cuerpo_automata',
    name: 'Autómata de Bronce',
    rarity: 'rare',
    price: 1450,
    affinityTypes: ['chispa', 'roca', 'comun'],
    ratios: { head: 22, torso: 42, arms: 22, legs: 14 },
    description: 'Obra maestra del taller con articulaciones de latón y núcleo equilibrado.',
    accentColor: PALETTE.brightBrass,
  },
};

export const ALL_CONTAINER_IDS = Object.keys(BODY_CONTAINERS);

export function getBodyContainer(id: string): BodyContainerDef {
  return BODY_CONTAINERS[id] ?? BODY_CONTAINERS.cuerpo_aprendiz;
}

export function getDefaultContainerForTypes(types: readonly CreatureType[]): string {
  const primary = types[0];
  switch (primary) {
    case 'brasa':
      return 'cuerpo_maga';
    case 'flora':
      return 'cuerpo_priest';
    case 'roca':
      return 'cuerpo_paladin';
    case 'comun':
      return 'cuerpo_bruja';
    case 'brisa':
    case 'marea':
    case 'chispa':
      return 'cuerpo_asesina';
    case 'umbra':
      return 'cuerpo_bruja';
    default:
      return 'cuerpo_aprendiz';
  }
}

export interface DollProfile {
  className: string;
  weapon: DollWeaponKind;
  weaponName: string;
}

const WEAPON_LABELS: Record<DollWeaponKind, string> = {
  staff: 'Báculo Ígneo',
  scepter: 'Cayado Sagrado',
  sword_shield: 'Espada y Escudo',
  wand: 'Varita Arcana',
  trident: 'Tridente Abisal',
  spear: 'Lanza Voltaica',
  daggers: 'Dagas Gemelas',
  scythe: 'Guadaña Espectral',
  hammer: 'Martillo Rúnico',
  bow: 'Arco de Viento',
  grimoire: 'Grimorio Vivo',
  orb: 'Orbe de Ki',
};

const TYPE_WEAPONS: Record<CreatureType, readonly DollWeaponKind[]> = {
  brasa: ['staff', 'orb', 'sword_shield'],
  flora: ['scepter', 'wand', 'bow'],
  roca: ['sword_shield', 'hammer', 'spear'],
  comun: ['wand', 'grimoire', 'orb'],
  marea: ['trident', 'scepter', 'orb'],
  chispa: ['spear', 'orb', 'daggers'],
  brisa: ['daggers', 'bow', 'wand'],
  umbra: ['scythe', 'grimoire', 'daggers'],
};

const TYPE_CLASSES: Record<CreatureType, string> = {
  brasa: 'Maga',
  flora: 'Priest',
  roca: 'Paladín',
  comun: 'Witch',
  marea: 'Corsaria',
  chispa: 'Monje Ki',
  brisa: 'Céfira',
  umbra: 'Segadora',
};

export function getSpeciesDollProfile(
  speciesId: number,
  types: readonly CreatureType[],
  explicitClass?: string,
  explicitWeapon?: DollWeaponKind
): DollProfile {
  const primary = types[0];
  const weaponPool = TYPE_WEAPONS[primary];
  const weapon = explicitWeapon ?? weaponPool[speciesId % weaponPool.length];
  const className = explicitClass ?? TYPE_CLASSES[primary];
  return {
    className,
    weapon,
    weaponName: WEAPON_LABELS[weapon],
  };
}
