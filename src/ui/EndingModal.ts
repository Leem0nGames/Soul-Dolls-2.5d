import { getCreatureDisplayName } from '../domain/Creature.ts';
import type { SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';

function formatPlayTime(sec: number): string {
  const s = Math.floor(sec);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export class EndingModal extends ModalOverlay {
  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(
      parent,
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-abyss-ink p-3 sm:p-4 safe-pad'
    );
  }

  open(save: SaveData, onKeepPlaying: () => void, onBackTitle: () => void): void {
    const teamHtml = save.party
      .map(
        (c) => `
          <div class="px-card border-old-bronze flex flex-col items-center p-2">
            <img src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}" data-souldoll-id="${c.speciesId}" data-souldoll-view="front" class="souldoll-img w-16 h-16 object-contain" alt="" />
            <div class="text-xs font-bold truncate max-w-[80px]">${getCreatureDisplayName(c)}</div>
            <div class="text-[11px] text-resonant-gold tabular-nums">${ES.party.lv}${c.level}</div>
          </div>
        `
      )
      .join('');

    this.root.innerHTML = `
      <div class="px-panel w-full max-w-xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-4 sm:p-5 text-porcelain text-center">
        <div class="text-lg sm:text-xl font-extrabold text-resonant-gold px-text-shadow">${ES.ending.title}</div>
        <div class="mt-1 text-xs sm:text-sm text-bone-gray">${ES.ending.subtitle}</div>
        <div class="mt-4 grid grid-cols-3 sm:grid-cols-6 gap-2">${teamHtml}</div>
        <div class="px-card mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 text-xs tabular-nums text-left">
          <div class="flex justify-between"><span>${ES.ending.time}:</span><span class="font-bold">${formatPlayTime(save.stats.playTimeSec)}</span></div>
          <div class="flex justify-between"><span>${ES.ending.battles}:</span><span class="font-bold">${save.stats.battlesWon}</span></div>
          <div class="flex justify-between"><span>${ES.ending.caught}:</span><span class="font-bold">${save.caughtSpecies.length}</span></div>
          <div class="flex justify-between"><span>${ES.ending.money}:</span><span class="font-bold text-resonant-gold">${save.money} ◈</span></div>
        </div>
        <div class="mt-5 flex flex-wrap justify-center gap-3">
          <button data-keep class="px-btn-success min-h-[44px] px-5 font-bold text-sm whitespace-nowrap">${ES.ending.keepPlaying}</button>
          <button data-title class="px-btn-secondary min-h-[44px] px-5 font-bold text-sm whitespace-nowrap">${ES.ending.backTitle}</button>
        </div>
      </div>
    `;

    this.bindSoulDolls(this.assets);
    this.showOverlay();

    this.root.querySelector('[data-keep]')?.addEventListener('click', () => {
      this.close();
      onKeepPlaying();
    });
    this.root.querySelector('[data-title]')?.addEventListener('click', () => {
      this.close();
      onBackTitle();
    });
  }
}
