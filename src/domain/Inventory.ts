import { getItem } from '../data/items.ts';
import { buildBodyPartsHp, healBodyParts } from './BodyParts.ts';
import type { BagSlot, CreatureInstance } from './types.ts';

export function getItemCount(bag: readonly BagSlot[], itemId: string): number {
  return bag.find((s) => s.itemId === itemId)?.quantity ?? 0;
}

export function addItem(bag: BagSlot[], itemId: string, quantity = 1): void {
  if (quantity <= 0) return;
  const existing = bag.find((s) => s.itemId === itemId);
  if (existing) {
    existing.quantity += quantity;
  } else {
    bag.push({ itemId, quantity });
  }
}

export function removeItem(bag: BagSlot[], itemId: string, quantity = 1): boolean {
  const idx = bag.findIndex((s) => s.itemId === itemId);
  if (idx === -1 || bag[idx].quantity < quantity) return false;
  bag[idx].quantity -= quantity;
  if (bag[idx].quantity <= 0) {
    bag.splice(idx, 1);
  }
  return true;
}

export function applyMedicineToCreature(
  itemId: string,
  creature: CreatureInstance
): { applied: boolean; healedHp: number; curedStatus: boolean } {
  const item = getItem(itemId);
  if (item.category !== 'medicine') {
    return { applied: false, healedHp: 0, curedStatus: false };
  }

  if (item.revive) {
    if (creature.currentHp > 0) {
      return { applied: false, healedHp: 0, curedStatus: false };
    }
    const amt = Math.max(1, Math.floor(creature.stats.hp * 0.5));
    creature.currentHp = amt;
    creature.bodyParts = buildBodyPartsHp(
      creature.stats.hp,
      creature.containerId ?? 'cuerpo_aprendiz',
      creature.ivs,
      creature.evBonuses,
      amt
    );
    creature.status = 'none';
    creature.sleepTurns = 0;
    return { applied: true, healedHp: amt, curedStatus: true };
  }

  if (creature.currentHp <= 0) {
    return { applied: false, healedHp: 0, curedStatus: false };
  }

  if (item.healHp !== undefined) {
    if (creature.currentHp >= creature.stats.hp) {
      return { applied: false, healedHp: 0, curedStatus: false };
    }
    const healed = healBodyParts(creature, item.healHp);
    return { applied: true, healedHp: healed, curedStatus: false };
  }

  if (item.curesStatus) {
    if (
      creature.status === 'none' ||
      (item.curesStatus !== 'all' && creature.status !== item.curesStatus)
    ) {
      return { applied: false, healedHp: 0, curedStatus: false };
    }
    creature.status = 'none';
    creature.sleepTurns = 0;
    return { applied: true, healedHp: 0, curedStatus: true };
  }

  return { applied: false, healedHp: 0, curedStatus: false };
}
