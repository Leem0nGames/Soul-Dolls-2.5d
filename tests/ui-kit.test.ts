import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ALL_BRAND_COLORS,
  assertBrandPaletteHex,
  BRAND_HEX_SET,
  BRAND_PALETTE_64,
  BRAND_PALETTE_GROUPS,
  BattleActionMenuView,
  BattleResultModalView,
  DialogPanelView,
  isBrandPaletteHex,
  LearnMoveModalView,
  OverworldHudView,
  PauseMenuView,
  PxBadge,
  PxButton,
  PxModal,
  PxNotice,
  PxPanel,
  PxPanelFooter,
  PxPanelHeader,
  PxProgressBar,
  PxSlider,
  PxSoulDustCounter,
  PxTabs,
  PxTypeBadge,
  QuestJournalView,
  type PxButtonVariant,
  type PxPanelVariant,
} from '../src/components/ui/index.ts';
import { createRng } from '../src/core/Rng.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { TYPE_VISUALS } from '../src/data/types.ts';
import { createCreature } from '../src/domain/Creature.ts';
import type { CreatureType } from '../src/domain/types.ts';
import type { AssetProvider } from '../src/gfx/AssetProvider.ts';
import { PALETTE } from '../src/gfx/Palette.ts';
import { createInitialSave } from '../src/save/migrations.ts';

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

const STUB_ASSETS = {
  getCreatureDataUrl: (id: number, view: 'front' | 'back') => `mock://doll/${id}/${view}`,
  getItemIconDataUrl: (id: string) => `mock://item/${id}`,
  getBattleIconDataUrl: (kind: string) => `mock://battle/${kind}`,
} as unknown as AssetProvider;

describe('Brand 64-Color Pixel UI Kit', () => {
  it('enforces the exact 64 colors across the 8 brand groups', () => {
    expect(BRAND_PALETTE_GROUPS).toHaveLength(8);

    const expectedCounts = {
      base: 9,
      neutrals: 6,
      woodsBronze: 7,
      redsPink: 8,
      violets: 8,
      cyansNature: 8,
      environment: 10,
      uiAccents: 8,
    };

    const collected: string[] = [];
    for (const group of BRAND_PALETTE_GROUPS) {
      expect(group.colors).toHaveLength(expectedCounts[group.id]);
      for (const hex of group.colors) {
        expect(hex).toMatch(/^#[0-9A-F]{6}$/);
        expect(isBrandPaletteHex(hex)).toBe(true);
        expect(assertBrandPaletteHex(hex.toLowerCase())).toBe(hex);
        collected.push(hex);
      }
    }

    expect(collected).toHaveLength(64);
    expect(new Set(collected).size).toBe(64);
    expect(ALL_BRAND_COLORS).toHaveLength(64);
    expect(BRAND_HEX_SET.size).toBe(64);
    expect(BRAND_PALETTE_64).toBe(PALETTE);

    expect(isBrandPaletteHex('#123456')).toBe(false);
    expect(() => assertBrandPaletteHex('#FFD84D')).toThrow(/outside the strict 64-color/i);
  });

  it('renders PxPanel across all variants using the px-panel base class', () => {
    const variants: PxPanelVariant[] = ['gold', 'violet', 'crimson', 'cyan', 'hud', 'card'];
    const expectedSubClass: Record<PxPanelVariant, string | null> = {
      gold: null,
      violet: 'px-panel-violet',
      crimson: 'px-panel-crimson',
      cyan: 'px-panel-cyan',
      hud: 'px-hud-box',
      card: 'px-card',
    };

    for (const variant of variants) {
      const html = renderToStaticMarkup(
        React.createElement(
          PxPanel,
          { variant, padding: 'md' },
          React.createElement(PxPanelHeader, {
            title: 'Título',
            subtitle: 'Subtítulo',
          }),
          React.createElement('div', null, 'Contenido'),
          React.createElement(PxPanelFooter, null, 'Pie')
        )
      );
      expect(html).toContain('px-panel');
      expect(html).not.toContain('px-panel-ornate');
      expect(html).not.toContain('data-px-ornate');
      expect(html).toContain('px-divider');
      const sub = expectedSubClass[variant];
      if (sub) {
        expect(html).toContain(sub);
      }
      assertFlatPixelMarkup(html);

      const ornateHtml = renderToStaticMarkup(
        React.createElement(
          PxPanel,
          { variant, padding: 'md', ornate: true },
          React.createElement(PxPanelHeader, {
            title: 'Título Ornato',
            ornate: true,
          }),
          React.createElement('div', null, 'Contenido')
        )
      );
      expect(ornateHtml).toContain('px-panel-ornate');
      expect(ornateHtml).toContain('data-px-ornate="true"');
      expect(ornateHtml).toContain('◆');
      assertFlatPixelMarkup(ornateHtml);
    }
  });

  it('renders PxButton across all variants using px-btn and px-btn-* classes', () => {
    const variants: PxButtonVariant[] = [
      'primary',
      'secondary',
      'success',
      'arcane',
      'violet',
      'danger',
      'ghost',
    ];

    for (const variant of variants) {
      const html = renderToStaticMarkup(
        React.createElement(PxButton, { variant, size: 'md' }, `Btn ${variant}`)
      );
      expect(html).toContain('class="px-btn ');
      expect(html).toContain(`px-btn-${variant}`);
      expect(html).toContain('min-h-[44px]');
      assertFlatPixelMarkup(html);
    }

    const activeSecondaryHtml = renderToStaticMarkup(
      React.createElement(PxButton, { variant: 'secondary', active: true }, 'Activo')
    );
    expect(activeSecondaryHtml).toContain('px-btn px-btn-primary');
    expect(activeSecondaryHtml).toContain('data-px-btn="primary"');

    const activeArcaneHtml = renderToStaticMarkup(
      React.createElement(PxButton, { variant: 'arcane', active: true }, 'Arcano')
    );
    expect(activeArcaneHtml).toContain('px-btn px-btn-arcane');
    expect(activeArcaneHtml).toContain('border-warm-white');

    const disabledHtml = renderToStaticMarkup(
      React.createElement(PxButton, { variant: 'primary', disabled: true }, 'Deshabilitado')
    );
    expect(disabledHtml).toContain('disabled=""');
    expect(disabledHtml).toContain('px-btn px-btn-primary');

    const defaultCaretHtml = renderToStaticMarkup(
      React.createElement(PxButton, { variant: 'secondary' }, 'Con selector')
    );
    expect(defaultCaretHtml).not.toContain('px-btn-no-caret');

    const noCaretHtml = renderToStaticMarkup(
      React.createElement(PxButton, { variant: 'secondary', showSelector: false }, 'Sin selector')
    );
    expect(noCaretHtml).toContain('px-btn-no-caret');
  });

  it('renders badges, progress bars, tabs, notices, sliders, counters, and modals with flat pixel styling', () => {
    const allTypes = Object.keys(TYPE_VISUALS) as CreatureType[];
    const typeBadges = allTypes
      .map((t) =>
        renderToStaticMarkup(React.createElement(PxTypeBadge, { type: t, size: 'md' }))
      )
      .join('');
    expect(typeBadges).toContain('rounded-none');
    assertFlatPixelMarkup(typeBadges);

    const badgeHtml = renderToStaticMarkup(
      React.createElement(PxBadge, { tone: 'gold', size: 'sm', children: 'OBJETIVO' })
    );
    expect(badgeHtml).toContain('border-resonant-gold');
    assertFlatPixelMarkup(badgeHtml);

    const barHtml = renderToStaticMarkup(
      React.createElement(PxProgressBar, {
        value: 20,
        max: 100,
        tone: 'hp',
        height: 'md',
        ghostValue: 45,
        lowPulse: true,
      })
    );
    expect(barHtml).toContain('progressbar');
    expect(barHtml).toContain('width:20%');
    expect(barHtml).toContain('width:45%');
    expect(barHtml).toContain('px-meter-segmented');
    assertFlatPixelMarkup(barHtml);

    const smoothBarHtml = renderToStaticMarkup(
      React.createElement(PxProgressBar, {
        value: 60,
        max: 100,
        tone: 'xp',
        segmented: false,
      })
    );
    expect(smoothBarHtml).not.toContain('px-meter-segmented');

    const tabsHtml = renderToStaticMarkup(
      React.createElement(PxTabs, {
        value: 'sound',
        onChange: () => {},
        items: [
          { id: 'sound', label: 'Sonido' },
          { id: 'quality', label: 'Gráficos' },
        ],
      })
    );
    expect(tabsHtml).toContain('px-btn px-btn-primary');
    expect(tabsHtml).toContain('px-btn px-btn-secondary');
    expect(tabsHtml).not.toContain('px-btn-no-caret');
    assertFlatPixelMarkup(tabsHtml);

    const gridTabsHtml = renderToStaticMarkup(
      React.createElement(PxTabs, {
        value: 'sound',
        columns: 2,
        onChange: () => {},
        items: [
          { id: 'sound', label: 'Sonido' },
          { id: 'quality', label: 'Gráficos' },
        ],
      })
    );
    expect(gridTabsHtml).toContain('px-btn-no-caret');

    const noticeHtml = renderToStaticMarkup(
      React.createElement(PxNotice, { tone: 'success', children: 'Guardado correctamente.' })
    );
    expect(noticeHtml).toContain('border-neon-mint');
    assertFlatPixelMarkup(noticeHtml);

    const counterHtml = renderToStaticMarkup(
      React.createElement(PxSoulDustCounter, { amount: 120, showLabel: true })
    );
    expect(counterHtml).toContain('120');
    assertFlatPixelMarkup(counterHtml);

    const sliderHtml = renderToStaticMarkup(
      React.createElement(PxSlider, {
        label: 'Volumen BGM',
        value: 80,
        min: 0,
        max: 100,
        displayValue: '80%',
        onChange: () => {},
      })
    );
    expect(sliderHtml).toContain('px-panel px-card');
    expect(sliderHtml).toContain('80%');
    assertFlatPixelMarkup(sliderHtml);

    const modalHtml = renderToStaticMarkup(
      React.createElement(PxModal, {
        open: true,
        variant: 'violet',
        children: React.createElement('div', null, 'Cuerpo modal'),
      })
    );
    expect(modalHtml).toContain('px-panel px-panel-violet');
    expect(modalHtml).toContain('px-panel-ornate');
    expect(modalHtml).toContain('role="dialog"');
    assertFlatPixelMarkup(modalHtml);

    const plainModalHtml = renderToStaticMarkup(
      React.createElement(PxModal, {
        open: true,
        ornate: false,
        children: React.createElement('div', null, 'Simple'),
      })
    );
    expect(plainModalHtml).not.toContain('px-panel-ornate');
  });

  it('renders OverworldHudView, DialogPanelView, PauseMenuView, and BattleHudViews consistently', () => {
    const save = createInitialSave();
    const rng = createRng(42);
    const ally = createCreature(1, 5, rng);
    const enemy = createCreature(15, 4, rng);
    save.party.push(ally);

    const overworldHtml = renderToStaticMarkup(
      React.createElement(OverworldHudView, {
        locationLine: 'Ruta 1 · 120 ◈',
        staminaCurrent: 75,
        staminaMax: 100,
        staminaExhausted: false,
        questCollapsed: false,
        questComplete: false,
        questStepLabel: 'Misión 1/5',
        questTitle: 'Despertar SoulDoll',
        questObjective: 'Cruza la Ruta 1',
        questTargetLabel: 'Guardia',
        questDistShort: '18m',
        questDistLong: 'Objetivo: 18m',
        arrowAngleDeg: 45,
        journalBadgeText: '1 lista(s)',
        journalBadgeTone: 'ready',
        onToggleQuest: () => {},
        onOpenJournal: () => {},
      })
    );
    expect(overworldHtml).toContain('px-panel px-hud-box');
    expect(overworldHtml).not.toContain('px-panel-ornate');
    expect(overworldHtml).toContain('px-btn px-btn-primary');
    expect(overworldHtml).toContain('Diario');
    expect(overworldHtml).toContain('Secundarias');
    assertFlatPixelMarkup(overworldHtml);

    const questJournalHtml = renderToStaticMarkup(
      React.createElement(QuestJournalView, {
        save,
        navContext: { map: MAPS.villa_origen, x: 24, y: 26 },
        onClose: () => {},
      })
    );
    expect(questJournalHtml).toContain('px-panel');
    expect(questJournalHtml).toContain('px-panel-ornate');
    expect(questJournalHtml).toContain('DIARIO DE MISIONES');
    expect(questJournalHtml).toContain('Brújula Activa');
    expect(questJournalHtml).toContain('Historia (0/');
    assertFlatPixelMarkup(questJournalHtml);

    const dialogHtml = renderToStaticMarkup(
      React.createElement(DialogPanelView, {
        visibleText: 'Bienvenida al taller de SoulDolls.',
        choices: [
          { label: 'Aceptar', onSelect: () => {} },
          { label: 'Luego', onSelect: () => {} },
        ],
        choiceIndex: 0,
        showChoices: true,
        showContinueHint: false,
        onAdvance: () => {},
        onPickChoice: () => {},
      })
    );
    expect(dialogHtml).toContain('px-panel');
    expect(dialogHtml).toContain('px-panel-ornate');
    expect(dialogHtml).toContain('px-btn px-btn-primary');
    expect(dialogHtml).toContain('px-btn px-btn-secondary');
    assertFlatPixelMarkup(dialogHtml);

    const pauseHtml = renderToStaticMarkup(
      React.createElement(PauseMenuView, {
        save,
        assets: STUB_ASSETS,
        initialView: 'options',
        initialOptionsTab: 'sound',
        callbacks: {
          onParty: () => {},
          onBag: () => {},
          onVessels: () => {},
          onBestiary: () => {},
          onCards: () => {},
          onQuests: () => {},
          onSave: () => true,
          onOptionsChanged: () => {},
          onClose: () => {},
        },
      })
    );
    expect(pauseHtml).toContain('px-panel');
    expect(pauseHtml).toContain('px-panel-ornate');
    expect(pauseHtml).toContain('px-btn px-btn-primary');
    expect(pauseHtml).toContain('px-btn px-btn-secondary');
    assertFlatPixelMarkup(pauseHtml);

    const battleMenuHtml = renderToStaticMarkup(
      React.createElement(BattleActionMenuView, {
        creature: ally,
        enemy,
        isWild: true,
        assets: STUB_ASSETS,
        onMove: () => {},
        onBag: () => {},
        onParty: () => {},
        onRun: () => {},
      })
    );
    expect(battleMenuHtml).toContain('px-btn px-btn-danger');
    expect(battleMenuHtml).toContain('px-btn px-btn-primary');
    expect(battleMenuHtml).toContain('px-btn px-btn-success');
    expect(battleMenuHtml).toContain('px-btn px-btn-arcane');
    expect(battleMenuHtml).toContain('px-divider');
    assertFlatPixelMarkup(battleMenuHtml);

    const learnHtml = renderToStaticMarkup(
      React.createElement(LearnMoveModalView, {
        creature: ally,
        newMoveId: ally.moves[0].moveId,
        onDecision: () => {},
      })
    );
    expect(learnHtml).toContain('px-panel');
    expect(learnHtml).toContain('px-btn px-btn-ghost');
    expect(learnHtml).toContain('px-btn px-btn-secondary');
    assertFlatPixelMarkup(learnHtml);

    const resultHtml = renderToStaticMarkup(
      React.createElement(BattleResultModalView, {
        xpTotal: 64,
        soulDust: 25,
        rewardMoney: 100,
        droppedCards: [{ speciesId: 15, creatureName: 'Soror', isDuplicate: true }],
        assets: STUB_ASSETS,
        onAlbum: () => {},
        onContinue: () => {},
        onDismantleDuplicate: () => {},
      })
    );
    expect(resultHtml).toContain('px-panel');
    expect(resultHtml).toContain('px-panel px-card');
    expect(resultHtml).toContain('px-btn px-btn-primary');
    expect(resultHtml).toContain('px-btn px-btn-arcane');
    expect(resultHtml).toContain('px-btn px-btn-secondary');
    assertFlatPixelMarkup(resultHtml);
  });

  it('audits src/index.css for strict 64-color compliance (including SVG data URIs) and flat pixel discipline', async () => {
    const fsModuleName = 'node:fs';
    const { readFileSync } = (await import(/* @vite-ignore */ fsModuleName)) as {
      readFileSync: (fileUrl: URL, encoding: 'utf8') => string;
    };
    const rawCss = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
    expect(rawCss).toContain('.px-panel');
    const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(css).not.toMatch(/linear-gradient|radial-gradient|conic-gradient/i);
    expect(css).not.toMatch(/\bblur\(/i);
    expect(css).not.toMatch(/\brgba?\(/i);

    const radiusMatches = [...css.matchAll(/border-radius\s*:\s*([^;\}]+)/gi)];
    expect(radiusMatches.length).toBeGreaterThan(5);
    for (const match of radiusMatches) {
      expect(match[1].trim()).toMatch(/^0(\s*!important)?$/i);
    }

    const hexMatches = [
      ...css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g),
      ...css.matchAll(/%23([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/gi),
    ];

    expect(hexMatches.length).toBeGreaterThan(20);
    for (const match of hexMatches) {
      const token = match[1];
      expect(token).toHaveLength(6);
      const normalized = `#${token.toUpperCase()}`;
      expect(BRAND_HEX_SET.has(normalized)).toBe(true);
    }
  });
});
