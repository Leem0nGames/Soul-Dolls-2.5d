import * as THREE from 'three';
import { createRng } from '../core/Rng.ts';
import type { FxQualityTier } from '../domain/FxPool.ts';
import type { BattleBiome, MapDef } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import type { TileAtlasKey } from '../gfx/ProceduralTiles.ts';
import { getTileUv } from './AtlasBuilder.ts';
import { DisposableRegistry } from './Disposables.ts';
import {
  buildCloudBillboards,
  createGradientSkyTexture,
  updateCloudBillboards,
  type CloudDriftItem,
} from './SkyBackdrop.ts';
import { buildTerrainChunks } from './TerrainMesher.ts';

export const PLAYER_STATION_POS = new THREE.Vector3(-2.15, 0.28, 2.0);
export const ENEMY_STATION_POS = new THREE.Vector3(2.25, 0.62, -2.35);

interface BiomeTheme {
  skyTop: number;
  skyBottom: number;
  fog: number;
  baseTile: string;
  hillTile: string;
  platformTop: TileAtlasKey;
  platformRim: TileAtlasKey;
  farColor: string;
  midColor: string;
  hasClouds: boolean;
  hasSunRays: boolean;
  hasGlowLights: boolean;
  glowColor: string;
}

function getBiomeTheme(biome: BattleBiome, isBoss: boolean): BiomeTheme {
  if (isBoss) {
    return {
      skyTop: hexToNumber(PALETTE.driedBlood),
      skyBottom: hexToNumber(PALETTE.oldBronze),
      fog: hexToNumber(PALETTE.rust),
      baseTile: 'A',
      hillTile: '#',
      platformTop: 'arena_floor',
      platformRim: 'roof_orange',
      farColor: PALETTE.driedBlood,
      midColor: PALETTE.bloodMoon,
      hasClouds: true,
      hasSunRays: false,
      hasGlowLights: true,
      glowColor: PALETTE.resonantGold,
    };
  }

  switch (biome) {
    case 'forest':
      return {
        skyTop: hexToNumber(PALETTE.oceanicTeal),
        skyBottom: hexToNumber(PALETTE.frostedGlass),
        fog: hexToNumber(PALETTE.iceCyan),
        baseTile: '.',
        hillTile: '*',
        platformTop: 'grass',
        platformRim: 'log',
        farColor: PALETTE.darkSlate,
        midColor: PALETTE.forestGreen,
        hasClouds: true,
        hasSunRays: true,
        hasGlowLights: false,
        glowColor: PALETTE.paleGold,
      };
    case 'mountain':
      return {
        skyTop: hexToNumber(PALETTE.stoneShadow),
        skyBottom: hexToNumber(PALETTE.paleGold),
        fog: hexToNumber(PALETTE.porcelain),
        baseTile: ',',
        hillTile: '#',
        platformTop: 'stone',
        platformRim: 'cobble',
        farColor: PALETTE.stoneShadow,
        midColor: PALETTE.stoneMid,
        hasClouds: true,
        hasSunRays: false,
        hasGlowLights: false,
        glowColor: PALETTE.paleGold,
      };
    case 'cave':
      return {
        skyTop: hexToNumber(PALETTE.abyssInk),
        skyBottom: hexToNumber(PALETTE.nightshade),
        fog: hexToNumber(PALETTE.cryptInk),
        baseTile: 'c',
        hillTile: '#',
        platformTop: 'cave_floor',
        platformRim: 'stone',
        farColor: PALETTE.abyssInk,
        midColor: PALETTE.nightshade,
        hasClouds: false,
        hasSunRays: false,
        hasGlowLights: true,
        glowColor: PALETTE.soulViolet,
      };
    case 'arena':
      return {
        skyTop: hexToNumber(PALETTE.deepAmethyst),
        skyBottom: hexToNumber(PALETTE.resonantGold),
        fog: hexToNumber(PALETTE.oldBronze),
        baseTile: 'A',
        hillTile: '#',
        platformTop: 'arena_floor',
        platformRim: 'cobble',
        farColor: PALETTE.nightshade,
        midColor: PALETTE.royalPurple,
        hasClouds: true,
        hasSunRays: false,
        hasGlowLights: true,
        glowColor: PALETTE.resonantGold,
      };
    case 'meadow':
    default:
      return {
        skyTop: hexToNumber(PALETTE.oceanicTeal),
        skyBottom: hexToNumber(PALETTE.frostedGlass),
        fog: hexToNumber(PALETTE.iceCyan),
        baseTile: '.',
        hillTile: '*',
        platformTop: 'grass',
        platformRim: 'dirt',
        farColor: PALETTE.stoneHighlight,
        midColor: PALETTE.forestGreen,
        hasClouds: true,
        hasSunRays: true,
        hasGlowLights: false,
        glowColor: PALETTE.paleGold,
      };
  }
}

function buildStageMapDef(biome: BattleBiome, theme: BiomeTheme): MapDef {
  const size = 24;
  const grid: string[] = [];
  const heights: string[] = [];
  const rng = createRng(biome.length * 911 + 42);

  for (let z = 0; z < size; z++) {
    let gRow = '';
    let hRow = '';
    for (let x = 0; x < size; x++) {
      const wx = x - 11.5;
      const wz = z - 11.5;
      const dPlayer = Math.hypot(wx - PLAYER_STATION_POS.x, wz - PLAYER_STATION_POS.z);
      const dEnemy = Math.hypot(wx - ENEMY_STATION_POS.x, wz - ENEMY_STATION_POS.z);
      const edge = Math.max(Math.abs(wx), Math.abs(wz)) / 12;

      let h = 0;
      let ch = theme.baseTile;
      if (dPlayer < 2.6) {
        h = 0;
      } else if (dEnemy < 2.6) {
        h = 1;
      } else if (edge > 0.72) {
        h = Math.min(6, Math.round((edge - 0.65) * 14 + rng.next() * 1.4));
        if (h >= 3) ch = theme.hillTile;
      } else if (wz < -4.5) {
        h = 1 + Math.round(rng.next() * 1.2);
      }
      gRow += ch;
      hRow += String(h);
    }
    grid.push(gRow);
    heights.push(hRow);
  }

  return {
    id: `battle_${biome}`,
    nameKey: `battle_${biome}`,
    biome,
    music: biome === 'cave' ? 'cave' : 'route',
    skyTopColor: theme.skyTop,
    skyBottomColor: theme.skyBottom,
    fogColor: theme.fog,
    snowLine: biome === 'mountain' ? 4 : undefined,
    grid,
    heights,
    legend: {
      '.': { tile: 'grass', solid: false },
      ',': { tile: 'dirt', solid: false },
      '*': { tile: 'flowers', solid: false },
      'c': { tile: 'cave_floor', solid: false },
      'A': { tile: 'arena_floor', solid: false },
      '#': { tile: 'stone', solid: true },
    },
    buildings: [],
    props: [],
    decoration: {
      seed: 1,
      treeDensity: 0,
      bushDensity: 0,
      flowerDensity: 0,
      rockDensity: 0,
      mushroomDensity: 0,
      treeKinds: [],
    },
    warps: [],
    npcs: [],
    signs: [],
  };
}

function createParallaxStripTexture(
  biome: BattleBiome,
  layer: 'far' | 'mid',
  color: string
): THREE.CanvasTexture {
  const w = 128;
  const h = 32;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;

  if (biome === 'cave') {
    for (let x = 0; x < w; x += 4) {
      const colH =
        layer === 'far'
          ? 12 + Math.round(Math.sin(x * 0.14) * 6 + Math.cos(x * 0.31) * 4)
          : 10 + Math.round(Math.abs(Math.sin(x * 0.25)) * 14);
      ctx.fillRect(x, h - colH, 4, colH);
    }
  } else if (biome === 'arena') {
    for (let x = 0; x < w; x += 8) {
      const colH = layer === 'far' ? 16 : (x / 8) % 2 === 0 ? 22 : 12;
      ctx.fillRect(x, h - colH, 6, colH);
    }
  } else if (layer === 'far') {
    // Mountain skyline
    for (let x = 0; x < w; x++) {
      const ridge =
        10 +
        Math.sin(x * 0.08) * 7 +
        Math.sin(x * 0.21 + 1.1) * 4 +
        (biome === 'mountain' ? Math.abs(Math.sin(x * 0.11)) * 7 : 0);
      const colH = Math.max(4, Math.round(ridge));
      ctx.fillRect(x, h - colH, 1, colH);
    }
  } else {
    // Mid tree/rock silhouette
    for (let x = 0; x < w; x += 3) {
      const treeH = 9 + Math.round(Math.abs(Math.sin(x * 0.33 + 0.7)) * 11);
      ctx.fillRect(x, h - treeH, 3, treeH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createBlobShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 2, 16, 16, 15);
  grad.addColorStop(0, 'rgba(11, 8, 14, 0.72)');
  grad.addColorStop(0.6, 'rgba(11, 8, 14, 0.42)');
  grad.addColorStop(1, 'rgba(11, 8, 14, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createGlowTexture(colorHex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  grad.addColorStop(0, colorHex);
  grad.addColorStop(0.45, colorHex + '88');
  grad.addColorStop(1, 'rgba(11,8,14,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 32, 32);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createSunRayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 64);
  grad.addColorStop(0, 'rgba(252, 237, 184, 0.35)');
  grad.addColorStop(1, 'rgba(252, 237, 184, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(4, 0, 24, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function createBossAuraTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(24, 24, 8, 24, 24, 24);
  grad.addColorStop(0, 'rgba(232, 184, 74, 0.16)');
  grad.addColorStop(0.65, 'rgba(194, 35, 75, 0.72)');
  grad.addColorStop(0.88, 'rgba(232, 184, 74, 0.85)');
  grad.addColorStop(1, 'rgba(232, 184, 74, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 48, 48);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function buildPlatformGeometry(
  cx: number,
  topY: number,
  cz: number,
  radius: number,
  height: number,
  topKey: TileAtlasKey,
  rimKey: TileAtlasKey
): THREE.BufferGeometry {
  const segs = 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const topRect = getTileUv(topKey);
  const rimRect = getTileUv(rimKey);
  const botY = topY - height;

  // Top disc
  const centerIdx = 0;
  positions.push(cx, topY, cz);
  uvs.push((topRect.u0 + topRect.u1) * 0.5, (topRect.v0 + topRect.v1) * 0.5);
  colors.push(1.05, 1.05, 1.05);

  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    positions.push(cx + cos * radius, topY, cz + sin * radius);
    uvs.push(
      topRect.u0 + (cos * 0.5 + 0.5) * (topRect.u1 - topRect.u0),
      topRect.v0 + (sin * 0.5 + 0.5) * (topRect.v1 - topRect.v0)
    );
    colors.push(0.95, 0.95, 0.95);
  }
  for (let i = 1; i <= segs; i++) {
    indices.push(centerIdx, i + 1, i);
  }

  // Side rim cylinder
  const baseStart = positions.length / 3;
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const u = i % 2 === 0 ? rimRect.u0 : rimRect.u1;
    const shade = 0.72 + 0.22 * (sin * 0.5 + 0.5);

    positions.push(cx + cos * radius, topY, cz + sin * radius);
    uvs.push(u, rimRect.v1);
    colors.push(shade, shade, shade);

    positions.push(cx + cos * (radius + 0.14), botY, cz + sin * (radius + 0.14));
    uvs.push(u, rimRect.v0);
    colors.push(shade * 0.78, shade * 0.78, shade * 0.78);
  }
  for (let i = 0; i < segs; i++) {
    const t0 = baseStart + i * 2;
    const b0 = t0 + 1;
    const t1 = t0 + 2;
    const b1 = t0 + 3;
    indices.push(t0, b0, t1, t1, b0, b1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
  geo.setIndex(new THREE.BufferAttribute(new Uint16Array(indices), 1));
  geo.computeBoundingSphere();
  return geo;
}

export class BattleStage {
  private disposables = new DisposableRegistry();
  private clouds: CloudDriftItem[] = [];
  private midLayerMesh: THREE.Mesh | null = null;
  private sunRays: THREE.Mesh[] = [];
  private glowSprites: THREE.Mesh[] = [];
  private bossAura: THREE.Mesh | null = null;
  private playerShadow: THREE.Mesh;
  private enemyShadow: THREE.Mesh;
  private time = 0;
  private qualityTier: FxQualityTier = 'high';

  constructor(
    scene: THREE.Scene,
    assets: AssetProvider,
    biome: BattleBiome,
    isBoss: boolean
  ) {
    const theme = getBiomeTheme(biome, isBoss);

    // Sky gradient + fog
    const skyTex = createGradientSkyTexture(theme.skyTop, theme.skyBottom);
    this.disposables.track(skyTex);
    scene.background = skyTex;
    scene.fog = new THREE.Fog(theme.fog, 13, 30);

    // 24x24 heightfield terrain patch
    const atlasMat = new THREE.MeshBasicMaterial({
      map: assets.getTileAtlasTexture(),
      vertexColors: true,
    });
    const grassMat = new THREE.MeshBasicMaterial({
      map: assets.getGrassTexture(),
      vertexColors: true,
    });
    this.disposables.track(atlasMat);
    this.disposables.track(grassMat);

    const stageMap = buildStageMapDef(biome, theme);
    const chunks = buildTerrainChunks(stageMap, atlasMat, grassMat);
    for (const c of chunks) {
      c.mesh.matrixAutoUpdate = true;
      c.mesh.position.set(-11.5, -0.05, -11.5);
      c.mesh.updateMatrix();
      scene.add(c.mesh);
      this.disposables.track(c.mesh.geometry);
    }

    // Two circular raised platforms
    const pGeo = buildPlatformGeometry(
      PLAYER_STATION_POS.x,
      PLAYER_STATION_POS.y,
      PLAYER_STATION_POS.z,
      1.65,
      0.42,
      theme.platformTop,
      theme.platformRim
    );
    const eGeo = buildPlatformGeometry(
      ENEMY_STATION_POS.x,
      ENEMY_STATION_POS.y,
      ENEMY_STATION_POS.z,
      1.55,
      0.72,
      theme.platformTop,
      theme.platformRim
    );
    const pMesh = new THREE.Mesh(pGeo, atlasMat);
    const eMesh = new THREE.Mesh(eGeo, atlasMat);
    scene.add(pMesh, eMesh);
    this.disposables.track(pGeo);
    this.disposables.track(eGeo);

    // 2 Parallax silhouette billboard layers
    const farTex = createParallaxStripTexture(biome, 'far', theme.farColor);
    const farGeo = new THREE.PlaneGeometry(34, 8.5);
    const farMat = new THREE.MeshBasicMaterial({
      map: farTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const farMesh = new THREE.Mesh(farGeo, farMat);
    farMesh.position.set(0, 3.3, -13.8);
    scene.add(farMesh);
    this.disposables.track(farTex);
    this.disposables.track(farGeo);
    this.disposables.track(farMat);

    const midTex = createParallaxStripTexture(biome, 'mid', theme.midColor);
    const midGeo = new THREE.PlaneGeometry(26, 5.2);
    const midMat = new THREE.MeshBasicMaterial({
      map: midTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.midLayerMesh = new THREE.Mesh(midGeo, midMat);
    this.midLayerMesh.position.set(0.5, 1.9, -9.8);
    scene.add(this.midLayerMesh);
    this.disposables.track(midTex);
    this.disposables.track(midGeo);
    this.disposables.track(midMat);

    // Moving clouds (outdoor biomes)
    if (theme.hasClouds) {
      this.clouds = buildCloudBillboards(scene, this.disposables, 0, -9, 15, 6, 331, 7.6);
    }

    // Additive sun-ray quads (meadow/forest)
    if (theme.hasSunRays) {
      const rayTex = createSunRayTexture();
      const rayGeo = new THREE.PlaneGeometry(2.4, 8.5);
      const rayMat = new THREE.MeshBasicMaterial({
        map: rayTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.track(rayTex);
      this.disposables.track(rayGeo);
      this.disposables.track(rayMat);

      for (const rx of [-3.8, 0.2, 4.1]) {
        const ray = new THREE.Mesh(rayGeo, rayMat);
        ray.position.set(rx, 3.6, -4.5);
        ray.rotation.z = -0.26;
        scene.add(ray);
        this.sunRays.push(ray);
      }
    }

    // Glow sprites (cave crystals / arena torches)
    if (theme.hasGlowLights) {
      const glowTex = createGlowTexture(theme.glowColor);
      const glowGeo = new THREE.PlaneGeometry(1.7, 1.7);
      const glowMat = new THREE.MeshBasicMaterial({
        map: glowTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      this.disposables.track(glowTex);
      this.disposables.track(glowGeo);
      this.disposables.track(glowMat);

      const positions: Array<[number, number, number]> = [
        [-4.6, 1.5, -3.5],
        [5.2, 1.9, -5.0],
        [-0.4, 1.6, -6.5],
      ];
      for (const [gx, gy, gz] of positions) {
        const sp = new THREE.Mesh(glowGeo, glowMat);
        sp.position.set(gx, gy, gz);
        scene.add(sp);
        this.glowSprites.push(sp);
      }
    }

    // Boss pulsing aura on enemy platform
    if (isBoss) {
      const auraTex = createBossAuraTexture();
      const auraGeo = new THREE.PlaneGeometry(2.8, 2.8);
      auraGeo.rotateX(-Math.PI / 2);
      const auraMat = new THREE.MeshBasicMaterial({
        map: auraTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      });
      this.bossAura = new THREE.Mesh(auraGeo, auraMat);
      this.bossAura.position.set(
        ENEMY_STATION_POS.x,
        ENEMY_STATION_POS.y + 0.03,
        ENEMY_STATION_POS.z
      );
      scene.add(this.bossAura);
      this.disposables.track(auraTex);
      this.disposables.track(auraGeo);
      this.disposables.track(auraMat);
    }

    // Soft procedural blob shadows under both creatures
    const shadowTex = createBlobShadowTexture();
    const shadowGeo = new THREE.PlaneGeometry(1.45, 0.95);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    this.disposables.track(shadowTex);
    this.disposables.track(shadowGeo);
    this.disposables.track(shadowMat);

    this.playerShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.playerShadow.position.set(
      PLAYER_STATION_POS.x,
      PLAYER_STATION_POS.y + 0.02,
      PLAYER_STATION_POS.z
    );
    this.enemyShadow = new THREE.Mesh(shadowGeo, shadowMat);
    this.enemyShadow.position.set(
      ENEMY_STATION_POS.x,
      ENEMY_STATION_POS.y + 0.02,
      ENEMY_STATION_POS.z
    );
    scene.add(this.playerShadow, this.enemyShadow);
  }

  setQualityTier(tier: FxQualityTier): void {
    if (this.qualityTier === tier) return;
    this.qualityTier = tier;
    if (this.midLayerMesh) {
      this.midLayerMesh.visible = tier !== 'low';
    }
    for (let i = 0; i < this.clouds.length; i++) {
      this.clouds[i].mesh.visible =
        tier === 'high' ? true : tier === 'medium' ? i % 2 === 0 : false;
    }
    for (let i = 0; i < this.sunRays.length; i++) {
      this.sunRays[i].visible = tier !== 'low';
    }
  }

  setShadowScale(side: 'player' | 'enemy', scale: number, visible: boolean): void {
    const mesh = side === 'player' ? this.playerShadow : this.enemyShadow;
    mesh.visible = visible;
    mesh.scale.setScalar(Math.max(0.1, scale));
  }

  update(dt: number, cameraPos: THREE.Vector3): void {
    this.time += dt;

    if (this.clouds.length > 0 && this.qualityTier !== 'low') {
      updateCloudBillboards(this.clouds, 0, dt);
    }

    for (let i = 0; i < this.sunRays.length; i++) {
      const ray = this.sunRays[i];
      ray.position.x += Math.sin(this.time * 0.4 + i) * 0.002;
    }

    for (let i = 0; i < this.glowSprites.length; i++) {
      const g = this.glowSprites[i];
      const pulse = 0.88 + Math.sin(this.time * 4.5 + i * 1.7) * 0.14;
      g.scale.setScalar(pulse);
      g.lookAt(cameraPos);
    }

    if (this.bossAura) {
      const s = 0.94 + Math.sin(this.time * 3.8) * 0.1;
      this.bossAura.scale.set(s, 1, s);
    }
  }

  dispose(): void {
    this.disposables.disposeAll();
  }
}
