import { describe, expect, it } from 'vitest';
import {
  ALL_SPECIES_IDS_WITH_FOLLOWER_PET,
  ALL_SPECIES_IDS_WITH_WILD_SOUL,
  SOUL_FORM_REGISTRY,
  getFollowerPetSpriteUrl,
  getSoulFormEntry,
  getWildSoulSpriteUrl,
  hasFollowerPetSprite,
  hasWildSoulSprite,
  resolveEnemyBattleSpriteView,
  resolveReserveSoulSpriteView,
} from '../src/data/soulForms.ts';

describe('soulForms registry and battle view resolution', () => {
  it('registers wild soul and reserved follower pet assets for SoulDoll #01', () => {
    expect(SOUL_FORM_REGISTRY.length).toBeGreaterThanOrEqual(1);
    expect(ALL_SPECIES_IDS_WITH_WILD_SOUL).toContain(1);
    expect(ALL_SPECIES_IDS_WITH_FOLLOWER_PET).toContain(1);

    const entry = getSoulFormEntry(1);
    expect(entry).toEqual({
      speciesId: 1,
      wildSoulPath: '/assets/souls/01.webp',
      followerPetPath: '/assets/followers/01.webp',
    });

    expect(hasWildSoulSprite(1)).toBe(true);
    expect(hasFollowerPetSprite(1)).toBe(true);
    expect(getWildSoulSpriteUrl(1)).toBe('/assets/souls/01.webp');
    expect(getFollowerPetSpriteUrl(1)).toBe('/assets/followers/01.webp');

    expect(hasWildSoulSprite(2)).toBe(false);
    expect(hasFollowerPetSprite(2)).toBe(false);
    expect(getWildSoulSpriteUrl(99)).toBeNull();
    expect(getFollowerPetSpriteUrl(99)).toBeNull();
  });

  it('uses unbodied wild soul sprite in wild encounters and embodied SoulDoll sprite against SoulTrainers', () => {
    // Wild encounter with registered wild soul -> wild unbodied form
    expect(resolveEnemyBattleSpriteView(1, true)).toBe('wild');
    // SoulTrainer battle (`isWild = false`) -> embodied SoulDoll form
    expect(resolveEnemyBattleSpriteView(1, false)).toBe('front');

    // Species without a registered wild soul safely falls back to embodied front sprite
    expect(resolveEnemyBattleSpriteView(15, true)).toBe('front');
    expect(resolveEnemyBattleSpriteView(15, false)).toBe('front');
  });

  it('uses wild soul form for unbodied reserves when available and falls back otherwise', () => {
    expect(resolveReserveSoulSpriteView(1)).toBe('wild');
    expect(resolveReserveSoulSpriteView(2)).toBe('front');
  });
});
