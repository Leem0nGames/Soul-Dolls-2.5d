import { describe, expect, it } from 'vitest';
import { computeRenderSize } from '../src/engine/Renderer.ts';

describe('PixelRenderer sizing', () => {
  it('uses the low internal resolution when pixel effect is enabled', () => {
    expect(computeRenderSize(1024, 600, true, 1)).toEqual({
      width: 410,
      height: 240,
    });
  });

  it('renders at display resolution when pixel effect is disabled', () => {
    expect(computeRenderSize(1024, 600, false, 1, 1)).toEqual({
      width: 1024,
      height: 600,
    });
  });

  it('caps high-resolution rendering to avoid excessive pixel counts', () => {
    const size = computeRenderSize(3840, 2160, false, 1, 2);

    expect(size.width * size.height).toBeLessThanOrEqual(4_194_304);
    expect(size.width).toBeGreaterThan(427);
    expect(size.height).toBeGreaterThan(240);
  });
});
