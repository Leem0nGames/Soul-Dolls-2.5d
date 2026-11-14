import type { Rng } from '../core/Rng.ts';
import { getCardDropChance } from '../data/cards.ts';
import { ALL_SPECIES_IDS, getSpecies, SPECIES } from '../data/species.ts';
import { getCreatureDisplayName, recalculateCreatureStats } from './Creature.ts';
import type { CardEntry, CreatureInstance, SaveData } from './types.ts';

export {
  BASE_CARD_DROP_CHANCE,
  BOSS_CARD_DROP_MULTIPLIER,
  CARD_RARITY_DROP_MULTIPLIERS,
  CARD_RARITY_ORDER,
  computeCardBonuses,
  formatCardBonuses,
  getCardBonuses,
  getCardDef,
  getCardDropChance,
  getCardRarity,
  getCardRarityDropMultiplier,
} from '../data/cards.ts';

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
    return { ok: true };
  }
  if (getAvailableCardCopies(save, cardSpeciesId) <= 0) {
    return { ok: false, reason: 'no_copy' };
  }

  creature.socketedCardId = cardSpeciesId;
  recalculateCreatureStats(creature);
  return { ok: true };
}

export function unsocketCardFromCreature(creature: CreatureInstance): number | null {
  const prev = creature.socketedCardId ?? null;
  if (prev === null) return null;
  delete creature.socketedCardId;
  recalculateCreatureStats(creature);
  return prev;
}

export function formatCreaturesUsingCard(save: SaveData, cardSpeciesId: number): string {
  const holders = getCreaturesWithCard(save, cardSpeciesId);
  if (holders.length === 0) return '';
  return holders.map((c) => getCreatureDisplayName(c)).join(', ');
}
