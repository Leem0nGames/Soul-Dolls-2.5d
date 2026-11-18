import { describe, expect, it } from 'vitest';
import {
  computeImpactIntensity,
  takeMoveImpactDamageEvents,
  type DamageEvent,
} from '../src/domain/BattleImpactSync.ts';
import type { BattleEvent } from '../src/domain/types.ts';

function damage(overrides: Partial<DamageEvent> = {}): DamageEvent {
  return {
    type: 'damage',
    target: 'enemy',
    amount: 10,
    hpAfter: 40,
    maxHp: 50,
    effectiveness: 1,
    crit: false,
    ...overrides,
  };
}

describe('battle impact synchronization', () => {
  it('moves the current move damage to the impact frame while preserving event order', () => {
    const queue: BattleEvent[] = [
      { type: 'ability_triggered', side: 'player', abilityId: 'a', abilityName: 'A' },
      damage({ amount: 11 }),
      damage({ amount: 9 }),
      { type: 'text', message: 'multi hit' },
      { type: 'move_use', side: 'enemy', moveId: 'placaje', moveName: 'Placaje' },
      damage({ target: 'player', amount: 7 }),
    ];

    const pulled = takeMoveImpactDamageEvents(queue);

    expect(pulled.map((ev) => ev.amount)).toEqual([11, 9]);
    expect(queue.map((ev) => ev.type)).toEqual([
      'ability_triggered',
      'text',
      'move_use',
      'damage',
    ]);
  });

  it('does not steal end-of-turn status damage from the current impact', () => {
    const queue: BattleEvent[] = [
      damage({ amount: 12 }),
      { type: 'text', message: 'hit' },
      { type: 'status_tick', target: 'enemy', status: 'burn', damage: 3, hpAfter: 25, maxHp: 50 },
      { type: 'text', message: 'burn' },
    ];

    const pulled = takeMoveImpactDamageEvents(queue);

    expect(pulled.map((ev) => ev.amount)).toEqual([12]);
    expect(queue.some((ev) => ev.type === 'status_tick')).toBe(true);
  });

  it('does not steal leech seed damage after the move outcome text', () => {
    const queue: BattleEvent[] = [
      damage({ amount: 14 }),
      { type: 'text', message: 'hit' },
      damage({ target: 'player', amount: 4 }),
      { type: 'text', message: 'leech' },
    ];

    const pulled = takeMoveImpactDamageEvents(queue);

    expect(pulled.map((ev) => ev.amount)).toEqual([14]);
    expect(queue.filter((ev) => ev.type === 'damage')).toHaveLength(1);
  });

  it('returns no damage on a miss, leaving later phases untouched', () => {
    const queue: BattleEvent[] = [
      { type: 'miss', side: 'player' },
      { type: 'text', message: 'missed' },
      { type: 'move_use', side: 'enemy', moveId: 'placaje', moveName: 'Placaje' },
      damage({ target: 'player', amount: 8 }),
    ];

    expect(takeMoveImpactDamageEvents(queue)).toEqual([]);
    expect(queue).toHaveLength(4);
  });

  it('scales visual intensity for crits, super-effective hits and resisted hits', () => {
    expect(computeImpactIntensity([])).toBe(1);
    expect(computeImpactIntensity([damage({ crit: true })])).toBe(1.28);
    expect(computeImpactIntensity([damage({ effectiveness: 2 })])).toBe(1.14);
    expect(computeImpactIntensity([damage({ effectiveness: 0.5 })])).toBe(0.88);
  });
});
