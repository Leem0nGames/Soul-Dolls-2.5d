import { getItem } from '../data/items.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { ES } from '../i18n/es.ts';
import { getCreatureDisplayName } from './Creature.ts';
import { checkItemEvolution } from './Evolution.ts';
import { getSellPrice } from './Shop.ts';
import {
  canCreatureLearnMove,
  getEvTotal,
  MAX_EV_PER_STAT,
  MAX_EV_TOTAL,
} from './SkillForge.ts';
import type {
  BagSlot,
  CreatureInstance,
  CreatureType,
  ItemCategory,
  ItemDef,
} from './types.ts';

export type BagPocketFilter = 'all' | ItemCategory;
export type BagSortMode = 'default' | 'name' | 'quantity_desc' | 'price_desc';

export interface BagScreenContext {
  party?: readonly CreatureInstance[];
  activePartyIndex?: number;
  isWild?: boolean;
  money?: number;
  repelSteps?: number;
}

export interface BagFilterOptions {
  category: BagPocketFilter;
  query: string;
  sort: BagSortMode;
  inBattle: boolean;
}

export interface BagTabSummary {
  id: BagPocketFilter;
  label: string;
  slotCount: number;
  totalQuantity: number;
}

export interface BagItemEntry {
  slot: BagSlot;
  item: ItemDef;
  usable: boolean;
  disabledReason?: string;
  actionLabel: string;
  badgeType?: CreatureType;
  categoryLabel: string;
  facts: string[];
  sellPrice: number;
}

export type BagPartyReadinessTone = 'ready' | 'info' | 'muted';

export interface BagPartyCompatibilityRow {
  partyIndex: number;
  speciesId: number;
  name: string;
  level: number;
  currentHp: number;
  maxHp: number;
  statusLabel: string;
  readinessText: string;
  tone: BagPartyReadinessTone;
  isActive: boolean;
}

export const OVERWORLD_BAG_POCKETS: readonly BagPocketFilter[] = [
  'all',
  'medicine',
  'tm',
  'capsule',
  'stone',
  'held',
  'utility',
];

export const BATTLE_BAG_POCKETS: readonly BagPocketFilter[] = [
  'all',
  'medicine',
  'capsule',
  'battle',
];

const BATTLE_ALLOWED_CATEGORIES = new Set<ItemCategory>(['medicine', 'capsule', 'battle']);

export function isItemVisibleInBagMode(def: ItemDef, inBattle: boolean): boolean {
  if (!inBattle) return true;
  if (!BATTLE_ALLOWED_CATEGORIES.has(def.category)) return false;
  if (def.category === 'medicine' && def.vitaminStat) return false;
  return true;
}

export const BAG_SORT_LABELS: Record<BagSortMode, string> = {
  default: 'Orden: Mochila',
  name: 'Orden: A–Z',
  quantity_desc: 'Orden: Cantidad',
  price_desc: 'Orden: Valor',
};

const SORT_ORDER: readonly BagSortMode[] = ['default', 'name', 'quantity_desc', 'price_desc'];

export function getNextBagSortMode(current: BagSortMode): BagSortMode {
  const idx = SORT_ORDER.indexOf(current);
  return SORT_ORDER[(idx + 1) % SORT_ORDER.length];
}

export function getVisibleBagPockets(inBattle: boolean): readonly BagPocketFilter[] {
  return inBattle ? BATTLE_BAG_POCKETS : OVERWORLD_BAG_POCKETS;
}

function normalizeSearchText(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function getBagPocketLabel(pocket: BagPocketFilter): string {
  if (pocket === 'all') return 'Todos';
  return ES.bag.categories[pocket];
}

export function getBagSummaryCounts(
  bag: readonly BagSlot[],
  inBattle: boolean
): { distinctCount: number; totalQuantity: number } {
  let distinctCount = 0;
  let totalQuantity = 0;
  for (const slot of bag) {
    if (slot.quantity <= 0) continue;
    const def = getItem(slot.itemId);
    if (!isItemVisibleInBagMode(def, inBattle)) continue;
    distinctCount += 1;
    totalQuantity += slot.quantity;
  }
  return { distinctCount, totalQuantity };
}

export function getBagTabSummaries(
  bag: readonly BagSlot[],
  inBattle: boolean
): BagTabSummary[] {
  const pockets = getVisibleBagPockets(inBattle);
  const byCategory = new Map<ItemCategory, { slots: number; qty: number }>();

  for (const slot of bag) {
    if (slot.quantity <= 0) continue;
    const def = getItem(slot.itemId);
    if (!isItemVisibleInBagMode(def, inBattle)) continue;
    const prev = byCategory.get(def.category) ?? { slots: 0, qty: 0 };
    byCategory.set(def.category, {
      slots: prev.slots + 1,
      qty: prev.qty + slot.quantity,
    });
  }

  const allTotals = getBagSummaryCounts(bag, inBattle);

  return pockets.map((pocket) => {
    if (pocket === 'all') {
      return {
        id: 'all',
        label: getBagPocketLabel('all'),
        slotCount: allTotals.distinctCount,
        totalQuantity: allTotals.totalQuantity,
      };
    }
    const stats = byCategory.get(pocket) ?? { slots: 0, qty: 0 };
    return {
      id: pocket,
      label: getBagPocketLabel(pocket),
      slotCount: stats.slots,
      totalQuantity: stats.qty,
    };
  });
}

export function getItemUsability(
  def: ItemDef,
  options: { inBattle: boolean; isWild?: boolean }
): { usable: boolean; reason?: string } {
  if (options.inBattle) {
    if (def.category === 'capsule') {
      if (options.isWild === false) {
        return {
          usable: false,
          reason: 'No puedes usar Soulpots en duelos contra otro Soultrainer.',
        };
      }
      return { usable: true };
    }
    if (def.category === 'medicine') {
      if (def.vitaminStat) {
        return {
          usable: false,
          reason: 'Los tónicos EV solo se aplican fuera de combate.',
        };
      }
      return { usable: true };
    }
    if (def.category === 'battle') {
      return { usable: true };
    }
    return { usable: false, reason: ES.bag.cantUseNow };
  }

  if (
    def.category === 'medicine' ||
    def.category === 'tm' ||
    def.category === 'stone' ||
    def.category === 'held' ||
    def.category === 'utility'
  ) {
    return { usable: true };
  }

  if (def.category === 'capsule') {
    return { usable: false, reason: 'Solo usable durante encuentros salvajes.' };
  }
  if (def.category === 'battle') {
    return { usable: false, reason: 'Solo usable durante un combate.' };
  }
  return { usable: false, reason: ES.bag.cantUseNow };
}

export function getBagItemActionLabel(def: ItemDef): string {
  if (def.arGacha) return 'Invocar AR';
  if (def.category === 'held') return ES.bag.equip;
  if (def.category === 'tm') return 'Enseñar';
  if (def.category === 'capsule') return 'Lanzar';
  return ES.bag.use;
}

export function getBagItemBadgeType(def: ItemDef): CreatureType | undefined {
  if (def.tmMoveId) {
    return getMove(def.tmMoveId).type;
  }
  if (def.heldHooks?.modifyDamage?.type) {
    return def.heldHooks.modifyDamage.type;
  }
  return undefined;
}

export function getBagItemFacts(def: ItemDef): string[] {
  const facts: string[] = [];

  if (def.healHp !== undefined) facts.push(`Cura +${def.healHp} PS`);
  if (def.healFull) facts.push('Restaura 100% PS');
  if (def.revive) facts.push('Reanima con 50% PS');
  if (def.curesStatus && def.curesStatus !== 'all') {
    facts.push(`Cura ${ES.status[def.curesStatus]}`);
  } else if (def.curesStatus === 'all') {
    facts.push('Cura cualquier estado');
  }
  if (def.vitaminStat) {
    facts.push(`+4 EV ${ES.stats[def.vitaminStat]}`);
  }
  if (def.catchMultiplier !== undefined) {
    facts.push(`Sellado ×${def.catchMultiplier.toFixed(1)}`);
  }
  if (def.repelSteps) {
    facts.push(`Dura ${def.repelSteps} pasos`);
  }
  if (def.escape) {
    facts.push('Retorno a Villa Origen');
  }
  if (def.arGacha) {
    facts.push('Escáner QR / Astral');
  }
  if (def.tmMoveId) {
    const move = getMove(def.tmMoveId);
    const catLabel =
      move.category === 'physical'
        ? 'Físico'
        : move.category === 'special'
          ? 'Especial'
          : 'Estado';
    facts.push(catLabel);
    facts.push(move.power > 0 ? `Pot. ${move.power}` : 'Sin potencia');
    facts.push(`Prec. ${move.accuracy}%`);
    facts.push(`PP ${move.pp}`);
  }
  if (def.heldHooks) {
    if (def.heldHooks.consumable) {
      facts.push('Consumible al activarse');
    } else {
      facts.push('Permanente al equipar');
    }
  }
  if (def.category === 'stone') {
    facts.push('Piedra evolutiva');
  }

  return facts;
}

export function buildBagItemEntry(
  slot: BagSlot,
  options: { inBattle: boolean; isWild?: boolean }
): BagItemEntry {
  const item = getItem(slot.itemId);
  const usability = getItemUsability(item, options);
  return {
    slot,
    item,
    usable: usability.usable,
    disabledReason: usability.reason,
    actionLabel: getBagItemActionLabel(item),
    badgeType: getBagItemBadgeType(item),
    categoryLabel: ES.bag.categories[item.category],
    facts: getBagItemFacts(item),
    sellPrice: getSellPrice(item.id),
  };
}

export function filterAndSortBagEntries(
  bag: readonly BagSlot[],
  options: BagFilterOptions & { isWild?: boolean }
): BagItemEntry[] {
  const queryNorm = normalizeSearchText(options.query);
  const indexed: Array<{ entry: BagItemEntry; index: number }> = [];

  bag.forEach((slot, index) => {
    if (slot.quantity <= 0) return;
    const def = getItem(slot.itemId);
    if (!isItemVisibleInBagMode(def, options.inBattle)) return;
    if (options.category !== 'all' && def.category !== options.category) return;

    if (queryNorm.length > 0) {
      const moveText = def.tmMoveId
        ? `${getMove(def.tmMoveId).name} ${ES.types[getMove(def.tmMoveId).type]}`
        : '';
      const haystack = normalizeSearchText(
        `${def.name} ${def.description} ${ES.bag.categories[def.category]} ${moveText}`
      );
      if (!haystack.includes(queryNorm)) return;
    }

    indexed.push({
      entry: buildBagItemEntry(slot, {
        inBattle: options.inBattle,
        isWild: options.isWild,
      }),
      index,
    });
  });

  indexed.sort((a, b) => {
    if (options.sort === 'name') {
      return a.entry.item.name.localeCompare(b.entry.item.name, 'es');
    }
    if (options.sort === 'quantity_desc') {
      return (
        b.entry.slot.quantity - a.entry.slot.quantity ||
        a.entry.item.name.localeCompare(b.entry.item.name, 'es')
      );
    }
    if (options.sort === 'price_desc') {
      return (
        b.entry.item.price - a.entry.item.price ||
        a.entry.item.name.localeCompare(b.entry.item.name, 'es')
      );
    }
    return a.index - b.index;
  });

  return indexed.map((item) => item.entry);
}

export function getBagPartyCompatibility(
  def: ItemDef,
  party: readonly CreatureInstance[] | undefined,
  options: { inBattle: boolean; activePartyIndex?: number }
): BagPartyCompatibilityRow[] {
  if (!party || party.length === 0) return [];

  const targetIndices = options.inBattle
    ? [options.activePartyIndex ?? 0].filter((i) => i >= 0 && i < party.length)
    : party.map((_, i) => i);

  return targetIndices.map((idx) => {
    const c = party[idx];
    const name = getCreatureDisplayName(c);
    const statusLabel = c.status !== 'none' ? ES.status[c.status] : '';
    const isActive = Boolean(options.inBattle && idx === (options.activePartyIndex ?? 0));

    let readinessText = 'Disponible';
    let tone: BagPartyReadinessTone = 'info';

    if (def.category === 'medicine') {
      if (def.vitaminStat) {
        const curStatEv = Math.max(0, Math.floor(c.evBonuses?.[def.vitaminStat] ?? 0));
        const totalEv = getEvTotal(c);
        const canAdd = curStatEv < MAX_EV_PER_STAT && totalEv < MAX_EV_TOTAL;
        if (options.inBattle) {
          readinessText = 'Solo fuera de combate';
          tone = 'muted';
        } else if (canAdd) {
          readinessText = `EV ${ES.stats[def.vitaminStat]} ${curStatEv}/${MAX_EV_PER_STAT} (+4)`;
          tone = 'ready';
        } else {
          readinessText =
            totalEv >= MAX_EV_TOTAL
              ? `Límite EV (${totalEv}/${MAX_EV_TOTAL})`
              : `${ES.stats[def.vitaminStat]} al máx. (${curStatEv}/${MAX_EV_PER_STAT})`;
          tone = 'muted';
        }
      } else if (def.revive) {
        if (c.currentHp <= 0) {
          readinessText = 'Listo para reanimar';
          tone = 'ready';
        } else {
          readinessText = 'Aún tiene PS';
          tone = 'muted';
        }
      } else if (def.healHp !== undefined || def.healFull) {
        if (c.currentHp <= 0) {
          readinessText = 'Debilitada · Revivir';
          tone = 'muted';
        } else if (c.currentHp < c.stats.hp) {
          const gain = def.healFull
            ? c.stats.hp - c.currentHp
            : Math.min(def.healHp ?? 0, c.stats.hp - c.currentHp);
          readinessText = `Recupera +${gain} PS`;
          tone = 'ready';
        } else {
          readinessText = 'PS completos';
          tone = 'muted';
        }
      } else if (def.curesStatus) {
        if (c.currentHp <= 0) {
          readinessText = 'Debilitada';
          tone = 'muted';
        } else if (
          c.status !== 'none' &&
          (def.curesStatus === 'all' || c.status === def.curesStatus)
        ) {
          readinessText = `Cura ${ES.status[c.status]}`;
          tone = 'ready';
        } else {
          readinessText = c.status === 'none' ? 'Sana' : `Estado: ${ES.status[c.status]}`;
          tone = 'muted';
        }
      }
    } else if (def.category === 'tm' && def.tmMoveId) {
      const alreadyKnows = c.moves.some((m) => m.moveId === def.tmMoveId);
      if (alreadyKnows) {
        readinessText = 'Ya la conoce';
        tone = 'muted';
      } else if (canCreatureLearnMove(c, def.tmMoveId)) {
        readinessText = c.moves.length >= 4 ? 'Compatible (reemplaza)' : 'Compatible';
        tone = 'ready';
      } else {
        readinessText = 'Sin afinidad';
        tone = 'muted';
      }
    } else if (def.category === 'stone') {
      const targetId = checkItemEvolution(c, def.id);
      if (targetId !== null) {
        readinessText = `Evoluciona → ${getSpecies(targetId).name}`;
        tone = 'ready';
      } else {
        readinessText = 'No evoluciona';
        tone = 'muted';
      }
    } else if (def.category === 'held') {
      if (c.heldItemId === def.id) {
        readinessText = 'Ya equipado';
        tone = 'muted';
      } else if (c.heldItemId) {
        readinessText = `Cambiar (${getItem(c.heldItemId).name})`;
        tone = 'info';
      } else {
        readinessText = 'Ranura libre';
        tone = 'ready';
      }
    } else if (def.category === 'battle') {
      readinessText = options.inBattle ? 'Aplica al activo' : 'Solo en combate';
      tone = options.inBattle ? 'ready' : 'muted';
    }

    return {
      partyIndex: idx,
      speciesId: c.speciesId,
      name,
      level: c.level,
      currentHp: c.currentHp,
      maxHp: c.stats.hp,
      statusLabel,
      readinessText,
      tone,
      isActive,
    };
  });
}
