import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { evaluateAchievements } from '../src/domain/Achievements.ts';
import {
  addCardToAlbum,
  addSoulDust,
  getAvailableCardCopies,
  socketCardOnCreature,
  upgradeCardRarity,
  upgradeCardStats,
} from '../src/domain/Cards.ts';
import { createCreature } from '../src/domain/Creature.ts';
import {
  ALL_HOUSES,
  buyHouse,
  depositCardToChest,
  depositItemToChest,
  depositPartySoulDollToBox,
  depositSoulToChest,
  getChestSoulCounts,
  getChestTotalCards,
  getChestTotalItems,
  getOwnedHousesCount,
  ownsHouse,
  withdrawBoxSoulDollToParty,
  withdrawCardFromChest,
  withdrawItemFromChest,
  withdrawSoulFromChest,
} from '../src/domain/Housing.ts';
import { isTileWalkable } from '../src/domain/TerrainRules.ts';
import { createInitialSave, migrateSaveData } from '../src/save/migrations.ts';

describe('Player Housing & Base System', () => {
  it('lists 3 purchasable houses across cities priced at 1 gold for development', () => {
    expect(ALL_HOUSES.length).toBe(3);
    expect(ALL_HOUSES.map((h) => h.cityMapId)).toEqual([
      'villa_origen',
      'pueblo_bruma',
      'arena_cumbre',
    ]);
    for (const h of ALL_HOUSES) {
      expect(h.price).toBe(1);
    }
  });

  it('buys houses for 1 gold, rejects duplicates and insufficient money', () => {
    const save = createInitialSave();
    save.money = 2;

    expect(ownsHouse(save, 'casa_villa')).toBe(false);
    const r1 = buyHouse(save, 'casa_villa');
    expect(r1.ok).toBe(true);
    expect(save.money).toBe(1);
    expect(ownsHouse(save, 'casa_villa')).toBe(true);

    const dup = buyHouse(save, 'casa_villa');
    expect(dup.ok).toBe(false);
    expect(dup.reason).toBe('already_owned');
    expect(save.money).toBe(1);

    const r2 = buyHouse(save, 'casa_bruma');
    expect(r2.ok).toBe(true);
    expect(save.money).toBe(0);

    const broke = buyHouse(save, 'casa_cumbre');
    expect(broke.ok).toBe(false);
    expect(broke.reason).toBe('not_enough_money');
    expect(getOwnedHousesCount(save)).toBe(2);
  });

  it('deposits and withdraws items cleanly between bag and shared itemChest', () => {
    const save = createInitialSave();
    save.bag = [
      { itemId: 'pocion', quantity: 5 },
      { itemId: 'capsula', quantity: 2 },
    ];

    expect(depositItemToChest(save, 'pocion', 3)).toBe(true);
    expect(save.bag.find((s) => s.itemId === 'pocion')?.quantity).toBe(2);
    expect(save.itemChest?.find((s) => s.itemId === 'pocion')?.quantity).toBe(3);
    expect(getChestTotalItems(save)).toBe(3);

    expect(depositItemToChest(save, 'capsula', 2)).toBe(true);
    expect(save.bag.find((s) => s.itemId === 'capsula')).toBeUndefined();
    expect(getChestTotalItems(save)).toBe(5);

    expect(withdrawItemFromChest(save, 'pocion', 4)).toBe(false);
    expect(withdrawItemFromChest(save, 'pocion', 2)).toBe(true);
    expect(save.bag.find((s) => s.itemId === 'pocion')?.quantity).toBe(4);
    expect(save.itemChest?.find((s) => s.itemId === 'pocion')?.quantity).toBe(1);
  });

  it('deposits and withdraws cards between active album and house cardChest, guarding socketed copies and preserving upgrades', () => {
    const save = createInitialSave();
    const rng = createRng(17);
    const doll = createCreature(1, 10, rng);
    save.party.push(doll);

    addCardToAlbum(save, 1);
    addCardToAlbum(save, 1);
    addSoulDust(save, 500);
    expect(upgradeCardRarity(save, 1).ok).toBe(true);
    expect(upgradeCardStats(save, 1).ok).toBe(true);

    // Socket 1 copy -> 1 free copy left
    expect(socketCardOnCreature(save, doll, 1).ok).toBe(true);
    expect(getAvailableCardCopies(save, 1)).toBe(1);

    // Cannot deposit 2 copies because 1 is socketed
    expect(depositCardToChest(save, 1, 2)).toEqual({ ok: false, reason: 'insufficient' });
    expect(depositCardToChest(save, 1, 1)).toEqual({ ok: true });
    expect(depositCardToChest(save, 1, 1)).toEqual({ ok: false, reason: 'socketed' });

    expect(getChestTotalCards(save)).toBe(1);
    expect(save.cardChest?.[1]?.rarityOverride).toBe('rara');
    expect(save.cardChest?.[1]?.upgradeLevel).toBe(1);

    // Move an un-socketed upgraded card completely into chest and back
    addCardToAlbum(save, 4);
    expect(upgradeCardStats(save, 4).ok).toBe(true);
    expect(depositCardToChest(save, 4, 1)).toEqual({ ok: true });
    expect(save.cardAlbum?.[4]).toBeUndefined();
    expect(getChestTotalCards(save)).toBe(2);

    expect(withdrawCardFromChest(save, 4, 1)).toEqual({ ok: true });
    expect(save.cardChest?.[4]).toBeUndefined();
    expect(save.cardAlbum?.[4]?.count).toBe(1);
    expect(save.cardAlbum?.[4]?.upgradeLevel).toBe(1);
  });

  it('moves captured reserve souls and party/boxed SoulDolls between active inventory and house storage', () => {
    const save = createInitialSave();
    const rng = createRng(29);
    const d1 = createCreature(1, 8, rng);
    const d2 = createCreature(4, 9, rng);
    save.party.push(d1, d2);
    save.soulReserve = [
      { uid: 'soul_a', speciesId: 7, level: 5, caughtAt: 1000, soulpotId: 'capsula' },
      { uid: 'soul_b', speciesId: 10, level: 6, caughtAt: 2000, soulpotId: 'supercapsula' },
    ];

    // Deposit unbound soul
    expect(depositSoulToChest(save, 'soul_a')).toBe(true);
    expect(save.soulReserve.map((s) => s.uid)).toEqual(['soul_b']);
    expect(save.soulChest?.map((s) => s.uid)).toEqual(['soul_a']);

    // Deposit party SoulDoll to box, guard last remaining party member
    const depDoll = depositPartySoulDollToBox(save, 1, 0);
    expect(depDoll).toEqual({ ok: true, boxIndex: 0 });
    expect(save.party).toHaveLength(1);
    expect(depositPartySoulDollToBox(save, 0, 0)).toEqual({ ok: false, reason: 'last_party' });

    const counts = getChestSoulCounts(save);
    expect(counts.reserveSouls).toBe(1);
    expect(counts.chestSouls).toBe(1);
    expect(counts.partyDolls).toBe(1);
    expect(counts.boxedDolls).toBe(1);
    expect(counts.totalActiveSouls).toBe(2);
    expect(counts.totalStoredSouls).toBe(2);

    // Withdraw unbound soul and boxed SoulDoll back to active inventory
    expect(withdrawSoulFromChest(save, 'soul_a')).toBe(true);
    expect(save.soulChest).toHaveLength(0);
    expect(save.soulReserve.map((s) => s.uid)).toEqual(['soul_b', 'soul_a']);

    const wdDoll = withdrawBoxSoulDollToParty(save, 0, 0);
    expect(wdDoll).toEqual({ ok: true });
    expect(save.party).toHaveLength(2);
    expect(save.storageBoxes[0].slots[0]).toBeNull();
  });

  it('evaluates achievements wall milestones from live SaveData state', () => {
    const save = createInitialSave();
    let evalRes = evaluateAchievements(save);
    expect(evalRes.unlockedCount).toBe(0);

    save.money = 100;
    buyHouse(save, 'casa_villa');
    save.stats.battlesWon = 5;
    save.champion = true;

    evalRes = evaluateAchievements(save);
    const unlockedIds = evalRes.items.filter((i) => i.unlocked).map((i) => i.def.id);
    expect(unlockedIds).toContain('primera_casa');
    expect(unlockedIds).toContain('duelos_5');
    expect(unlockedIds).toContain('campeon_cumbre');
    expect(unlockedIds).not.toContain('todas_casas');

    buyHouse(save, 'casa_bruma');
    buyHouse(save, 'casa_cumbre');
    evalRes = evaluateAchievements(save);
    expect(evalRes.items.find((i) => i.def.id === 'todas_casas')?.unlocked).toBe(true);
  });

  it('migrates legacy saves without housing fields and sanitizes corrupted housing, cardChest, and soulChest data', () => {
    const migrated = migrateSaveData({
      version: 6,
      mapId: 'villa_origen',
      playerX: 24,
      playerY: 26,
      ownedHouses: ['casa_villa', 'invalid_house', 'casa_villa'],
      itemChest: [
        { itemId: 'pocion', quantity: 3 },
        { itemId: 'pocion', quantity: 2 },
        { itemId: 'no_existe', quantity: 99 },
        { itemId: 'capsula', quantity: 0 },
      ],
      cardChest: {
        1: { speciesId: 1, count: 2, firstObtainedAt: 500, rarityOverride: 'epica', upgradeLevel: 2 },
        9999: { speciesId: 9999, count: 1 },
        4: { speciesId: 4, count: 0 },
      },
      soulChest: [
        { uid: 's1', speciesId: 1, level: 5, caughtAt: 100, soulpotId: 'capsula' },
        { uid: 's1', speciesId: 1, level: 5, caughtAt: 100, soulpotId: 'capsula' },
        { uid: 'bad', speciesId: 9999, level: 3 },
      ],
    });
    expect(migrated).not.toBeNull();
    expect(migrated!.ownedHouses).toEqual(['casa_villa']);
    expect(migrated!.itemChest).toEqual([{ itemId: 'pocion', quantity: 5 }]);
    expect(migrated!.cardChest?.[1]).toEqual({
      speciesId: 1,
      count: 2,
      firstObtainedAt: 500,
      rarityOverride: 'epica',
      upgradeLevel: 2,
    });
    expect(migrated!.cardChest?.[4]).toBeUndefined();
    expect(migrated!.cardChest?.[9999]).toBeUndefined();
    expect(migrated!.soulChest).toEqual([
      { uid: 's1', speciesId: 1, level: 5, caughtAt: 100, soulpotId: 'capsula' },
    ]);
  });

  it('connects all 3 city house doors to two-story explorable interiors with chest, wall, and bed', () => {
    for (const house of ALL_HOUSES) {
      const city = MAPS[house.cityMapId];
      const floor1 = MAPS[house.floor1MapId];
      const floor2 = MAPS[house.floor2MapId];

      expect(city).toBeDefined();
      expect(floor1).toBeDefined();
      expect(floor2).toBeDefined();
      expect(floor1.isInterior).toBe(true);
      expect(floor2.isInterior).toBe(true);

      // Town has door warp & real-estate broker NPC
      const doorWarp = city.warps.find(
        (w) => w.houseId === house.id && w.targetMap === house.floor1MapId
      );
      expect(doorWarp).toBeDefined();
      expect(city.npcs.some((n) => n.houseBrokerId === house.id)).toBe(true);

      // Floor 1 has chest, achievements_wall, kitchen props, and staircase warp up
      expect(floor1.props.some((p) => p.kind === 'chest')).toBe(true);
      expect(floor1.props.some((p) => p.kind === 'achievements_wall')).toBe(true);
      expect(floor1.props.some((p) => p.kind === 'stove')).toBe(true);
      expect(floor1.props.some((p) => p.kind === 'sofa')).toBe(true);
      const stairUpWarp = floor1.warps.find((w) => w.targetMap === house.floor2MapId);
      expect(stairUpWarp).toBeDefined();

      // Floor 2 has bed and return staircase warp down
      const bed = floor2.props.find((p) => p.kind === 'bed');
      expect(bed).toBeDefined();
      const stairDownWarp = floor2.warps.find((w) => w.targetMap === house.floor1MapId);
      expect(stairDownWarp).toBeDefined();

      // Bed is reachable from at least one adjacent walkable tile
      const adj = [
        [bed!.x, bed!.z + 1],
        [bed!.x, bed!.z - 1],
        [bed!.x + 1, bed!.z],
        [bed!.x - 1, bed!.z],
      ];
      expect(
        adj.some(([ax, ay]) => isTileWalkable(floor2, ax, ay, ax, ay))
      ).toBe(true);
    }
  });
});
