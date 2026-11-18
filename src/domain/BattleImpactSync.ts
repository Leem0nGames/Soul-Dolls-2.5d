import type { BattleEvent } from './types.ts';

export type DamageEvent = Extract<BattleEvent, { type: 'damage' }>;

const IMPACT_BOUNDARIES: ReadonlySet<BattleEvent['type']> = new Set<BattleEvent['type']>([
  'move_use',
  'switch_in',
  'switch_out',
  'catch_attempt',
  'faint',
  'status_tick',
  'weather_tick',
  'run_success',
  'run_fail',
  'battle_end',
]);

export function takeMoveImpactDamageEvents(queue: BattleEvent[]): DamageEvent[] {
  let limit = queue.findIndex(
    (ev) => ev.type === 'text' || IMPACT_BOUNDARIES.has(ev.type)
  );
  if (limit < 0) limit = queue.length;

  const damages = queue
    .slice(0, limit)
    .filter((ev): ev is DamageEvent => ev.type === 'damage');
  if (damages.length === 0) return damages;

  const kept: BattleEvent[] = [];
  for (let i = 0; i < queue.length; i++) {
    const ev = queue[i];
    if (i < limit && ev.type === 'damage') continue;
    kept.push(ev);
  }
  queue.length = 0;
  queue.push(...kept);
  return damages;
}

export function computeImpactIntensity(damages: readonly DamageEvent[]): number {
  let factor = 1;
  for (const damage of damages) {
    if (damage.crit) {
      factor = Math.max(factor, 1.28);
    } else if (damage.effectiveness >= 2) {
      factor = Math.max(factor, 1.14);
    } else if (damage.effectiveness < 1) {
      factor = Math.min(factor, 0.88);
    }
  }
  return factor;
}
