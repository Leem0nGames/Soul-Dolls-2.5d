import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BackgroundLayer,
  DEFAULT_HORIZON_LAYERS,
  computeParallaxShift,
} from '../src/components/ui/index.ts';

describe('BackgroundLayer 2.5D parallax component', () => {
  it('renders layered .parallax-horizon-layer tiers inside .parallax-horizon-container with flat pixel SVGs', () => {
    const html = renderToStaticMarkup(React.createElement(BackgroundLayer));

    expect(html).toContain('class="parallax-horizon-container');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-background-layer="true"');

    for (const layer of DEFAULT_HORIZON_LAYERS) {
      expect(html).toContain(`parallax-horizon-layer ${layer.className}`);
      expect(html).toContain(`data-parallax-id="${layer.id}"`);
    }

    // Strict flat pixel UI compliance (zero gradients/blurs/rounded cards)
    expect(html).not.toMatch(/linear-gradient|radial-gradient|backdrop-blur|bg-gradient/i);
  });

  it('scales 2.5D negative margin shifts proportionally by depth and clamps safely inside -35px inset bounds', () => {
    const distant = computeParallaxShift(0.5, -0.5, 0.65, 12);
    const mid = computeParallaxShift(0.5, -0.5, 1.35, 12);
    const near = computeParallaxShift(0.5, -0.5, 2.25, 12);

    // Opposite direction to pointer, progressive depth speed
    expect(distant.marginLeft).toBeCloseTo(-3.9, 2);
    expect(mid.marginLeft).toBeCloseTo(-8.1, 2);
    expect(near.marginLeft).toBeCloseTo(-13.5, 2);
    expect(Math.abs(near.marginLeft)).toBeGreaterThan(Math.abs(mid.marginLeft));
    expect(Math.abs(mid.marginLeft)).toBeGreaterThan(Math.abs(distant.marginLeft));

    // Vertical shift is half the horizontal depth rate
    expect(near.marginTop).toBeCloseTo(-near.marginLeft * 0.5, 2);

    // Extreme multiplier clamps cleanly below the -35px layer inset
    const extreme = computeParallaxShift(4, -4, 5, 30);
    expect(extreme.marginLeft).toBe(-32);
    expect(extreme.marginTop).toBe(32);
  });

  it('applies pointerOffset margins deterministically and zeroes them under reducedMotion', () => {
    const activeHtml = renderToStaticMarkup(
      React.createElement(BackgroundLayer, {
        pointerOffset: { x: 1, y: 0 },
        maxOffsetPx: 10,
        reducedMotion: false,
      })
    );
    expect(activeHtml).toContain('margin-left:-6.5px');
    expect(activeHtml).toContain('margin-left:-13.5px');
    expect(activeHtml).toContain('margin-left:-22.5px');

    const reducedHtml = renderToStaticMarkup(
      React.createElement(BackgroundLayer, {
        pointerOffset: { x: 1, y: 1 },
        maxOffsetPx: 10,
        reducedMotion: true,
      })
    );
    expect(reducedHtml).toContain('margin-left:0px;margin-top:0px');
    expect(reducedHtml).not.toContain('margin-left:-6.5px');
  });
});
