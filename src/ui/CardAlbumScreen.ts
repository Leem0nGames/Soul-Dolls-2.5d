import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import {
  CARD_RARITY_ORDER,
  formatCardBonuses,
  formatCreaturesUsingCard,
  getAlbumCounts,
  getAvailableCardCopies,
  getCardDef,
  getCardDropChance,
  getCardRarityDropMultiplier,
  socketCardOnCreature,
  unsocketCardFromCreature,
} from '../domain/Cards.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import type { CardRarity, SaveData, StatName } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';
import { CARD_RARITY_STYLES } from './cardRarityStyles.ts';
import { playCardSocketFx } from './cardSocketFx.ts';

type CardFilter = 'all' | 'owned' | 'missing';
type RarityFilter = 'all' | CardRarity;

const STAT_ORDER: readonly StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

export class CardAlbumScreen {
  readonly root: HTMLDivElement;
  private filter: CardFilter = 'all';
  private rarityFilter: RarityFilter = 'all';
  private selectedId: number | null = null;
  private notice = '';
  private justSocketedPartyIdx: number | null = null;
  private unbindImages: (() => void) | null = null;
  private dragCleanup: (() => void) | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-crypt-ink/90 p-3 safe-pad';
    parent.appendChild(this.root);
  }

  open(save: SaveData, onClose: () => void, onChanged?: () => void): void {
    this.selectedId = null;
    this.notice = '';
    this.justSocketedPartyIdx = null;
    this.dragCleanup?.();
    this.dragCleanup = null;

    const render = () => {
      this.dragCleanup?.();
      this.dragCleanup = null;
      const counts = getAlbumCounts(save);

      if (this.selectedId !== null) {
        this.renderDetail(
          save,
          this.selectedId,
          () => {
            this.selectedId = null;
            this.notice = '';
            this.justSocketedPartyIdx = null;
            render();
          },
          () => {
            onChanged?.();
            render();
          }
        );
        return;
      }

      const filters: Array<{ id: CardFilter; label: string }> = [
        { id: 'all', label: `${ES.cards.filterAll} (${counts.total})` },
        { id: 'owned', label: `${ES.cards.filterOwned} (${counts.collected})` },
        {
          id: 'missing',
          label: `${ES.cards.filterMissing} (${counts.total - counts.collected})`,
        },
      ];

      const filterBtns = filters
        .map(
          (f) =>
            `<button data-filter="${f.id}" class="min-h-[44px] px-3 rounded-lg text-xs font-bold border ${
              this.filter === f.id
                ? 'border-bright-brass bg-resonant-gold text-crypt-ink'
                : 'border-cold-stone/70 bg-ash-purple text-porcelain'
            }">${f.label}</button>`
        )
        .join('');

      const rarityCounts = CARD_RARITY_ORDER.reduce(
        (acc, r) => {
          acc[r] = 0;
          return acc;
        },
        {} as Record<CardRarity, number>
      );
      for (const id of ALL_SPECIES_IDS) {
        rarityCounts[getCardDef(id).rarity] += 1;
      }

      const rarityBtns = [
        `<button data-rarity="all" class="min-h-[40px] px-2.5 rounded-lg text-[11px] font-bold border ${
          this.rarityFilter === 'all'
            ? 'border-warm-white bg-cold-stone/40 text-warm-white'
            : 'border-ash-purple bg-crypt-ink text-bone-gray'
        }">${ES.cards.allRarities}</button>`,
        ...CARD_RARITY_ORDER.map((r) => {
          const style = CARD_RARITY_STYLES[r];
          const active = this.rarityFilter === r;
          return `<button data-rarity="${r}" class="min-h-[40px] px-2.5 rounded-lg text-[11px] font-bold border-2 ${
            active
              ? `${style.border} ${style.frameBg} ${style.accent} ${style.glow}`
              : `${style.unownedBorder} bg-crypt-ink/80 ${style.accent} opacity-80 hover:opacity-100`
          }">${ES.cards.rarity[r]} (${rarityCounts[r]})</button>`;
        }),
      ].join('');

      const filteredIds = ALL_SPECIES_IDS.filter((id) => {
        const owned = (save.cardAlbum?.[id]?.count ?? 0) > 0;
        if (this.filter === 'owned' && !owned) return false;
        if (this.filter === 'missing' && owned) return false;
        if (this.rarityFilter !== 'all' && getCardDef(id).rarity !== this.rarityFilter) {
          return false;
        }
        return true;
      });

      const cardsHtml =
        filteredIds.length === 0
          ? `<div class="col-span-full py-10 text-center text-sm text-bone-gray">${
              this.filter === 'owned'
                ? 'Aún no has obtenido cartas en este filtro.'
                : this.filter === 'missing'
                  ? '¡Ya coleccionaste todas las cartas de este filtro!'
                  : 'No hay cartas en este filtro.'
            }</div>`
          : filteredIds
              .map((id) => {
                const entry = save.cardAlbum?.[id];
                const owned = Boolean(entry && entry.count > 0);
                const spec = getSpecies(id);
                const card = getCardDef(id);
                const rarityStyle = CARD_RARITY_STYLES[card.rarity];

                if (!owned) {
                  return `
                    <button data-card="${id}" class="text-left rounded-xl border ${rarityStyle.unownedBorder} bg-crypt-ink/70 hover:border-cold-stone p-2.5 flex flex-col items-center justify-between gap-2 min-h-[156px]">
                      <div class="w-full flex items-center justify-between text-[11px] tabular-nums">
                        <span class="text-cold-stone">#${String(id).padStart(2, '0')}</span>
                        <span class="font-bold ${rarityStyle.accent} opacity-75">${ES.cards.rarity[card.rarity]}</span>
                      </div>
                      <img src="${this.assets.getCreatureSilhouetteDataUrl(id)}" data-souldoll-id="${id}" data-souldoll-view="silhouette" class="souldoll-img w-16 h-16 object-contain opacity-60" alt="${ES.cards.unknown}" />
                      <div class="w-full text-center">
                        <div class="font-bold text-xs text-cold-stone">${ES.cards.unknown}</div>
                        <div class="text-[10px] text-bone-gray/60 truncate">Sin obtener</div>
                      </div>
                    </button>
                  `;
                }

                const avail = getAvailableCardCopies(save, id);
                const holders = formatCreaturesUsingCard(save, id);
                const primaryType = TYPE_VISUALS[card.types[0]];
                const typesText = card.types.map((t) => ES.types[t]).join(' · ');
                const bonusStr = formatCardBonuses(card.bonuses);

                return `
                  <button data-card="${id}" class="text-left rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.frameBg} ${rarityStyle.glow} ${rarityStyle.hoverBorder} p-2.5 flex flex-col justify-between gap-1.5 min-h-[156px] relative overflow-hidden transition-colors">
                    <div class="w-full flex items-center justify-between gap-1 text-[11px] tabular-nums">
                      <span class="text-bone-gray font-bold">#${String(id).padStart(2, '0')}</span>
                      <span class="font-bold ${rarityStyle.accent}">${ES.cards.rarity[card.rarity]} · ×${entry!.count}</span>
                    </div>
                    <div class="w-full flex items-center justify-center rounded-lg py-1" style="background:radial-gradient(circle, ${primaryType.bg}55 0%, rgba(20,16,28,0) 74%)">
                      <img src="${this.assets.getCreatureDataUrl(id, 'front')}" data-souldoll-id="${id}" data-souldoll-view="front" class="souldoll-img w-16 h-16 object-contain" alt="${spec.name}" />
                    </div>
                    <div class="w-full min-w-0">
                      <div class="font-bold text-xs text-porcelain truncate">${spec.name}</div>
                      <div class="text-[10px] text-bone-gray truncate">${typesText}</div>
                      <div class="mt-0.5 text-[10px] font-bold text-ki-cyan truncate tabular-nums">${bonusStr}</div>
                      <div class="text-[10px] ${holders ? 'text-resonant-gold' : 'text-bone-gray/80'} truncate tabular-nums">${
                        holders ? `Engarzada: ${holders}` : `Libres: ${avail}/${entry!.count}`
                      }</div>
                    </div>
                  </button>
                `;
              })
              .join('');

      this.root.innerHTML = `
        <div class="w-full max-w-4xl max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-2.5 gap-2">
            <div>
              <div class="font-bold text-resonant-gold">${ES.cards.title}</div>
              <div class="text-xs text-bone-gray tabular-nums">${ES.cards.collected}: ${counts.collected}/${counts.total} · Copias totales: ${counts.totalCopies}</div>
            </div>
            <button data-close class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.cards.back}</button>
          </div>
          <div class="text-xs text-bone-gray mb-2">${ES.cards.subtitle}</div>
          <div class="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5 mb-2">${filterBtns}</div>
          <div class="flex flex-wrap gap-1.5 mb-3">${rarityBtns}</div>
          <div class="touch-scroll overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pr-1">
            ${cardsHtml}
          </div>
        </div>
      `;

      this.root.querySelector('[data-close]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelectorAll<HTMLElement>('[data-filter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.filter = btn.dataset.filter as CardFilter;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-rarity]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.rarityFilter = btn.dataset.rarity as RarityFilter;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-card]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedId = Number(btn.dataset.card);
          this.notice = '';
          render();
        });
      });
    };

    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, this.assets);
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    render();
  }

  private renderDetail(
    save: SaveData,
    speciesId: number,
    onBack: () => void,
    onMutate: () => void
  ): void {
    const spec = getSpecies(speciesId);
    const card = getCardDef(speciesId);
    const entry = save.cardAlbum?.[speciesId];
    const owned = Boolean(entry && entry.count > 0);
    const rarityStyle = CARD_RARITY_STYLES[card.rarity];
    const dropPct = `${(getCardDropChance(speciesId, false) * 100).toFixed(1)}%`;
    const dropMult = `×${getCardRarityDropMultiplier(card.rarity).toFixed(2)}`;

    if (!owned) {
      this.root.innerHTML = `
        <div class="w-full max-w-md max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.glow} bg-smoked-wood p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-4">
            <div class="font-bold text-bone-gray tabular-nums">#${String(speciesId).padStart(2, '0')} · ${ES.cards.unknown}</div>
            <button data-back class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold">${ES.cards.back}</button>
          </div>
          <div class="flex flex-col items-center py-6 gap-3 text-center">
            <img src="${this.assets.getCreatureSilhouetteDataUrl(speciesId)}" data-souldoll-id="${speciesId}" data-souldoll-view="silhouette" class="souldoll-img w-28 h-28 object-contain opacity-75" alt="${ES.cards.unknown}" />
            <div class="text-xs font-bold uppercase tracking-wider ${rarityStyle.accent}">${ES.cards.rarity[card.rarity]}</div>
            <div class="text-[11px] text-bone-gray tabular-nums">${ES.cards.dropChanceLabel(dropPct, dropMult)}</div>
            <p class="text-sm text-bone-gray max-w-xs">${ES.cards.lockedHint}</p>
          </div>
        </div>
      `;
      this.root.querySelector('[data-back]')?.addEventListener('click', onBack);
      return;
    }

    const totalCopies = entry!.count;
    const availCopies = getAvailableCardCopies(save, speciesId);
    const holdersText = formatCreaturesUsingCard(save, speciesId);
    const primaryType = TYPE_VISUALS[card.types[0]];
    const typeBadges = card.types
      .map((t) => {
        const v = TYPE_VISUALS[t];
        return `<span class="px-2 py-0.5 rounded text-xs font-bold border" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
      })
      .join(' ');

    const bonusesGrid = STAT_ORDER.filter((stat) => (card.bonuses[stat] ?? 0) > 0)
      .map(
        (stat) => `
          <div class="rounded-lg border border-ash-purple bg-smoked-wood/80 px-2.5 py-1.5 flex items-center justify-between text-xs tabular-nums">
            <span class="font-bold text-bone-gray">${ES.stats[stat]}</span>
            <span class="font-bold text-ki-cyan">+${card.bonuses[stat]}</span>
          </div>
        `
      )
      .join('');

    const partyHtml =
      save.party.length === 0
        ? `<div class="rounded-lg border border-ash-purple bg-crypt-ink p-4 text-xs text-bone-gray text-center">${ES.cards.noParty}</div>`
        : save.party
            .map((mon, idx) => {
              const hasThis = mon.socketedCardId === speciesId;
              const otherCard =
                mon.socketedCardId !== undefined && !hasThis
                  ? getCardDef(mon.socketedCardId)
                  : null;
              const activeCard = hasThis ? card : otherCard;
              const canDropHere = !hasThis && availCopies > 0;
              let btnHtml = '';
              if (hasThis) {
                btnHtml = `<button data-unsocket="${idx}" class="min-h-[44px] px-3 rounded-lg bg-rosewood hover:bg-rift-crimson text-warm-white text-xs font-bold shrink-0">${ES.cards.unsocketAction}</button>`;
              } else if (availCopies > 0) {
                btnHtml = `<button data-socket="${idx}" class="min-h-[44px] px-3 rounded-lg bg-oceanic-teal hover:bg-vibrant-aqua text-warm-white text-xs font-bold shrink-0">${
                  otherCard ? ES.cards.swapAction : ES.cards.socketAction
                }</button>`;
              } else {
                btnHtml = `<span class="text-[11px] text-bone-gray/80 font-semibold shrink-0">${ES.cards.noCopyAvailable}</span>`;
              }

              const statLine = (
                [
                  ['hp', 'PS'],
                  ['atk', 'ATQ'],
                  ['spa', 'ATE'],
                  ['spe', 'VEL'],
                ] as const
              )
                .map(([key, label]) => {
                  const b = activeCard?.bonuses[key];
                  const valHtml =
                    hasThis && b
                      ? `<span data-party-stat-boost="${idx}" class="text-ki-cyan font-bold">${mon.stats[key]} (+${b})</span>`
                      : `<span>${mon.stats[key]}</span>`;
                  return `${label} ${valHtml}`;
                })
                .join(' · ');

              return `
                <div data-party-drop-idx="${idx}" data-can-drop="${canDropHere ? '1' : '0'}" class="rounded-lg border-2 transition-all duration-150 ${
                  hasThis
                    ? 'border-resonant-gold bg-ash-purple/40 card-socket-active'
                    : 'border-ash-purple bg-crypt-ink'
                } p-2.5 flex items-center justify-between gap-2.5">
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <div data-socket-slot="${idx}" class="relative w-12 h-12 rounded-lg border ${
                      hasThis
                        ? 'border-ki-cyan/80 bg-deep-abyss/60'
                        : activeCard
                          ? 'border-old-bronze bg-smoked-wood/80'
                          : 'border-dashed border-cold-stone/60 bg-smoked-wood/40'
                    } flex items-center justify-center shrink-0">
                      <img src="${this.assets.getCreatureDataUrl(mon.speciesId, 'front')}" data-souldoll-id="${mon.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain" alt="${getCreatureDisplayName(mon)}" />
                      ${
                        activeCard
                          ? `<img src="${this.assets.getCreatureDataUrl(activeCard.speciesId, 'front')}" data-souldoll-id="${activeCard.speciesId}" data-souldoll-view="front" class="souldoll-img w-5 h-5 object-contain rounded border-2 ${CARD_RARITY_STYLES[activeCard.rarity].border} bg-crypt-ink absolute -bottom-1 -right-1 shadow" alt="${activeCard.name}" />`
                          : ''
                      }
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="font-bold text-sm text-porcelain truncate">${getCreatureDisplayName(mon)} <span class="text-xs text-resonant-gold tabular-nums">${ES.party.lv}${mon.level}</span></div>
                      <div class="text-[11px] text-bone-gray tabular-nums">${statLine}</div>
                      ${
                        hasThis
                          ? `<div class="text-[11px] font-bold text-ki-cyan">${ES.cards.bonusActive}: ${formatCardBonuses(card.bonuses)}</div>`
                          : otherCard
                            ? `<div class="text-[11px] text-pale-gold truncate">Ranura: ${otherCard.name}</div>`
                            : `<div data-drop-hint="${idx}" class="text-[11px] text-bone-gray/70">Ranura libre</div>`
                      }
                    </div>
                  </div>
                  ${btnHtml}
                </div>
              `;
            })
            .join('');

    const canDragCard = availCopies > 0 && save.party.length > 0;

    this.root.innerHTML = `
      <div class="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
        <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3 gap-2">
          <div class="font-bold text-resonant-gold tabular-nums">#${String(speciesId).padStart(2, '0')} · ${card.name}</div>
          <button data-back class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.cards.back}</button>
        </div>

        ${this.notice ? `<div class="mb-3 rounded-lg border border-ki-cyan/60 bg-oceanic-teal/40 px-3 py-2 text-xs font-semibold text-warm-white">${this.notice}</div>` : ''}

        <div class="grid grid-cols-1 md:grid-cols-[270px_1fr] gap-4">
          <div class="flex flex-col gap-2">
            <div data-drag-card class="rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.frameBg} ${rarityStyle.glow} p-3.5 flex flex-col gap-3 shadow-xl transition-transform duration-150 ${
              canDragCard ? 'touch-none select-none cursor-grab active:cursor-grabbing hover:-translate-y-0.5' : ''
            }">
              <div class="flex items-center justify-between text-xs font-bold">
                <span class="tabular-nums text-bone-gray">#${String(speciesId).padStart(2, '0')} · ${card.title}</span>
                <span class="${rarityStyle.accent} uppercase tracking-wider">${ES.cards.rarity[card.rarity]}</span>
              </div>

              <div class="rounded-lg border border-ash-purple/80 py-3 flex items-center justify-center" style="background:radial-gradient(circle, ${primaryType.bg}66 0%, #14101C 76%)">
                <img src="${this.assets.getCreatureDataUrl(speciesId, 'front')}" data-souldoll-id="${speciesId}" data-souldoll-view="front" class="souldoll-img w-32 h-32 object-contain pointer-events-none" alt="${spec.name}" />
              </div>

              <div>
                <div class="text-lg font-bold text-porcelain">${spec.name}</div>
                <div class="mt-1 flex flex-wrap gap-1">${typeBadges}</div>
              </div>

              <div class="text-xs text-porcelain/90 leading-relaxed border-t border-ash-purple pt-2">
                ${card.description}
              </div>

              <div class="border-t border-ash-purple pt-2 space-y-1.5">
                <div class="text-[11px] font-bold uppercase tracking-wider text-bone-gray">${ES.cards.bonusesTitle}</div>
                <div class="grid grid-cols-2 gap-1.5">${bonusesGrid}</div>
              </div>

              <div class="border-t border-ash-purple pt-2 text-xs text-bone-gray space-y-0.5 tabular-nums">
                <div>${ES.cards.dropChanceLabel(dropPct, dropMult)}</div>
                <div>${ES.cards.copiesLabel(availCopies, totalCopies)}</div>
                ${holdersText ? `<div class="text-resonant-gold">${ES.cards.equippedBy(holdersText)}</div>` : ''}
              </div>
            </div>
            ${
              canDragCard
                ? `<div class="text-[11px] text-center text-ki-cyan/90 font-semibold px-2">${ES.cards.dragHint}</div>`
                : ''
            }
          </div>

          <div class="flex flex-col gap-2">
            <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.cards.socketIntoParty}</div>
            <div class="space-y-2">${partyHtml}</div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('[data-back]')?.addEventListener('click', onBack);

    const performSocket = (idx: number) => {
      const mon = save.party[idx];
      if (!mon) return;
      const res = socketCardOnCreature(save, mon, speciesId);
      if (res.ok) {
        this.justSocketedPartyIdx = idx;
        this.notice = `${card.name} engarzada en ${getCreatureDisplayName(mon)} (${formatCardBonuses(card.bonuses)}).`;
        onMutate();
      }
    };

    this.root.querySelectorAll<HTMLElement>('[data-socket]').forEach((btn) => {
      btn.addEventListener('click', () => {
        performSocket(Number(btn.dataset.socket));
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-unsocket]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.unsocket);
        const mon = save.party[idx];
        if (!mon) return;
        unsocketCardFromCreature(mon);
        this.notice = `Retiraste ${card.name} de ${getCreatureDisplayName(mon)}.`;
        onMutate();
      });
    });

    if (canDragCard) {
      const dragCardEl = this.root.querySelector<HTMLElement>('[data-drag-card]');
      const dropTargets = Array.from(
        this.root.querySelectorAll<HTMLElement>('[data-party-drop-idx][data-can-drop="1"]')
      );
      if (dragCardEl && dropTargets.length > 0) {
        let dragging = false;
        let activePointerId: number | null = null;
        let startX = 0;
        let startY = 0;
        let ghostEl: HTMLDivElement | null = null;
        let hoveredTarget: HTMLElement | null = null;

        const clearDragVisuals = () => {
          dragCardEl.style.opacity = '';
          ghostEl?.remove();
          ghostEl = null;
          for (const el of dropTargets) {
            el.classList.remove('card-drop-target-ready', 'card-drop-target-hover');
          }
          hoveredTarget = null;
        };

        const createGhost = (x: number, y: number) => {
          const g = document.createElement('div');
          g.className = `pointer-events-none fixed z-[65] w-44 rounded-xl border-2 ${rarityStyle.border} ${rarityStyle.frameBg} p-2.5 shadow-2xl`;
          g.style.left = `${x}px`;
          g.style.top = `${y}px`;
          g.style.transform = 'translate(-50%, -55%) rotate(-3deg) scale(0.95)';
          g.style.boxShadow = `0 12px 30px rgba(0,0,0,0.65), 0 0 18px ${rarityStyle.fxColor}66`;
          g.innerHTML = `
            <div class="flex items-center justify-between text-[10px] font-bold mb-1">
              <span class="text-porcelain truncate">${card.name}</span>
              <span class="${rarityStyle.accent}">${ES.cards.rarity[card.rarity]}</span>
            </div>
            <div class="flex items-center justify-center py-1 rounded bg-smoked-wood/70">
              <img src="${this.assets.getCreatureDataUrl(speciesId, 'front')}" class="souldoll-img w-16 h-16 object-contain" alt="" />
            </div>
            <div class="mt-1 text-[10px] font-bold text-ki-cyan text-center tabular-nums">${formatCardBonuses(card.bonuses)}</div>
          `;
          document.body.appendChild(g);
          return g;
        };

        const findDropAt = (x: number, y: number): HTMLElement | null => {
          for (const el of dropTargets) {
            const r = el.getBoundingClientRect();
            if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
              return el;
            }
          }
          return null;
        };

        const onPointerMove = (ev: PointerEvent) => {
          if (activePointerId !== ev.pointerId) return;
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!dragging) {
            if (dx * dx + dy * dy < 64) return;
            dragging = true;
            dragCardEl.style.opacity = '0.55';
            ghostEl = createGhost(ev.clientX, ev.clientY);
            for (const el of dropTargets) {
              el.classList.add('card-drop-target-ready');
            }
          }
          if (ghostEl) {
            ghostEl.style.left = `${ev.clientX}px`;
            ghostEl.style.top = `${ev.clientY}px`;
          }
          const hit = findDropAt(ev.clientX, ev.clientY);
          if (hit !== hoveredTarget) {
            hoveredTarget?.classList.remove('card-drop-target-hover');
            hoveredTarget = hit;
            hoveredTarget?.classList.add('card-drop-target-hover');
          }
        };

        const onPointerUp = (ev: PointerEvent) => {
          if (activePointerId !== ev.pointerId) return;
          const wasDragging = dragging;
          const dropIdx =
            wasDragging && hoveredTarget ? Number(hoveredTarget.dataset.partyDropIdx) : null;
          activePointerId = null;
          dragging = false;
          clearDragVisuals();
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);

          if (wasDragging && dropIdx !== null && !Number.isNaN(dropIdx)) {
            performSocket(dropIdx);
          }
        };

        const onPointerDown = (ev: PointerEvent) => {
          if (ev.button !== 0 && ev.pointerType === 'mouse') return;
          activePointerId = ev.pointerId;
          dragging = false;
          startX = ev.clientX;
          startY = ev.clientY;
          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerUp);
        };

        dragCardEl.addEventListener('pointerdown', onPointerDown);
        this.dragCleanup = () => {
          clearDragVisuals();
          dragCardEl.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          window.removeEventListener('pointercancel', onPointerUp);
        };
      }
    }

    if (this.justSocketedPartyIdx !== null) {
      const idx = this.justSocketedPartyIdx;
      this.justSocketedPartyIdx = null;
      const slotEl =
        this.root.querySelector<HTMLElement>(`[data-socket-slot="${idx}"]`) ??
        this.root.querySelector<HTMLElement>(`[data-party-drop-idx="${idx}"]`);
      const rowEl = this.root.querySelector<HTMLElement>(`[data-party-drop-idx="${idx}"]`);
      if (rowEl) {
        rowEl.classList.remove('card-socket-flash');
        void rowEl.offsetWidth;
        rowEl.classList.add('card-socket-flash');
      }
      const statEls = this.root.querySelectorAll<HTMLElement>(
        `[data-party-stat-boost="${idx}"]`
      );
      playCardSocketFx(slotEl, rarityStyle.fxColor, statEls);
    }
  }

  close(): void {
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.dragCleanup?.();
    this.dragCleanup = null;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.remove();
  }
}
