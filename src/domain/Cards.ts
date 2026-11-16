import type { Rng } from '../core/Rng.ts';
import {
  CARD_DISMANTLE_DUST,
  CARD_RARITY_ORDER,
  computeCardBonusesForRarity,
  getCardDef,
  getCardDropChance,
  getCardStatUpgradeCost,
  getNextCardRarity,
  getRarityUpgradeCost,
  MAX_CARD_STAT_UPGRADE_LEVEL,
} from '../data/cards.ts';
import { ALL_SPECIES_IDS, getSpecies, SPECIES } from '../data/species.ts';
import { getCreatureDisplayName, recalculateCreatureStats } from './Creature.ts';
import type { CardDef, CardEntry, CardRarity, CreatureInstance, SaveData, Stats } from './types.ts';

export {
  BASE_CARD_DROP_CHANCE,
  BOSS_CARD_DROP_MULTIPLIER,
  CARD_DISMANTLE_DUST,
  CARD_RARITY_DROP_MULTIPLIERS,
  CARD_RARITY_ORDER,
  CARD_RARITY_UPGRADE_COST,
  computeCardBonuses,
  computeCardBonusesForRarity,
  formatCardBonuses,
  getCardBonuses,
  getCardDef,
  getCardDropChance,
  getCardRankedStats,
  getCardRarity,
  getCardRarityDropMultiplier,
  getCardStatUpgradeCost,
  getNextCardRarity,
  getRarityUpgradeCost,
  MAX_CARD_STAT_UPGRADE_LEVEL,
} from '../data/cards.ts';

export interface EffectiveCardDef extends CardDef {
  upgradeLevel: number;
}

export function rollCardDrop(speciesId: number, rng: Rng, isBoss = false): boolean {
  if (!SPECIES[speciesId]) return false;
  return rng.next() < getCardDropChance(speciesId, isBoss);
}

export function ensureCardAlbum(save: SaveData): Record<number, CardEntry> {
  if (!save.cardAlbum || typeof save.cardAlbum !== 'object') {
    save.cardAlbum = {};
  }
  return save.cardAlbum;
}

export function ensureSoulDust(save: SaveData): number {
  const cur = typeof save.soulDust === 'number' && Number.isFinite(save.soulDust)
    ? Math.max(0, Math.floor(save.soulDust))
    : 0;
  save.soulDust = cur;
  return cur;
}

export function getSoulDust(save: SaveData): number {
  return typeof save.soulDust === 'number' && Number.isFinite(save.soulDust)
    ? Math.max(0, Math.floor(save.soulDust))
    : 0;
}

export function addSoulDust(save: SaveData, delta: number): number {
  const next = Math.max(0, ensureSoulDust(save) + Math.floor(delta));
  save.soulDust = next;
  return next;
}

export function getEffectiveCardDef(save: SaveData, speciesId: number): EffectiveCardDef {
  const baseDef = getCardDef(speciesId);
  const spec = getSpecies(speciesId);
  const entry = save.cardAlbum?.[speciesId];
  const rarity: CardRarity =
    entry?.rarityOverride && CARD_RARITY_ORDER.includes(entry.rarityOverride)
      ? entry.rarityOverride
      : baseDef.rarity;
  const upgradeLevel = Math.max(
    0,
    Math.min(MAX_CARD_STAT_UPGRADE_LEVEL, Math.floor(entry?.upgradeLevel ?? 0))
  );
  const bonuses = computeCardBonusesForRarity(spec, rarity, upgradeLevel);
  return {
    ...baseDef,
    rarity,
    bonuses,
    upgradeLevel,
  };
}

export function getEffectiveCardBonuses(save: SaveData, speciesId: number): Partial<Stats> {
  return getEffectiveCardDef(save, speciesId).bonuses;
}

export function getCardDismantleValue(speciesId: number): number {
  const base = getCardDef(speciesId);
  return CARD_DISMANTLE_DUST[base.rarity];
}

export function addCardToAlbum(
  save: SaveData,
  speciesId: number
): { entry: CardEntry; isNew: boolean } {
  const album = ensureCardAlbum(save);
  getSpecies(speciesId);
  const existing = album[speciesId];
  if (existing) {
    existing.count = Math.max(1, existing.count) + 1;
    return { entry: existing, isNew: false };
  }
  const entry: CardEntry = {
    speciesId,
    count: 1,
    firstObtainedAt: Date.now(),
  };
  album[speciesId] = entry;
  return { entry, isNew: true };
}

export function getAlbumCounts(save: SaveData): {
  collected: number;
  total: number;
  totalCopies: number;
} {
  const album = save.cardAlbum ?? {};
  let collected = 0;
  let totalCopies = 0;
  for (const id of ALL_SPECIES_IDS) {
    const entry = album[id];
    if (entry && entry.count > 0) {
      collected += 1;
      totalCopies += entry.count;
    }
  }
  return { collected, total: ALL_SPECIES_IDS.length, totalCopies };
}

export function getAllOwnedCreatures(save: SaveData): CreatureInstance[] {
  return [
    ...save.party,
    ...save.storageBoxes.flatMap((box) =>
      box.slots.filter((c): c is CreatureInstance => c !== null)
    ),
  ];
}

export function getCreaturesWithCard(
  save: SaveData,
  cardSpeciesId: number
): CreatureInstance[] {
  return getAllOwnedCreatures(save).filter((c) => c.socketedCardId === cardSpeciesId);
}

export function getSocketedCountForCard(save: SaveData, cardSpeciesId: number): number {
  return getCreaturesWithCard(save, cardSpeciesId).length;
}

export function getAvailableCardCopies(save: SaveData, cardSpeciesId: number): number {
  const total = save.cardAlbum?.[cardSpeciesId]?.count ?? 0;
  const used = getSocketedCountForCard(save, cardSpeciesId);
  return Math.max(0, total - used);
}

export function canDismantleDuplicateCard(
  save: SaveData,
  speciesId: number
): { ok: boolean; reason?: 'not_owned' | 'no_duplicate' | 'all_socketed' } {
  const entry = save.cardAlbum?.[speciesId];
  if (!entry || entry.count <= 0) {
    return { ok: false, reason: 'not_owned' };
  }
  if (entry.count <= 1) {
    return { ok: false, reason: 'no_duplicate' };
  }
  if (getAvailableCardCopies(save, speciesId) <= 0) {
    return { ok: false, reason: 'all_socketed' };
  }
  return { ok: true };
}

export function dismantleDuplicateCard(
  save: SaveData,
  speciesId: number
): {
  ok: boolean;
  dustGained: number;
  remainingCount: number;
  soulDust: number;
  reason?: 'not_owned' | 'no_duplicate' | 'all_socketed';
} {
  const check = canDismantleDuplicateCard(save, speciesId);
  const entry = save.cardAlbum?.[speciesId];
  if (!check.ok || !entry) {
    return {
      ok: false,
      dustGained: 0,
      remainingCount: entry?.count ?? 0,
      soulDust: getSoulDust(save),
      reason: check.reason,
    };
  }
  entry.count -= 1;
  const dustGained = getCardDismantleValue(speciesId);
  const soulDust = addSoulDust(save, dustGained);
  return {
    ok: true,
    dustGained,
    remainingCount: entry.count,
    soulDust,
  };
}

export function syncSocketedCreaturesForCard(save: SaveData, cardSpeciesId: number): void {
  const bonuses = getEffectiveCardBonuses(save, cardSpeciesId);
  for (const mon of getCreaturesWithCard(save, cardSpeciesId)) {
    mon.socketedCardBonuses = { ...bonuses };
    recalculateCreatureStats(mon);
  }
}

export function upgradeCardRarity(
  save: SaveData,
  speciesId: number
): {
  ok: boolean;
  newRarity?: CardRarity;
  cost: number;
  soulDust: number;
  reason?: 'not_owned' | 'max_rarity' | 'insufficient_dust';
} {
  const album = ensureCardAlbum(save);
  const entry = album[speciesId];
  if (!entry || entry.count <= 0) {
    return { ok: false, cost: 0, soulDust: getSoulDust(save), reason: 'not_owned' };
  }
  const effective = getEffectiveCardDef(save, speciesId);
  const nextRarity = getNextCardRarity(effective.rarity);
  if (!nextRarity) {
    return { ok: false, cost: 0, soulDust: getSoulDust(save), reason: 'max_rarity' };
  }
  const cost = getRarityUpgradeCost(effective.rarity);
  const dust = getSoulDust(save);
  if (dust < cost) {
    return { ok: false, cost, soulDust: dust, reason: 'insufficient_dust' };
  }
  const soulDust = addSoulDust(save, -cost);
  entry.rarityOverride = nextRarity;
  syncSocketedCreaturesForCard(save, speciesId);
  return { ok: true, newRarity: nextRarity, cost, soulDust };
}

export function upgradeCardStats(
  save: SaveData,
  speciesId: number
): {
  ok: boolean;
  newLevel?: number;
  cost: number;
  soulDust: number;
  reason?: 'not_owned' | 'max_level' | 'insufficient_dust';
} {
  const album = ensureCardAlbum(save);
  const entry = album[speciesId];
  if (!entry || entry.count <= 0) {
    return { ok: false, cost: 0, soulDust: getSoulDust(save), reason: 'not_owned' };
  }
  const effective = getEffectiveCardDef(save, speciesId);
  if (effective.upgradeLevel >= MAX_CARD_STAT_UPGRADE_LEVEL) {
    return { ok: false, cost: 0, soulDust: getSoulDust(save), reason: 'max_level' };
  }
  const cost = getCardStatUpgradeCost(effective.rarity, effective.upgradeLevel);
  const dust = getSoulDust(save);
  if (dust < cost) {
    return { ok: false, cost, soulDust: dust, reason: 'insufficient_dust' };
  }
  const soulDust = addSoulDust(save, -cost);
  const newLevel = effective.upgradeLevel + 1;
  entry.upgradeLevel = newLevel;
  syncSocketedCreaturesForCard(save, speciesId);
  return { ok: true, newLevel, cost, soulDust };
}

export function socketCardOnCreature(
  save: SaveData,
  creature: CreatureInstance,
  cardSpeciesId: number
): { ok: boolean; reason?: 'not_owned' | 'no_copy' } {
  const album = ensureCardAlbum(save);
  const entry = album[cardSpeciesId];
  if (!entry || entry.count <= 0) {
    return { ok: false, reason: 'not_owned' };
  }
  if (creature.socketedCardId === cardSpeciesId) {
    creature.socketedCardBonuses = { ...getEffectiveCardBonuses(save, cardSpeciesId) };
    recalculateCreatureStats(creature);
    return { ok: true };
  }
  if (getAvailableCardCopies(save, cardSpeciesId) <= 0) {
    return { ok: false, reason: 'no_copy' };
  }

  creature.socketedCardId = cardSpeciesId;
  creature.socketedCardBonuses = { ...getEffectiveCardBonuses(save, cardSpeciesId) };
  recalculateCreatureStats(creature);
  return { ok: true };
}

export function unsocketCardFromCreature(creature: CreatureInstance): number | null {
  const prev = creature.socketedCardId ?? null;
  if (prev === null) return null;
  delete creature.socketedCardId;
  delete creature.socketedCardBonuses;
  recalculateCreatureStats(creature);
  return prev;
}

export function formatCreaturesUsingCard(save: SaveData, cardSpeciesId: number): string {
  const holders = getCreaturesWithCard(save, cardSpeciesId);
  if (holders.length === 0) return '';
  return holders.map((c) => getCreatureDisplayName(c)).join(', ');
}
