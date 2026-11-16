import { getItem } from '../data/items.ts';
import type { BagSlot, ItemCategory } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';
import { renderSoulDustCounter } from './renderSoulDustCounter.ts';

const OVERWORLD_CATEGORIES: readonly ItemCategory[] = [
  'medicine',
  'capsule',
  'stone',
  'held',
  'utility',
];
const BATTLE_CATEGORIES: readonly ItemCategory[] = ['medicine', 'capsule', 'battle'];

export class BagScreen extends ModalOverlay {
  private activeCat: ItemCategory = 'medicine';

  constructor(
    parent: HTMLElement,
    private readonly assets?: AssetProvider
  ) {
    super(parent);
  }

  open(
    bag: BagSlot[],
    inBattle: boolean,
    onUseItem: (itemId: string) => void,
    onClose: () => void,
    soulDust = 0
  ): void {
    const visibleCats = inBattle ? BATTLE_CATEGORIES : OVERWORLD_CATEGORIES;
    if (!visibleCats.includes(this.activeCat)) {
      this.activeCat = visibleCats[0];
    }

    const render = () => {
      const tabs = visibleCats
        .map((cat) => {
          const active = cat === this.activeCat;
          return `<button data-cat="${cat}" class="min-h-[44px] px-3 text-xs font-bold whitespace-nowrap ${
            active ? 'px-btn-primary' : 'px-btn-secondary'
          }">${ES.bag.categories[cat]}</button>`;
        })
        .join('');

      const items = bag.filter((s) => getItem(s.itemId).category === this.activeCat);
      const listHtml =
        items.length === 0
          ? `<div class="py-8 text-center text-sm text-bone-gray">${ES.bag.empty}</div>`
          : items
              .map((slot) => {
                const def = getItem(slot.itemId);
                const usable = inBattle
                  ? def.category === 'medicine' ||
                    def.category === 'capsule' ||
                    def.category === 'battle'
                  : def.category === 'medicine' ||
                    def.category === 'stone' ||
                    def.category === 'held' ||
                    def.category === 'utility';
                const btnLabel = def.category === 'held' ? ES.bag.equip : ES.bag.use;
                const iconHtml = this.assets
                  ? `<img src="${this.assets.getItemIconDataUrl(def.id)}" class="pixel-canvas w-8 h-8 object-contain shrink-0" alt="" />`
                  : '';
                return `
                  <div class="px-card flex items-center justify-between gap-3 p-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      ${iconHtml}
                      <div class="min-w-0">
                        <div class="font-bold text-sm text-porcelain">${def.name} <span class="text-resonant-gold tabular-nums">×${slot.quantity}</span></div>
                        <div class="text-xs text-bone-gray">${def.description}</div>
                      </div>
                    </div>
                    <button data-use="${def.id}" ${usable ? '' : 'disabled'} class="min-h-[44px] px-3.5 text-xs font-bold shrink-0 whitespace-nowrap ${
                      usable
                        ? 'px-btn-success'
                        : 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                    }">${btnLabel}</button>
                  </div>
                `;
              })
              .join('');

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-3.5 sm:p-4 text-porcelain">
          <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3 gap-2">
            <div class="text-base font-bold text-resonant-gold truncate">${ES.bag.title}</div>
            <div class="flex items-center gap-2 shrink-0">
              ${renderSoulDustCounter(soulDust, { compact: true, showLabel: true, dataAttr: 'data-bag-soul-dust' })}
              <button data-close class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.bag.back}</button>
            </div>
          </div>
          <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 mb-3">${tabs}</div>
          <div class="space-y-2">${listHtml}</div>
        </div>
      `;

      this.root.querySelectorAll<HTMLElement>('[data-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeCat = btn.dataset.cat as ItemCategory;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-use]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.use!;
          this.close();
          onUseItem(id);
        });
      });

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });
    };

    this.showOverlay();
    render();
  }
}
