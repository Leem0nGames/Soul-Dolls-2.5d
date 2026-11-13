import { describe, expect, it } from 'vitest';
import { getMoveEffectivenessHint } from '../src/domain/BattleHints.ts';

describe('BattleHints', () => {
  it('returns blank status hint for status moves regardless of matchup', () => {
    expect(getMoveEffectivenessHint('chispa', 'status', ['roca'])).toEqual({
      multiplier: 1,
      label: '',
      tone: 'status',
    });
    expect(getMoveEffectivenessHint('brasa', 'status', ['flora'])).toEqual({
      multiplier: 1,
      label: '',
      tone: 'status',
    });
  });

  it('returns ×2 and ×4 for super-effective damaging moves', () => {
    expect(getMoveEffectivenessHint('brasa', 'special', ['flora'])).toEqual({
      multiplier: 2,
      label: '×2',
      tone: 'super',
    });
    expect(getMoveEffectivenessHint('roca', 'physical', ['brasa', 'brisa'])).toEqual({
      multiplier: 4,
      label: '×4',
      tone: 'super',
    });
  });

  it('returns ×½ and ×¼ for resisted damaging moves', () => {
    expect(getMoveEffectivenessHint('brasa', 'special', ['marea'])).toEqual({
      multiplier: 0.5,
      label: '×½',
      tone: 'resist',
    });
    expect(getMoveEffectivenessHint('flora', 'physical', ['brasa', 'brisa'])).toEqual({
      multiplier: 0.25,
      label: '×¼',
      tone: 'resist',
    });
  });

  it('returns ×0 for immunities and empty label for neutral hits', () => {
    expect(getMoveEffectivenessHint('chispa', 'special', ['roca'])).toEqual({
      multiplier: 0,
      label: '×0',
      tone: 'immune',
    });
    expect(getMoveEffectivenessHint('comun', 'physical', ['flora'])).toEqual({
      multiplier: 1,
      label: '',
      tone: 'neutral',
    });
  });
});
