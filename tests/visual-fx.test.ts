import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import type { BattleBiome } from '../src/domain/types.ts';
import { BattlePostFx, ImpactShockwaveShader } from '../src/engine/BattlePostFx.ts';
import { createBattleSpriteMaterial } from '../src/engine/BattleSpriteMat.ts';
import {
  buildInstancedPropBatches,
  createBottomPivotPlaneGeometry,
  createLitBillboardMaterial,
} from '../src/engine/BillboardBatch.ts';
import { DioramaGradeShader, getBiomeVisualProfile } from '../src/engine/BiomeGradeShader.ts';
import { buildBuildingsMesh } from '../src/engine/BuildingMesher.ts';
import { DisposableRegistry } from '../src/engine/Disposables.ts';
import { OverworldAtmosphere } from '../src/engine/OverworldAtmosphere.ts';
import { buildTerrainBorderApron, buildTerrainChunks } from '../src/engine/TerrainMesher.ts';
import { WaterSurface } from '../src/engine/WaterSurface.ts';
import type { AssetProvider } from '../src/gfx/AssetProvider.ts';

const ALL_BIOMES: BattleBiome[] = [
  'meadow',
  'forest',
  'cave',
  'mountain',
  'snow',
  'coast',
  'arena',
];

describe('Visual FX & HD-2D Pipeline', () => {
  it('returns finite, balanced biome visual profiles for every biome and mode', () => {
    for (const biome of ALL_BIOMES) {
      const overworld = getBiomeVisualProfile(biome, { isBattle: false });
      const battle = getBiomeVisualProfile(biome, { isBattle: true });
      const interior = getBiomeVisualProfile(biome, { isInterior: true });
      const boss = getBiomeVisualProfile(biome, { isBoss: true, isBattle: true });

      for (const p of [overworld, battle, interior, boss]) {
        expect(Number.isFinite(p.contrast)).toBe(true);
        expect(Number.isFinite(p.saturation)).toBe(true);
        expect(Number.isFinite(p.vignette)).toBe(true);
        expect(Number.isFinite(p.tiltStrength)).toBe(true);
        expect(p.contrast).toBeGreaterThan(0.9);
        expect(p.saturation).toBeGreaterThan(0.9);
        expect(p.focusSpan).toBeGreaterThan(0.1);
        expect(p.tint.x).toBeGreaterThan(0.5);
        expect(p.tint.y).toBeGreaterThan(0.5);
        expect(p.tint.z).toBeGreaterThan(0.5);
      }

      expect(overworld.focusY).toBeCloseTo(0.44);
      expect(battle.focusY).toBeCloseTo(0.56);
      expect(boss.vignette).toBeGreaterThan(overworld.vignette);
    }
  });

  it('exposes complete DioramaGradeShader and ImpactShockwaveShader uniforms', () => {
    expect(DioramaGradeShader.uniforms.uTiltStrength.value).toBeGreaterThan(0);
    expect(DioramaGradeShader.uniforms.uGradeMix.value).toBe(1);
    expect(DioramaGradeShader.fragmentShader).toContain('sampleTiltShift');
    expect(DioramaGradeShader.fragmentShader).toContain('applyFilmicGrade');
    expect(DioramaGradeShader.fragmentShader).toContain('uGradeMix');

    expect(ImpactShockwaveShader.uniforms.uTiltStrength.value).toBeGreaterThan(0);
    expect(ImpactShockwaveShader.uniforms.uGradeMix.value).toBe(1);
    expect(ImpactShockwaveShader.uniforms.uTint.value).toBeInstanceOf(THREE.Vector3);
    expect(ImpactShockwaveShader.uniforms.uImpactTint.value).toBeInstanceOf(THREE.Vector3);
    expect(ImpactShockwaveShader.uniforms.uImpactFlash.value).toBe(0);
    expect(ImpactShockwaveShader.uniforms.uSpeedLines.value).toBe(0);
    expect(ImpactShockwaveShader.uniforms.uRefractionMix.value).toBe(0);
    expect(ImpactShockwaveShader.fragmentShader).toContain('radialBlur');
    expect(ImpactShockwaveShader.fragmentShader).toContain('uSpeedLines');
    expect(ImpactShockwaveShader.fragmentShader).toContain('uImpactFlash');
    expect(ImpactShockwaveShader.fragmentShader).toContain('tRefraction');
    expect(ImpactShockwaveShader.fragmentShader).toContain('uGradeMix');
    expect(typeof BattlePostFx).toBe('function');
  });

  it('builds OverworldAtmosphere with contact shadows, glow halos, shafts, and particles in Node', () => {
    const disposables = new DisposableRegistry();
    const scene = new THREE.Scene();
    const villa = MAPS.villa_origen;

    const atmo = new OverworldAtmosphere(
      scene,
      disposables,
      villa,
      [
        { kind: 'oak', x: 4, y: 0, z: 4, scale: 1 },
        { kind: 'lamp_post', x: 6, y: 0, z: 6, scale: 1 },
        { kind: 'crystal', x: 8, y: 0, z: 8, scale: 1 },
      ],
      [{ kind: 'lamp_stone', x: 10, y: 0, z: 10 }]
    );

    const actorShadow = atmo.createActorShadow(0.76);
    expect(actorShadow).toBeInstanceOf(THREE.Mesh);
    expect(actorShadow.renderOrder).toBe(1);

    atmo.spawnStepPuff(7, 0, 7, 'grass');
    atmo.spawnStepPuff(8, 0, 8, 'dust');
    atmo.spawnStepPuff(9, 0, 9, 'snow');
    atmo.update(0.016, 6.2, 0, 6.2, 0, 'high', true);

    const pointLights = scene.children.filter(
      (c): c is THREE.PointLight => c instanceof THREE.PointLight
    );
    expect(pointLights).toHaveLength(2);
    expect(pointLights[0].intensity).toBeGreaterThan(0.5);

    const shaftGroup = scene.children.find((c): c is THREE.Group => c instanceof THREE.Group);
    const pointsChildren = scene.children.filter(
      (c): c is THREE.Points => c instanceof THREE.Points
    );
    expect(shaftGroup?.visible).toBe(true);
    expect(pointsChildren.every((p) => p.visible)).toBe(true);

    atmo.update(0.016, 6.2, 0, 6.2, 0, 'high', false);
    expect(shaftGroup?.visible).toBe(false);
    expect(pointsChildren.every((p) => !p.visible)).toBe(true);

    atmo.update(0.016, 14, 0, 14, 0.2, 'medium');
    atmo.update(0.016, 16, 0, 16, 0.4, 'low');
    expect(pointLights[0].intensity).toBe(0);

    // Prop shadows + glow mesh + 2 PointLights + step puffs + shaftGroup + particles
    expect(scene.children.length).toBe(7);
    disposables.disposeAll();
  });

  it('omits outdoor light shafts and weather particles inside house interiors', () => {
    const interiorMap = Object.values(MAPS).find((m) => m.isInterior);
    expect(interiorMap).toBeDefined();

    const disposables = new DisposableRegistry();
    const scene = new THREE.Scene();
    const atmo = new OverworldAtmosphere(
      scene,
      disposables,
      interiorMap!,
      [{ kind: 'heal_machine', x: 3, y: 0, z: 3, scale: 1 }],
      []
    );

    atmo.update(0.016, 5, 0, 5, 0, 'high');
    // Prop shadow + glow halo + 2 PointLights + step puffs; no shafts or particles indoors
    expect(scene.children.length).toBe(5);
    disposables.disposeAll();
  });

  it('builds cave god rays on cueva_eco without errors', () => {
    const disposables = new DisposableRegistry();
    const scene = new THREE.Scene();
    const atmo = new OverworldAtmosphere(scene, disposables, MAPS.cueva_eco, [], []);
    atmo.update(0.032, 10, 0, 10, 0, 'high');
    // Step puffs + shaftGroup + particles (no prop placements passed)
    expect(scene.children.length).toBe(3);
    disposables.disposeAll();
  });

  it('enables shadow receiving on terrain meshes and cast/receive on buildings', () => {
    const mat = new THREE.MeshStandardMaterial();
    const chunks = buildTerrainChunks(MAPS.villa_origen, mat);
    expect(chunks.length).toBeGreaterThan(0);
    for (const chunk of chunks) {
      expect(chunk.mesh.receiveShadow).toBe(true);
      chunk.mesh.geometry.dispose();
    }

    const apron = buildTerrainBorderApron(MAPS.villa_origen, mat);
    expect(apron).not.toBeNull();
    expect(apron!.receiveShadow).toBe(true);
    apron!.geometry.dispose();

    const buildings = buildBuildingsMesh(MAPS.villa_origen, mat);
    expect(buildings).not.toBeNull();
    let meshCount = 0;
    buildings!.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        meshCount++;
        expect(mesh.castShadow).toBe(true);
        expect(mesh.receiveShadow).toBe(true);
        mesh.geometry.dispose();
      }
    });
    expect(meshCount).toBeGreaterThan(0);
    mat.dispose();
  });

  it('builds animated WaterSurface with shoreline foam attributes for maps with water', () => {
    const disposables = new DisposableRegistry();
    const scene = new THREE.Scene();
    const water = new WaterSurface(scene, disposables, MAPS.pueblo_bruma);

    expect(water.mesh).not.toBeNull();
    const shoreAttr = water.mesh!.geometry.attributes.aShore;
    expect(shoreAttr).toBeDefined();
    expect(shoreAttr.count).toBeGreaterThan(0);

    water.update(0.016, 'high');
    water.update(0.016, 'low');

    // Interior map without water skips creating a mesh
    const interiorMap = Object.values(MAPS).find((m) => m.isInterior)!;
    const noWater = new WaterSurface(scene, disposables, interiorMap);
    expect(noWater.mesh).toBeNull();

    disposables.disposeAll();
  });

  it('creates lit billboards with upward normals, GPU wind hook, and cutout depth shadows', () => {
    const geo = createBottomPivotPlaneGeometry(2, 2, 1, 4);
    const normAttr = geo.attributes.normal;
    expect(normAttr.getX(0)).toBe(0);
    expect(normAttr.getY(0)).toBe(1);
    expect(normAttr.getZ(0)).toBe(0);

    const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const litMat = createLitBillboardMaterial(dummyTex, { windAmp: 0.05 });
    expect(litMat).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(litMat.customProgramCacheKey()).toContain('hd2d_wind');

    const fakeAssets = {
      getPropTexture: () => dummyTex,
    } as unknown as AssetProvider;

    const batches = buildInstancedPropBatches(
      [
        { kind: 'oak', x: 2, y: 0, z: 2, scale: 1 },
        { kind: 'flower_patch', x: 4, y: 0, z: 4, scale: 1 },
      ],
      fakeAssets
    );

    const oakBatch = batches.find((b) => b.kind === 'oak')!;
    const flowerBatch = batches.find((b) => b.kind === 'flower_patch')!;

    expect(oakBatch.mesh.castShadow).toBe(true);
    expect(oakBatch.mesh.receiveShadow).toBe(true);
    expect(oakBatch.mesh.customDepthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial);

    expect(flowerBatch.mesh.castShadow).toBe(false);
    expect(flowerBatch.mesh.receiveShadow).toBe(true);

    for (const b of batches) {
      b.mesh.geometry.dispose();
      (b.mesh.material as THREE.Material).dispose();
      (b.mesh.customDepthMaterial as THREE.Material | undefined)?.dispose();
    }
    geo.dispose();
    litMat.dispose();
    dummyTex.dispose();
  });

  it('includes subtle HD-2D silhouette rim highlight in BattleSpriteMat shader', () => {
    const dummyTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    const handle = createBattleSpriteMaterial(dummyTex);
    expect(handle.material.fragmentShader).toContain('rimMask');
    expect(handle.material.fragmentShader).toContain('rimTint');
    handle.material.dispose();
    dummyTex.dispose();
  });
});
