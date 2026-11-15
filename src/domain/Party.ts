import { healCreatureFull } from './Creature.ts';
import type { CreatureInstance } from './types.ts';

export const MAX_PARTY_SIZE = 6;

export function addToParty(
  party: CreatureInstance[],
  creature: CreatureInstance
): boolean {
  if (party.length >= MAX_PARTY_SIZE) return false;
  party.push(creature);
  return true;
}

export function getFirstHealthyIndex(party: readonly CreatureInstance[]): number {
  return party.findIndex((c) => c.currentHp > 0);
}

export function swapPartySlots(
  party: CreatureInstance[],
  a: number,
  b: number
): void {
  if (a < 0 || b < 0 || a >= party.length || b >= party.length || a === b) {
    return;
  }
  const tmp = party[a];
  party[a] = party[b];
  party[b] = tmp;
}

export function healPartyFull(party: CreatureInstance[]): void {
  for (const c of party) {
    healCreatureFull(c);
  }
}
