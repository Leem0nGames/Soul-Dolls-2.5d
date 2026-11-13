import { addToParty, MAX_PARTY_SIZE } from './Party.ts';
import type { CreatureInstance, StorageBox } from './types.ts';

export const STORAGE_BOX_COUNT = 8;
export const STORAGE_BOX_SIZE = 20;

export function createDefaultStorageBoxes(): StorageBox[] {
  return Array.from({ length: STORAGE_BOX_COUNT }, (_, idx) => ({
    name: `Caja ${idx + 1}`,
    slots: new Array<CreatureInstance | null>(STORAGE_BOX_SIZE).fill(null),
  }));
}

export function normalizeStorageBoxes(boxes: unknown): StorageBox[] {
  const base = createDefaultStorageBoxes();
  if (!Array.isArray(boxes)) return base;
  for (let i = 0; i < STORAGE_BOX_COUNT; i++) {
    const rawBox = boxes[i] as Partial<StorageBox> | undefined;
    if (!rawBox || typeof rawBox !== 'object') continue;
    if (typeof rawBox.name === 'string' && rawBox.name.trim()) {
      base[i].name = rawBox.name.trim().slice(0, 18);
    }
    if (Array.isArray(rawBox.slots)) {
      for (let s = 0; s < STORAGE_BOX_SIZE; s++) {
        const entry = rawBox.slots[s];
        base[i].slots[s] = entry && typeof entry === 'object' ? (entry as CreatureInstance) : null;
      }
    }
  }
  return base;
}

export function depositCreature(
  party: CreatureInstance[],
  boxes: StorageBox[],
  partyIndex: number,
  boxIndex: number,
  slotIndex?: number
): { ok: boolean; reason?: 'last_party' | 'invalid' | 'box_full' } {
  if (party.length <= 1) return { ok: false, reason: 'last_party' };
  const creature = party[partyIndex];
  const box = boxes[boxIndex];
  if (!creature || !box) return { ok: false, reason: 'invalid' };

  const targetSlot =
    slotIndex !== undefined && box.slots[slotIndex] === null
      ? slotIndex
      : box.slots.findIndex((s) => s === null);

  if (targetSlot === -1) return { ok: false, reason: 'box_full' };

  party.splice(partyIndex, 1);
  box.slots[targetSlot] = creature;
  return { ok: true };
}

export function withdrawCreature(
  party: CreatureInstance[],
  boxes: StorageBox[],
  boxIndex: number,
  slotIndex: number
): { ok: boolean; reason?: 'party_full' | 'invalid' } {
  if (party.length >= MAX_PARTY_SIZE) return { ok: false, reason: 'party_full' };
  const box = boxes[boxIndex];
  if (!box) return { ok: false, reason: 'invalid' };
  const creature = box.slots[slotIndex];
  if (!creature) return { ok: false, reason: 'invalid' };
  box.slots[slotIndex] = null;
  party.push(creature);
  return { ok: true };
}

export function moveStoredCreature(
  boxes: StorageBox[],
  fromBox: number,
  fromSlot: number,
  toBox: number,
  toSlot: number
): boolean {
  const b1 = boxes[fromBox];
  const b2 = boxes[toBox];
  if (!b1 || !b2) return false;
  if (fromSlot < 0 || fromSlot >= b1.slots.length || toSlot < 0 || toSlot >= b2.slots.length) {
    return false;
  }
  const a = b1.slots[fromSlot];
  if (!a) return false;
  const b = b2.slots[toSlot];
  b2.slots[toSlot] = a;
  b1.slots[fromSlot] = b;
  return true;
}

export function renameStorageBox(
  boxes: StorageBox[],
  boxIndex: number,
  newName: string
): boolean {
  const box = boxes[boxIndex];
  if (!box) return false;
  const clean = newName.trim().slice(0, 18);
  if (!clean) return false;
  box.name = clean;
  return true;
}

export function releaseStoredCreature(
  boxes: StorageBox[],
  boxIndex: number,
  slotIndex: number
): CreatureInstance | null {
  const box = boxes[boxIndex];
  if (!box) return null;
  const c = box.slots[slotIndex];
  if (!c) return null;
  box.slots[slotIndex] = null;
  return c;
}

export function addCapturedCreature(
  party: CreatureInstance[],
  boxes: StorageBox[],
  creature: CreatureInstance
): { destination: 'party' | 'box' | 'none'; boxIndex?: number } {
  if (addToParty(party, creature)) {
    return { destination: 'party' };
  }
  for (let b = 0; b < boxes.length; b++) {
    const emptyIdx = boxes[b].slots.findIndex((s) => s === null);
    if (emptyIdx !== -1) {
      boxes[b].slots[emptyIdx] = creature;
      return { destination: 'box', boxIndex: b };
    }
  }
  return { destination: 'none' };
}
