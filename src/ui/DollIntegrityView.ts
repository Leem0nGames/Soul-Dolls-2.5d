import {
  BODY_PART_LABELS,
  BODY_PART_ORDER,
  BODY_PART_SHORT,
  computeBodyPartRatios,
  ensureBodyParts,
} from '../domain/BodyParts.ts';
import type { CreatureInstance } from '../domain/types.ts';
import { PALETTE } from '../gfx/Palette.ts';

export interface PartTone {
  fill: string;
  hi: string;
  barCls: string;
  textCls: string;
  broken: boolean;
}

export function getBodyPartTone(current: number, max: number): PartTone {
  if (current <= 0) {
    return {
      fill: PALETTE.ashPurple,
      hi: PALETTE.coldStone,
      barCls: 'bg-ash-purple',
      textCls: 'text-coral-red font-bold',
      broken: true,
    };
  }
  const pct = (current / Math.max(1, max)) * 100;
  if (pct > 60) {
    return {
      fill: PALETTE.kiCyan,
      hi: PALETTE.iceCyan,
      barCls: 'bg-ki-cyan',
      textCls: 'text-porcelain',
      broken: false,
    };
  }
  if (pct > 25) {
    return {
      fill: PALETTE.resonantGold,
      hi: PALETTE.paleGold,
      barCls: 'bg-resonant-gold',
      textCls: 'text-pale-gold',
      broken: false,
    };
  }
  return {
    fill: PALETTE.coralRed,
    hi: PALETTE.peachBlush,
    barCls: 'bg-coral-red',
    textCls: 'text-coral-red',
    broken: false,
  };
}

function renderPixelSegments(pct: number, tone: PartTone): string {
  const totalPips = 5;
  const filledPips = tone.broken
    ? 0
    : Math.max(1, Math.min(totalPips, Math.ceil((pct / 100) * totalPips)));

  let html = '';
  for (let i = 0; i < totalPips; i++) {
    const active = i < filledPips;
    html += `<span class="h-1.5 flex-1 ${
      active ? tone.barCls : 'bg-abyss-ink border border-ash-purple'
    }"></span>`;
  }
  return html;
}

function renderDollSilhouetteSvg(
  creature: CreatureInstance,
  scale: 2 | 3 = 2
): string {
  const parts = ensureBodyParts(creature);
  const head = getBodyPartTone(parts.head.current, parts.head.max);
  const torso = getBodyPartTone(parts.torso.current, parts.torso.max);
  const arms = getBodyPartTone(parts.arms.current, parts.arms.max);
  const legs = getBodyPartTone(parts.legs.current, parts.legs.max);

  const w = 16 * scale;
  const h = 20 * scale;
  const ink = PALETTE.abyssInk;
  const joint = PALETTE.cryptInk;
  const crack = PALETTE.riftCrimson;
  const crackHi = PALETTE.coralRed;

  return `
    <svg
      width="${w}"
      height="${h}"
      viewBox="0 0 16 20"
      shape-rendering="crispEdges"
      class="pixel-canvas shrink-0 select-none"
      aria-hidden="true"
    >
      <rect x="7" y="5" width="2" height="1" fill="${joint}" />

      <g data-part="head" style="transform-origin:8px 2px">
        <rect x="6" y="0" width="4" height="1" fill="${ink}" />
        <rect x="5" y="1" width="6" height="4" fill="${ink}" />
        <rect x="6" y="1" width="4" height="3" fill="${head.fill}" />
        <rect x="7" y="0" width="2" height="1" fill="${head.hi}" />
        <rect x="6" y="1" width="2" height="1" fill="${head.hi}" />
        <rect x="6" y="2" width="1" height="1" fill="${joint}" />
        <rect x="9" y="2" width="1" height="1" fill="${joint}" />
        ${
          head.broken
            ? `<rect x="6" y="1" width="1" height="1" fill="${crack}" />
               <rect x="9" y="1" width="1" height="1" fill="${crackHi}" />
               <rect x="7" y="2" width="2" height="1" fill="${crack}" />
               <rect x="6" y="3" width="1" height="1" fill="${crackHi}" />
               <rect x="9" y="3" width="1" height="1" fill="${crack}" />`
            : ''
        }
      </g>

      <g data-part="torso" style="transform-origin:8px 9px">
        <rect x="5" y="6" width="6" height="5" fill="${ink}" />
        <rect x="6" y="11" width="4" height="2" fill="${ink}" />
        <rect x="6" y="6" width="4" height="4" fill="${torso.fill}" />
        <rect x="7" y="10" width="2" height="2" fill="${torso.fill}" />
        <rect x="7" y="7" width="2" height="2" fill="${torso.hi}" />
        ${
          torso.broken
            ? `<rect x="6" y="6" width="1" height="1" fill="${crack}" />
               <rect x="7" y="7" width="1" height="1" fill="${crackHi}" />
               <rect x="8" y="8" width="1" height="1" fill="${crack}" />
               <rect x="9" y="9" width="1" height="1" fill="${crackHi}" />`
            : ''
        }
      </g>

      <g data-part="arms" style="transform-origin:8px 9px">
        <rect x="2" y="6" width="3" height="6" fill="${ink}" />
        <rect x="1" y="11" width="3" height="2" fill="${ink}" />
        <rect x="3" y="7" width="1" height="4" fill="${arms.fill}" />
        <rect x="2" y="11" width="1" height="1" fill="${arms.fill}" />
        <rect x="3" y="7" width="1" height="1" fill="${arms.hi}" />

        <rect x="11" y="6" width="3" height="6" fill="${ink}" />
        <rect x="12" y="11" width="3" height="2" fill="${ink}" />
        <rect x="12" y="7" width="1" height="4" fill="${arms.fill}" />
        <rect x="13" y="11" width="1" height="1" fill="${arms.fill}" />
        <rect x="12" y="7" width="1" height="1" fill="${arms.hi}" />
        ${
          arms.broken
            ? `<rect x="3" y="8" width="1" height="1" fill="${crack}" />
               <rect x="2" y="9" width="1" height="1" fill="${crackHi}" />
               <rect x="12" y="8" width="1" height="1" fill="${crack}" />
               <rect x="13" y="9" width="1" height="1" fill="${crackHi}" />`
            : ''
        }
      </g>

      <g data-part="legs" style="transform-origin:8px 16px">
        <rect x="4" y="13" width="3" height="5" fill="${ink}" />
        <rect x="3" y="18" width="4" height="2" fill="${ink}" />
        <rect x="5" y="13" width="1" height="5" fill="${legs.fill}" />
        <rect x="4" y="18" width="2" height="1" fill="${legs.fill}" />
        <rect x="5" y="15" width="1" height="1" fill="${legs.hi}" />

        <rect x="9" y="13" width="3" height="5" fill="${ink}" />
        <rect x="9" y="18" width="4" height="2" fill="${ink}" />
        <rect x="10" y="13" width="1" height="5" fill="${legs.fill}" />
        <rect x="10" y="18" width="2" height="1" fill="${legs.fill}" />
        <rect x="10" y="15" width="1" height="1" fill="${legs.hi}" />
        ${
          legs.broken
            ? `<rect x="5" y="14" width="1" height="1" fill="${crack}" />
               <rect x="4" y="16" width="1" height="1" fill="${crackHi}" />
               <rect x="10" y="14" width="1" height="1" fill="${crack}" />
               <rect x="11" y="16" width="1" height="1" fill="${crackHi}" />`
            : ''
        }
      </g>
    </svg>
  `;
}

export function renderDollIntegrityHtml(
  creature: CreatureInstance,
  options: { mode: 'battle-player' | 'battle-enemy' | 'summary' }
): string {
  const parts = ensureBodyParts(creature);
  const isSummary = options.mode === 'summary';
  const ratios = isSummary
    ? computeBodyPartRatios(
        creature.containerId ?? 'cuerpo_aprendiz',
        creature.ivs,
        creature.evBonuses
      )
    : null;

  const rowsHtml = BODY_PART_ORDER.map((key) => {
    const p = parts[key];
    const pct = Math.max(0, Math.min(100, Math.round((p.current / Math.max(1, p.max)) * 100)));
    const tone = getBodyPartTone(p.current, p.max);

    const valueLabel = tone.broken
      ? 'ROT'
      : options.mode === 'battle-enemy'
        ? `${pct}%`
        : `${p.current}/${p.max}`;

    const labelText = isSummary
      ? `${BODY_PART_LABELS[key]} <span class="text-cold-stone">(${ratios![key]}%)</span>`
      : BODY_PART_SHORT[key];

    return `
      <div data-part-row="${key}" class="flex items-center gap-1.5 leading-none">
        <span class="${isSummary ? 'w-24 text-[11px]' : 'w-6 text-[10px]'} shrink-0 text-bone-gray whitespace-nowrap">${labelText}</span>
        <div class="flex-1 flex items-center gap-[2px] min-w-0">${renderPixelSegments(pct, tone)}</div>
        <span class="${isSummary ? 'w-12 text-[11px]' : 'w-11 text-[10px]'} shrink-0 text-right tabular-nums whitespace-nowrap ${tone.textCls}">${valueLabel}</span>
      </div>
    `;
  }).join('');

  return `
    <div class="flex items-center ${isSummary ? 'gap-3' : 'gap-2'}">
      ${renderDollSilhouetteSvg(creature, isSummary ? 3 : 2)}
      <div class="flex-1 min-w-0 ${isSummary ? 'space-y-1.5' : 'space-y-[3px]'}">
        ${rowsHtml}
      </div>
    </div>
  `;
}
