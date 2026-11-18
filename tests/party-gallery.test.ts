import { describe, expect, it } from 'vitest';
import { createRng } from '../src/core/Rng.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { ES } from '../src/i18n/es.ts';
import {
  renderPartyGalleryMarkup,
  type PartyMode,
} from '../src/ui/renderPartyGalleryMarkup.ts';

const STUB_ASSETS = {
  getCreatureDataUrl: (id: number, view: 'front' | 'back') =>
    `mock://doll/${id}/${view}`,
  getItemIconDataUrl: (id: string) => `mock://item/${id}`,
};

const BANNED_STYLE_PATTERNS = [
  /bg-gradient/i,
  /linear-gradient/i,
  /radial-gradient/i,
  /backdrop-blur/i,
  /filter:\s*blur/i,
  /\brounded-(sm|md|lg|xl|2xl|3xl|full)\b/i,
  /\bshadow-(sm|md|lg|xl|2xl)\b/i,
];

function makeSampleParty(count = 6) {
  const rng = createRng(42);
  const speciesPool = [1, 4, 7, 10, 12, 2];
  return Array.from({ length: count }, (_, idx) => {
    const c = createCreature(speciesPool[idx % speciesPool.length], 8 + idx * 2, rng);
    if (idx === 1) {
      c.heldItemId = 'baya_roble';
      c.socketedCardId = speciesPool[idx];
    }
    if (idx === 2) {
      c.currentHp = 0;
      c.status = 'burn';
    }
    return c;
  });
}

describe('Party Gallery Layout (.px-panel scrollable grid)', () => {
  it('renders a scrollable grid-based .px-panel gallery instead of an Instagram post feed', () => {
    const party = makeSampleParty(6);
    const html = renderPartyGalleryMarkup(party, { kind: 'manage' }, STUB_ASSETS);

    expect(html).toContain('px-panel px-panel-ornate');
    expect(html).toContain('data-party-scroll');
    expect(html).toContain('overflow-y-auto touch-scroll');
    expect(html).toContain('data-party-gallery');
    expect(html).toContain('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3');

    // Six cards inside the gallery, each using .px-panel px-card + .px-panel px-hud-box showcase
    for (let i = 0; i < 6; i++) {
      expect(html).toContain(`data-party-slot="${i}"`);
    }
    expect(html.match(/class="px-panel px-card /g)?.length).toBe(6);
    expect(html.match(/class="px-panel px-hud-box /g)?.length).toBe(6);

    // Team header summary & action controls
    expect(html).toContain('6/6 en formación');
    expect(html).toContain('5 listas');
    expect(html).toContain('data-close');
    expect(html).toContain('data-summary="0"');
    expect(html).not.toContain('data-lead="0"');
    expect(html).toContain('data-lead="1"');
    expect(html).toContain('Cristal Maná Carmesí');

    // Must not resemble an Instagram post layout
    expect(html).not.toMatch(/Instagram-style/i);
    expect(html).not.toMatch(/\baspect-square\b/i);
    expect(html).not.toContain('souldoll_portrait');
    expect(html).not.toMatch(/@[a-z0-9]+/i);

    // Must comply with strict flat-pixel styling rules
    for (const pattern of BANNED_STYLE_PATTERNS) {
      expect(html).not.toMatch(pattern);
    }
  });

  it('renders empty state cleanly inside the grid gallery when party is empty', () => {
    const html = renderPartyGalleryMarkup([], { kind: 'manage' }, STUB_ASSETS);
    expect(html).toContain('px-panel px-panel-ornate');
    expect(html).toContain('0/6 en formación');
    expect(html).toContain(ES.party.empty);
    expect(html).toContain('data-party-gallery');
  });

  it('supports switch and item_target modes with cancel and state labels', () => {
    const party = makeSampleParty(3);

    const switchForcedMode: PartyMode = {
      kind: 'switch',
      activeIndex: 0,
      allowCancel: false,
      onPick: () => {},
    };
    const switchHtml = renderPartyGalleryMarkup(party, switchForcedMode, STUB_ASSETS);
    expect(switchHtml).toContain(ES.party.chooseSwitch);
    expect(switchHtml).not.toContain('data-close');
    expect(switchHtml).toContain(ES.party.inBattle);
    expect(switchHtml).toContain(ES.party.sendOut);
    expect(switchHtml).toContain(ES.party.fainted);

    const itemMode: PartyMode = {
      kind: 'item_target',
      onPick: () => {},
      onCancel: () => {},
    };
    const itemHtml = renderPartyGalleryMarkup(party, itemMode, STUB_ASSETS);
    expect(itemHtml).toContain('data-close');
    expect(itemHtml.match(/data-pick="/g)?.length).toBe(3);
    expect(itemHtml).toContain(ES.party.useItem);
  });

  it('escapes custom creature nicknames cleanly', () => {
    const party = makeSampleParty(1);
    party[0].nickname = '<script>alert("xss")</script>';
    const html = renderPartyGalleryMarkup(party, { kind: 'manage' }, STUB_ASSETS);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });
});
