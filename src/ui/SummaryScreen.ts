import { getBodyContainer, getSpeciesDollProfile } from '../data/containers.ts';
import { getItem } from '../data/items.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { getCreatureAbilityDef } from '../domain/Abilities.ts';
import {
  formatCardBonuses,
  getAvailableCardCopies,
  getCardDef,
  socketCardOnCreature,
  unsocketCardFromCreature,
} from '../domain/Cards.ts';
import { getCreatureDisplayName, xpForLevel } from '../domain/Creature.ts';
import { equipHeldItem, getHeldItemDef, unequipHeldItem } from '../domain/HeldItems.ts';
import type { BagSlot, CreatureInstance, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { renderDollIntegrityHtml } from './DollIntegrityView.ts';
import { AnimatedSoulDollView } from './components/AnimatedSoulDollView.ts';
import { ModalOverlay } from './ModalOverlay.ts';
import { CARD_RARITY_STYLES } from './cardRarityStyles.ts';
import { playCardSocketFx } from './cardSocketFx.ts';
import { renderTypeBadge, renderTypeBadges } from './renderTypeBadge.ts';

export interface SummaryHeldConfig {
  bag: BagSlot[];
  onChanged?: () => void;
}

export interface SummaryCardConfig {
  save: SaveData;
  onChanged?: () => void;
}

export class SummaryScreen extends ModalOverlay {
  private activeAnimView: AnimatedSoulDollView | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(
      parent,
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-abyss-ink p-3 safe-pad'
    );
  }

  open(
    creature: CreatureInstance,
    onClose: () => void,
    heldConfig?: SummaryHeldConfig,
    cardConfig?: SummaryCardConfig
  ): void {
    let pickingHeld = false;
    let pickingCard = false;
    let justSocketedCard = false;

    const render = () => {
      const spec = getSpecies(creature.speciesId);
      const ability = getCreatureAbilityDef(creature);
      const heldItem = getHeldItemDef(creature);
      const socketedCard =
        creature.socketedCardId !== undefined ? getCardDef(creature.socketedCardId) : null;
      const containerDef = getBodyContainer(creature.containerId ?? 'cuerpo_aprendiz');
      const dollProfile = getSpeciesDollProfile(
        creature.speciesId,
        spec.types,
        spec.dollClass,
        spec.weapon
      );

      const partsHtml = renderDollIntegrityHtml(creature, { mode: 'summary' });

      const nextLvXp =
        creature.level >= 100
          ? creature.xp
          : xpForLevel(creature.level + 1, spec.growthRate);
      const currLvXp = xpForLevel(creature.level, spec.growthRate);
      const expPct =
        creature.level >= 100
          ? 100
          : Math.max(
              0,
              Math.min(
                100,
                Math.round(((creature.xp - currLvXp) / Math.max(1, nextLvXp - currLvXp)) * 100)
              )
            );

      const typeBadges = renderTypeBadges(spec.types, 'md');

      const movesHtml = creature.moves
        .map((slot) => {
          const m = getMove(slot.moveId);
          return `
            <div class="px-card p-2">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-sm text-porcelain">${m.name}</span>
                ${renderTypeBadge(m.type, 'move')}
              </div>
              <div class="mt-1 flex justify-between text-xs text-bone-gray tabular-nums">
                <span>${ES.summary.power}: ${m.power || '—'} · ${ES.summary.acc}: ${m.accuracy}%</span>
                <span>${ES.summary.pp}: ${slot.pp}/${slot.maxPp}</span>
              </div>
              <div class="mt-0.5 text-[11px] text-bone-gray">${m.description}</div>
            </div>
          `;
        })
        .join('');

      const heldActionsHtml = heldConfig
        ? `<div class="flex gap-1.5 mt-2">
             <button data-equip-open class="px-btn-arcane min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.equipItem}</button>
             ${
               heldItem
                 ? `<button data-unequip class="px-btn-danger min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.removeItem}</button>`
                 : ''
             }
           </div>`
        : '';

      const heldPickerModal =
        pickingHeld && heldConfig
          ? (() => {
              const heldSlots = heldConfig.bag.filter(
                (s) => getItem(s.itemId).category === 'held'
              );
              const list =
                heldSlots.length === 0
                  ? `<div class="py-4 text-center text-xs text-bone-gray">${ES.bag.noHeldItemsInBag}</div>`
                  : heldSlots
                      .map((s) => {
                        const def = getItem(s.itemId);
                        return `
                          <button data-pick-held="${def.id}" class="px-card w-full min-h-[48px] hover:border-resonant-gold p-2 flex items-center gap-2.5 text-left">
                            <img src="${this.assets.getItemIconDataUrl(def.id)}" class="pixel-canvas w-7 h-7 object-contain shrink-0" alt="" />
                            <div class="min-w-0 flex-1">
                              <div class="font-bold text-xs text-porcelain">${def.name} <span class="text-resonant-gold">×${s.quantity}</span></div>
                              <div class="text-[11px] text-bone-gray">${def.description}</div>
                            </div>
                          </button>
                        `;
                      })
                      .join('');
              return `
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-abyss-ink p-3">
                  <div class="px-panel w-full max-w-md max-h-[80dvh] flex flex-col p-3.5 text-porcelain">
                    <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2">
                      <span class="font-bold text-sm text-resonant-gold">${ES.summary.equipItem}</span>
                      <button data-pick-cancel class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.back}</button>
                    </div>
                    <div class="touch-scroll overflow-y-auto space-y-1.5">${list}</div>
                  </div>
                </div>
              `;
            })()
          : '';

      const cardActionsHtml = cardConfig
        ? `<div class="flex gap-1.5 mt-2">
             <button data-card-open class="px-btn-arcane min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.socketCard}</button>
             ${
               socketedCard
                 ? `<button data-card-remove class="px-btn-danger min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.removeCard}</button>`
                 : ''
             }
           </div>`
        : '';

      const cardPickerModal =
        pickingCard && cardConfig
          ? (() => {
              const ownedEntries = Object.values(cardConfig.save.cardAlbum ?? {})
                .filter((e) => e && e.count > 0)
                .sort((a, b) => a.speciesId - b.speciesId);
              const availableList = ownedEntries.filter(
                (e) =>
                  getAvailableCardCopies(cardConfig.save, e.speciesId) > 0 ||
                  creature.socketedCardId === e.speciesId
              );
              const list =
                availableList.length === 0
                  ? `<div class="py-4 text-center text-xs text-bone-gray">${ES.summary.noAvailableCards}</div>`
                  : availableList
                      .map((e) => {
                        const cDef = getCardDef(e.speciesId);
                        const avail = getAvailableCardCopies(cardConfig.save, e.speciesId);
                        const isCur = creature.socketedCardId === e.speciesId;
                        const rStyle = CARD_RARITY_STYLES[cDef.rarity];
                        return `
                          <button data-pick-card="${cDef.speciesId}" class="w-full min-h-[56px] rounded-none border-2 ${
                            isCur ? 'border-warm-white' : rStyle.border
                          } ${rStyle.frameBg} ${rStyle.glow} ${rStyle.hoverBorder} p-2 flex items-center gap-2.5 text-left">
                            <img src="${this.assets.getCreatureDataUrl(cDef.speciesId, 'front')}" data-souldoll-id="${cDef.speciesId}" data-souldoll-view="front" class="souldoll-img w-11 h-11 object-contain shrink-0" alt="${cDef.name}" />
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center justify-between gap-1">
                                <span class="font-bold text-xs text-porcelain truncate">${cDef.name}</span>
                                <span class="text-[11px] font-bold ${rStyle.accent} tabular-nums shrink-0">${ES.cards.rarity[cDef.rarity]} · Disp. ${avail}/${e.count}</span>
                              </div>
                              <div class="text-[11px] font-bold text-ki-cyan tabular-nums">${formatCardBonuses(cDef.bonuses)}</div>
                              <div class="text-[10px] text-bone-gray truncate">${cDef.description}</div>
                            </div>
                          </button>
                        `;
                      })
                      .join('');
              return `
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-abyss-ink p-3">
                  <div class="px-panel w-full max-w-md max-h-[80dvh] flex flex-col border-ki-cyan p-3.5 text-porcelain">
                    <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-2">
                      <span class="font-bold text-sm text-ki-cyan">${ES.summary.socketCard}</span>
                      <button data-card-cancel class="px-btn-secondary min-h-[44px] px-3 text-xs font-bold whitespace-nowrap">${ES.summary.back}</button>
                    </div>
                    <div class="touch-scroll overflow-y-auto space-y-1.5">${list}</div>
                  </div>
                </div>
              `;
            })()
          : '';

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-3.5 sm:p-4 text-porcelain">
          <div class="flex items-center justify-between border-b-2 border-ash-purple pb-2 mb-3">
            <div class="text-base font-bold text-resonant-gold">${ES.summary.title}</div>
            <button data-close class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.summary.back}</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-3">
              <div class="px-card flex items-center gap-3 p-3">
                <div data-anim-portrait class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center"></div>
                <div>
                  <div class="text-lg font-bold">${getCreatureDisplayName(creature)}</div>
                  <div class="text-xs text-bone-gray tabular-nums">${ES.party.lv}${creature.level} · #${String(spec.id).padStart(2, '0')} · ${dollProfile.className}</div>
                  <div class="mt-1 flex gap-1">${typeBadges}</div>
                  <div class="mt-1 text-[11px] text-ki-cyan">Arma: ${dollProfile.weaponName}</div>
                  <div class="mt-0.5 text-xs text-bone-gray">${ES.status[creature.status]}</div>
                </div>
              </div>

              <div class="px-card p-3 text-xs space-y-2">
                <div>
                  <div class="font-bold uppercase tracking-wider text-bone-gray">Cuerpo Contenedor</div>
                  <div class="mt-0.5 font-bold text-resonant-gold">${containerDef.name}</div>
                  <div class="mt-1.5 space-y-1.5">${partsHtml}</div>
                </div>
                <div class="pt-2 border-t border-ash-purple">
                  <div class="font-bold uppercase tracking-wider text-bone-gray">${ES.summary.ability}</div>
                  ${
                    ability
                      ? `<div class="mt-0.5 font-bold text-ki-cyan">${ability.name}</div><div class="text-porcelain">${ability.description}</div>`
                      : `<div class="mt-0.5 text-bone-gray">—</div>`
                  }
                </div>
                <div class="pt-2 border-t border-ash-purple">
                  <div class="font-bold uppercase tracking-wider text-bone-gray">${ES.summary.heldItem}</div>
                  ${
                    heldItem
                      ? `<div class="mt-1 flex items-center gap-2">
                           <img src="${this.assets.getItemIconDataUrl(heldItem.id)}" class="pixel-canvas w-6 h-6 object-contain shrink-0" alt="" />
                           <div>
                             <div class="font-bold text-resonant-gold">${heldItem.name}</div>
                             <div class="text-porcelain">${heldItem.description}</div>
                           </div>
                         </div>`
                      : `<div class="mt-0.5 text-bone-gray">${ES.summary.noHeldItem}</div>`
                  }
                  ${heldActionsHtml}
                </div>
                <div class="pt-2 border-t border-ash-purple">
                  <div class="flex items-center justify-between">
                    <span class="font-bold uppercase tracking-wider text-bone-gray">${ES.summary.socketedCard}</span>
                    ${
                      socketedCard
                        ? `<span class="text-[10px] font-bold text-ki-cyan uppercase tracking-wider">${ES.cards.bonusActive}</span>`
                        : ''
                    }
                  </div>
                  ${
                    socketedCard
                      ? (() => {
                          const rStyle = CARD_RARITY_STYLES[socketedCard.rarity];
                          return `<div data-card-slot class="mt-1.5 rounded-none border-2 ${rStyle.border} ${rStyle.frameBg} ${rStyle.glow} p-2 flex items-center gap-2.5 card-socket-active">
                           <img src="${this.assets.getCreatureDataUrl(socketedCard.speciesId, 'front')}" data-souldoll-id="${socketedCard.speciesId}" data-souldoll-view="front" class="souldoll-img w-9 h-9 object-contain shrink-0" alt="${socketedCard.name}" />
                           <div class="min-w-0">
                             <div class="font-bold text-porcelain">${socketedCard.name} · <span class="text-[11px] font-bold ${rStyle.accent}">${ES.cards.rarity[socketedCard.rarity]}</span></div>
                             <div class="font-bold text-ki-cyan tabular-nums">${formatCardBonuses(socketedCard.bonuses)}</div>
                           </div>
                         </div>`;
                        })()
                      : `<div data-card-slot class="mt-1 rounded-none border-2 border-dashed border-cold-stone bg-smoked-wood px-2.5 py-2 text-bone-gray">${ES.summary.noCard}</div>`
                  }
                  ${cardActionsHtml}
                </div>
              </div>

              <div class="px-card p-3 text-xs space-y-1.5 tabular-nums">
                <div class="flex justify-between"><span>${ES.party.hp} Total</span><span>${creature.currentHp} / ${creature.stats.hp}${socketedCard?.bonuses.hp ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.hp})</em>` : ''}</span></div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-ash-purple">
                  <div class="flex justify-between"><span>${ES.stats.atk}</span><span>${creature.stats.atk}${socketedCard?.bonuses.atk ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.atk})</em>` : ''} <em class="text-bone-gray">(IV ${creature.ivs.atk})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.def}</span><span>${creature.stats.def}${socketedCard?.bonuses.def ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.def})</em>` : ''} <em class="text-bone-gray">(IV ${creature.ivs.def})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spa}</span><span>${creature.stats.spa}${socketedCard?.bonuses.spa ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.spa})</em>` : ''} <em class="text-bone-gray">(IV ${creature.ivs.spa})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spd}</span><span>${creature.stats.spd}${socketedCard?.bonuses.spd ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.spd})</em>` : ''} <em class="text-bone-gray">(IV ${creature.ivs.spd})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spe}</span><span>${creature.stats.spe}${socketedCard?.bonuses.spe ? ` <em data-stat-boost class="text-ki-cyan not-italic">(+${socketedCard.bonuses.spe})</em>` : ''} <em class="text-bone-gray">(IV ${creature.ivs.spe})</em></span></div>
                </div>
                <div class="pt-1 border-t border-ash-purple">
                  <div class="flex justify-between mb-1"><span>${ES.summary.xp}</span><span>${creature.xp} / ${nextLvXp}</span></div>
                  <div class="h-2.5 w-full rounded-none border border-ash-purple bg-ui-ink overflow-hidden">
                    <div class="h-full bg-ki-cyan" style="width:${expPct}%"></div>
                  </div>
                </div>
              </div>
              <div class="text-xs text-porcelain leading-snug">${spec.description}</div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.summary.moves}</div>
              ${movesHtml}
            </div>
          </div>
          ${heldPickerModal}
          ${cardPickerModal}
        </div>
      `;

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelector('[data-equip-open]')?.addEventListener('click', () => {
        pickingHeld = true;
        render();
      });

      this.root.querySelector('[data-unequip]')?.addEventListener('click', () => {
        if (heldConfig) {
          unequipHeldItem(heldConfig.bag, creature);
          heldConfig.onChanged?.();
          render();
        }
      });

      this.root.querySelector('[data-pick-cancel]')?.addEventListener('click', () => {
        pickingHeld = false;
        render();
      });

      this.root.querySelectorAll<HTMLElement>('[data-pick-held]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const itemId = btn.dataset.pickHeld!;
          if (heldConfig) {
            equipHeldItem(heldConfig.bag, creature, itemId);
            heldConfig.onChanged?.();
          }
          pickingHeld = false;
          render();
        });
      });

      this.root.querySelector('[data-card-open]')?.addEventListener('click', () => {
        pickingCard = true;
        render();
      });

      this.root.querySelector('[data-card-remove]')?.addEventListener('click', () => {
        if (cardConfig) {
          unsocketCardFromCreature(creature);
          cardConfig.onChanged?.();
          render();
        }
      });

      this.root.querySelector('[data-card-cancel]')?.addEventListener('click', () => {
        pickingCard = false;
        render();
      });

      this.root.querySelectorAll<HTMLElement>('[data-pick-card]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const cardSpeciesId = Number(btn.dataset.pickCard);
          if (cardConfig) {
            const res = socketCardOnCreature(cardConfig.save, creature, cardSpeciesId);
            if (res.ok) {
              justSocketedCard = true;
            }
            cardConfig.onChanged?.();
          }
          pickingCard = false;
          render();
        });
      });

      if (justSocketedCard && socketedCard) {
        justSocketedCard = false;
        const slotEl = this.root.querySelector<HTMLElement>('[data-card-slot]');
        const statEls = this.root.querySelectorAll<HTMLElement>('[data-stat-boost]');
        const accent = CARD_RARITY_STYLES[socketedCard.rarity].fxColor;
        playCardSocketFx(slotEl, accent, statEls);
      }

      this.activeAnimView?.dispose();
      this.activeAnimView = new AnimatedSoulDollView(this.assets, creature.speciesId, 'front', 84);
      this.root.querySelector('[data-anim-portrait]')?.replaceChildren(this.activeAnimView.root);
    };

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }

  protected override onBeforeClose(): void {
    this.activeAnimView?.dispose();
    this.activeAnimView = null;
  }
}
