import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ArcaneBindingOverlay, BRAND_HEX_SET, isBrandPaletteHex } from '../src/components/ui/index.ts';
import { AbilityVfxSystem } from '../src/engine/AbilityVfxSystem.ts';
import { FxSystem } from '../src/engine/FxSystem.ts';

const BANNED_STYLE_PATTERNS = [
  /bg-gradient/i,
  /linear-gradient/i,
  /radial-gradient/i,
  /backdrop-blur/i,
  /filter:\s*blur/i,
  /\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/i,
  /\bshadow-(sm|md|lg|xl|2xl)\b/i,
];

function assertFlatPixelMarkup(html: string): void {
  for (const pattern of BANNED_STYLE_PATTERNS) {
    expect(html).not.toMatch(pattern);
  }
}

describe('Arcane Binding Overlay & VFX', () => {
  it('renders ArcaneBindingOverlay adhering strictly to the flat 64-color pixel palette', () => {
    const onComplete = vi.fn();
    const html = renderToStaticMarkup(
      React.createElement(ArcaneBindingOverlay, {
        speciesId: 10,
        creatureName: 'Zumbín',
        level: 8,
        creatureType: 'umbra',
        vesselName: 'Muñeca de Porcelana',
        spriteUrl: '/assets/souls/10.webp',
        durationMs: 2400,
        onComplete,
      })
    );

    expect(html).toContain('VÍNCULO ARCANO');
    expect(html).toContain('Zumbín');
    expect(html).toContain('#010');
    expect(html).toContain('Nv. 8');
    expect(html).toContain('Muñeca de Porcelana');
    expect(html).toContain('SINTONIZACIÓN');
    expect(html).toContain('FILAMENTOS');
    expect(html).toContain('ANCLAJE');
    expect(html).toContain('VÍNCULO FIJADO');

    // Verify adherence to strict flat pixel art constraints
    assertFlatPixelMarkup(html);

    // Validate that all hex codes found in the markup belong to the 64-color palette
    const hexMatches = html.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(hexMatches.length).toBeGreaterThan(0);
    for (const hex of hexMatches) {
      expect(isBrandPaletteHex(hex.toUpperCase())).toBe(true);
      expect(BRAND_HEX_SET.has(hex.toUpperCase())).toBe(true);
    }
  });

  it('renders with fallback vessel and placeholder when optional props are omitted', () => {
    const html = renderToStaticMarkup(
      React.createElement(ArcaneBindingOverlay, {
        speciesId: 12,
        creatureName: 'Chisporro',
        level: 5,
        creatureType: 'chispa',
        onComplete: () => {},
      })
    );

    expect(html).toContain('Chisporro');
    expect(html).toContain('#012');
    expect(html).toContain('Muñeca Artesanal Primaria');
    assertFlatPixelMarkup(html);
  });

  it('triggers playArcaneBinding in AbilityVfxSystem without errors', () => {
    const scene = new THREE.Scene();
    const vfx = new AbilityVfxSystem(scene);

    const fromPos = new THREE.Vector3(-2, 1, 0);
    const toPos = new THREE.Vector3(2, 0.5, 0);
    const groundY = 0;

    expect(() => {
      vfx.playArcaneBinding(fromPos, toPos, groundY, 1.6);
    }).not.toThrow();

    // Advance time and update items
    expect(() => {
      vfx.update(0.016);
      vfx.update(0.5);
    }).not.toThrow();

    vfx.dispose();
  });

  it('triggers playArcaneBinding in FxSystem spawning combined particle and shader VFX', () => {
    const scene = new THREE.Scene();
    const fx = new FxSystem(scene);

    const fromPos = new THREE.Vector3(-2, 1, 0);
    const toPos = new THREE.Vector3(2, 0.5, 0);
    const groundY = 0;

    expect(() => {
      fx.playArcaneBinding(fromPos, toPos, groundY, 1.6);
    }).not.toThrow();

    const camPos = new THREE.Vector3(0, 5, 10);
    expect(() => {
      fx.update(0.016, camPos);
      fx.update(0.2, camPos);
    }).not.toThrow();

    fx.dispose();
  });
});
