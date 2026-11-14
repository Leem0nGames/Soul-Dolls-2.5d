import { getCreatureDisplayName } from '../domain/Creature.ts';
import type { SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

function formatPlayTime(sec: number): string {
  const s = Math.floor(sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export class EndingModal {
  readonly root: HTMLDivElement;
  private unbindImages: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-crypt-ink/95 p-3 sm:p-4 safe-pad';
    parent.appendChild(this.root);
  }

  open(save: SaveData, onKeepPlaying: () => void, onBackTitle: () => void): void {
    const teamHtml = save.party
      .map(
        (c) => `
          <div class="flex flex-col items-center rounded-lg border border-old-bronze/70 bg-crypt-ink p-2">
            <img src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}" data-souldoll-id="${c.speciesId}" data-souldoll-view="front" class="souldoll-img w-16 h-16 object-contain" alt="" />
            <div class="text-xs font-bold truncate max-w-[80px]">${getCreatureDisplayName(c)}</div>
            <div class="text-[11px] text-resonant-gold tabular-nums">${ES.party.lv}${c.level}</div>
          </div>
        `
      )
      .join('');

    this.root.innerHTML = `
      <div class="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-2xl border-2 border-resonant-gold bg-smoked-wood p-4 sm:p-5 text-porcelain shadow-2xl text-center">
        <div class="text-lg sm:text-xl font-extrabold text-resonant-gold">${ES.ending.title}</div>
        <div class="mt-1 text-xs sm:text-sm text-bone-gray">${ES.ending.subtitle}</div>
        <div class="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">${teamHtml}</div>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-ash-purple bg-crypt-ink p-3 text-xs tabular-nums text-left">
          <div class="flex justify-between"><span>${ES.ending.time}:</span><span class="font-bold">${formatPlayTime(save.stats.playTimeSec)}</span></div>
          <div class="flex justify-between"><span>${ES.ending.battles}:</span><span class="font-bold">${save.stats.battlesWon}</span></div>
          <div class="flex justify-between"><span>${ES.ending.caught}:</span><span class="font-bold">${save.caughtSpecies.length}</span></div>
          <div class="flex justify-between"><span>${ES.ending.money}:</span><span class="font-bold text-resonant-gold">${save.money} ◈</span></div>
        </div>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <button data-keep class="min-h-[44px] px-5 rounded-lg bg-emerald-base hover:bg-oceanic-teal text-warm-white font-bold text-sm">${ES.ending.keepPlaying}</button>
          <button data-title class="min-h-[44px] px-5 rounded-lg border border-cold-stone bg-ash-purple hover:bg-cold-stone/40 font-bold text-sm">${ES.ending.backTitle}</button>
        </div>
      </div>
    `;

    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, this.assets);
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');

    this.root.querySelector('[data-keep]')?.addEventListener('click', () => {
      this.close();
      onKeepPlaying();
    });
    this.root.querySelector('[data-title]')?.addEventListener('click', () => {
      this.close();
      onBackTitle();
    });
  }

  close(): void {
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.remove();
  }
}
