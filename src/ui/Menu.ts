import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { getBestiaryCounts } from '../domain/Bestiary.ts';
import { getTotalVesselCount } from '../domain/BodyParts.ts';
import type { GameOptions, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';

export interface MenuCallbacks {
  onParty: () => void;
  onBag: () => void;
  onVessels?: () => void;
  onBestiary?: () => void;
  onSave: () => boolean;
  onOptionsChanged: (options: GameOptions) => void;
  onClose: () => void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;
  private isOpenFlag = false;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-30 hidden items-center justify-center sm:justify-end bg-crypt-ink/60 p-3 sm:p-4 safe-pad';
    parent.appendChild(this.root);
  }

  isOpen(): boolean {
    return this.isOpenFlag;
  }

  open(save: SaveData, callbacks: MenuCallbacks): void {
    this.isOpenFlag = true;
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    this.renderMain(save, callbacks);
  }

  private renderMain(save: SaveData, callbacks: MenuCallbacks, notice = ''): void {
    const counts = getBestiaryCounts(save);
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
      <div class="w-[min(92vw,300px)] max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3 text-porcelain shadow-2xl">
        <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-2">
          <span class="font-bold text-resonant-gold">${ES.menu.title}</span>
          <span class="text-xs text-pale-gold tabular-nums">${save.money} ◈</span>
        </div>
        ${badgesInfo}
        ${repelInfo}
        ${notice ? `<div class="mb-2 rounded bg-oceanic-teal/70 px-2 py-1 text-xs text-frosted-glass">${notice}</div>` : ''}
        <div class="flex flex-col gap-1.5">
          <button data-act="party" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60">${ES.menu.party}</button>
          <button data-act="bag" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60">${ES.menu.bag}</button>
          <button data-act="vessels" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60 flex items-center justify-between">
            <span>${ES.menu.vessels}</span>
            <span class="text-xs text-ki-cyan tabular-nums">${vesselCount}C · ${reserveCount}A</span>
          </button>
          <button data-act="dex" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60">${ES.menu.dex} (${counts.caught}/${counts.total})</button>
          <button data-act="save" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60">${ES.menu.save}</button>
          <button data-act="options" class="min-h-[44px] px-3 rounded-lg bg-ash-purple hover:bg-cold-stone/40 text-left font-semibold text-sm border border-cold-stone/60">${ES.menu.options}</button>
          <button data-act="close" class="min-h-[44px] px-3 rounded-lg bg-blood-moon/80 hover:bg-rosewood text-left font-semibold text-sm border border-rift-crimson/70">${ES.menu.close}</button>
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
              return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:${v.bg};color:${v.color}">${ES.types[t]}</span>`;
            })
            .join(' ')
        : '';
      return `
        <div class="rounded-lg border ${caught ? 'border-resonant-gold/75' : 'border-ash-purple'} bg-crypt-ink p-2 flex items-center gap-2">
          ${
            seen
              ? `<img src="${this.assets.getCreatureDataUrl(id, 'front')}" class="pixel-canvas w-12 h-12 object-contain shrink-0" alt="${spec.name}" />`
              : `<div class="w-12 h-12 rounded bg-smoked-wood flex items-center justify-center text-cold-stone font-bold">?</div>`
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
      <div class="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl mx-auto">
        <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
          <div>
            <div class="font-bold text-resonant-gold">${ES.dex.title}</div>
            <div class="text-xs text-bone-gray tabular-nums">${ES.dex.seen}: ${save.seenSpecies.length}/${ALL_SPECIES_IDS.length} · ${ES.dex.caught}: ${save.caughtSpecies.length}/${ALL_SPECIES_IDS.length}</div>
          </div>
          <button data-back class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold">${ES.options.back}</button>
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
      <div class="w-full max-w-sm max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-4 text-porcelain shadow-2xl mx-auto">
        <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
          <span class="font-bold text-resonant-gold">${ES.options.title}</span>
          <button data-back class="min-h-[44px] px-3 rounded-lg border border-cold-stone bg-ash-purple text-xs font-bold">${ES.options.back}</button>
        </div>
        <div class="space-y-3 text-sm">
          <div>
            <div class="flex justify-between mb-1">
              <span>${ES.options.volume}</span>
              <span class="tabular-nums">${Math.round(opt.volume * 100)}%</span>
            </div>
            <input data-vol type="range" min="0" max="100" value="${Math.round(opt.volume * 100)}" class="w-full h-9 accent-resonant-gold touch-pan-x" />
          </div>
          <button data-mute class="w-full min-h-[44px] px-3 rounded-lg bg-ash-purple border border-cold-stone/70 flex justify-between items-center">
            <span>${ES.options.muted}</span>
            <span class="font-bold text-resonant-gold">${opt.muted ? ES.options.yes : ES.options.no}</span>
          </button>
          <button data-battery class="w-full min-h-[44px] px-3 rounded-lg bg-ash-purple border border-cold-stone/70 flex justify-between items-center">
            <span>${ES.options.batterySaver}</span>
            <span class="font-bold text-resonant-gold">${opt.batterySaver ? ES.options.yes : ES.options.no}</span>
          </button>
          <button data-speed class="w-full min-h-[44px] px-3 rounded-lg bg-ash-purple border border-cold-stone/70 flex justify-between items-center">
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
    this.root.querySelector('[data-speed]')?.addEventListener('click', () => {
      opt.textSpeed = opt.textSpeed === 'normal' ? 'fast' : 'normal';
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks);
    });
  }

  close(): void {
    this.isOpenFlag = false;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.root.remove();
  }
}
