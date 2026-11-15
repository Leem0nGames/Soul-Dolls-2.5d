import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { ALL_CONTAINER_IDS, getBodyContainer } from '../data/containers.ts';
import { getItem } from '../data/items.ts';
import { addVessel, ensureSaveVesselState } from '../domain/BodyParts.ts';
import { buyItem, getSellPrice, sellItem } from '../domain/Shop.ts';
import { ES } from '../i18n/es.ts';

export class ShopScene implements Scene {
  readonly name = 'shop';
  private root: HTMLDivElement;
  private mode: 'buy' | 'containers' | 'sell' = 'buy';
  private notice = '';

  constructor(
    private readonly game: Game,
    private readonly stock: string[],
    private readonly onDone: () => void
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-abyss-ink p-3 safe-pad';
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: false,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.touchControls.setVisible(false);
    this.game.uiLayer.appendChild(this.root);
    this.renderUi();
  }

  private renderUi(): void {
    const save = this.game.saveData;
    ensureSaveVesselState(save);

    const rows =
      this.mode === 'buy'
        ? this.stock
            .map((id) => {
              const item = getItem(id);
              const owned = save.bag.find((s) => s.itemId === id)?.quantity ?? 0;
              const canAfford = save.money >= item.price;
              return `
                <div class="px-card flex items-center justify-between gap-2.5 p-2.5">
                  <div class="flex items-center gap-2.5 min-w-0">
                    <img src="${this.game.assets.getItemIconDataUrl(id)}" class="pixel-canvas w-8 h-8 object-contain shrink-0" alt="" />
                    <div class="min-w-0">
                      <div class="font-bold text-sm text-porcelain">${item.name} <span class="text-xs text-bone-gray tabular-nums">(${ES.shop.owned}: ${owned})</span></div>
                      <div class="text-xs text-bone-gray">${item.description}</div>
                    </div>
                  </div>
                  <button data-buy="${id}" ${canAfford ? '' : 'disabled'} class="min-h-[44px] px-3 text-xs font-bold tabular-nums shrink-0 whitespace-nowrap ${
                    canAfford
                      ? 'px-btn-success'
                      : 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                  }">${item.price} ◈</button>
                </div>
              `;
            })
            .join('')
        : this.mode === 'containers'
          ? ALL_CONTAINER_IDS.filter((cid) => cid !== 'cuerpo_titan' || save.badges.length >= 1)
              .map((cid) => {
                const cdef = getBodyContainer(cid);
                const owned = save.vessels?.[cid] ?? 0;
                const canAfford = save.money >= cdef.price;
                return `
                  <div class="px-card flex items-center justify-between gap-2 p-2.5">
                    <div class="min-w-0">
                      <div class="font-bold text-sm text-porcelain">${cdef.name} <span class="text-xs text-bone-gray tabular-nums">(${ES.shop.owned}: ${owned})</span></div>
                      <div class="text-xs text-bone-gray">${cdef.description}</div>
                      <div class="text-[11px] text-ki-cyan tabular-nums mt-0.5">Cab ${cdef.ratios.head}% · Tor ${cdef.ratios.torso}% · Bra ${cdef.ratios.arms}% · Pie ${cdef.ratios.legs}%</div>
                    </div>
                    <button data-buy-container="${cid}" ${canAfford ? '' : 'disabled'} class="min-h-[44px] px-3 text-xs font-bold tabular-nums shrink-0 whitespace-nowrap ${
                      canAfford
                        ? 'px-btn-success'
                        : 'rounded-none border-2 border-ash-purple bg-smoked-wood text-cold-stone cursor-not-allowed'
                    }">${cdef.price} ◈</button>
                  </div>
                `;
              })
              .join('')
          : save.bag.length === 0
            ? `<div class="py-8 text-center text-sm text-bone-gray">${ES.shop.nothingToSell}</div>`
            : save.bag
                .map((slot) => {
                  const item = getItem(slot.itemId);
                  const val = getSellPrice(slot.itemId);
                  return `
                    <div class="px-card flex items-center justify-between gap-2.5 p-2.5">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${this.game.assets.getItemIconDataUrl(slot.itemId)}" class="pixel-canvas w-8 h-8 object-contain shrink-0" alt="" />
                        <div class="min-w-0">
                          <div class="font-bold text-sm text-porcelain">${item.name} <span class="text-resonant-gold tabular-nums">×${slot.quantity}</span></div>
                          <div class="text-xs text-bone-gray">${item.description}</div>
                        </div>
                      </div>
                      <button data-sell="${slot.itemId}" class="px-btn-primary min-h-[44px] px-3 text-xs font-bold tabular-nums shrink-0 whitespace-nowrap">+${val} ◈</button>
                    </div>
                  `;
                })
                .join('');

    this.root.innerHTML = `
      <div class="px-panel w-full max-w-xl max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-4 text-porcelain">
        <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3">
          <div>
            <div class="font-bold text-resonant-gold">${ES.shop.title}</div>
            <div class="text-xs text-pale-gold tabular-nums">${ES.menu.money}: ${save.money} ◈</div>
          </div>
          <button data-exit class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.shop.exit}</button>
        </div>

        <div class="flex flex-wrap gap-2 mb-3">
          <button data-tab="buy" class="min-h-[44px] px-3.5 text-sm font-bold whitespace-nowrap ${
            this.mode === 'buy' ? 'px-btn-primary' : 'px-btn-secondary'
          }">${ES.shop.buy}</button>
          <button data-tab="containers" class="min-h-[44px] px-3.5 text-sm font-bold whitespace-nowrap ${
            this.mode === 'containers' ? 'px-btn-primary' : 'px-btn-secondary'
          }">Contenedores</button>
          <button data-tab="sell" class="min-h-[44px] px-3.5 text-sm font-bold whitespace-nowrap ${
            this.mode === 'sell' ? 'px-btn-primary' : 'px-btn-secondary'
          }">${ES.shop.sell}</button>
        </div>

        ${this.notice ? `<div class="mb-2 rounded-none border-2 border-ki-cyan bg-deep-abyss px-3 py-1.5 text-xs font-bold text-neon-mint">${this.notice}</div>` : ''}

        <div class="touch-scroll overflow-y-auto space-y-2 pr-1">${rows}</div>
      </div>
    `;

    this.root.querySelector('[data-exit]')?.addEventListener('click', () => {
      this.game.bus.emit('audio:sfx', { sfx: 'cancel' });
      this.game.scenes.pop();
      this.onDone();
    });
    this.root.querySelectorAll<HTMLElement>('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mode = btn.dataset.tab as 'buy' | 'containers' | 'sell';
        this.notice = '';
        this.renderUi();
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.buy!;
        const res = buyItem(save.bag, save.money, id, 1);
        if (res.ok) {
          save.money = res.moneyAfter;
          this.notice = ES.shop.bought(getItem(id).name);
          this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
        } else {
          this.notice = ES.shop.noMoney;
        }
        this.renderUi();
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-buy-container]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cid = btn.dataset.buyContainer!;
        const cdef = getBodyContainer(cid);
        if (save.money >= cdef.price) {
          save.money -= cdef.price;
          addVessel(save, cid, 1);
          this.notice = ES.shop.bought(cdef.name);
          this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
        } else {
          this.notice = ES.shop.noMoney;
        }
        this.renderUi();
      });
    });
    this.root.querySelectorAll<HTMLElement>('[data-sell]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.sell!;
        const res = sellItem(save.bag, save.money, id, 1);
        if (res.ok) {
          save.money = res.moneyAfter;
          this.notice = ES.shop.sold(getItem(id).name, res.gained);
          this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
        }
        this.renderUi();
      });
    });
  }

  fixedUpdate(): void {
    if (this.game.input.justPressed('b')) {
      this.game.scenes.pop();
      this.onDone();
    }
  }

  render(): void {}

  onExit(): void {
    this.root.remove();
  }
}
