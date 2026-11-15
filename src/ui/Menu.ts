import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { getBestiaryCounts } from '../domain/Bestiary.ts';
import { getTotalVesselCount } from '../domain/BodyParts.ts';
import { getAlbumCounts } from '../domain/Cards.ts';
import type { GameOptions, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

export interface MenuCallbacks {
  onParty: () => void;
  onBag: () => void;
  onVessels?: () => void;
  onBestiary?: () => void;
  onCards?: () => void;
  onQuests?: () => void;
  onSave: () => boolean;
  onOptionsChanged: (options: GameOptions) => void;
  onClose: () => void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;
  private isOpenFlag = false;
  private unbindImages: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-30 hidden items-center justify-center sm:justify-end bg-abyss-ink p-3 sm:p-4 safe-pad';
    parent.appendChild(this.root);
  }

  isOpen(): boolean {
    return this.isOpenFlag;
  }

  open(save: SaveData, callbacks: MenuCallbacks): void {
    this.isOpenFlag = true;
    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, this.assets);
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    this.renderMain(save, callbacks);
  }

  private renderMain(save: SaveData, callbacks: MenuCallbacks, notice = ''): void {
    const counts = getBestiaryCounts(save);
    const cardCounts = getAlbumCounts(save);
    const vesselCount = getTotalVesselCount(save);
    const reserveCount = save.soulReserve?.length ?? 0;
    const repelInfo =
      save.repelSteps > 0
        ? `<div class="text-xs text-ki-cyan tabular-nums">${ES.menu.repelActive}: ${save.repelSteps}</div>`
        : '';
    const badgesInfo =
      save.badges.length > 0
        ? `<div class="text-xs text-neon-mint tabular-nums mb-1">${ES.menu.badges}: ${save.badges.length}/4</div>`
        : '';

    this.root.innerHTML = `
      <div class="px-panel w-[min(92vw,300px)] max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-3 text-porcelain">
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2">
          <span class="font-bold text-resonant-gold">${ES.menu.title}</span>
          <span class="text-xs text-pale-gold tabular-nums">${save.money} ◈</span>
        </div>
        ${badgesInfo}
        ${repelInfo}
        ${notice ? `<div class="mb-2 rounded-none border-2 border-ki-cyan bg-deep-abyss px-2 py-1 text-xs font-bold text-frosted-glass">${notice}</div>` : ''}
        <div class="flex flex-col gap-1.5">
          <button data-act="party" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.party}</button>
          <button data-act="bag" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.bag}</button>
          <button data-act="vessels" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm flex items-center justify-between">
            <span>${ES.menu.vessels}</span>
            <span class="text-xs text-ki-cyan tabular-nums">${vesselCount}C · ${reserveCount}A</span>
          </button>
          <button data-act="dex" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.dex} (${counts.caught}/${counts.total})</button>
          <button data-act="cards" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm flex items-center justify-between">
            <span>${ES.menu.cards}</span>
            <span class="text-xs text-resonant-gold tabular-nums">${cardCounts.collected}/${cardCounts.total}</span>
          </button>
          <button data-act="quests" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm flex items-center justify-between">
            <span>${ES.menu.quests}</span>
            <span class="text-xs text-pale-gold tabular-nums">${save.completedSideQuests?.length ?? 0}/5</span>
          </button>
          <button data-act="save" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.save}</button>
          <button data-act="options" class="px-btn-secondary min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.options}</button>
          <button data-act="close" class="px-btn-danger min-h-[44px] px-3 text-left font-bold text-sm">${ES.menu.close}</button>
        </div>
      </div>
    `;

    this.root.querySelector('[data-act="party"]')?.addEventListener('click', () => {
      this.close();
      callbacks.onParty();
    });
    this.root.querySelector('[data-act="bag"]')?.addEventListener('click', () => {
      this.close();
      callbacks.onBag();
    });
    this.root.querySelector('[data-act="vessels"]')?.addEventListener('click', () => {
      if (callbacks.onVessels) {
        this.close();
        callbacks.onVessels();
      }
    });
    this.root.querySelector('[data-act="dex"]')?.addEventListener('click', () => {
      if (callbacks.onBestiary) {
        this.close();
        callbacks.onBestiary();
      } else {
        this.renderDex(save, callbacks);
      }
    });
    this.root.querySelector('[data-act="cards"]')?.addEventListener('click', () => {
      if (callbacks.onCards) {
        this.close();
        callbacks.onCards();
      }
    });
    this.root.querySelector('[data-act="quests"]')?.addEventListener('click', () => {
      if (callbacks.onQuests) {
        this.close();
        callbacks.onQuests();
      }
    });
    this.root.querySelector('[data-act="save"]')?.addEventListener('click', () => {
      const ok = callbacks.onSave();
      this.renderMain(save, callbacks, ok ? ES.menu.savedOk : '');
    });
    this.root.querySelector('[data-act="options"]')?.addEventListener('click', () => {
      this.renderOptions(save, callbacks);
    });
    this.root.querySelector('[data-act="close"]')?.addEventListener('click', () => {
      this.close();
      callbacks.onClose();
    });
  }

  private renderDex(save: SaveData, callbacks: MenuCallbacks): void {
    const cards = ALL_SPECIES_IDS.map((id) => {
      const seen = save.seenSpecies.includes(id);
      const caught = save.caughtSpecies.includes(id);
      const spec = getSpecies(id);
      const typesHtml = seen
        ? spec.types
            .map((t) => {
              const v = TYPE_VISUALS[t];
              return `<span class="px-1.5 py-0.5 rounded-none border text-[10px] font-bold" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
            })
            .join(' ')
        : '';
      return `
        <div class="px-card ${caught ? 'border-resonant-gold' : 'border-ash-purple'} p-2 flex items-center gap-2">
          ${
            seen
              ? `<img src="${this.assets.getCreatureDataUrl(id, 'front')}" data-souldoll-id="${id}" data-souldoll-view="front" class="souldoll-img w-12 h-12 object-contain shrink-0" alt="${spec.name}" />`
              : `<div class="w-12 h-12 rounded-none border border-ash-purple bg-smoked-wood flex items-center justify-center text-cold-stone font-bold">?</div>`
          }
          <div class="min-w-0">
            <div class="text-xs text-bone-gray tabular-nums">#${String(id).padStart(2, '0')} ${caught ? '★' : ''}</div>
            <div class="font-bold text-sm truncate">${seen ? spec.name : ES.dex.unknown}</div>
            <div class="mt-0.5 flex gap-1">${typesHtml}</div>
          </div>
        </div>
      `;
    }).join('');

    this.root.innerHTML = `
      <div class="px-panel w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-3.5 sm:p-4 text-porcelain mx-auto">
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3">
          <div>
            <div class="font-bold text-resonant-gold">${ES.dex.title}</div>
            <div class="text-xs text-bone-gray tabular-nums">${ES.dex.seen}: ${save.seenSpecies.length}/${ALL_SPECIES_IDS.length} · ${ES.dex.caught}: ${save.caughtSpecies.length}/${ALL_SPECIES_IDS.length}</div>
          </div>
          <button data-back class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.options.back}</button>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">${cards}</div>
      </div>
    `;
    this.root.querySelector('[data-back]')?.addEventListener('click', () => {
      this.renderMain(save, callbacks);
    });
  }

  private renderOptions(save: SaveData, callbacks: MenuCallbacks): void {
    const opt = save.options;
    this.root.innerHTML = `
      <div class="px-panel w-full max-w-sm max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-4 text-porcelain mx-auto">
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3">
          <span class="font-bold text-resonant-gold">${ES.options.title}</span>
          <button data-back class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.options.back}</button>
        </div>
        <div class="space-y-3 text-sm">
          <div>
            <div class="flex justify-between mb-1">
              <span>${ES.options.volume}</span>
              <span class="tabular-nums">${Math.round(opt.volume * 100)}%</span>
            </div>
            <input data-vol type="range" min="0" max="100" value="${Math.round(opt.volume * 100)}" class="w-full h-9 accent-resonant-gold touch-pan-x" />
          </div>
          <button data-mute class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center font-semibold">
            <span>${ES.options.muted}</span>
            <span class="font-bold text-resonant-gold">${opt.muted ? ES.options.yes : ES.options.no}</span>
          </button>
          <button data-battery class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center font-semibold">
            <span>${ES.options.batterySaver}</span>
            <span class="font-bold text-resonant-gold">${opt.batterySaver ? ES.options.yes : ES.options.no}</span>
          </button>
          <button data-pixel-effect class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center font-semibold">
            <span>${ES.options.pixelEffect}</span>
            <span class="font-bold text-resonant-gold">${opt.pixelEffect ? ES.options.yes : ES.options.no}</span>
          </button>
          <button data-speed class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center font-semibold">
            <span>${ES.options.textSpeed}</span>
            <span class="font-bold text-resonant-gold">${opt.textSpeed === 'fast' ? ES.options.fast : ES.options.normal}</span>
          </button>
        </div>
      </div>
    `;

    this.root.querySelector('[data-back]')?.addEventListener('click', () => {
      this.renderMain(save, callbacks);
    });
    const volInput = this.root.querySelector('[data-vol]') as HTMLInputElement | null;
    volInput?.addEventListener('input', () => {
      opt.volume = Number(volInput.value) / 100;
      callbacks.onOptionsChanged(opt);
      const label = volInput.previousElementSibling?.lastElementChild;
      if (label) label.textContent = `${Math.round(opt.volume * 100)}%`;
    });
    this.root.querySelector('[data-mute]')?.addEventListener('click', () => {
      opt.muted = !opt.muted;
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks);
    });
    this.root.querySelector('[data-battery]')?.addEventListener('click', () => {
      opt.batterySaver = !opt.batterySaver;
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks);
    });
    this.root.querySelector('[data-pixel-effect]')?.addEventListener('click', () => {
      opt.pixelEffect = !opt.pixelEffect;
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks);
    });
    this.root.querySelector('[data-speed]')?.addEventListener('click', () => {
      opt.textSpeed = opt.textSpeed === 'normal' ? 'fast' : 'normal';
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks);
    });
  }

  close(): void {
    this.isOpenFlag = false;
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
