import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { getBestiaryCounts } from '../domain/Bestiary.ts';
import { getTotalVesselCount } from '../domain/BodyParts.ts';
import { getAlbumCounts, getSoulDust } from '../domain/Cards.ts';
import type {
  GameOptions,
  GraphicsQualitySetting,
  SaveData,
} from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { defaultOptions } from '../save/migrations.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';
import { renderSoulDustIconSvg } from './renderSoulDustCounter.ts';

export type OptionsTab = 'sound' | 'quality' | 'postfx' | 'game';

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

export interface OptionsOnlyCallbacks {
  onOptionsChanged: (options: GameOptions) => void;
  onClose: () => void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;
  private isOpenFlag = false;
  private unbindImages: (() => void) | null = null;
  private activeOptionsTab: OptionsTab = 'sound';

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center sm:justify-end bg-abyss-ink p-3 sm:p-4 safe-pad';
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

  openOptionsOnly(save: SaveData, callbacks: OptionsOnlyCallbacks): void {
    this.isOpenFlag = true;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    const wrapped: MenuCallbacks = {
      onParty: () => {},
      onBag: () => {},
      onSave: () => false,
      onOptionsChanged: callbacks.onOptionsChanged,
      onClose: callbacks.onClose,
    };
    this.renderOptions(save, wrapped, true);
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
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2 gap-2">
          <span class="font-bold text-resonant-gold">${ES.menu.title}</span>
          <div class="flex items-center gap-2 text-xs tabular-nums">
            <span class="inline-flex items-center gap-1 text-ghost-violet font-bold" title="${ES.cards.soulDustLabel}">${renderSoulDustIconSvg('w-3.5 h-3.5')}<span>${getSoulDust(save)}</span></span>
            <span class="text-cold-stone" aria-hidden="true">·</span>
            <span class="text-pale-gold font-bold">${save.money} ◈</span>
          </div>
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
      this.renderOptions(save, callbacks, false);
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

  private renderToggleRow(attr: string, label: string, enabled: boolean): string {
    return `
      <button ${attr} class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center gap-3 font-semibold text-left">
        <span>${label}</span>
        <span class="font-bold tabular-nums ${enabled ? 'text-neon-mint' : 'text-bone-gray'}">${enabled ? ES.options.yes : ES.options.no}</span>
      </button>
    `;
  }

  private renderSliderRow(
    attr: string,
    label: string,
    min: number,
    max: number,
    value: number,
    displayValue: string,
    disabled = false
  ): string {
    return `
      <div class="rounded-none border-2 border-ash-purple bg-deep-abyss/80 px-3 py-2 ${disabled ? 'opacity-50' : ''}">
        <div class="flex justify-between items-center mb-1 text-xs font-semibold">
          <span class="text-porcelain">${label}</span>
          <span data-val-for="${attr}" class="tabular-nums font-bold text-resonant-gold">${displayValue}</span>
        </div>
        <input ${attr} type="range" min="${min}" max="${max}" value="${value}" ${disabled ? 'disabled' : ''} class="w-full h-8 accent-resonant-gold touch-pan-x cursor-pointer" />
      </div>
    `;
  }

  private renderOptions(
    save: SaveData,
    callbacks: MenuCallbacks,
    optionsOnly: boolean,
    notice = ''
  ): void {
    const opt = save.options;
    const tabOrder: OptionsTab[] = ['sound', 'quality', 'postfx', 'game'];

    const tabsHtml = tabOrder
      .map((t) => {
        const active = t === this.activeOptionsTab;
        return `
          <button
            data-opt-tab="${t}"
            class="min-h-[40px] px-1.5 rounded-none border-2 text-xs font-bold whitespace-nowrap transition-colors ${
              active
                ? 'border-resonant-gold bg-ash-purple text-pale-gold shadow-[inset_0_-2px_0_#E8B84A]'
                : 'border-cold-stone/60 bg-crypt-ink text-bone-gray hover:border-ki-cyan hover:text-porcelain'
            }"
          >
            ${ES.options.tabs[t]}
          </button>
        `;
      })
      .join('');

    let bodyHtml = '';
    if (this.activeOptionsTab === 'sound') {
      bodyHtml = `
        ${this.renderSliderRow('data-vol', ES.options.volume, 0, 100, Math.round(opt.volume * 100), `${Math.round(opt.volume * 100)}%`)}
        ${this.renderSliderRow('data-music-vol', ES.options.musicVolume, 0, 100, Math.round(opt.musicVolume * 100), `${Math.round(opt.musicVolume * 100)}%`)}
        ${this.renderSliderRow('data-sfx-vol', ES.options.sfxVolume, 0, 100, Math.round(opt.sfxVolume * 100), `${Math.round(opt.sfxVolume * 100)}%`)}
        ${this.renderToggleRow('data-mute', ES.options.muted, opt.muted)}
      `;
    } else if (this.activeOptionsTab === 'quality') {
      const levels: GraphicsQualitySetting[] = ['auto', 'low', 'medium', 'high'];
      const qualityButtons = levels
        .map((lvl) => {
          const active = opt.graphicsQuality === lvl;
          return `
            <button
              data-quality-lvl="${lvl}"
              class="min-h-[40px] px-1 rounded-none border-2 text-xs font-bold ${
                active
                  ? 'border-resonant-gold bg-ash-purple text-pale-gold'
                  : 'border-cold-stone/60 bg-crypt-ink text-bone-gray hover:border-ki-cyan hover:text-porcelain'
              }"
            >
              ${ES.options.qualityLevels[lvl]}
            </button>
          `;
        })
        .join('');
      bodyHtml = `
        <div class="rounded-none border-2 border-ash-purple bg-deep-abyss/80 px-3 py-2">
          <div class="text-xs font-semibold text-porcelain mb-1.5">${ES.options.graphicsQuality}</div>
          <div class="grid grid-cols-4 gap-1.5">${qualityButtons}</div>
        </div>
        ${this.renderToggleRow('data-shadows', ES.options.shadows, opt.shadows)}
        ${this.renderToggleRow('data-particles', ES.options.ambientParticles, opt.ambientParticles)}
        ${this.renderToggleRow('data-pixel-effect', ES.options.pixelEffect, opt.pixelEffect)}
        ${this.renderToggleRow('data-battery', ES.options.batterySaver, opt.batterySaver)}
      `;
    } else if (this.activeOptionsTab === 'postfx') {
      const tiltBlocked = opt.graphicsQuality === 'low' || opt.pixelEffect;
      bodyHtml = `
        ${this.renderToggleRow('data-bloom', ES.options.bloom, opt.bloom)}
        ${this.renderSliderRow('data-bloom-int', ES.options.bloomIntensity, 40, 160, Math.round(opt.bloomIntensity * 100), `${Math.round(opt.bloomIntensity * 100)}%`, !opt.bloom)}
        ${this.renderToggleRow('data-tilt-shift', ES.options.tiltShift, opt.tiltShift)}
        ${tiltBlocked ? `<div class="px-2 py-1 text-[11px] text-bone-gray border-l-2 border-resonant-gold/70 bg-deep-abyss/60">${ES.options.tiltShiftHint}</div>` : ''}
        ${this.renderToggleRow('data-color-grade', ES.options.colorGrading, opt.colorGrading)}
        ${this.renderToggleRow('data-vignette', ES.options.vignette, opt.vignette)}
      `;
    } else {
      bodyHtml = `
        <button data-speed class="px-btn-secondary w-full min-h-[44px] px-3 flex justify-between items-center font-semibold">
          <span>${ES.options.textSpeed}</span>
          <span class="font-bold text-resonant-gold">${opt.textSpeed === 'fast' ? ES.options.fast : ES.options.normal}</span>
        </button>
      `;
    }

    this.root.innerHTML = `
      <div class="px-panel w-[min(94vw,400px)] max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-4 text-porcelain mx-auto">
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2.5 gap-2">
          <span class="font-bold text-resonant-gold tracking-wide">${ES.options.title}</span>
          <button data-back class="px-btn-secondary min-h-[40px] px-3 text-xs font-bold whitespace-nowrap">${optionsOnly ? ES.options.close : ES.options.back}</button>
        </div>

        <div class="grid grid-cols-4 gap-1 mb-3">${tabsHtml}</div>

        ${notice ? `<div class="mb-2 rounded-none border-2 border-ki-cyan bg-deep-abyss px-2.5 py-1 text-xs font-bold text-frosted-glass">${notice}</div>` : ''}

        <div class="flex-1 min-h-0 touch-scroll overflow-y-auto space-y-2 pr-0.5 text-sm">
          ${bodyHtml}
        </div>

        <div class="mt-3 pt-2.5 border-t-2 border-ash-purple flex items-center justify-between gap-2">
          <button data-reset-opts class="px-btn-secondary min-h-[40px] px-3 text-xs font-bold text-bone-gray">${ES.options.resetDefaults}</button>
          <button data-done-opts class="px-btn-primary min-h-[40px] px-4 text-xs font-extrabold">${ES.options.close}</button>
        </div>
      </div>
    `;

    const exitOptions = () => {
      if (optionsOnly) {
        this.close();
        callbacks.onClose();
      } else {
        this.renderMain(save, callbacks);
      }
    };

    this.root.querySelector('[data-back]')?.addEventListener('click', exitOptions);
    this.root.querySelector('[data-done-opts]')?.addEventListener('click', () => {
      if (optionsOnly) {
        exitOptions();
      } else {
        this.close();
        callbacks.onClose();
      }
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-opt-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextTab = btn.dataset.optTab as OptionsTab | undefined;
        if (!nextTab || nextTab === this.activeOptionsTab) return;
        this.activeOptionsTab = nextTab;
        this.renderOptions(save, callbacks, optionsOnly);
      });
    });

    this.root.querySelector('[data-reset-opts]')?.addEventListener('click', () => {
      Object.assign(opt, defaultOptions());
      callbacks.onOptionsChanged(opt);
      this.renderOptions(save, callbacks, optionsOnly, ES.options.resetDone);
    });

    const bindRange = (
      attr: string,
      onChange: (val: number) => string
    ) => {
      const input = this.root.querySelector(`[${attr}]`) as HTMLInputElement | null;
      const readout = this.root.querySelector(`[data-val-for="${attr}"]`);
      input?.addEventListener('input', () => {
        const text = onChange(Number(input.value));
        if (readout) readout.textContent = text;
        callbacks.onOptionsChanged(opt);
      });
    };

    bindRange('data-vol', (v) => {
      opt.volume = v / 100;
      return `${Math.round(opt.volume * 100)}%`;
    });
    bindRange('data-music-vol', (v) => {
      opt.musicVolume = v / 100;
      return `${Math.round(opt.musicVolume * 100)}%`;
    });
    bindRange('data-sfx-vol', (v) => {
      opt.sfxVolume = v / 100;
      return `${Math.round(opt.sfxVolume * 100)}%`;
    });
    bindRange('data-bloom-int', (v) => {
      opt.bloomIntensity = v / 100;
      return `${Math.round(opt.bloomIntensity * 100)}%`;
    });

    const bindToggle = (attr: string, flip: () => void) => {
      this.root.querySelector(`[${attr}]`)?.addEventListener('click', () => {
        flip();
        callbacks.onOptionsChanged(opt);
        this.renderOptions(save, callbacks, optionsOnly);
      });
    };

    bindToggle('data-mute', () => {
      opt.muted = !opt.muted;
    });
    bindToggle('data-shadows', () => {
      opt.shadows = !opt.shadows;
    });
    bindToggle('data-particles', () => {
      opt.ambientParticles = !opt.ambientParticles;
    });
    bindToggle('data-pixel-effect', () => {
      opt.pixelEffect = !opt.pixelEffect;
    });
    bindToggle('data-battery', () => {
      opt.batterySaver = !opt.batterySaver;
    });
    bindToggle('data-bloom', () => {
      opt.bloom = !opt.bloom;
    });
    bindToggle('data-tilt-shift', () => {
      opt.tiltShift = !opt.tiltShift;
    });
    bindToggle('data-color-grade', () => {
      opt.colorGrading = !opt.colorGrading;
    });
    bindToggle('data-vignette', () => {
      opt.vignette = !opt.vignette;
    });
    bindToggle('data-speed', () => {
      opt.textSpeed = opt.textSpeed === 'normal' ? 'fast' : 'normal';
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-quality-lvl]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const lvl = btn.dataset.qualityLvl as GraphicsQualitySetting | undefined;
        if (!lvl) return;
        opt.graphicsQuality = lvl;
        callbacks.onOptionsChanged(opt);
        this.renderOptions(save, callbacks, optionsOnly);
      });
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
