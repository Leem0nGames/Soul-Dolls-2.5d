import { ES } from '../i18n/es.ts';

/**
 * Pixel-art faceted soul crystal/dust icon built on an 8x8 pixel grid.
 */
export function renderSoulDustIconSvg(sizeClass = 'w-4 h-4'): string {
  return `<svg viewBox="0 0 8 8" class="${sizeClass} shrink-0 pixel-canvas" shape-rendering="crispEdges" aria-hidden="true">
    <rect x="3" y="0" width="2" height="1" fill="#F4EFFF" />
    <rect x="2" y="1" width="4" height="1" fill="#D1BEFF" />
    <rect x="1" y="2" width="2" height="2" fill="#B691FF" />
    <rect x="3" y="2" width="2" height="3" fill="#9B6BFF" />
    <rect x="5" y="2" width="2" height="2" fill="#7F4AD6" />
    <rect x="2" y="4" width="4" height="2" fill="#7F4AD6" />
    <rect x="3" y="6" width="2" height="1" fill="#5E329E" />
    <rect x="1" y="6" width="1" height="1" fill="#D1BEFF" />
    <rect x="6" y="1" width="1" height="1" fill="#F4EFFF" />
  </svg>`;
}

export function renderSoulDustCounter(
  amount: number,
  options: { compact?: boolean; showLabel?: boolean; dataAttr?: string } = {}
): string {
  const safeAmount = Math.max(0, Math.floor(amount));
  const compact = options.compact ?? false;
  const showLabel = options.showLabel ?? true;
  const attr = options.dataAttr ? ` ${options.dataAttr}` : '';

  return `<div${attr} class="inline-flex items-center gap-1.5 rounded-none border-2 border-soul-violet bg-crypt-ink ${
    compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
  } font-bold text-ghost-violet shadow-[inset_0_2px_0_0_#3C1C6E,2px_2px_0_0_#050505] tabular-nums whitespace-nowrap shrink-0" title="${ES.cards.soulDustLabel}">
    ${renderSoulDustIconSvg(compact ? 'w-3.5 h-3.5' : 'w-4 h-4')}
    ${showLabel ? `<span class="text-bone-gray font-semibold hidden sm:inline">${ES.cards.soulDustLabel}:</span><span class="text-bone-gray font-semibold sm:hidden">${ES.cards.soulDustShort}:</span>` : ''}
    <span class="text-lavender-mist font-black">${safeAmount}</span>
  </div>`;
}
