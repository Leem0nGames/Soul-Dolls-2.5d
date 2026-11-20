import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { getItem } from '../src/data/items.ts';
import {
  filterAndSortBagEntries,
  getBagPartyCompatibility,
  getBagSummaryCounts,
  getBagTabSummaries,
  getItemUsability,
  getNextBagSortMode,
} from '../src/domain/BagPresentation.ts';
import { createCreature } from '../src/domain/Creature.ts';
import type { BagSlot } from '../src/domain/types.ts';

describe('BagPresentation', () => {
  const sampleBag: BagSlot[] = [
    { itemId: 'pocion', quantity: 3 },
    { itemId: 'capsula', quantity: 5 },
    { itemId: 'mt_forja_interna', quantity: 1 },
    { itemId: 'piedra_chispa', quantity: 2 },
    { itemId: 'amuleto_brasa', quantity: 1 },
    { itemId: 'tonico_vel', quantity: 2 },
  ];

  it('computes category counts and filters battle vs overworld items accurately', () => {
    const overworldCounts = getBagSummaryCounts(sampleBag, false);
    expect(overworldCounts).toEqual({ distinctCount: 6, totalQuantity: 14 });

    const battleCounts = getBagSummaryCounts(sampleBag, true);
    expect(battleCounts).toEqual({ distinctCount: 2, totalQuantity: 8 });

    const overworldTabs = getBagTabSummaries(sampleBag, false);
    expect(overworldTabs.find((t) => t.id === 'all')?.slotCount).toBe(6);
    expect(overworldTabs.find((t) => t.id === 'medicine')?.slotCount).toBe(2);
    expect(overworldTabs.find((t) => t.id === 'tm')?.slotCount).toBe(1);

    const battleTabs = getBagTabSummaries(sampleBag, true);
    expect(battleTabs.map((t) => t.id)).toEqual(['all', 'medicine', 'capsule', 'battle']);
    expect(battleTabs.find((t) => t.id === 'medicine')?.slotCount).toBe(1);
  });

  it('searches accent-insensitively across item names, descriptions, and TM move types', () => {
    const byAccentlessName = filterAndSortBagEntries(sampleBag, {
      category: 'all',
      query: 'tonico',
      sort: 'default',
      inBattle: false,
    });
    expect(byAccentlessName.map((e) => e.item.id)).toEqual(['tonico_vel']);

    const byTypeWord = filterAndSortBagEntries(sampleBag, {
      category: 'all',
      query: 'brasa',
      sort: 'default',
      inBattle: false,
    });
    expect(byTypeWord.map((e) => e.item.id)).toEqual(['mt_forja_interna', 'amuleto_brasa']);
  });

  it('sorts items cleanly by quantity, name, and price', () => {
    expect(getNextBagSortMode('default')).toBe('name');
    expect(getNextBagSortMode('price_desc')).toBe('default');

    const byQty = filterAndSortBagEntries(sampleBag, {
      category: 'all',
      query: '',
      sort: 'quantity_desc',
      inBattle: false,
    });
    expect(byQty[0].item.id).toBe('capsula');

    const byName = filterAndSortBagEntries(sampleBag, {
      category: 'all',
      query: '',
      sort: 'name',
      inBattle: false,
    });
    expect(byName.map((e) => e.item.name)).toEqual(
      [...byName.map((e) => e.item.name)].sort((a, b) => a.localeCompare(b, 'es'))
    );
  });

  it('enforces wild vs trainer battle usability for Soulpots and vitamins', () => {
    const soulpot = getItem('capsula');
    expect(getItemUsability(soulpot, { inBattle: true, isWild: true }).usable).toBe(true);
    expect(getItemUsability(soulpot, { inBattle: true, isWild: false }).usable).toBe(false);
    expect(getItemUsability(soulpot, { inBattle: false }).usable).toBe(false);

    const tonic = getItem('tonico_vel');
    expect(getItemUsability(tonic, { inBattle: false }).usable).toBe(true);
    expect(getItemUsability(tonic, { inBattle: true, isWild: true }).usable).toBe(false);
  });

  it('computes accurate party compatibility previews for medicine, TMs, stones, and held items', () => {
    const rng = createRng(101);
    const brasa = createCreature(1, 10, rng); // Brasito (brasa)
    brasa.currentHp = Math.max(1, brasa.stats.hp - 12);
    const chisporro = createCreature(12, 10, rng); // Chisporro (chispa, evolves with piedra_chispa)
    chisporro.heldItemId = 'amuleto_brasa';

    const party = [brasa, chisporro];

    const potionRows = getBagPartyCompatibility(getItem('pocion'), party, { inBattle: false });
    expect(potionRows[0].tone).toBe('ready');
    expect(potionRows[0].readinessText).toContain('Recupera +12 PS');
    expect(potionRows[1].tone).toBe('muted');
    expect(potionRows[1].readinessText).toBe('PS completos');

    const tmRows = getBagPartyCompatibility(getItem('mt_forja_interna'), party, {
      inBattle: false,
    });
    expect(tmRows[0].tone).toBe('ready');
    expect(tmRows[1].tone).toBe('muted');
    expect(tmRows[1].readinessText).toBe('Sin afinidad');

    const stoneRows = getBagPartyCompatibility(getItem('piedra_chispa'), party, {
      inBattle: false,
    });
    expect(stoneRows[0].tone).toBe('muted');
    expect(stoneRows[1].tone).toBe('ready');
    expect(stoneRows[1].readinessText).toContain('Evoluciona');

    const heldRows = getBagPartyCompatibility(getItem('amuleto_brasa'), party, {
      inBattle: false,
    });
    expect(heldRows[0].tone).toBe('ready');
    expect(heldRows[0].readinessText).toBe('Ranura libre');
    expect(heldRows[1].tone).toBe('muted');
    expect(heldRows[1].readinessText).toBe('Ya equipado');
  });
});
