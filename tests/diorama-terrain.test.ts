import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps/index.ts';
import { HEIGHT_UNIT } from '../src/domain/TerrainRules.ts';
import type { BattleBiome, MapDef } from '../src/domain/types.ts';
import { getTileUv } from '../src/engine/AtlasBuilder.ts';
import {
  attachCliffEdgeDirectionalLighting,
  updateCliffEdgeDirectionalLighting,
  type CliffEdgeLightingUniforms,
} from '../src/engine/CliffEdgeLighting.ts';
import {
  buildCliffOrnamentsMesh,
  createCliffOrnamentMaterial,
  createCliffOrnamentTexturePair,
  planCliffOrnaments,
} from '../src/engine/CliffOrnamentMesher.ts';
import {
  DIORAMA_RENDER_ORDER,
  getBiomeCliffWeathering,
} from '../src/engine/DioramaLayers.ts';
import { attachCameraOcclusionCutout } from '../src/engine/OcclusionCutout.ts';
import { PixelSsaoShader } from '../src/engine/PixelSsaoShader.ts';
import {
  buildStaircaseMeshes,
  detectStairClimbDirection,
} from '../src/engine/StaircaseMesher.ts';
import {
  buildTerrainChunks,
  detectCliffBoundaries,
} from '../src/engine/TerrainMesher.ts';
import {
  attachTerrainDioramaShader,
  updateTerrainDioramaBiome,
} from '../src/engine/TerrainWeatheringShader.ts';
import {
  OVERHANG_ASSET_SHEET_URL,
  OVERHANG_SHEET_SLOTS,
  buildOverhangNormalBuffer,
  buildProceduralOverhangsGroup,
  createOverhangAssetSheet,
  createOverhangTexturePair,
  generateCliffOverhangPlan,
  isChromaGreenPixel,
  isChromaMagentaPixel,
  processChromaKeyOverhangBuffer,
  processMagentaGridOverhangBuffer,
  type OverhangGenerationStats,
} from '../src/engine/ProceduralOverhangGenerator.ts';

function makeCliffTestMap(biome: BattleBiome = 'forest'): MapDef {
  return {
    id: 'cliff_test',
    nameKey: 'cliff_test',
    biome,
    music: biome === 'cave' ? 'cave' : 'route',
    skyTopColor: 0x000000,
    skyBottomColor: 0x111111,
    fogColor: 0x222222,
    grid: [
      '.....',
      '.###.',
      '.#^#.',
      '.###.',
      '.....',
    ],
    heights: [
      '11111',
      '13331',
      '13231',
      '13331',
      '11111',
    ],
    legend: {
      '.': { tile: 'grass', solid: false },
      '#': { tile: 'stone', solid: true },
      '^': { tile: 'stairs', solid: false, ramp: true },
    },
    buildings: [],
    props: [],
    decoration: {
      seed: 42,
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

describe('Diorama 90-degree cliff terrain & shaders', () => {
  it('detects 90-degree cliff boundaries and emits non-sheared vertical wall planes with exact normals', () => {
    const map = makeCliffTestMap('mountain');
    const boundaries = detectCliffBoundaries(map);
    expect(boundaries.length).toBeGreaterThan(0);

    // Center raised stone ring (level 3) drops onto outer grass (level 1) and stair (level 2)
    const northEdge = boundaries.find((b) => b.x === 2 && b.z === 1 && b.face === 'north');
    expect(northEdge).toBeDefined();
    expect(northEdge!.yTop).toBeCloseTo(3 * HEIGHT_UNIT);
    expect(northEdge!.yBottom).toBeCloseTo(1 * HEIGHT_UNIT);

    const mat = new THREE.MeshStandardMaterial();
    const chunks = buildTerrainChunks(map, mat);
    expect(chunks).toHaveLength(1);
    const mesh = chunks[0].mesh;
    expect(mesh.renderOrder).toBe(DIORAMA_RENDER_ORDER.TERRAIN_BASE);

    const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    const norm = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute;
    const cliffMeta = mesh.geometry.getAttribute('aCliffMeta') as THREE.BufferAttribute;
    expect(cliffMeta).toBeDefined();
    expect(cliffMeta.itemSize).toBe(3);

    let horizontalQuads = 0;
    let verticalQuads = 0;
    const cliffRect = getTileUv('cliff_rock');

    for (let i = 0; i < pos.count; i += 4) {
      const ny = norm.getY(i);
      const nx = norm.getX(i);
      const nz = norm.getZ(i);
      if (Math.abs(ny - 1) < 0.001) {
        horizontalQuads++;
        // Every flat tile top must have identical Y across all 4 vertices (no diagonal stretching)
        const y0 = pos.getY(i);
        expect(pos.getY(i + 1)).toBeCloseTo(y0);
        expect(pos.getY(i + 2)).toBeCloseTo(y0);
        expect(pos.getY(i + 3)).toBeCloseTo(y0);
      } else {
        verticalQuads++;
        // Vertical cliff wall must have strictly horizontal cardinal unit normal
        expect(Math.abs(ny)).toBeLessThan(0.001);
        expect(Math.abs(Math.abs(nx) + Math.abs(nz) - 1)).toBeLessThan(0.001);
        expect(cliffMeta.getX(i)).toBeCloseTo(1.0);

        // Verify UVs stay strictly inside cliff_rock atlas cell (zero shearing/bleeding)
        for (let k = 0; k < 4; k++) {
          const u = uv.getX(i + k);
          const v = uv.getY(i + k);
          expect(u).toBeGreaterThanOrEqual(cliffRect.u0 - 1e-5);
          expect(u).toBeLessThanOrEqual(cliffRect.u1 + 1e-5);
          expect(v).toBeGreaterThanOrEqual(cliffRect.v0 - 1e-5);
          expect(v).toBeLessThanOrEqual(cliffRect.v1 + 1e-5);
        }
      }
    }

    expect(horizontalQuads).toBe(25);
    expect(verticalQuads).toBeGreaterThanOrEqual(boundaries.length);

    mesh.geometry.dispose();
    mat.dispose();
  });

  it('auto-orients staircases toward higher terrain and assigns staircase renderOrder', () => {
    const map = makeCliffTestMap('meadow');
    // At (2,2) level 2, neighbors (1,2), (3,2), (2,1), (2,3) are level 3, north checked first
    const orient = detectStairClimbDirection(map, 2, 2);
    expect(orient.dir).toBe('north');
    expect(orient.yLow).toBeCloseTo(2 * HEIGHT_UNIT);
    expect(orient.yHigh).toBeCloseTo(3 * HEIGHT_UNIT);

    // Pueblo Bruma terrace stairs at (23, 29) climb north from level 2 to level 3
    const brumaOrient = detectStairClimbDirection(MAPS.pueblo_bruma, 23, 29);
    expect(brumaOrient.dir).toBe('north');
    expect(brumaOrient.yHigh).toBeCloseTo(3 * HEIGHT_UNIT);

    // Explicit west-climbing stairs (higher tile at x=1) and east-climbing stairs (higher tile at x=3)
    const westMap = makeCliffTestMap('meadow');
    westMap.heights = ['11111', '11111', '13211', '11111', '11111'];
    expect(detectStairClimbDirection(westMap, 2, 2).dir).toBe('west');
    westMap.heights = ['11111', '11111', '11231', '11111', '11111'];
    expect(detectStairClimbDirection(westMap, 2, 2).dir).toBe('east');

    const mat = new THREE.MeshStandardMaterial();
    const group = buildStaircaseMeshes(map, mat);
    expect(group.children.length).toBe(1);
    const stairMesh = group.children[0] as THREE.Mesh;
    expect(stairMesh.renderOrder).toBe(DIORAMA_RENDER_ORDER.STAIRCASE);
    expect(stairMesh.geometry.getAttribute('position').count).toBe(4 * 2 * 4); // 4 steps * (tread + riser) * 4 verts
    stairMesh.geometry.dispose();
    mat.dispose();
  });

  it('snaps floating cliff ornaments cleanly to 90-degree boundaries with outward anti-Z-fighting offset', () => {
    const forestMap = makeCliffTestMap('forest');
    const boundaries = detectCliffBoundaries(forestMap);
    const placements = planCliffOrnaments(forestMap, boundaries);
    expect(placements.length).toBeGreaterThan(0);

    for (const p of placements) {
      expect(p.offsetOutward).toBeGreaterThan(0);
      // Verify ornament coordinates align with one of the detected boundaries + outward offset
      const match = boundaries.find(
        (b) =>
          b.face === p.face &&
          Math.abs(b.x + p.nx * (0.5 + p.offsetOutward) - p.x) < 1e-4 &&
          Math.abs(b.z + p.nz * (0.5 + p.offsetOutward) - p.z) < 1e-4
      );
      expect(match).toBeDefined();
    }

    const dummyTex = new THREE.DataTexture(new Uint8Array(16), 2, 2) as unknown as THREE.CanvasTexture;
    const mat = createCliffOrnamentMaterial(dummyTex);
    expect(mat.polygonOffset).toBe(true);

    const group = buildCliffOrnamentsMesh(forestMap, mat);
    expect(group).not.toBeNull();
    const mesh = group!.children[0] as THREE.Mesh;
    expect(mesh.renderOrder).toBe(DIORAMA_RENDER_ORDER.CLIFF_ORNAMENT);
    expect(mesh.renderOrder).toBeGreaterThan(DIORAMA_RENDER_ORDER.TERRAIN_BASE);
    expect(mesh.renderOrder).toBeLessThan(DIORAMA_RENDER_ORDER.WATER_SURFACE);

    // Cave biome selects crystal_icicle / cracked_trim ornaments
    const cavePlacements = planCliffOrnaments(makeCliffTestMap('cave'));
    expect(
      cavePlacements.some((p) => p.kind === 'crystal_icicle' || p.kind === 'cracked_trim')
    ).toBe(true);

    mesh.geometry.dispose();
    mat.dispose();
    dummyTex.dispose();
  });

  it('provides biome-specific cliff-top weathering profiles and chains shader hooks cleanly', () => {
    const biomes: BattleBiome[] = [
      'meadow',
      'forest',
      'mountain',
      'snow',
      'cave',
      'arena',
      'coast',
    ];
    const hexes = new Set<string>();
    for (const b of biomes) {
      const prof = getBiomeCliffWeathering(b);
      expect(prof.strength).toBeGreaterThan(0.2);
      expect(prof.edgeBandHeight).toBeGreaterThan(0.2);
      hexes.add(prof.edgeColor.getHexString());
    }
    expect(hexes.size).toBe(biomes.length);

    const mat = new THREE.MeshStandardMaterial();
    attachCameraOcclusionCutout(mat, { minRelY: -0.35 });
    attachTerrainDioramaShader(mat, 'forest');

    const cacheKey = mat.customProgramCacheKey();
    expect(cacheKey).toContain('cam_occ_');
    expect(cacheKey).toContain('terrain_diorama_v1');

    const uniforms = mat.userData.__terrainDioramaUniforms as {
      uWeatheringColor: { value: THREE.Color };
      uWeatheringStrength: { value: number };
    };
    const forestHex = uniforms.uWeatheringColor.value.getHexString();
    updateTerrainDioramaBiome(mat, 'cave');
    expect(uniforms.uWeatheringColor.value.getHexString()).not.toBe(forestHex);

    mat.dispose();
  });

  it('configures PixelSsaoShader with perspective depth linearization and pixel-grid uniforms', () => {
    expect(PixelSsaoShader.uniforms.tDepth).toBeDefined();
    expect(PixelSsaoShader.uniforms.uPixelGrid.value.x).toBeGreaterThan(0);
    expect(PixelSsaoShader.uniforms.uCameraNear.value).toBeGreaterThan(0);
    expect(PixelSsaoShader.uniforms.uCameraFar.value).toBeGreaterThan(
      PixelSsaoShader.uniforms.uCameraNear.value
    );
    expect(PixelSsaoShader.fragmentShader).toContain('perspectiveDepthToViewZ');
    expect(PixelSsaoShader.fragmentShader).toContain('uPixelGrid');
  });

  it('generates procedural overhang assets (worn stone, mossy patches, hanging roots) with corner caps and diorama sorting', () => {
    expect(OVERHANG_ASSET_SHEET_URL).toContain('520710015_1795112955056095_ccb22d3d.jpg');
    const sheet = createOverhangAssetSheet();
    const img = sheet.image as HTMLCanvasElement;
    expect(img.width).toBe(64 * OVERHANG_SHEET_SLOTS.length);
    expect(img.height).toBe(64);
    expect(sheet.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(sheet.magFilter).toBe(THREE.NearestFilter);
    sheet.dispose();

    // Verify magenta chroma-key strips #FF00FF while keeping emerald/forest greens and brown roots 100% intact
    expect(isChromaMagentaPixel(255, 0, 255)).toBe(true);
    expect(isChromaMagentaPixel(42, 160, 68)).toBe(false);
    expect(isChromaGreenPixel(0, 255, 0)).toBe(true);
    expect(isChromaGreenPixel(42, 140, 85)).toBe(false);

    // Build a 12x8 synthetic 3x2 grid with #FF00FF magenta background and emerald green sprite in cell (0,0)
    const gw = 12;
    const gh = 8;
    const magGrid = new Uint8ClampedArray(gw * gh * 4);
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const idx = (y * gw + x) * 4;
        const inCell00 = x >= 1 && x <= 2 && y >= 1 && y <= 2;
        if (inCell00) {
          magGrid[idx] = 52;
          magGrid[idx + 1] = 175;
          magGrid[idx + 2] = 74;
          magGrid[idx + 3] = 255;
        } else {
          magGrid[idx] = 255;
          magGrid[idx + 1] = 0;
          magGrid[idx + 2] = 255;
          magGrid[idx + 3] = 255;
        }
      }
    }
    const magAtlas = processMagentaGridOverhangBuffer(magGrid, gw, gh, 3, 2, 16);
    expect(magAtlas.width).toBe(16 * OVERHANG_SHEET_SLOTS.length);
    expect(magAtlas.height).toBe(16);
    // Slot 3 (mossy_patch) receives cell (0,0) with lush green foliage preserved (opaque + G > R & B)
    const mossCenterIdx = (4 * magAtlas.width + (3 * 16 + 8)) * 4;
    expect(magAtlas.data[mossCenterIdx + 3]).toBe(255);
    expect(magAtlas.data[mossCenterIdx + 1]).toBeGreaterThan(magAtlas.data[mossCenterIdx]);

    const mockW = 16;
    const mockH = 8;
    const mockRgba = new Uint8ClampedArray(mockW * mockH * 4);
    for (let y = 0; y < mockH; y++) {
      for (let x = 0; x < mockW; x++) {
        const idx = (y * mockW + x) * 4;
        if (y >= 2 && y <= 5) {
          // Foreground row across all 8 columns
          mockRgba[idx] = 107;
          mockRgba[idx + 1] = 119;
          mockRgba[idx + 2] = 140;
          mockRgba[idx + 3] = 255;
        } else {
          // Neon green background
          mockRgba[idx] = 0;
          mockRgba[idx + 1] = 255;
          mockRgba[idx + 2] = 0;
          mockRgba[idx + 3] = 255;
        }
      }
    }
    const processed = processChromaKeyOverhangBuffer(mockRgba, mockW, mockH, 16);
    expect(processed.width).toBe(16 * OVERHANG_SHEET_SLOTS.length);
    expect(processed.height).toBe(16);
    // Top row of slot 0 should be foreground (top-aligned to y=0), alpha = 255
    expect(processed.data[3]).toBe(255);

    const forestMap = makeCliffTestMap('forest');
    const boundaries = detectCliffBoundaries(forestMap);
    const plan = generateCliffOverhangPlan(forestMap, boundaries);
    expect(plan.length).toBeGreaterThan(0);

    // Outer corners of the 3x3 ring must be flagged as corners and include top-cap overhangs
    const corners = plan.filter((p) => p.isCorner);
    expect(corners.length).toBeGreaterThan(0);
    expect(corners.some((p) => p.hasTopCap && p.overhangProjection > 0)).toBe(true);

    // Villa Origen should spawn diverse edge-worn stone and vegetation overhangs
    const villaPlan = generateCliffOverhangPlan(MAPS.villa_origen);
    const kinds = new Set(villaPlan.map((p) => p.kind));
    expect(
      kinds.has('mossy_patch') || kinds.has('hanging_roots') || kinds.has('worn_capstone')
    ).toBe(true);

    const group = buildProceduralOverhangsGroup(forestMap);
    expect(group).not.toBeNull();
    const mesh = group!.children[0] as THREE.Mesh;
    expect(mesh.renderOrder).toBe(DIORAMA_RENDER_ORDER.CLIFF_ORNAMENT);
    expect(mesh.castShadow).toBe(true);

    const stats = mesh.userData.overhangStats as OverhangGenerationStats;
    expect(stats.total).toBe(plan.length);
    expect(stats.withTopCap).toBe(stats.total);
    expect(stats.volumetricSlabs).toBe(stats.total * 2);
    expect(stats.corners).toBe(corners.length);

    // Every emitted quad must have +Y top cap, -Y dark undercut soffit, or horizontal cardinal normal
    const norm = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute;
    let topCapVerts = 0;
    let soffitVerts = 0;
    let cardinalVerts = 0;
    for (let i = 0; i < norm.count; i++) {
      const nx = norm.getX(i);
      const ny = norm.getY(i);
      const nz = norm.getZ(i);
      if (Math.abs(ny - 1) < 1e-4) {
        topCapVerts++;
      } else if (Math.abs(ny + 1) < 1e-4) {
        soffitVerts++;
      } else {
        expect(Math.abs(ny)).toBeLessThan(1e-4);
        expect(Math.abs(Math.abs(nx) + Math.abs(nz) - 1)).toBeLessThan(1e-4);
        cardinalVerts++;
      }
    }
    expect(topCapVerts).toBe(stats.volumetricSlabs * 4);
    expect(soffitVerts).toBe(stats.volumetricSlabs * 4);
    // Front + left end-cap + right end-cap per slab (3 * 4 verts) plus 1 quad (4 verts) per drape skirt
    expect(cardinalVerts).toBe(stats.volumetricSlabs * 3 * 4 + stats.drapeSkirts * 4);

    mesh.geometry.dispose();
    (group!.userData.createdMaterial as THREE.Material)?.dispose();
    (group!.userData.createdTexture as THREE.Texture)?.dispose();
    (group!.userData.createdNormalTexture as THREE.Texture)?.dispose();
  });

  it('computes per-slot tangent-space overhang normal maps, vertex tangents, and tracks directional sun lighting', () => {
    // 2 slots of 8x8: slot 0 opaque bright block, slot 1 transparent (testing zero cross-slot bleed)
    const cell = 8;
    const w = cell * 2;
    const h = cell;
    const rgba = new Uint8ClampedArray(w * h * 4);
    for (let y = 1; y <= 6; y++) {
      for (let x = 1; x < cell; x++) {
        const idx = (y * w + x) * 4;
        rgba[idx] = 210;
        rgba[idx + 1] = 195;
        rgba[idx + 2] = 160;
        rgba[idx + 3] = 255;
      }
    }

    const nBuf = buildOverhangNormalBuffer(rgba, w, h, cell);
    expect(nBuf.length).toBe(rgba.length);

    // Transparent slot 1 must remain untouched neutral outward normal (128, 128, 255, 255)
    for (let y = 0; y < h; y++) {
      const slot1Idx = (y * w + cell) * 4;
      expect(nBuf[slot1Idx]).toBe(128);
      expect(nBuf[slot1Idx + 1]).toBe(128);
      expect(nBuf[slot1Idx + 2]).toBe(255);
      expect(nBuf[slot1Idx + 3]).toBe(255);
    }

    // Upper bevel edge (y=1) should tilt upward (+ny -> green > 128), bottom edge (y=6) should tilt downward (green < 128)
    const topEdgeIdx = (1 * w + 4) * 4;
    const botEdgeIdx = (6 * w + 4) * 4;
    expect(nBuf[topEdgeIdx + 1]).toBeGreaterThan(128);
    expect(nBuf[botEdgeIdx + 1]).toBeLessThan(128);
    expect(nBuf[topEdgeIdx + 2]).toBeGreaterThan(128);

    // Paired texture loader exposes linear NoColorSpace NearestFilter normalMap
    const pair = createCliffOrnamentTexturePair();
    expect(pair.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(pair.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect(pair.normalMap.magFilter).toBe(THREE.NearestFilter);

    const mat = createCliffOrnamentMaterial(pair.map, pair.normalMap, 'forest', false);
    expect(mat.normalMap).toBe(pair.normalMap);
    expect(mat.normalMapType).toBe(THREE.TangentSpaceNormalMap);
    expect(mat.normalScale.x).toBeGreaterThan(1.0);
    expect(mat.customProgramCacheKey()).toContain('cam_occ_');
    expect(mat.customProgramCacheKey()).toContain('cliff_edge_lit_v1');

    // Geometry tangents must exist with itemSize 4 for accurate tangent-space normal mapping on all 5 slab faces
    const forestMap = makeCliffTestMap('forest');
    const group = buildCliffOrnamentsMesh(forestMap, mat)!;
    const mesh = group.children[0] as THREE.Mesh;
    const tangent = mesh.geometry.getAttribute('tangent') as THREE.BufferAttribute;
    expect(tangent).toBeDefined();
    expect(tangent.itemSize).toBe(4);
    expect(tangent.count).toBe(mesh.geometry.getAttribute('position').count);
    expect(Number.isFinite(tangent.getX(0))).toBe(true);

    // Directional light sync updates light direction, fill rim, and sunset/night/cave tint presets
    const sun = new THREE.DirectionalLight(0xffdd99, 1.5);
    sun.position.set(10, 12, 4);
    sun.target.position.set(0, 0, 0);
    updateCliffEdgeDirectionalLighting(mat, {
      biome: 'forest',
      sunLight: sun,
      timePhase: 'dusk',
      isCave: false,
    });
    const uniforms = mat.userData.__cliffEdgeLitUniforms as CliffEdgeLightingUniforms;
    const sunsetLightX = uniforms.uCliffLightDir.value.x;
    const sunsetKeyHex = uniforms.uCliffKeyColor.value.getHexString();

    sun.position.set(-10, 12, -4);
    updateCliffEdgeDirectionalLighting(mat, {
      biome: 'cave',
      sunLight: sun,
      timePhase: 'night',
      isCave: true,
    });
    expect(uniforms.uCliffLightDir.value.x).toBeLessThan(0);
    expect(uniforms.uCliffLightDir.value.x).not.toBeCloseTo(sunsetLightX);
    expect(uniforms.uCliffKeyColor.value.getHexString()).not.toBe(sunsetKeyHex);

    // Attach helper handles repeated calls cleanly without duplicating shader hooks
    attachCliffEdgeDirectionalLighting(mat, 'snow', false);
    expect(mat.customProgramCacheKey().match(/cliff_edge_lit_v1/g)?.length).toBe(1);

    const standalonePair = createOverhangTexturePair();
    standalonePair.map.dispose();
    standalonePair.normalMap.dispose();
    mesh.geometry.dispose();
    mat.dispose();
    pair.map.dispose();
    pair.normalMap.dispose();
  });
});
