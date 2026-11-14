import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ALL_SPECIES_IDS } from '../src/data/species.ts';
import { DEFAULT_BATTLE_POSE } from '../src/domain/BattleCameraScript.ts';
import { ENEMY_STATION_POS, PLAYER_STATION_POS } from '../src/engine/BattleStage.ts';
import { BattleCamera } from '../src/engine/BattleCamera.ts';
import {
  findRegionAlphaBounds,
  getSoulDollSheetId,
  getSoulDollSheetUrl,
} from '../src/gfx/SoulDollSheets.ts';

describe('SoulDoll 1x2 spritesheets & battle scaling', () => {
  it('maps every species ID 1..50 to its 01..50 .webp spritesheet URL', () => {
    for (const id of ALL_SPECIES_IDS) {
      expect(getSoulDollSheetId(id)).toBe(id);
      const url = getSoulDollSheetUrl(id);
      expect(url).toBe(`/assets/souldolls/${String(id).padStart(2, '0')}.webp`);
    }

    expect(getSoulDollSheetId(0)).toBe(1);
    expect(getSoulDollSheetId(999)).toBe(52);
  });

  it('extracts separate front (left) and back (right) tight alpha bounding boxes from 1x2 sheets', () => {
    const w = 12;
    const h = 8;
    const data = new Uint8ClampedArray(w * h * 4);
    const setOpaque = (x: number, y: number, alpha = 255) => {
      const idx = (y * w + x) * 4;
      data[idx] = 200;
      data[idx + 1] = 160;
      data[idx + 2] = 120;
      data[idx + 3] = alpha;
    };

    // Front region (0..6): box from (1,2) to (4,7) -> 4x6
    setOpaque(1, 2);
    setOpaque(4, 7);
    // Faint fringe pixel ignored (< threshold 12)
    setOpaque(0, 0, 8);

    // Back region (6..12): box from (7,1) to (10,6) -> 4x6
    setOpaque(7, 1);
    setOpaque(10, 6);

    const front = findRegionAlphaBounds(data, w, h, 0, w / 2);
    const back = findRegionAlphaBounds(data, w, h, w / 2, w);

    expect(front).toEqual({ x0: 1, y0: 2, x1: 4, y1: 7, w: 4, h: 6 });
    expect(back).toEqual({ x0: 7, y0: 1, x1: 10, y1: 6, w: 4, h: 6 });
  });

  it('computes continuous normalized battle sprite scale without 32px step distortion', () => {
    const cam = new THREE.PerspectiveCamera(44, 16 / 9, 0.3, 48);
    const bc = new BattleCamera(cam);
    const camPos = new THREE.Vector3(
      DEFAULT_BATTLE_POSE.pos.x,
      DEFAULT_BATTLE_POSE.pos.y,
      DEFAULT_BATTLE_POSE.pos.z
    );

    const pScale = bc.computeNormalizedSpriteScale(PLAYER_STATION_POS, 0.34);
    const eScale = bc.computeNormalizedSpriteScale(ENEMY_STATION_POS, 0.27);
    expect(pScale).toBeGreaterThan(1.0);
    expect(eScale).toBeGreaterThan(1.0);

    const distP = PLAYER_STATION_POS.distanceTo(camPos);
    const distE = ENEMY_STATION_POS.distanceTo(camPos);
    expect((pScale / distP) / (eScale / distE)).toBeCloseTo(0.34 / 0.27, 4);

    // Portrait aspect adapts cleanly without oversizing offscreen
    cam.aspect = 9 / 16;
    const pPortrait = bc.computeNormalizedSpriteScale(PLAYER_STATION_POS, 0.34);
    const ePortrait = bc.computeNormalizedSpriteScale(ENEMY_STATION_POS, 0.27);
    expect(pPortrait).toBeGreaterThan(0.8);
    expect(ePortrait).toBeGreaterThan(0.8);
  });

  it('frames both SoulDoll stations inside unobstructed portrait and landscape bounds through peak idle breathing and sway', () => {
    const projectScreenBounds = (aspect: number) => {
      const cam = new THREE.PerspectiveCamera(52, aspect, 0.3, 48);
      const bc = new BattleCamera(cam);
      bc.init(false, false);

      const pScale = bc.computeNormalizedSpriteScale(PLAYER_STATION_POS, 0.45);
      const eScale = bc.computeNormalizedSpriteScale(ENEMY_STATION_POS, 0.285);

      const toScreen = (world: THREE.Vector3) => {
        const v = world.clone().project(cam);
        return { x: v.x * 0.5 + 0.5, y: -v.y * 0.5 + 0.5 };
      };

      // Peak idle inhale adds +5.5% upper expansion/heave; sample full idle camera sway cycle
      let minEHeadBreathY = 1;
      let minPHeadBreathY = 1;
      let maxPFeetY = 0;
      for (let i = 0; i < 8; i++) {
        if (i > 0) bc.update(0.75);
        const pF = toScreen(PLAYER_STATION_POS);
        const pH = toScreen(
          PLAYER_STATION_POS.clone().add(new THREE.Vector3(0, pScale * 1.055, 0))
        );
        const eH = toScreen(
          ENEMY_STATION_POS.clone().add(new THREE.Vector3(0, eScale * 1.055, 0))
        );
        minEHeadBreathY = Math.min(minEHeadBreathY, eH.y);
        minPHeadBreathY = Math.min(minPHeadBreathY, pH.y);
        maxPFeetY = Math.max(maxPFeetY, pF.y);
      }

      bc.init(false, false);
      const pFeet = toScreen(PLAYER_STATION_POS);
      const pHead = toScreen(PLAYER_STATION_POS.clone().add(new THREE.Vector3(0, pScale, 0)));
      const eFeet = toScreen(ENEMY_STATION_POS);
      const eHead = toScreen(ENEMY_STATION_POS.clone().add(new THREE.Vector3(0, eScale, 0)));

      return {
        pFeet,
        pHead,
        eFeet,
        eHead,
        pScale,
        eScale,
        minEHeadBreathY,
        minPHeadBreathY,
        maxPFeetY,
      };
    };

    // Compact portrait phone (360x740)
    const compactPortrait = projectScreenBounds(360 / 740);
    expect(compactPortrait.minEHeadBreathY).toBeGreaterThan(0.2);
    expect(compactPortrait.minPHeadBreathY).toBeGreaterThan(0.18);
    expect(compactPortrait.maxPFeetY).toBeLessThan(0.58);

    // Modern portrait phone (~9:19.5)
    const portrait = projectScreenBounds(412 / 892);
    expect(portrait.minEHeadBreathY).toBeGreaterThan(0.2);
    expect(portrait.minPHeadBreathY).toBeGreaterThan(0.18);
    expect(portrait.maxPFeetY).toBeLessThan(0.58);
    expect(portrait.eFeet.x - portrait.pFeet.x).toBeGreaterThan(0.35);
    const portraitPlayerH = portrait.pFeet.y - portrait.pHead.y;
    const portraitEnemyH = portrait.eFeet.y - portrait.eHead.y;
    expect(portraitPlayerH / portraitEnemyH).toBeGreaterThan(1.45);
    expect(portraitPlayerH).toBeGreaterThan(0.3);
    expect(portraitPlayerH).toBeLessThan(0.38);
    expect(portraitEnemyH).toBeGreaterThan(0.18);
    expect(portraitEnemyH).toBeLessThan(0.25);

    // Desktop landscape (16:9)
    const landscape = projectScreenBounds(16 / 9);
    expect(landscape.minEHeadBreathY).toBeGreaterThan(0.13);
    expect(landscape.minPHeadBreathY).toBeGreaterThan(0.11);
    expect(landscape.maxPFeetY).toBeLessThan(0.67);
    expect(landscape.eFeet.x - landscape.pFeet.x).toBeGreaterThan(0.2);
    const landscapePlayerH = landscape.pFeet.y - landscape.pHead.y;
    const landscapeEnemyH = landscape.eFeet.y - landscape.eHead.y;
    expect(landscapePlayerH / landscapeEnemyH).toBeGreaterThan(1.45);
  });
});
