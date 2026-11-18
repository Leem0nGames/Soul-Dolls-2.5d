import { describe, expect, it } from 'vitest';
import { SPECIES_ANIMATION_REGISTRY } from '../src/data/animations.ts';
import { SPECIES } from '../src/data/species.ts';
import {
  applyChromaKeyRgba,
  buildAgentPromptSummary,
  buildDualSoulAgentPrompt,
  buildDualSoulFileNames,
  buildDualSoulTsSnippet,
  buildOutputFileName,
  buildTsSnippet,
  computeTrimSamplingPlan,
  detectDualSoulRegions,
  filterGrimoireSpecies,
  pad2,
  stepBounded,
} from '../src/domain/SpriteStudioLogic.ts';

describe('SpriteStudioLogic', () => {
  it('formats padded IDs, filenames, and bounded steppers cleanly', () => {
    expect(pad2(1)).toBe('01');
    expect(pad2(15)).toBe('15');
    expect(buildOutputFileName(1, 'physical_attack')).toBe('physical_attack_01.webp');
    expect(buildOutputFileName(15, 'special_attack')).toBe('special_attack_15.webp');
    expect(stepBounded(4, 1, 1, 10)).toBe(5);
    expect(stepBounded(1, -1, 1, 10)).toBe(1);
    expect(stepBounded(10, 5, 1, 10)).toBe(10);
  });

  it('computes clamped video trim sampling plan and grid rows', () => {
    const plan = computeTrimSamplingPlan({
      start: 1.85,
      end: 4.55,
      fps: 7.5,
      cols: 4,
      duration: 6.0,
      maxFrames: 20,
    });
    expect(plan.totalFrames).toBe(20);
    expect(plan.rows).toBe(5);
    expect(plan.timestamps[0]).toBeCloseTo(1.85);
    expect(plan.timestamps[plan.timestamps.length - 1]).toBeLessThanOrEqual(5.99);

    const invertedPlan = computeTrimSamplingPlan({
      start: 5.5,
      end: 2.0,
      fps: 8,
      cols: 4,
      duration: 6.0,
    });
    expect(invertedPlan.end).toBeGreaterThan(invertedPlan.start);
    expect(invertedPlan.totalFrames).toBeGreaterThanOrEqual(1);
  });

  it('filters Grimoire entries by ID, name, animation status, and wild soul status', () => {
    const animatedOnly = filterGrimoireSpecies({
      maxId: 52,
      query: '',
      filter: 'animated',
      speciesMap: SPECIES,
      registry: SPECIES_ANIMATION_REGISTRY,
    });
    expect(animatedOnly.map((e) => e.id)).toEqual([1, 15]);

    const wildOnly = filterGrimoireSpecies({
      maxId: 52,
      query: '',
      filter: 'wild',
      speciesMap: SPECIES,
      registry: SPECIES_ANIMATION_REGISTRY,
    });
    expect(wildOnly.map((e) => e.id)).toEqual([1]);
    expect(wildOnly[0]?.hasWildSoul).toBe(true);
    expect(wildOnly[0]?.hasFollowerPet).toBe(true);

    const searchByHash = filterGrimoireSpecies({
      maxId: 52,
      query: '#01',
      filter: 'all',
      speciesMap: SPECIES,
      registry: SPECIES_ANIMATION_REGISTRY,
    });
    expect(searchByHash.some((e) => e.id === 1)).toBe(true);
    expect(searchByHash.every((e) => e.id === 1)).toBe(true);

    const pendingOnly = filterGrimoireSpecies({
      maxId: 52,
      query: '',
      filter: 'pending',
      speciesMap: SPECIES,
      registry: SPECIES_ANIMATION_REGISTRY,
    });
    expect(pendingOnly.some((e) => e.id === 1)).toBe(false);
    expect(pendingOnly.some((e) => e.id === 2)).toBe(true);
  });

  it('generates both natural-language agent prompt and TypeScript snippet', () => {
    const meta = {
      speciesId: 4,
      speciesName: 'Gotín',
      role: 'special_attack' as const,
      cols: 4,
      rows: 4,
      totalFrames: 16,
      impactFrame: 7,
      cellW: 640,
      cellH: 360,
      facing: 'left' as const,
      sourceKind: 'video' as const,
    };
    const prompt = buildAgentPromptSummary(meta);
    expect(prompt).toContain('special_attack_04.webp');
    expect(prompt).toContain('#04 (Gotín)');
    expect(prompt).toContain('impactFrame 7');

    const snippet = buildTsSnippet(meta);
    expect(snippet).toContain("path: '/assets/attacks/special_attack_04.webp'");
    expect(snippet).toContain("facing: 'left'");
  });

  it('detects dual soul and follower pet bounding boxes automatically and with manual split override', () => {
    const width = 20;
    const height = 70;
    const rgba = new Uint8ClampedArray(width * height * 4);

    // Top sprite (wild soul): y = 2..18, x = 4..15
    for (let y = 2; y <= 18; y++) {
      for (let x = 4; x <= 15; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 180;
        rgba[idx + 1] = 80;
        rgba[idx + 2] = 240;
        rgba[idx + 3] = 255;
      }
    }

    // Gap from y = 19..41 (> 18 rows transparent)
    // Bottom sprite (pixel pet): y = 42..58, x = 6..13
    for (let y = 42; y <= 58; y++) {
      for (let x = 6; x <= 13; x++) {
        const idx = (y * width + x) * 4;
        rgba[idx] = 220;
        rgba[idx + 1] = 120;
        rgba[idx + 2] = 255;
        rgba[idx + 3] = 255;
      }
    }

    const autoRegions = detectDualSoulRegions(rgba, width, height);
    expect(autoRegions.splitY).toBe(30);
    expect(autoRegions.soulBox).toEqual({ x0: 4, y0: 2, x1: 15, y1: 18, w: 12, h: 17 });
    expect(autoRegions.followerBox).toEqual({ x0: 6, y0: 42, x1: 13, y1: 58, w: 8, h: 17 });

    const manualRegions = detectDualSoulRegions(rgba, width, height, 0.5);
    expect(manualRegions.splitY).toBe(35);
    expect(manualRegions.soulBox).toEqual({ x0: 4, y0: 2, x1: 15, y1: 18, w: 12, h: 17 });
    expect(manualRegions.followerBox).toEqual({ x0: 6, y0: 42, x1: 13, y1: 58, w: 8, h: 17 });

    expect(buildDualSoulFileNames(1)).toEqual({ soulFile: '01.webp', followerFile: '01.webp' });
    const prompt = buildDualSoulAgentPrompt({
      speciesId: 1,
      speciesName: 'Brasito',
      followerW: 284,
      followerH: 429,
    });
    expect(prompt).toContain('/public/assets/souls/01.webp');
    expect(prompt).toContain('/public/assets/followers/01.webp (284x429)');

    const tsSnippet = buildDualSoulTsSnippet(1);
    expect(tsSnippet).toContain("wildSoulPath: '/assets/souls/01.webp'");
    expect(tsSnippet).toContain("followerPetPath: '/assets/followers/01.webp'");
  });

  it('removes green and grey chroma backgrounds cleanly while preserving foreground pixels', () => {
    // Pixel 0: pure green screen (10, 220, 15, 255)
    // Pixel 1: dark purple armor (70, 45, 110, 255)
    const greenBuf = new Uint8ClampedArray([10, 220, 15, 255, 70, 45, 110, 255]);
    applyChromaKeyRgba(greenBuf, 'green', 52, 70);
    expect(greenBuf[3]).toBe(0);
    expect(greenBuf[7]).toBe(255);

    // Pixel 0: solid grey ~180
    // Pixel 1: bright gold highlight
    const greyBuf = new Uint8ClampedArray([180, 180, 180, 255, 232, 184, 74, 255]);
    applyChromaKeyRgba(greyBuf, 'grey', 40, 0);
    expect(greyBuf[3]).toBe(0);
    expect(greyBuf[7]).toBe(255);
  });
});
