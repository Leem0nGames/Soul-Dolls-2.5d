import { getBodyContainer, getSpeciesDollProfile } from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import { getCreatureAbilityDef } from '../domain/Abilities.ts';
import { formatCardBonuses, getCardDef, getEffectiveCardDef } from '../domain/Cards.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { getHeldItemDef } from '../domain/HeldItems.ts';
import { SOULDOLL_PORTRAIT_PLACEHOLDER_PATH } from '../domain/MeleeStabTiming.ts';
import { swapPartySlots } from '../domain/Party.ts';
import type { BagSlot, CreatureInstance, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';
import { renderTypeBadges } from './renderTypeBadge.ts';
import type { SummaryScreen } from './SummaryScreen.ts';

export type PartyMode =
  | { kind: 'manage'; bag?: BagSlot[]; save?: SaveData }
  | { kind: 'switch'; activeIndex: number; allowCancel: boolean; onPick: (index: number) => void }
  | { kind: 'item_target'; onPick: (index: number) => void; onCancel: () => void };

function escapeHtml(raw: string): string {
  return raw
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export class PartyScreen extends ModalOverlay {
  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider,
    private readonly summary: SummaryScreen
  ) {
    super(parent);
  }

  open(party: CreatureInstance[], mode: PartyMode, onClose: () => void): void {
    const render = () => {
      const canCancel = mode.kind !== 'switch' || mode.allowCancel;
      const aliveCount = party.filter((c) => c.currentHp > 0).length;
      const avgLevel =
        party.length > 0
          ? Math.round(party.reduce((acc, c) => acc + c.level, 0) / party.length)
          : 0;

      const cardsHtml =
        party.length === 0
          ? `<div class="col-span-full text-center py-10 text-bone-gray">${ES.party.empty}</div>`
          : party
              .map((c, idx) => {
                const spec = getSpecies(c.speciesId);
                const displayName = getCreatureDisplayName(c);
                const dollProfile = getSpeciesDollProfile(
                  c.speciesId,
                  spec.types,
                  spec.dollClass,
                  spec.weapon
                );
                const containerDef = getBodyContainer(c.containerId ?? 'cuerpo_aprendiz');
                const ability = getCreatureAbilityDef(c);
                const heldItem = getHeldItemDef(c);
                const socketedCard =
                  c.socketedCardId !== undefined
                    ? mode.kind === 'manage' && mode.save
                      ? getEffectiveCardDef(mode.save, c.socketedCardId)
                      : {
                          ...getCardDef(c.socketedCardId),
                          bonuses:
                            c.socketedCardBonuses ?? getCardDef(c.socketedCardId).bonuses,
                        }
                    : null;

                const pct = Math.max(
                  0,
                  Math.min(100, Math.round((c.currentHp / Math.max(1, c.stats.hp)) * 100))
                );
                const barColor =
                  pct > 50 ? 'bg-ui-success' : pct > 20 ? 'bg-ui-warning' : 'bg-ui-danger';
                const isFainted = c.currentHp <= 0;
                const isActiveInBattle = mode.kind === 'switch' && idx === mode.activeIndex;
                const isLead = idx === 0;
                const handle = `@${spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '')}`;

                const stateNote = isFainted
                  ? `<span class="text-coral-red font-bold">${ES.party.fainted}</span>`
                  : isActiveInBattle
                    ? `<span class="text-ki-cyan font-bold">${ES.party.inBattle}</span>`
                    : isLead
                      ? `<span class="text-resonant-gold font-bold">${ES.party.leadTag}</span>`
                      : '';

                const statusText =
                  c.status !== 'none'
                    ? `<span class="text-ethereal-orchid font-bold">${ES.statusShort[c.status]}</span>`
                    : '';

                const actionButtonsHtml =
                  mode.kind === 'manage'
                    ? `
                      <button data-summary="${idx}" class="px-btn-secondary flex-1 min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${ES.party.summary}</button>
                      ${
                        idx > 0
                          ? `<button data-lead="${idx}" class="px-btn-arcane min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${ES.party.makeLead}</button>`
                          : ''
                      }
                    `
                    : mode.kind === 'switch'
                      ? `<button data-pick="${idx}" class="${
                          isFainted || isActiveInBattle ? 'px-btn-secondary' : 'px-btn-success'
                        } w-full min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${
                          isFainted
                            ? ES.party.fainted
                            : isActiveInBattle
                              ? ES.party.inBattle
                              : ES.party.sendOut
                        }</button>`
                      : `<button data-pick="${idx}" class="px-btn-success w-full min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${ES.party.useItem}</button>`;

                const heldLine = heldItem
                  ? `<div class="flex items-center gap-1.5 min-w-0">
                       <img src="${this.assets.getItemIconDataUrl(heldItem.id)}" class="pixel-canvas w-4 h-4 object-contain shrink-0" alt="" />
                       <span class="truncate text-porcelain">${escapeHtml(heldItem.name)}</span>
                     </div>`
                  : `<span class="text-bone-gray">${ES.summary.noHeldItem}</span>`;

                return `
                  <article class="px-card ${
                    isFainted
                      ? 'border-rift-crimson bg-dried-blood/40'
                      : isActiveInBattle || isLead
                        ? 'border-old-bronze bg-crypt-ink'
                        : 'border-ash-purple bg-crypt-ink'
                  } flex flex-col overflow-hidden">
                    <!-- Instagram-style post author bar -->
                    <header class="flex items-center justify-between gap-2.5 px-3 py-2.5 border-b border-ash-purple bg-smoked-wood/60">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <img
                          src="${this.assets.getCreatureDataUrl(c.speciesId, 'front')}"
                          data-souldoll-id="${c.speciesId}"
                          data-souldoll-view="front"
                          class="souldoll-img w-9 h-9 object-contain shrink-0 border border-ash-purple bg-crypt-ink"
                          alt="${escapeHtml(spec.name)}"
                        />
                        <div class="min-w-0">
                          <div class="font-bold text-sm text-warm-white truncate">${escapeHtml(displayName)}</div>
                          <div class="text-[11px] text-bone-gray truncate">${escapeHtml(handle)} · ${escapeHtml(dollProfile.className)}</div>
                        </div>
                      </div>
                      <div class="text-right shrink-0 text-xs tabular-nums">
                        <div class="font-bold text-resonant-gold">${ES.party.lv}${c.level}</div>
                        ${stateNote ? `<div class="text-[11px]">${stateNote}</div>` : ''}
                      </div>
                    </header>

                    <!-- 1:1 Square Portrait Post Media -->
                    <div class="relative aspect-square w-full overflow-hidden border-b border-ash-purple bg-gradient-to-b from-smoked-wood to-crypt-ink">
                      <img
                        src="${SOULDOLL_PORTRAIT_PLACEHOLDER_PATH}"
                        referrerPolicy="no-referrer"
                        onerror="this.style.opacity='0'"
                        class="w-full h-full object-cover object-top block"
                        alt="Retrato de ${escapeHtml(displayName)}"
                      />
                      <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0B080E]/95 via-[#0B080E]/55 to-transparent px-3 pt-8 pb-2.5 flex items-end justify-between gap-2">
                        <div class="flex items-center gap-1 flex-wrap">${renderTypeBadges(spec.types, 'sm')}</div>
                        <span class="text-[11px] font-bold text-frosted-glass px-text-shadow truncate">${escapeHtml(dollProfile.weaponName)}</span>
                      </div>
                    </div>

                    <!-- Vitals, Caption Bio & Spec Profile -->
                    <div class="p-3 flex-1 flex flex-col gap-2.5 text-xs">
                      <div>
                        <div class="flex items-center justify-between gap-2 text-[11px] tabular-nums mb-1">
                          <span class="font-bold text-porcelain">${ES.party.hp} ${c.currentHp}/${c.stats.hp} <span class="text-bone-gray font-normal">(${pct}%)</span></span>
                          ${statusText}
                        </div>
                        <div class="h-2.5 w-full rounded-none border border-ash-purple bg-ui-ink overflow-hidden">
                          <div class="h-full ${barColor}" style="width:${pct}%"></div>
                        </div>
                      </div>

                      <p class="text-[11px] text-porcelain/90 leading-relaxed line-clamp-2 m-0">
                        ${escapeHtml(spec.description)}
                      </p>

                      <div class="grid grid-cols-4 gap-1 py-2 border-y border-ash-purple/80 text-center text-[11px] tabular-nums">
                        <div>
                          <div class="text-[10px] text-bone-gray">${ES.stats.atk}</div>
                          <div class="font-bold text-warm-white">${c.stats.atk}</div>
                        </div>
                        <div>
                          <div class="text-[10px] text-bone-gray">${ES.stats.def}</div>
                          <div class="font-bold text-warm-white">${c.stats.def}</div>
                        </div>
                        <div>
                          <div class="text-[10px] text-bone-gray">${ES.stats.spa}</div>
                          <div class="font-bold text-warm-white">${c.stats.spa}</div>
                        </div>
                        <div>
                          <div class="text-[10px] text-bone-gray">${ES.stats.spe}</div>
                          <div class="font-bold text-warm-white">${c.stats.spe}</div>
                        </div>
                      </div>

                      <div class="space-y-1 text-[11px] min-w-0">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-bone-gray shrink-0">${ES.summary.ability}</span>
                          <span class="font-bold text-ki-cyan truncate">${escapeHtml(ability?.name ?? '—')}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-bone-gray shrink-0">Contenedor</span>
                          <span class="text-porcelain truncate">${escapeHtml(containerDef.name)}</span>
                        </div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-bone-gray shrink-0">${ES.summary.heldItem}</span>
                          ${heldLine}
                        </div>
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-bone-gray shrink-0">${ES.summary.socketedCard}</span>
                          ${
                            socketedCard
                              ? `<span class="font-bold text-resonant-gold truncate">${escapeHtml(socketedCard.name)} · ${escapeHtml(formatCardBonuses(socketedCard.bonuses))}</span>`
                              : `<span class="text-bone-gray truncate">${ES.summary.noCard}</span>`
                          }
                        </div>
                      </div>

                      <div class="mt-auto pt-1 flex flex-wrap gap-2">
                        ${actionButtonsHtml}
                      </div>
                    </div>
                  </article>
                `;
              })
              .join('');

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto p-4 sm:p-5 text-porcelain">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ash-purple pb-3 mb-4">
            <div class="min-w-0">
              <div class="text-base sm:text-lg font-bold text-resonant-gold">${
                mode.kind === 'switch' ? ES.party.chooseSwitch : ES.party.title
              }</div>
              <div class="text-xs text-bone-gray tabular-nums">
                ${ES.party.subtitle} · ${party.length}/6 en formación · ${aliveCount} listas${
                  party.length > 0 ? ` · ${ES.party.lv} prom. ${avgLevel}` : ''
                }
              </div>
            </div>
            ${
              canCancel
                ? `<button data-close class="px-btn-secondary min-h-[44px] px-4 py-2 text-sm font-bold whitespace-nowrap shrink-0">${ES.party.back}</button>`
                : ''
            }
          </div>
          <div data-msg class="mb-2 text-xs text-coral-red min-h-[1rem]"></div>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${cardsHtml}</div>
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
          const cardCfg =
            mode.kind === 'manage' && mode.save
              ? { save: mode.save, onChanged: () => render() }
              : undefined;
          this.summary.open(party[i], () => {}, heldCfg, cardCfg);
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

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }
}
