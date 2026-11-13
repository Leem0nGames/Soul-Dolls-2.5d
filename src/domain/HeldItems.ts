import { ITEMS } from '../data/items.ts';
import { addItem, removeItem } from './Inventory.ts';
import type {
  BagSlot,
  BattleStatName,
  CreatureInstance,
  ItemDef,
  MoveDef,
} from './types.ts';

export function getHeldItemDef(creature: CreatureInstance): ItemDef | null {
  if (!creature.heldItemId) return null;
  const item = ITEMS[creature.heldItemId];
  return item && item.heldHooks ? item : null;
}

export function equipHeldItem(
  bag: BagSlot[],
  creature: CreatureInstance,
  itemId: string
): boolean {
  const def = ITEMS[itemId];
  if (!def || !def.heldHooks) return false;
  if (!removeItem(bag, itemId, 1)) return false;
  if (creature.heldItemId) {
    addItem(bag, creature.heldItemId, 1);
  }
  creature.heldItemId = itemId;
  return true;
}

export function unequipHeldItem(
  bag: BagSlot[],
  creature: CreatureInstance
): string | null {
  if (!creature.heldItemId) return null;
  const removed = creature.heldItemId;
  addItem(bag, removed, 1);
  creature.heldItemId = undefined;
  return removed;
}

export function computeHeldDamageMultiplier(
  attacker: CreatureInstance,
  move: MoveDef
): { multiplier: number; item: ItemDef | null } {
  const item = getHeldItemDef(attacker);
  const mod = item?.heldHooks?.modifyDamage;
  if (!item || !mod) return { multiplier: 1, item: null };
  if (mod.type && mod.type !== move.type) return { multiplier: 1, item: null };
  return { multiplier: mod.multiplier, item };
}

export function computeHeldStatMultiplier(
  creature: CreatureInstance,
  stat: BattleStatName
): number {
  const item = getHeldItemDef(creature);
  const mod = item?.heldHooks?.modifyStat;
  if (!mod || mod.stat !== stat) return 1;
  return mod.multiplier;
}
