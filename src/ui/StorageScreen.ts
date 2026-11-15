import { getSpecies } from '../data/species.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import {
  depositCreature,
  moveStoredCreature,
  releaseStoredCreature,
  renameStorageBox,
  STORAGE_BOX_SIZE,
  withdrawCreature,
} from '../domain/Storage.ts';
import type { CreatureInstance, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import type { SummaryScreen } from './SummaryScreen.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

type SelectedSource =
  | { kind: 'party'; partyIndex: number }
  | { kind: 'box'; boxIndex: number; slotIndex: number }
  | null;

export class StorageScreen {
  readonly root: HTMLDivElement;
  private activeBox = 0;
  private selected: SelectedSource = null;
  private movingFrom: { boxIndex: number; slotIndex: number } | null = null;
  private renaming = false;
  private confirmRelease: { boxIndex: number; slotIndex: number } | null = null;
  private notice = '';
  private unbindImages: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider,
    private readonly summary: SummaryScreen
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-abyss-ink p-2.5 sm:p-4 safe-pad';
    parent.appendChild(this.root);
  }

  open(save: SaveData, onClose: () => void): void {
    this.activeBox = 0;
    this.selected = null;
    this.movingFrom = null;
    this.renaming = false;
    this.confirmRelease = null;
    this.notice = '';

    const getSelectedCreature = (): CreatureInstance | null => {
      if (!this.selected) return null;
      if (this.selected.kind === 'party') {
        return save.party[this.selected.partyIndex] ?? null;
      }
      return save.storageBoxes[this.selected.boxIndex]?.slots[this.selected.slotIndex] ?? null;
    };

    const render = () => {
      const box = save.storageBoxes[this.activeBox];
      const selCreature = getSelectedCreature();

      const boxTabs = save.storageBoxes
        .map(
          (b, idx) =>
            `<button data-box="${idx}" class="min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap ${
              idx === this.activeBox ? 'px-btn-primary' : 'px-btn-secondary'
            }">${idx + 1}. ${b.name}</button>`
        )
        .join('');

      const partyHtml = save.party
        .map((c, idx) => {
          const isSel =
            this.selected?.kind === 'party' && this.selected.partyIndex === idx;
          return `
            <button data-party="${idx}" class="px-card w-full ${
              isSel ? 'border-resonant-gold bg-ash-purple' : 'border-ash-purple bg-crypt-ink'
            } p-1.5 flex items-center gap-2 text-left min-h-[48px]">
              <img src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}" data-souldoll-id="${c.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="" />
              <div class="min-w-0 flex-1">
                <div class="font-bold text-xs truncate">${getCreatureDisplayName(c)}</div>
                <div class="text-[10px] text-resonant-gold tabular-nums">${ES.party.lv}${c.level}</div>
              </div>
            </button>
          `;
        })
        .join('');

      const slotsHtml = box.slots
        .slice(0, STORAGE_BOX_SIZE)
        .map((c, idx) => {
          const isSel =
            this.selected?.kind === 'box' &&
            this.selected.boxIndex === this.activeBox &&
            this.selected.slotIndex === idx;
          const isMoveSrc =
            this.movingFrom?.boxIndex === this.activeBox &&
            this.movingFrom.slotIndex === idx;
          if (!c) {
            return `
              <button data-slot="${idx}" class="aspect-square min-h-[52px] rounded-none border-2 ${
                this.movingFrom
                  ? 'border-ki-cyan bg-deep-abyss hover:bg-oceanic-teal'
                  : 'border-ash-purple bg-abyss-ink'
              } flex items-center justify-center text-[10px] text-cold-stone">·</button>
            `;
          }
          return `
            <button data-slot="${idx}" class="aspect-square min-h-[52px] rounded-none border-2 shadow-[2px_2px_0_#050505] ${
              isMoveSrc
                ? 'border-ki-cyan bg-oceanic-teal'
                : isSel
                  ? 'border-resonant-gold bg-ash-purple'
                  : 'border-ash-purple bg-crypt-ink'
            } p-1 flex flex-col items-center justify-center relative">
              <img src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}" data-souldoll-id="${c.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain" alt="${getSpecies(c.speciesId).name}" />
              <span class="text-[9px] text-pale-gold tabular-nums leading-none">${ES.party.lv}${c.level}</span>
            </button>
          `;
        })
        .join('');

      let actionBar = '';
      if (this.movingFrom) {
        actionBar = `
          <div class="flex items-center justify-between gap-2 rounded-none border-2 border-ki-cyan bg-deep-abyss px-3 py-2 text-xs shadow-[2px_2px_0_#050505]">
            <span class="font-bold text-ice-cyan">${ES.storage.placeHere}</span>
            <button data-cancel-move class="px-btn-secondary min-h-[44px] px-3 font-bold whitespace-nowrap">${ES.storage.cancelMove}</button>
          </div>
        `;
      } else if (selCreature && this.selected) {
        const actions =
          this.selected.kind === 'party'
            ? `<button data-act="deposit" class="px-btn-arcane min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.deposit}</button>
               <button data-act="summary" class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.summary}</button>`
            : `<button data-act="withdraw" class="px-btn-success min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.withdraw}</button>
               <button data-act="move" class="px-btn-arcane min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.move}</button>
               <button data-act="summary" class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.summary}</button>
               <button data-act="release" class="px-btn-danger min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.release}</button>`;

        actionBar = `
          <div class="px-card flex flex-wrap items-center justify-between gap-2 p-2.5">
            <div class="flex items-center gap-2 min-w-0">
              <img src="${this.assets.getCreatureDataUrl(selCreature.speciesId, 'front')}" data-souldoll-id="${selCreature.speciesId}" data-souldoll-view="front" class="souldoll-img w-12 h-12 object-contain shrink-0" alt="" />
              <div class="min-w-0">
                <div class="font-bold text-sm truncate">${getCreatureDisplayName(selCreature)}</div>
                <div class="text-xs text-resonant-gold tabular-nums">${ES.party.lv}${selCreature.level} · ${selCreature.currentHp}/${selCreature.stats.hp} ${ES.party.hp}</div>
              </div>
            </div>
            <div class="flex flex-wrap gap-1.5">${actions}</div>
          </div>
        `;
      }

      const renameModal = this.renaming
        ? `
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-abyss-ink p-4">
            <div class="px-panel w-full max-w-xs p-4 space-y-3">
              <div class="text-sm font-bold text-resonant-gold">${ES.storage.renamePrompt}</div>
              <input data-rename-input type="text" maxlength="18" value="${box.name.replace(/"/g, '&quot;')}" class="w-full min-h-[44px] rounded-none border-2 border-cold-stone bg-crypt-ink px-3 text-sm text-porcelain" />
              <div class="flex justify-end gap-2">
                <button data-rename-cancel class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.confirmNo}</button>
                <button data-rename-save class="px-btn-primary min-h-[44px] px-4 text-xs font-bold whitespace-nowrap">${ES.storage.saveName}</button>
              </div>
            </div>
          </div>
        `
        : '';

      const releaseModal = this.confirmRelease
        ? (() => {
            const target =
              save.storageBoxes[this.confirmRelease.boxIndex]?.slots[
                this.confirmRelease.slotIndex
              ];
            const name = target ? getCreatureDisplayName(target) : '';
            return `
              <div class="fixed inset-0 z-50 flex items-center justify-center bg-abyss-ink p-4">
                <div class="px-panel-crimson w-full max-w-xs p-4 space-y-3">
                  <div class="text-sm font-bold text-coral-red">${ES.storage.releaseConfirm(name)}</div>
                  <div class="flex justify-end gap-2">
                    <button data-rel-no class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.confirmNo}</button>
                    <button data-rel-yes class="px-btn-danger min-h-[44px] px-4 text-xs font-bold whitespace-nowrap">${ES.storage.confirmYes}</button>
                  </div>
                </div>
              </div>
            `;
          })()
        : '';

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-4xl max-h-[calc(100dvh-1rem)] flex flex-col p-3 sm:p-4 text-porcelain">
          <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2 gap-2">
            <div class="font-bold text-resonant-gold text-sm sm:text-base">${ES.storage.title}</div>
            <div class="flex items-center gap-2">
              <button data-open-rename class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.storage.rename}</button>
              <button data-close class="px-btn-secondary min-h-[44px] px-3.5 text-xs font-bold whitespace-nowrap">${ES.storage.back}</button>
            </div>
          </div>

          <div class="flex gap-1.5 overflow-x-auto pb-2 mb-2">${boxTabs}</div>
          ${this.notice ? `<div class="mb-2 rounded-none border-2 border-resonant-gold bg-dark-oak px-3 py-1.5 text-xs font-bold text-resonant-gold">${this.notice}</div>` : ''}

          <div class="touch-scroll overflow-y-auto grid grid-cols-1 md:grid-cols-[190px_1fr] gap-3 flex-1">
            <div class="space-y-1.5">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.storage.partyTitle} (${save.party.length}/6)</div>
              <div class="grid grid-cols-2 md:grid-cols-1 gap-1.5">${partyHtml}</div>
            </div>
            <div>
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray mb-1.5">${ES.storage.boxLabel(this.activeBox, box.name)}</div>
              <div class="grid grid-cols-5 gap-1.5">${slotsHtml}</div>
            </div>
          </div>

          <div class="mt-2.5">${actionBar}</div>
          ${renameModal}
          ${releaseModal}
        </div>
      `;

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelector('[data-open-rename]')?.addEventListener('click', () => {
        this.renaming = true;
        render();
      });

      this.root.querySelector('[data-rename-cancel]')?.addEventListener('click', () => {
        this.renaming = false;
        render();
      });

      this.root.querySelector('[data-rename-save]')?.addEventListener('click', () => {
        const input = this.root.querySelector('[data-rename-input]') as HTMLInputElement | null;
        if (input) {
          renameStorageBox(save.storageBoxes, this.activeBox, input.value);
        }
        this.renaming = false;
        render();
      });

      this.root.querySelector('[data-rel-no]')?.addEventListener('click', () => {
        this.confirmRelease = null;
        render();
      });

      this.root.querySelector('[data-rel-yes]')?.addEventListener('click', () => {
        if (this.confirmRelease) {
          releaseStoredCreature(
            save.storageBoxes,
            this.confirmRelease.boxIndex,
            this.confirmRelease.slotIndex
          );
          this.confirmRelease = null;
          this.selected = null;
        }
        render();
      });

      this.root.querySelectorAll<HTMLElement>('[data-box]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeBox = Number(btn.dataset.box);
          this.notice = '';
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-party]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.movingFrom = null;
          this.notice = '';
          this.selected = { kind: 'party', partyIndex: Number(btn.dataset.party) };
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-slot]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const slotIndex = Number(btn.dataset.slot);
          this.notice = '';
          if (this.movingFrom) {
            moveStoredCreature(
              save.storageBoxes,
              this.movingFrom.boxIndex,
              this.movingFrom.slotIndex,
              this.activeBox,
              slotIndex
            );
            this.movingFrom = null;
            this.selected = { kind: 'box', boxIndex: this.activeBox, slotIndex };
            render();
            return;
          }
          if (save.storageBoxes[this.activeBox]?.slots[slotIndex]) {
            this.selected = { kind: 'box', boxIndex: this.activeBox, slotIndex };
          } else {
            this.selected = null;
          }
          render();
        });
      });

      this.root.querySelector('[data-cancel-move]')?.addEventListener('click', () => {
        this.movingFrom = null;
        render();
      });

      this.root.querySelector('[data-act="deposit"]')?.addEventListener('click', () => {
        if (this.selected?.kind !== 'party') return;
        const res = depositCreature(save.party, save.storageBoxes, this.selected.partyIndex, this.activeBox);
        if (!res.ok) {
          this.notice =
            res.reason === 'last_party'
              ? ES.storage.errLastParty
              : res.reason === 'box_full'
                ? ES.storage.errBoxFull
                : '';
        } else {
          this.selected = null;
        }
        render();
      });

      this.root.querySelector('[data-act="withdraw"]')?.addEventListener('click', () => {
        if (this.selected?.kind !== 'box') return;
        const res = withdrawCreature(
          save.party,
          save.storageBoxes,
          this.selected.boxIndex,
          this.selected.slotIndex
        );
        if (!res.ok && res.reason === 'party_full') {
          this.notice = ES.storage.errPartyFull;
        } else {
          this.selected = null;
        }
        render();
      });

      this.root.querySelector('[data-act="move"]')?.addEventListener('click', () => {
        if (this.selected?.kind !== 'box') return;
        this.movingFrom = {
          boxIndex: this.selected.boxIndex,
          slotIndex: this.selected.slotIndex,
        };
        render();
      });

      this.root.querySelector('[data-act="summary"]')?.addEventListener('click', () => {
        if (!selCreature) return;
        this.summary.open(
          selCreature,
          () => {},
          { bag: save.bag, onChanged: () => render() },
          { save, onChanged: () => render() }
        );
      });

      this.root.querySelector('[data-act="release"]')?.addEventListener('click', () => {
        if (this.selected?.kind !== 'box') return;
        this.confirmRelease = {
          boxIndex: this.selected.boxIndex,
          slotIndex: this.selected.slotIndex,
        };
        render();
      });
    };

    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, this.assets);
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    render();
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
