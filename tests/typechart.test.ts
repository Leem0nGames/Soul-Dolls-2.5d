import { describe, expect, it } from 'vitest';
import { getTypeMultiplier } from '../src/domain/TypeChart.ts';

describe('TypeChart', () => {
  it('returns 2x for super-effective matchups', () => {
    expect(getTypeMultiplier('brasa', ['flora'])).toBe(2);
    expect(getTypeMultiplier('marea', ['brasa'])).toBe(2);
    expect(getTypeMultiplier('flora', ['marea'])).toBe(2);
    expect(getTypeMultiplier('chispa', ['marea'])).toBe(2);
  });

  it('returns 0.5x for resisted matchups', () => {
    expect(getTypeMultiplier('brasa', ['marea'])).toBe(0.5);
    expect(getTypeMultiplier('flora', ['brasa'])).toBe(0.5);
  });

  it('returns 0x for immunities', () => {
    expect(getTypeMultiplier('chispa', ['roca'])).toBe(0);
    expect(getTypeMultiplier('umbra', ['comun'])).toBe(0);
    expect(getTypeMultiplier('comun', ['umbra'])).toBe(0);
  });

  it('multiplies dual-type effectiveness accurately', () => {
    // Brasa vs Flora/Umbra = 2 * 1 = 2
    expect(getTypeMultiplier('brasa', ['flora', 'umbra'])).toBe(2);
    // Marea vs Brasa/Brisa = 2 * 1 = 2
    expect(getTypeMultiplier('marea', ['brasa', 'brisa'])).toBe(2);
    // Chispa vs Brisa/Chispa = 2 * 0.5 = 1
    expect(getTypeMultiplier('chispa', ['brisa', 'chispa'])).toBe(1);
    // Roca vs Brasa/Brisa = 2 * 2 = 4
    expect(getTypeMultiplier('roca', ['brasa', 'brisa'])).toBe(4);
  });
});
