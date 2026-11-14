import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ALL_SPECIES_IDS } from '../src/data/species.ts';
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
    const camPos = new THREE.Vector3(-4.1, 2.1, 5.85);

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
});
