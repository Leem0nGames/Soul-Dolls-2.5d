import { getItem } from '../data/items.ts';
import type { BagSlot, ItemCategory } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';

const OVERWORLD_CATEGORIES: readonly ItemCategory[] = [
  'medicine',
  'capsule',
  'stone',
  'held',
  'utility',
];
const BATTLE_CATEGORIES: readonly ItemCategory[] = ['medicine', 'capsule', 'battle'];

export class BagScreen {
  readonly root: HTMLDivElement;
  private activeCat: ItemCategory = 'medicine';

  constructor(
    parent: HTMLElement,
    private readonly assets?: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-crypt-ink/90 p-3 safe-pad';
    parent.appendChild(this.root);
  }

  open(
    bag: BagSlot[],
    inBattle: boolean,
    onUseItem: (itemId: string) => void,
    onClose: () => void
  ): void {
    const visibleCats = inBattle ? BATTLE_CATEGORIES : OVERWORLD_CATEGORIES;
    if (!visibleCats.includes(this.activeCat)) {
      this.activeCat = visibleCats[0];
    }

    const render = () => {
      const tabs = visibleCats
        .map((cat) => {
          const active = cat === this.activeCat;
          return `<button data-cat="${cat}" class="min-h-[44px] px-3 rounded-lg text-xs font-bold border ${
            active
              ? 'border-bright-brass bg-resonant-gold text-crypt-ink'
              : 'border-cold-stone/70 bg-ash-purple text-porcelain'
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
                  <div class="flex items-center justify-between gap-3 rounded-lg border border-ash-purple bg-crypt-ink p-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      ${iconHtml}
                      <div class="min-w-0">
                        <div class="font-bold text-sm text-porcelain">${def.name} <span class="text-resonant-gold tabular-nums">×${slot.quantity}</span></div>
                        <div class="text-xs text-bone-gray">${def.description}</div>
                      </div>
                    </div>
                    <button data-use="${def.id}" ${usable ? '' : 'disabled'} class="min-h-[44px] px-3.5 rounded-lg text-xs font-bold shrink-0 ${
                      usable
                        ? 'bg-emerald-base text-warm-white hover:bg-oceanic-teal'
                        : 'bg-ash-purple text-cold-stone cursor-not-allowed'
                    }">${btnLabel}</button>
                  </div>
                `;
              })
              .join('');

      this.root.innerHTML = `
        <div class="w-full max-w-xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
            <div class="text-base font-bold text-resonant-gold">${ES.bag.title}</div>
            <button data-close class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.bag.back}</button>
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
