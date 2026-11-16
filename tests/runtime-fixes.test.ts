import { afterEach, describe, expect, it, vi } from 'vitest';
import { Input } from '../src/core/Input.ts';
import { createRng } from '../src/core/Rng.ts';
import { SceneStack, type Scene } from '../src/core/SceneStack.ts';
import { MAPS } from '../src/data/maps/index.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../src/data/species.ts';
import { createCreature } from '../src/domain/Creature.ts';
import { applyEvolution, checkLevelEvolution } from '../src/domain/Evolution.ts';
import {
  SOULDOLL_MAX_SHEET_ID,
  getSoulDollSheetId,
  getSoulDollSheetUrl,
} from '../src/gfx/SoulDollSheets.ts';

function makeDummyScene(name: string, log: string[]): Scene {
  return {
    name,
    onEnter: () => log.push(`${name}:enter`),
    onExit: () => log.push(`${name}:exit`),
    onPause: () => log.push(`${name}:pause`),
    onResume: () => log.push(`${name}:resume`),
    fixedUpdate: () => {},
    render: () => {},
  };
}

describe('Runtime fixes regression tests', () => {
  const originalWindow = globalThis.window;
  const originalHTMLElement = globalThis.HTMLElement;

  afterEach(() => {
    if (originalWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      globalThis.window = originalWindow;
    }
    if (originalHTMLElement === undefined) {
      delete (globalThis as Record<string, unknown>).HTMLElement;
    } else {
      globalThis.HTMLElement = originalHTMLElement;
    }
  });

  it('SceneStack.replaceTop swaps top scene without prematurely resuming the underlying scene', () => {
    const log: string[] = [];
    const stack = new SceneStack();
    const overworld = makeDummyScene('overworld', log);
    const battle = makeDummyScene('battle', log);
    const evolution = makeDummyScene('evolution', log);

    stack.push(overworld);
    stack.push(battle);
    log.length = 0;

    stack.replaceTop(evolution);
    expect(stack.peek()).toBe(evolution);
    expect(log).toEqual(['battle:exit', 'evolution:enter']);
    expect(log).not.toContain('overworld:resume');

    log.length = 0;
    stack.pop();
    expect(stack.peek()).toBe(overworld);
    expect(log).toEqual(['evolution:exit', 'overworld:resume']);
  });

  it('Input ignores keyboard events originating from editable inputs, textareas, selects, and contentEditable elements', () => {
    const listeners = new Map<string, Array<(e: unknown) => void>>();
    class MockHTMLElement {
      tagName: string;
      type = '';
      isContentEditable = false;
      constructor(tagName: string, opts?: { type?: string; isContentEditable?: boolean }) {
        this.tagName = tagName;
        if (opts?.type) this.type = opts.type;
        if (opts?.isContentEditable) this.isContentEditable = opts.isContentEditable;
      }
    }

    (globalThis as unknown as Record<string, unknown>).HTMLElement = MockHTMLElement;
    (globalThis as unknown as Record<string, unknown>).window = {
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        const arr = listeners.get(type) ?? [];
        arr.push(fn);
        listeners.set(type, arr);
      },
      removeEventListener: (type: string, fn: (e: unknown) => void) => {
        const arr = listeners.get(type) ?? [];
        listeners.set(
          type,
          arr.filter((item) => item !== fn)
        );
      },
    };

    const input = new Input();
    const keydown = listeners.get('keydown')?.[0];
    expect(keydown).toBeTypeOf('function');

    const textInput = new MockHTMLElement('INPUT', { type: 'text' });
    const textarea = new MockHTMLElement('TEXTAREA');
    const select = new MockHTMLElement('SELECT');
    const editableDiv = new MockHTMLElement('DIV', { isContentEditable: true });
    const rangeInput = new MockHTMLElement('INPUT', { type: 'range' });
    const body = new MockHTMLElement('BODY');

    for (const target of [textInput, textarea, select, editableDiv]) {
      const preventDefault = vi.fn();
      keydown!({ code: 'Space', target, preventDefault });
      keydown!({ code: 'KeyW', target, preventDefault });
      keydown!({ code: 'KeyM', target, preventDefault });
      expect(preventDefault).not.toHaveBeenCalled();
      expect(input.justPressed('a')).toBe(false);
      expect(input.justPressed('up')).toBe(false);
      expect(input.justPressed('start')).toBe(false);
    }

    // Range sliders and non-editable targets still drive game input
    const preventRange = vi.fn();
    keydown!({ code: 'ArrowRight', target: rangeInput, preventDefault: preventRange });
    expect(preventRange).toHaveBeenCalledTimes(1);
    expect(input.justPressed('right')).toBe(true);
    input.endFixedStep();

    const preventBody = vi.fn();
    keydown!({ code: 'Space', target: body, preventDefault: preventBody });
    expect(preventBody).toHaveBeenCalledTimes(1);
    expect(input.justPressed('a')).toBe(true);

    input.dispose();
  });

  it('covers SoulDoll sheets 1..SOULDOLL_MAX_SHEET_ID (52) without truncation', () => {
    expect(SOULDOLL_MAX_SHEET_ID).toBe(52);
    for (let id = 1; id <= SOULDOLL_MAX_SHEET_ID; id++) {
      expect(getSoulDollSheetId(id)).toBe(id);
      expect(getSoulDollSheetUrl(id)).toBe(
        `/assets/souldolls/${String(id).padStart(2, '0')}.webp`
      );
    }
    expect(ALL_SPECIES_IDS.length).toBeGreaterThanOrEqual(50);
  });

  it('supports sequential/re-evaluated level evolutions cleanly', () => {
    const starter = createCreature(1, 12, createRng(101));
    const firstTarget = checkLevelEvolution(starter);
    expect(firstTarget).toBe(2);

    applyEvolution(starter, firstTarget!);
    expect(starter.speciesId).toBe(2);
    expect(getSpecies(starter.speciesId).name).toBe('Pirodraco');

    // If not yet at stage-2 level threshold, no immediate second evolution
    expect(checkLevelEvolution(starter)).toBeNull();

    // If raised high enough, checkLevelEvolution yields stage 3 immediately
    starter.level = 24;
    expect(checkLevelEvolution(starter)).toBe(3);
  });

  it('provides a valid villa_origen fallback and valid dimensions for all maps and warps', () => {
    const fallback = MAPS['villa_origen'];
    expect(fallback).toBeDefined();
    expect(fallback.grid.length).toBeGreaterThan(26);
    expect(fallback.grid[0].length).toBeGreaterThan(24);

    for (const [mapId, map] of Object.entries(MAPS)) {
      const height = map.grid.length;
      const width = map.grid[0]?.length ?? 0;
      expect(width, `Invalid width on ${mapId}`).toBeGreaterThan(0);
      expect(height, `Invalid height on ${mapId}`).toBeGreaterThan(0);
      for (const warp of map.warps) {
        const dest = MAPS[warp.targetMap];
        expect(dest, `Missing warp target ${warp.targetMap} from ${mapId}`).toBeDefined();
        const destH = dest.grid.length;
        const destW = dest.grid[0]?.length ?? 0;
        expect(warp.targetX).toBeGreaterThanOrEqual(0);
        expect(warp.targetX).toBeLessThan(destW);
        expect(warp.targetY).toBeGreaterThanOrEqual(0);
        expect(warp.targetY).toBeLessThan(destH);
      }
    }
  });
});
