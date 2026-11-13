import { getSpecies } from '../data/species.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { swapPartySlots } from '../domain/Party.ts';
import type { BagSlot, CreatureInstance } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import type { SummaryScreen } from './SummaryScreen.ts';

export type PartyMode =
  | { kind: 'manage'; bag?: BagSlot[] }
  | { kind: 'switch'; activeIndex: number; allowCancel: boolean; onPick: (index: number) => void }
  | { kind: 'item_target'; onPick: (index: number) => void; onCancel: () => void };

export class PartyScreen {
  readonly root: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider,
    private readonly summary: SummaryScreen
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-crypt-ink/90 p-3 safe-pad';
    parent.appendChild(this.root);
  }

  open(party: CreatureInstance[], mode: PartyMode, onClose: () => void): void {
    const render = () => {
      const canCancel = mode.kind !== 'switch' || mode.allowCancel;
      const cardsHtml =
        party.length === 0
          ? `<div class="col-span-2 text-center py-8 text-bone-gray">${ES.party.empty}</div>`
          : party
              .map((c, idx) => {
                const spec = getSpecies(c.speciesId);
                const pct = Math.max(0, Math.min(100, Math.round((c.currentHp / Math.max(1, c.stats.hp)) * 100)));
                const barColor = pct > 50 ? 'bg-ui-success' : pct > 20 ? 'bg-ui-warning' : 'bg-ui-danger';
                const statusBadge =
                  c.status !== 'none'
                    ? `<span class="px-1.5 py-0.5 rounded bg-royal-purple text-warm-white text-[10px] font-bold">${ES.statusShort[c.status]}</span>`
                    : '';
                const heldBadge = c.heldItemId
                  ? `<img src="${this.assets.getItemIconDataUrl(c.heldItemId)}" class="pixel-canvas w-4 h-4 object-contain shrink-0" alt="" />`
                  : '';
                const isFainted = c.currentHp <= 0;
                return `
                  <div class="rounded-xl border-2 ${isFainted ? 'border-blood-moon opacity-75' : 'border-cold-stone'} bg-crypt-ink p-2.5 flex items-center gap-2.5">
                    <img src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}" class="pixel-canvas w-14 h-14 object-contain shrink-0" alt="${spec.name}" />
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center justify-between gap-1">
                        <div class="flex items-center gap-1 min-w-0">
                          <span class="font-bold text-sm truncate">${getCreatureDisplayName(c)}</span>
                          ${heldBadge}
                        </div>
                        <span class="text-xs text-resonant-gold tabular-nums shrink-0">${ES.party.lv}${c.level}</span>
                      </div>
                      <div class="mt-1 h-2 w-full rounded bg-smoked-wood overflow-hidden">
                        <div class="h-full ${barColor}" style="width:${pct}%"></div>
                      </div>
                      <div class="mt-1 flex items-center justify-between text-xs text-bone-gray tabular-nums">
                        <span>${c.currentHp}/${c.stats.hp} ${ES.party.hp}</span>
                        ${statusBadge}
                      </div>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        ${
                          mode.kind === 'manage'
                            ? `<button data-summary="${idx}" class="min-h-[44px] px-3 rounded-lg bg-ash-purple border border-cold-stone text-xs font-semibold hover:bg-cold-stone/40">${ES.party.summary}</button>` +
                              (idx > 0
                                ? `<button data-lead="${idx}" class="min-h-[44px] px-3 rounded-lg bg-oceanic-teal text-warm-white text-xs font-semibold hover:bg-vibrant-aqua">${ES.party.makeLead}</button>`
                                : '')
                            : `<button data-pick="${idx}" class="min-h-[44px] px-3.5 rounded-lg bg-emerald-base text-warm-white text-xs font-bold hover:bg-moss">${ES.party.useItem}</button>`
                        }
                      </div>
                    </div>
                  </div>
                `;
              })
              .join('');

      this.root.innerHTML = `
        <div class="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
            <div class="text-base font-bold text-resonant-gold">${
              mode.kind === 'switch' ? ES.party.chooseSwitch : ES.party.title
            }</div>
            ${
              canCancel
                ? `<button data-close class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.party.back}</button>`
                : ''
            }
          </div>
          <div data-msg class="mb-2 text-xs text-coral-red min-h-[1rem]"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">${cardsHtml}</div>
        </div>
      `;

      const msgEl = this.root.querySelector('[data-msg]') as HTMLElement;

      this.root.querySelectorAll<HTMLElement>('[data-summary]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.summary);
          const heldCfg =
            mode.kind === 'manage' && mode.bag
              ? { bag: mode.bag, onChanged: () => render() }
              : undefined;
          this.summary.open(party[i], () => {}, heldCfg);
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-lead]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.lead);
          swapPartySlots(party, 0, i);
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-pick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.pick);
          if (mode.kind === 'switch') {
            if (party[i].currentHp <= 0) {
              msgEl.textContent = ES.party.cantSwitchFainted;
              return;
            }
            if (i === mode.activeIndex) {
              msgEl.textContent = ES.party.cantSwitchActive;
              return;
            }
            this.close();
            mode.onPick(i);
          } else if (mode.kind === 'item_target') {
            this.close();
            mode.onPick(i);
          }
        });
      });

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        if (mode.kind === 'item_target') mode.onCancel();
        else onClose();
      });
    };

    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    render();
  }

  close(): void {
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.root.remove();
  }
}
