import { getItem } from '../data/items.ts';
import { addItem, getItemCount, removeItem } from './Inventory.ts';
import type { BagSlot } from './types.ts';

export function buyItem(
  bag: BagSlot[],
  money: number,
  itemId: string,
  quantity = 1
): { ok: boolean; moneyAfter: number } {
  if (quantity <= 0) return { ok: false, moneyAfter: money };
  const item = getItem(itemId);
  const cost = item.price * quantity;
  if (money < cost) return { ok: false, moneyAfter: money };
  addItem(bag, itemId, quantity);
  return { ok: true, moneyAfter: money - cost };
}

export function getSellPrice(itemId: string): number {
  return Math.max(1, Math.floor(getItem(itemId).price * 0.5));
}

export function sellItem(
  bag: BagSlot[],
  money: number,
  itemId: string,
  quantity = 1
): { ok: boolean; moneyAfter: number; gained: number } {
  if (quantity <= 0 || getItemCount(bag, itemId) < quantity) {
    return { ok: false, moneyAfter: money, gained: 0 };
  }
  const gained = getSellPrice(itemId) * quantity;
  removeItem(bag, itemId, quantity);
  return { ok: true, moneyAfter: money + gained, gained };
}
