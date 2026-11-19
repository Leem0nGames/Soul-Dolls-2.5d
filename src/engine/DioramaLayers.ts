import * as THREE from 'three';
import type { BattleBiome } from '../domain/types.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import { PALETTE } from '../gfx/Palette.ts';

export const DIORAMA_RENDER_ORDER = {
  TERRAIN_BASE: 0,
  STAIRCASE: 1,
  SHADOW_DECAL: 1,
  CLIFF_ORNAMENT: 2,
  WATER_SURFACE: 3,
  ATMOSPHERE_GLOW: 4,
  ATMOSPHERE_PARTICLE: 5,
} as const;

export type CliffDirection = 'north' | 'south' | 'west' | 'east';

export interface CliffBoundary {
  x: number;
  z: number;
  nx: number;
  nz: number;
  face: CliffDirection;
  topLevel: number;
  bottomLevel: number;
  yTop: number;
  yBottom: number;
  topTile: TileAtlasKey;
  cliffTile: TileAtlasKey;
}

export interface CliffWeatheringProfile {
  edgeColor: THREE.Color;
  secondaryColor: THREE.Color;
  strength: number;
  edgeBandHeight: number;
}

export function getBiomeCliffWeathering(biome: BattleBiome): CliffWeatheringProfile {
  switch (biome) {
    case 'forest':
      return {
        edgeColor: new THREE.Color(PALETTE.emerald),
        secondaryColor: new THREE.Color(PALETTE.forestGreen),
        strength: 0.58,
        edgeBandHeight: 0.42,
      };
    case 'mountain':
      return {
        edgeColor: new THREE.Color(PALETTE.stoneHighlight),
        secondaryColor: new THREE.Color(PALETTE.tarnishedGold),
        strength: 0.46,
        edgeBandHeight: 0.36,
      };
    case 'snow':
      return {
        edgeColor: new THREE.Color(PALETTE.frostedGlass),
        secondaryColor: new THREE.Color(PALETTE.iceCyan),
        strength: 0.65,
        edgeBandHeight: 0.44,
      };
    case 'cave':
      return {
        edgeColor: new THREE.Color(PALETTE.etherealOrchid),
        secondaryColor: new THREE.Color(PALETTE.deepAmethyst),
        strength: 0.52,
        edgeBandHeight: 0.40,
      };
    case 'arena':
      return {
        edgeColor: new THREE.Color(PALETTE.resonantGold),
        secondaryColor: new THREE.Color(PALETTE.oldBronze),
        strength: 0.42,
        edgeBandHeight: 0.34,
      };
    case 'coast':
      return {
        edgeColor: new THREE.Color(PALETTE.sandDesert),
        secondaryColor: new THREE.Color(PALETTE.vibrantAqua),
        strength: 0.48,
        edgeBandHeight: 0.36,
      };
    case 'meadow':
    default:
      return {
        edgeColor: new THREE.Color(PALETTE.moss),
        secondaryColor: new THREE.Color(PALETTE.oliveDrab),
        strength: 0.46,
        edgeBandHeight: 0.38,
      };
  }
}
