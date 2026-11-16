import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { getMove } from '../src/data/moves.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../src/data/species.ts';
import { BattleEngine } from '../src/domain/BattleEngine.ts';
import { sumBodyPartsCurrent } from '../src/domain/BodyParts.ts';
import {
  addCardToAlbum,
  addSoulDust,
  BASE_CARD_DROP_CHANCE,
  canDismantleDuplicateCard,
  CARD_DISMANTLE_DUST,
  CARD_RARITY_DROP_MULTIPLIERS,
  CARD_RARITY_UPGRADE_COST,
  dismantleDuplicateCard,
  formatCardBonuses,
  getAlbumCounts,
  getAvailableCardCopies,
  getCardDef,
  getCardDropChance,
  getCardRarityDropMultiplier,
  getCardStatUpgradeCost,
  getEffectiveCardDef,
  getSoulDust,
  MAX_CARD_STAT_UPGRADE_LEVEL,
  rollCardDrop,
  socketCardOnCreature,
  unsocketCardFromCreature,
  upgradeCardRarity,
  upgradeCardStats,
} from '../src/domain/Cards.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { applyEvolution } from '../src/domain/Evolution.ts';
import { awardExperience, computeBattleXp } from '../src/domain/Experience.ts';
import type { CardRarity } from '../src/domain/types.ts';
import { createInitialSave, CURRENT_SAVE_VERSION, migrateSaveData } from '../src/save/migrations.ts';

describe('SoulDolls Collectible Cards, Album & Stat Socketing', () => {
  it('generates valid card definitions, 4-tier rarities, descriptions, and scaled bonuses for all 50 species', () => {
    expect(ALL_SPECIES_IDS).toHaveLength(50);
    const counts: Record<CardRarity, number> = {
      comun: 0,
      rara: 0,
      epica: 0,
      legendaria: 0,
    };

    for (const id of ALL_SPECIES_IDS) {
      const spec = getSpecies(id);
      const card = getCardDef(id);
      expect(card.speciesId).toBe(id);
      expect(card.description).toContain(spec.description);
      expect(card.types).toEqual(spec.types);
      const bonusValues = Object.values(card.bonuses).filter((n): n is number => (n ?? 0) > 0);
      const bonusSum = bonusValues.reduce((s, n) => s + n, 0);
      expect(bonusSum).toBeGreaterThan(0);
      expect(formatCardBonuses(card.bonuses).length).toBeGreaterThan(0);

      counts[card.rarity] += 1;
      if (card.rarity === 'comun') expect(bonusSum).toBe(6);
      if (card.rarity === 'rara') expect(bonusSum).toBe(12);
      if (card.rarity === 'epica') expect(bonusSum).toBe(18);
      if (card.rarity === 'legendaria') expect(bonusSum).toBe(28);
    }

    expect(counts.comun).toBeGreaterThan(0);
    expect(counts.rara).toBeGreaterThan(0);
    expect(counts.epica).toBeGreaterThan(0);
    expect(counts.legendaria).toBeGreaterThan(0);

    // Representative species per tier
    expect(getCardDef(1).rarity).toBe('comun'); // Brasito (stage 1)
    expect(getCardDef(2).rarity).toBe('rara'); // Pirodraco (stage 2)
    expect(getCardDef(45).rarity).toBe('rara'); // Dracornio (rare single-stage)
    expect(getCardDef(3).rarity).toBe('epica'); // Ignisaurio (stage 3)
    expect(getCardDef(18).rarity).toBe('epica'); // Cristalux (apex single-stage)
    expect(getCardDef(50).rarity).toBe('legendaria'); // Astralón (legendary)
  });

  it('applies decreasing drop rate multipliers across Common, Rare, Epic, and Legendary cards', () => {
    expect(CARD_RARITY_DROP_MULTIPLIERS.comun).toBe(1.0);
    expect(getCardRarityDropMultiplier('comun')).toBeGreaterThan(
      getCardRarityDropMultiplier('rara')
    );
    expect(getCardRarityDropMultiplier('rara')).toBeGreaterThan(
      getCardRarityDropMultiplier('epica')
    );
    expect(getCardRarityDropMultiplier('epica')).toBeGreaterThan(
      getCardRarityDropMultiplier('legendaria')
    );

    const commonChance = getCardDropChance(1, false);
    const rareChance = getCardDropChance(2, false);
    const epicChance = getCardDropChance(3, false);
    const legendaryChance = getCardDropChance(50, false);

    expect(commonChance).toBeCloseTo(BASE_CARD_DROP_CHANCE * CARD_RARITY_DROP_MULTIPLIERS.comun);
    expect(rareChance).toBeCloseTo(BASE_CARD_DROP_CHANCE * CARD_RARITY_DROP_MULTIPLIERS.rara);
    expect(epicChance).toBeCloseTo(BASE_CARD_DROP_CHANCE * CARD_RARITY_DROP_MULTIPLIERS.epica);
    expect(legendaryChance).toBeCloseTo(
      BASE_CARD_DROP_CHANCE * CARD_RARITY_DROP_MULTIPLIERS.legendaria
    );
    expect(commonChance).toBeGreaterThan(rareChance);
    expect(rareChance).toBeGreaterThan(epicChance);
    expect(epicChance).toBeGreaterThan(legendaryChance);
    expect(getCardDropChance(50, true)).toBeGreaterThan(legendaryChance);
  });

  it('tracks album discovery, duplicate counts, and enforces available copy limits when socketing', () => {
    const save = createInitialSave();
    const rng = createRng(42);
    const dollA = createCreature(1, 10, rng);
    const dollB = createCreature(4, 10, rng);
    save.party.push(dollA, dollB);

    expect(getAlbumCounts(save).collected).toBe(0);
    expect(socketCardOnCreature(save, dollA, 1)).toEqual({ ok: false, reason: 'not_owned' });

    const firstDrop = addCardToAlbum(save, 1);
    expect(firstDrop.isNew).toBe(true);
    expect(firstDrop.entry.count).toBe(1);
    expect(getAlbumCounts(save)).toEqual({ collected: 1, total: 50, totalCopies: 1 });
    expect(getAvailableCardCopies(save, 1)).toBe(1);

    // Socket 1 copy onto dollA
    expect(socketCardOnCreature(save, dollA, 1).ok).toBe(true);
    expect(dollA.socketedCardId).toBe(1);
    expect(getAvailableCardCopies(save, 1)).toBe(0);

    // Cannot socket same single copy onto dollB at the same time
    expect(socketCardOnCreature(save, dollB, 1)).toEqual({ ok: false, reason: 'no_copy' });

    // Getting a duplicate drop allows socketing onto a second SoulDoll
    const secondDrop = addCardToAlbum(save, 1);
    expect(secondDrop.isNew).toBe(false);
    expect(secondDrop.entry.count).toBe(2);
    expect(getAvailableCardCopies(save, 1)).toBe(1);
    expect(socketCardOnCreature(save, dollB, 1).ok).toBe(true);
    expect(getAvailableCardCopies(save, 1)).toBe(0);

    // Unsocketing frees a copy again
    expect(unsocketCardFromCreature(dollA)).toBe(1);
    expect(dollA.socketedCardId).toBeUndefined();
    expect(getAvailableCardCopies(save, 1)).toBe(1);
  });

  it('applies card attribute bonuses to stats, keeps 4-part body HP synced, and preserves bonuses across level-up and evolution', () => {
    const save = createInitialSave();
    const doll = createCreature(1, 15, createRng(101));
    save.party.push(doll);
    addCardToAlbum(save, 9); // stage 3 epic card -> +8/+6/+4 bonuses

    const baseStats = { ...doll.stats };
    const card = getCardDef(9);

    const res = socketCardOnCreature(save, doll, 9);
    expect(res.ok).toBe(true);

    expect(doll.stats.hp).toBe(baseStats.hp + (card.bonuses.hp ?? 0));
    expect(doll.stats.atk).toBe(baseStats.atk + (card.bonuses.atk ?? 0));
    expect(doll.stats.def).toBe(baseStats.def + (card.bonuses.def ?? 0));
    expect(doll.stats.spa).toBe(baseStats.spa + (card.bonuses.spa ?? 0));
    expect(doll.stats.spd).toBe(baseStats.spd + (card.bonuses.spd ?? 0));
    expect(doll.stats.spe).toBe(baseStats.spe + (card.bonuses.spe ?? 0));

    // Body parts sum matches max HP
    const parts = doll.bodyParts!;
    expect(parts.head.max + parts.torso.max + parts.arms.max + parts.legs.max).toBe(doll.stats.hp);
    expect(sumBodyPartsCurrent(parts)).toBe(doll.currentHp);

    // Level up preserves socketed bonuses
    const neededXp = computeBattleXp(createCreature(20, 30, createRng(5)), true) * 5;
    awardExperience(doll, neededXp);
    expect(doll.socketedCardId).toBe(9);
    const unsocketedCheck = { ...doll };
    unsocketCardFromCreature(doll);
    expect(unsocketedCheck.stats.atk).toBe(doll.stats.atk + (card.bonuses.atk ?? 0));
    expect(unsocketedCheck.stats.spa).toBe(doll.stats.spa + (card.bonuses.spa ?? 0));

    // Re-socket and evolve: bonuses remain applied on evolved form
    socketCardOnCreature(save, doll, 9);
    applyEvolution(doll, 2);
    const evolvedWithCard = { ...doll.stats };
    unsocketCardFromCreature(doll);
    expect(evolvedWithCard.spa).toBe(doll.stats.spa + (card.bonuses.spa ?? 0));
    expect(evolvedWithCard.spd).toBe(doll.stats.spd + (card.bonuses.spd ?? 0));

    // Legendary card (#50 Astralón) grants +10/+8/+6/+4 across 4 stats
    addCardToAlbum(save, 50);
    const legCard = getCardDef(50);
    expect(legCard.rarity).toBe('legendaria');
    const preLegStats = { ...doll.stats };
    expect(socketCardOnCreature(save, doll, 50).ok).toBe(true);
    expect(doll.stats.hp).toBe(preLegStats.hp + (legCard.bonuses.hp ?? 0));
    expect(doll.stats.atk).toBe(preLegStats.atk + (legCard.bonuses.atk ?? 0));
    expect(doll.stats.spa).toBe(preLegStats.spa + (legCard.bonuses.spa ?? 0));
    expect(doll.stats.spe).toBe(preLegStats.spe + (legCard.bonuses.spe ?? 0));
  });

  it('rolls card drops probabilistically and emits card_drop event in BattleEngine when enemy doll faints', () => {
    expect(getCardDropChance(1, false)).toBeGreaterThan(0);
    expect(getCardDropChance(1, true)).toBeGreaterThan(getCardDropChance(1, false));

    let drops = 0;
    const sampleRng = createRng(9001);
    for (let i = 0; i < 200; i++) {
      if (rollCardDrop(1, sampleRng, false)) drops++;
    }
    expect(drops).toBeGreaterThan(30);
    expect(drops).toBeLessThan(120);

    // Find a seed where defeating an enemy SoulDoll in BattleEngine produces a card_drop event
    let sawCardDropEvent = false;
    for (let seed = 1; seed <= 40; seed++) {
      const rng = createRng(seed);
      const playerMon = createCreature(4, 30, rng);
      const dmgIdx = Math.max(
        0,
        playerMon.moves.findIndex((m) => getMove(m.moveId).power > 0)
      );
      const enemyMon = createCreature(10, 2, rng);

      const engine = new BattleEngine(
        [playerMon],
        [enemyMon],
        [],
        rng,
        undefined,
        'meadow'
      );
      const events = engine.stepTurn({ type: 'move', moveIndex: dmgIdx });
      const dropEv = events.find((e) => e.type === 'card_drop');
      if (dropEv && dropEv.type === 'card_drop') {
        expect(dropEv.speciesId).toBe(10);
        sawCardDropEvent = true;
        break;
      }
    }
    expect(sawCardDropEvent).toBe(true);
  });

  it('migrates and preserves cardAlbum and socketedCardId across saves', () => {
    const save = createInitialSave();
    const doll = createCreature(1, 12, createRng(7));
    save.party.push(doll);
    addCardToAlbum(save, 1);
    socketCardOnCreature(save, doll, 1);

    const raw = JSON.parse(JSON.stringify(save));
    const migrated = migrateSaveData(raw);
    expect(migrated).not.toBeNull();
    expect(migrated!.version).toBe(CURRENT_SAVE_VERSION);
    expect(migrated!.cardAlbum?.[1]?.count).toBe(1);
    expect(migrated!.party[0].socketedCardId).toBe(1);
    expect(migrated!.party[0].stats).toEqual(doll.stats);
  });

  it('breaks down un-socketed duplicate cards into Soul Dust scaled by rarity', () => {
    const save = createInitialSave();
    const rng = createRng(77);
    const dollA = createCreature(1, 10, rng);
    const dollB = createCreature(4, 10, rng);
    save.party.push(dollA, dollB);

    expect(getSoulDust(save)).toBe(0);
    expect(dismantleDuplicateCard(save, 1).reason).toBe('not_owned');

    addCardToAlbum(save, 1); // Comun, 1 copy
    expect(canDismantleDuplicateCard(save, 1)).toEqual({ ok: false, reason: 'no_duplicate' });
    expect(dismantleDuplicateCard(save, 1).ok).toBe(false);

    // Add duplicate copy and socket both
    addCardToAlbum(save, 1); // 2 copies total
    socketCardOnCreature(save, dollA, 1);
    socketCardOnCreature(save, dollB, 1);
    expect(canDismantleDuplicateCard(save, 1)).toEqual({ ok: false, reason: 'all_socketed' });

    // Unsocket 1 copy -> can now dismantle the duplicate
    unsocketCardFromCreature(dollB);
    expect(canDismantleDuplicateCard(save, 1)).toEqual({ ok: true });
    const res = dismantleDuplicateCard(save, 1);
    expect(res.ok).toBe(true);
    expect(res.dustGained).toBe(CARD_DISMANTLE_DUST.comun);
    expect(res.remainingCount).toBe(1);
    expect(getSoulDust(save)).toBe(CARD_DISMANTLE_DUST.comun);

    // Higher rarity cards yield more Soul Dust
    addCardToAlbum(save, 50); // Legendaria
    addCardToAlbum(save, 50);
    const legRes = dismantleDuplicateCard(save, 50);
    expect(legRes.ok).toBe(true);
    expect(legRes.dustGained).toBe(CARD_DISMANTLE_DUST.legendaria);
    expect(CARD_DISMANTLE_DUST.legendaria).toBeGreaterThan(CARD_DISMANTLE_DUST.epica);
    expect(CARD_DISMANTLE_DUST.epica).toBeGreaterThan(CARD_DISMANTLE_DUST.rara);
    expect(CARD_DISMANTLE_DUST.rara).toBeGreaterThan(CARD_DISMANTLE_DUST.comun);
  });

  it('upgrades card rarity and stat levels with Soul Dust, updates socketed SoulDolls, and persists across level-up, evolution, and save migration', () => {
    const save = createInitialSave();
    const rng = createRng(123);
    const doll = createCreature(1, 15, rng);
    save.party.push(doll);
    addCardToAlbum(save, 1); // Comun card (#1 Brasito)
    socketCardOnCreature(save, doll, 1);

    const beforeStats = { ...doll.stats };
    const beforeCard = getEffectiveCardDef(save, 1);
    expect(beforeCard.rarity).toBe('comun');
    expect(beforeCard.upgradeLevel).toBe(0);

    // Cannot upgrade without enough Soul Dust
    expect(upgradeCardRarity(save, 1)).toEqual({
      ok: false,
      cost: CARD_RARITY_UPGRADE_COST.comun,
      soulDust: 0,
      reason: 'insufficient_dust',
    });

    // Grant Soul Dust and upgrade rarity comun -> rara -> epica -> legendaria
    addSoulDust(save, 500);
    const rarityUp = upgradeCardRarity(save, 1);
    expect(rarityUp.ok).toBe(true);
    expect(rarityUp.newRarity).toBe('rara');

    const rareCard = getEffectiveCardDef(save, 1);
    expect(rareCard.rarity).toBe('rara');
    expect(doll.stats.spa).toBeGreaterThanOrEqual(beforeStats.spa);
    const rareSum = Object.values(rareCard.bonuses).reduce((s, n) => s + (n ?? 0), 0);
    const baseSum = Object.values(beforeCard.bonuses).reduce((s, n) => s + (n ?? 0), 0);
    expect(rareSum).toBe(12);
    expect(baseSum).toBe(6);

    // Upgrade stats multiple levels up to MAX_CARD_STAT_UPGRADE_LEVEL
    const preStatUpgradeBonuses = { ...rareCard.bonuses };
    const costLv0 = getCardStatUpgradeCost('rara', 0);
    const statRes = upgradeCardStats(save, 1);
    expect(statRes.ok).toBe(true);
    expect(statRes.newLevel).toBe(1);
    expect(statRes.cost).toBe(costLv0);

    const reinforcedCard = getEffectiveCardDef(save, 1);
    const reinforcedSum = Object.values(reinforcedCard.bonuses).reduce((s, n) => s + (n ?? 0), 0);
    const preReinforcedSum = Object.values(preStatUpgradeBonuses).reduce((s, n) => s + (n ?? 0), 0);
    expect(reinforcedSum).toBe(preReinforcedSum + 3); // +2 primary, +1 secondary

    // Level-up & Evolution keep upgraded card bonuses
    const neededXp = computeBattleXp(createCreature(20, 30, createRng(9)), true) * 4;
    awardExperience(doll, neededXp);
    applyEvolution(doll, 2);

    const evolvedWithUpgradedCard = { ...doll.stats };
    unsocketCardFromCreature(doll);
    const evolvedWithoutCard = { ...doll.stats };
    expect(
      evolvedWithUpgradedCard.atk - evolvedWithoutCard.atk +
        (evolvedWithUpgradedCard.spa - evolvedWithoutCard.spa) +
        (evolvedWithUpgradedCard.spe - evolvedWithoutCard.spe) +
        (evolvedWithUpgradedCard.def - evolvedWithoutCard.def) +
        (evolvedWithUpgradedCard.spd - evolvedWithoutCard.spd) +
        (evolvedWithUpgradedCard.hp - evolvedWithoutCard.hp)
    ).toBe(reinforcedSum);

    // Re-socket and verify cap + save migration preservation
    socketCardOnCreature(save, doll, 1);
    for (let i = 1; i < MAX_CARD_STAT_UPGRADE_LEVEL; i++) {
      expect(upgradeCardStats(save, 1).ok).toBe(true);
    }
    expect(upgradeCardStats(save, 1).reason).toBe('max_level');

    const raw = JSON.parse(JSON.stringify(save));
    const migrated = migrateSaveData(raw)!;
    expect(getSoulDust(migrated)).toBe(getSoulDust(save));
    expect(migrated.cardAlbum?.[1]?.rarityOverride).toBe('rara');
    expect(migrated.cardAlbum?.[1]?.upgradeLevel).toBe(MAX_CARD_STAT_UPGRADE_LEVEL);
    expect(migrated.party[0].stats).toEqual(doll.stats);
  });
});
