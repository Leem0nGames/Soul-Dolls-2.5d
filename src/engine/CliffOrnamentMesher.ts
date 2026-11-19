import type * as THREE from 'three';
import type { BattleBiome, MapDef } from '../domain/types.ts';
import type { CliffBoundary } from './DioramaLayers.ts';
import {
  buildProceduralOverhangsGroup,
  createOverhangAssetSheet,
  createOverhangMaterial,
  createOverhangTexturePair,
  generateCliffOverhangPlan,
  type OverhangAssetKind,
  type OverhangPlacement,
} from './ProceduralOverhangGenerator.ts';

export type CliffOrnamentKind = OverhangAssetKind;
export type CliffOrnamentPlacement = OverhangPlacement;

export function planCliffOrnaments(
  map: MapDef,
  boundaries?: readonly CliffBoundary[]
): CliffOrnamentPlacement[] {
  return generateCliffOverhangPlan(map, boundaries);
}

export function createCliffOrnamentTexture(): THREE.Texture {
  return createOverhangAssetSheet();
}

export function createCliffOrnamentTexturePair(): {
  map: THREE.Texture;
  normalMap: THREE.Texture;
} {
  return createOverhangTexturePair();
}

export function createCliffOrnamentMaterial(
  texture: THREE.Texture,
  normalTexture?: THREE.Texture,
  biome: BattleBiome = 'meadow',
  isCave = false
): THREE.MeshStandardMaterial {
  return createOverhangMaterial(texture, normalTexture, biome, isCave);
}

export function buildCliffOrnamentsMesh(
  map: MapDef,
  material?: THREE.Material
): THREE.Group | null {
  return buildProceduralOverhangsGroup(map, material);
}
