import { getItem } from '../data/items.ts';
import { getSpecies } from '../data/species.ts';
import {
  CARD_RARITY_ORDER,
  formatCardBonuses,
  getAlbumCounts,
  getAvailableCardCopies,
  getEffectiveCardDef,
  getSocketedCountForCard,
} from '../domain/Cards.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import {
  depositCardToChest,
  depositItemToChest,
  depositPartySoulDollToBox,
  depositSoulToChest,
  ensureHousingState,
  formatSoulContainerLabel,
  getChestCardEffectiveDef,
  getChestSoulCounts,
  getChestTotalCards,
  getChestTotalItems,
  withdrawBoxSoulDollToParty,
  withdrawCardFromChest,
  withdrawItemFromChest,
  withdrawSoulFromChest,
} from '../domain/Housing.ts';
import { MAX_PARTY_SIZE } from '../domain/Party.ts';
import type {
  BagSlot,
  CardRarity,
  ItemCategory,
  SaveData,
} from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { CARD_RARITY_STYLES } from './cardRarityStyles.ts';
import { ModalOverlay } from './ModalOverlay.ts';

type ChestSection = 'items' | 'cards' | 'souls';
type MobilePane = 'active' | 'chest';
type ItemCatFilter = 'all' | ItemCategory;
type CardRarityFilter = 'all' | CardRarity;
type SoulFilter = 'all' | 'reserve' | 'dolls';

const CHEST_ITEM_CATEGORIES: readonly ItemCatFilter[] = [
  'all',
  'medicine',
  'capsule',
  'stone',
  'held',
  'battle',
  'tm',
  'utility',
];

export class ChestScreen extends ModalOverlay {
  private section: ChestSection = 'items';
  private mobilePane: MobilePane = 'active';
  private itemCategory: ItemCatFilter = 'all';
  private cardRarity: CardRarityFilter = 'all';
  private soulFilter: SoulFilter = 'all';
  private targetBoxIndex = 0;
  private notice = '';

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(parent);
  }

  open(save: SaveData, onClose: () => void, onChanged?: () => void): void {
    ensureHousingState(save);
    this.notice = '';

    const render = () => {
      ensureHousingState(save);

      const bagTotal = save.bag.reduce((sum, slot) => sum + slot.quantity, 0);
      const itemChestTotal = getChestTotalItems(save);
      const albumCounts = getAlbumCounts(save);
      const cardChestTotal = getChestTotalCards(save);
      const soulCounts = getChestSoulCounts(save);

      const sectionTabs: Array<{ id: ChestSection; label: string; counts: string }> = [
        {
          id: 'items',
          label: ES.housing.tabItems,
          counts: `${bagTotal} / ${itemChestTotal}`,
        },
        {
          id: 'cards',
          label: ES.housing.tabCards,
          counts: `${albumCounts.totalCopies} / ${cardChestTotal}`,
        },
        {
          id: 'souls',
          label: ES.housing.tabSouls,
          counts: `${soulCounts.totalActiveSouls} / ${soulCounts.totalStoredSouls}`,
        },
      ];

      const sectionTabsHtml = sectionTabs
        .map((t) => {
          const active = this.section === t.id;
          return `<button data-chest-section="${t.id}" class="min-h-[44px] px-2.5 flex items-center justify-center gap-1.5 text-xs font-bold whitespace-nowrap ${
            active ? 'px-btn-primary' : 'px-btn-secondary'
          }">
            <span>${t.label}</span>
            <span class="tabular-nums opacity-85">(${t.counts})</span>
          </button>`;
        })
        .join('');

      const filterBarHtml = this.buildFilterBarHtml(save);
      const { activeHtml, chestHtml, activeCountLabel, chestCountLabel } =
        this.buildPaneLists(save);

      const headerSummary = `Obj: ${bagTotal}/${itemChestTotal} · Cartas: ${albumCounts.totalCopies}/${cardChestTotal} · Almas: ${soulCounts.totalActiveSouls}/${soulCounts.totalStoredSouls}`;

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-4xl max-h-[calc(100dvh-1.25rem)] flex flex-col p-3.5 sm:p-4 text-porcelain">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b-2 border-ash-purple pb-2 mb-2.5">
            <div class="min-w-0">
              <div class="text-base font-bold text-resonant-gold truncate">${ES.housing.chestTitle}</div>
              <div class="text-xs text-ki-cyan tabular-nums">${headerSummary}</div>
            </div>
            <button data-chest-close class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">${ES.housing.close}</button>
          </div>

          <div class="grid grid-cols-3 gap-1.5 mb-2.5">${sectionTabsHtml}</div>

          ${filterBarHtml}

          ${
            this.notice
              ? `<div class="mb-2.5 rounded-none border-2 border-ki-cyan bg-deep-abyss px-3 py-1.5 text-xs font-bold text-frosted-glass">${this.notice}</div>`
              : ''
          }

          <div class="grid grid-cols-2 gap-1.5 mb-2 md:hidden">
            <button data-mobile-pane="active" class="min-h-[44px] px-2 text-xs font-bold whitespace-nowrap ${
              this.mobilePane === 'active' ? 'px-btn-primary' : 'px-btn-secondary'
            }">${ES.housing.activePane} (${activeCountLabel})</button>
            <button data-mobile-pane="chest" class="min-h-[44px] px-2 text-xs font-bold whitespace-nowrap ${
              this.mobilePane === 'chest' ? 'px-btn-primary' : 'px-btn-secondary'
            }">${ES.housing.chestPane} (${chestCountLabel})</button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0">
            <div class="${
              this.mobilePane === 'active' ? 'flex' : 'hidden md:flex'
            } flex-col min-h-0 rounded-none border-2 border-ash-purple bg-abyss-ink p-2.5">
              <div class="flex items-center justify-between border-b border-ash-purple pb-1.5 mb-2 text-xs font-bold">
                <span class="text-pale-gold">${ES.housing.activePane}</span>
                <span class="text-bone-gray tabular-nums">${activeCountLabel}</span>
              </div>
              <div class="touch-scroll overflow-y-auto space-y-2 pr-0.5 flex-1">${activeHtml}</div>
            </div>

            <div class="${
              this.mobilePane === 'chest' ? 'flex' : 'hidden md:flex'
            } flex-col min-h-0 rounded-none border-2 border-ash-purple bg-abyss-ink p-2.5">
              <div class="flex items-center justify-between border-b border-ash-purple pb-1.5 mb-2 text-xs font-bold">
                <span class="text-ki-cyan">${ES.housing.chestPane}</span>
                <span class="text-bone-gray tabular-nums">${chestCountLabel}</span>
              </div>
              <div class="touch-scroll overflow-y-auto space-y-2 pr-0.5 flex-1">${chestHtml}</div>
            </div>
          </div>
        </div>
      `;

      this.bindEvents(save, render, onClose, onChanged);
    };

    this.bindSoulDolls(this.assets);
    this.showOverlay();
    render();
  }

  private buildFilterBarHtml(save: SaveData): string {
    if (this.section === 'items') {
      const btns = CHEST_ITEM_CATEGORIES.map((cat) => {
        const active = this.itemCategory === cat;
        const label =
          cat === 'all' ? ES.housing.allCategories : ES.bag.categories[cat];
        return `<button data-item-cat="${cat}" class="min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap ${
          active ? 'px-btn-primary' : 'px-btn-secondary'
        }">${label}</button>`;
      }).join('');
      return `<div class="flex flex-wrap gap-1.5 mb-2.5">${btns}</div>`;
    }

    if (this.section === 'cards') {
      const btns = [
        `<button data-card-rarity="all" class="min-h-[44px] px-2.5 rounded-none text-xs font-bold border-2 whitespace-nowrap ${
          this.cardRarity === 'all'
            ? 'border-warm-white bg-cold-stone text-warm-white'
            : 'border-ash-purple bg-crypt-ink text-bone-gray'
        }">${ES.cards.allRarities}</button>`,
        ...CARD_RARITY_ORDER.map((r) => {
          const style = CARD_RARITY_STYLES[r];
          const active = this.cardRarity === r;
          return `<button data-card-rarity="${r}" class="min-h-[44px] px-2.5 rounded-none text-xs font-bold border-2 whitespace-nowrap ${
            active
              ? `${style.border} ${style.frameBg} ${style.accent} ${style.glow}`
              : `${style.unownedBorder} bg-crypt-ink ${style.accent}`
          }">${ES.cards.rarity[r]}</button>`;
        }),
      ].join('');
      return `<div class="flex flex-wrap gap-1.5 mb-2.5">${btns}</div>`;
    }

    const soulFilters: Array<{ id: SoulFilter; label: string }> = [
      { id: 'all', label: ES.housing.soulsAll },
      { id: 'reserve', label: ES.housing.soulsReserve },
      { id: 'dolls', label: ES.housing.soulsDolls },
    ];
    const filterBtns = soulFilters
      .map(
        (f) =>
          `<button data-soul-filter="${f.id}" class="min-h-[44px] px-3 text-xs font-bold whitespace-nowrap ${
            this.soulFilter === f.id ? 'px-btn-primary' : 'px-btn-secondary'
          }">${f.label}</button>`
      )
      .join('');

    const boxBtns =
      this.soulFilter === 'reserve'
        ? ''
        : `<div class="flex items-center gap-1 overflow-x-auto pt-0.5">
            <span class="text-[11px] font-bold text-bone-gray shrink-0 pr-1">Destino:</span>
            ${save.storageBoxes
              .map(
                (box, idx) =>
                  `<button data-target-box="${idx}" class="min-h-[44px] px-2.5 text-[11px] font-bold shrink-0 whitespace-nowrap ${
                    idx === this.targetBoxIndex ? 'px-btn-arcane' : 'px-btn-secondary'
                  }">${box.name}</button>`
              )
              .join('')}
          </div>`;

    return `
      <div class="space-y-1.5 mb-2.5">
        <div class="flex flex-wrap gap-1.5">${filterBtns}</div>
        ${boxBtns}
      </div>
    `;
  }

  private buildPaneLists(save: SaveData): {
    activeHtml: string;
    chestHtml: string;
    activeCountLabel: string;
    chestCountLabel: string;
  } {
    if (this.section === 'items') {
      return this.buildItemLists(save);
    }
    if (this.section === 'cards') {
      return this.buildCardLists(save);
    }
    return this.buildSoulLists(save);
  }

  private buildItemLists(save: SaveData): {
    activeHtml: string;
    chestHtml: string;
    activeCountLabel: string;
    chestCountLabel: string;
  } {
    const filterItem = (slot: BagSlot) => {
      if (slot.quantity <= 0) return false;
      if (this.itemCategory === 'all') return true;
      return getItem(slot.itemId).category === this.itemCategory;
    };

    const bagSlots = save.bag.filter(filterItem);
    const chestSlots = (save.itemChest ?? []).filter(filterItem);

    const renderSlot = (slot: BagSlot, dir: 'deposit' | 'withdraw') => {
      const def = getItem(slot.itemId);
      const iconUrl = this.assets.getItemIconDataUrl(def.id);
      const oneAttr = dir === 'deposit' ? 'data-item-dep-one' : 'data-item-wd-one';
      const allAttr = dir === 'deposit' ? 'data-item-dep-all' : 'data-item-wd-all';
      const oneLabel = dir === 'deposit' ? ES.housing.depositOne : ES.housing.withdrawOne;
      const allLabel = dir === 'deposit' ? ES.housing.depositAll : ES.housing.withdrawAll;
      return `
        <div class="px-card flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 p-2">
          <div class="flex items-center gap-2 min-w-0 flex-1">
            <img src="${iconUrl}" class="pixel-canvas w-8 h-8 object-contain shrink-0" alt="${def.name}" />
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="font-bold text-xs text-porcelain truncate">${def.name}</span>
                <span class="text-resonant-gold font-bold text-xs tabular-nums">×${slot.quantity}</span>
              </div>
              <div class="text-[11px] text-bone-gray truncate">${ES.bag.categories[def.category]} · ${def.description}</div>
            </div>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button ${oneAttr}="${def.id}" class="px-btn-success min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${oneLabel}</button>
            ${
              slot.quantity > 1
                ? `<button ${allAttr}="${def.id}" class="px-btn-primary min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${allLabel}</button>`
                : ''
            }
          </div>
        </div>
      `;
    };

    const activeQty = bagSlots.reduce((s, slot) => s + slot.quantity, 0);
    const chestQty = chestSlots.reduce((s, slot) => s + slot.quantity, 0);

    return {
      activeHtml:
        bagSlots.length === 0
          ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyBag}</div>`
          : bagSlots.map((s) => renderSlot(s, 'deposit')).join(''),
      chestHtml:
        chestSlots.length === 0
          ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyChest}</div>`
          : chestSlots.map((s) => renderSlot(s, 'withdraw')).join(''),
      activeCountLabel: String(activeQty),
      chestCountLabel: String(chestQty),
    };
  }

  private buildCardLists(save: SaveData): {
    activeHtml: string;
    chestHtml: string;
    activeCountLabel: string;
    chestCountLabel: string;
  } {
    const albumEntries = Object.values(save.cardAlbum ?? {})
      .filter((e) => e && e.count > 0)
      .sort((a, b) => a.speciesId - b.speciesId)
      .filter((e) => {
        if (this.cardRarity === 'all') return true;
        return getEffectiveCardDef(save, e.speciesId).rarity === this.cardRarity;
      });

    const chestEntries = Object.values(save.cardChest ?? {})
      .filter((e) => e && e.count > 0)
      .sort((a, b) => a.speciesId - b.speciesId)
      .filter((e) => {
        if (this.cardRarity === 'all') return true;
        return getChestCardEffectiveDef(save, e.speciesId).rarity === this.cardRarity;
      });

    const activeHtml =
      albumEntries.length === 0
        ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyActiveCards}</div>`
        : albumEntries
            .map((entry) => {
              const id = entry.speciesId;
              const spec = getSpecies(id);
              const def = getEffectiveCardDef(save, id);
              const style = CARD_RARITY_STYLES[def.rarity];
              const avail = getAvailableCardCopies(save, id);
              const socketed = getSocketedCountForCard(save, id);
              const upgSuffix = def.upgradeLevel > 0 ? ` +${def.upgradeLevel}` : '';
              const metaLine = `${ES.cards.rarity[def.rarity]}${upgSuffix} · ${formatCardBonuses(def.bonuses)}`;
              const copyLine =
                socketed > 0
                  ? `Libres: ${avail}/${entry.count} (${socketed} engarzada)`
                  : `Copias: ${entry.count}`;

              return `
                <div class="px-card ${style.border} p-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <img src="${this.assets.getCreatureDataUrl(id, 'front')}" data-souldoll-id="${id}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${spec.name}" />
                    <div class="min-w-0">
                      <div class="font-bold text-xs text-porcelain truncate">#${String(id).padStart(2, '0')} ${spec.name}</div>
                      <div class="text-[11px] font-bold ${style.accent} truncate tabular-nums">${metaLine}</div>
                      <div class="text-[11px] text-bone-gray tabular-nums">${copyLine}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    ${
                      avail > 0
                        ? `<button data-card-dep-one="${id}" class="px-btn-success min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.housing.depositOne}</button>
                           ${
                             avail > 1
                               ? `<button data-card-dep-all="${id}" class="px-btn-primary min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.housing.depositAll}</button>`
                               : ''
                           }`
                        : `<span class="text-[11px] font-bold text-bone-gray px-2 whitespace-nowrap">${ES.housing.allSocketed}</span>`
                    }
                  </div>
                </div>
              `;
            })
            .join('');

    const chestHtml =
      chestEntries.length === 0
        ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyChestCards}</div>`
        : chestEntries
            .map((entry) => {
              const id = entry.speciesId;
              const spec = getSpecies(id);
              const def = getChestCardEffectiveDef(save, id);
              const style = CARD_RARITY_STYLES[def.rarity];
              const upgSuffix = def.upgradeLevel > 0 ? ` +${def.upgradeLevel}` : '';
              const metaLine = `${ES.cards.rarity[def.rarity]}${upgSuffix} · ${formatCardBonuses(def.bonuses)}`;
              return `
                <div class="px-card ${style.border} p-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
                  <div class="flex items-center gap-2 min-w-0 flex-1">
                    <img src="${this.assets.getCreatureDataUrl(id, 'front')}" data-souldoll-id="${id}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${spec.name}" />
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-xs text-porcelain truncate">#${String(id).padStart(2, '0')} ${spec.name}</span>
                        <span class="text-resonant-gold font-bold text-xs tabular-nums">×${entry.count}</span>
                      </div>
                      <div class="text-[11px] font-bold ${style.accent} truncate tabular-nums">${metaLine}</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1 shrink-0">
                    <button data-card-wd-one="${id}" class="px-btn-success min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.housing.withdrawOne}</button>
                    ${
                      entry.count > 1
                        ? `<button data-card-wd-all="${id}" class="px-btn-primary min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap">${ES.housing.withdrawAll}</button>`
                        : ''
                    }
                  </div>
                </div>
              `;
            })
            .join('');

    const activeTotal = albumEntries.reduce((s, e) => s + e.count, 0);
    const chestTotal = chestEntries.reduce((s, e) => s + e.count, 0);

    return {
      activeHtml,
      chestHtml,
      activeCountLabel: String(activeTotal),
      chestCountLabel: String(chestTotal),
    };
  }

  private buildSoulLists(save: SaveData): {
    activeHtml: string;
    chestHtml: string;
    activeCountLabel: string;
    chestCountLabel: string;
  } {
    const showReserve = this.soulFilter === 'all' || this.soulFilter === 'reserve';
    const showDolls = this.soulFilter === 'all' || this.soulFilter === 'dolls';

    const reserve = save.soulReserve ?? [];
    const chestSouls = save.soulChest ?? [];
    const party = save.party;
    const boxed: Array<{ boxIndex: number; boxName: string; slotIndex: number; doll: NonNullable<SaveData['storageBoxes'][number]['slots'][number]> }> = [];
    for (let b = 0; b < save.storageBoxes.length; b++) {
      const box = save.storageBoxes[b];
      for (let s = 0; s < box.slots.length; s++) {
        const mon = box.slots[s];
        if (mon) {
          boxed.push({ boxIndex: b, boxName: box.name, slotIndex: s, doll: mon });
        }
      }
    }

    const activeChunks: string[] = [];
    let activeCount = 0;

    if (showReserve && reserve.length > 0) {
      activeCount += reserve.length;
      activeChunks.push(
        `<div class="text-[11px] font-bold text-ki-cyan pt-0.5">Almas en Reserva (${reserve.length})</div>`
      );
      for (const soul of reserve) {
        const spec = getSpecies(soul.speciesId);
        activeChunks.push(`
          <div class="px-card p-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <img src="${this.assets.getCreatureDataUrl(soul.speciesId, 'front')}" data-souldoll-id="${soul.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${spec.name}" />
              <div class="min-w-0">
                <div class="font-bold text-xs text-porcelain truncate">Alma de ${spec.name}</div>
                <div class="text-[11px] text-bone-gray tabular-nums">${ES.party.lv}${soul.level} · Sin cuerpo</div>
              </div>
            </div>
            <button data-soul-dep="${soul.uid}" class="px-btn-success min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap">${ES.housing.storeSoul}</button>
          </div>
        `);
      }
    }

    if (showDolls && party.length > 0) {
      activeCount += party.length;
      const canDepositParty = party.length > 1;
      const boxName = save.storageBoxes[this.targetBoxIndex]?.name ?? 'Caja 1';
      activeChunks.push(
        `<div class="text-[11px] font-bold text-resonant-gold pt-1">SoulDolls en Equipo (${party.length}/${MAX_PARTY_SIZE})</div>`
      );
      party.forEach((mon, idx) => {
        const containerLabel = formatSoulContainerLabel(mon.containerId);
        activeChunks.push(`
          <div class="px-card p-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <img src="${this.assets.getCreatureDataUrl(mon.speciesId, 'front')}" data-souldoll-id="${mon.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${getCreatureDisplayName(mon)}" />
              <div class="min-w-0">
                <div class="font-bold text-xs text-porcelain truncate">${getCreatureDisplayName(mon)}</div>
                <div class="text-[11px] text-bone-gray tabular-nums truncate">${ES.party.lv}${mon.level} · ${mon.currentHp}/${mon.stats.hp} ${ES.party.hp}${containerLabel ? ` · ${containerLabel}` : ''}</div>
              </div>
            </div>
            ${
              canDepositParty
                ? `<button data-doll-dep="${idx}" class="px-btn-arcane min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap">${ES.housing.storeDoll} (${boxName})</button>`
                : `<span class="text-[11px] font-bold text-bone-gray px-2 shrink-0 whitespace-nowrap">${ES.housing.lastPartyBlock}</span>`
            }
          </div>
        `);
      });
    }

    const chestChunks: string[] = [];
    let chestCount = 0;

    if (showReserve && chestSouls.length > 0) {
      chestCount += chestSouls.length;
      chestChunks.push(
        `<div class="text-[11px] font-bold text-ki-cyan pt-0.5">Almas en el Cofre (${chestSouls.length})</div>`
      );
      for (const soul of chestSouls) {
        const spec = getSpecies(soul.speciesId);
        chestChunks.push(`
          <div class="px-card p-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <img src="${this.assets.getCreatureDataUrl(soul.speciesId, 'front')}" data-souldoll-id="${soul.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${spec.name}" />
              <div class="min-w-0">
                <div class="font-bold text-xs text-porcelain truncate">Alma de ${spec.name}</div>
                <div class="text-[11px] text-bone-gray tabular-nums">${ES.party.lv}${soul.level} · Guardada</div>
              </div>
            </div>
            <button data-soul-wd="${soul.uid}" class="px-btn-success min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap">${ES.housing.restoreSoul}</button>
          </div>
        `);
      }
    }

    if (showDolls && boxed.length > 0) {
      chestCount += boxed.length;
      const canWithdraw = party.length < MAX_PARTY_SIZE;
      chestChunks.push(
        `<div class="text-[11px] font-bold text-resonant-gold pt-1">SoulDolls en Cajas (${boxed.length})</div>`
      );
      for (const item of boxed) {
        const mon = item.doll;
        chestChunks.push(`
          <div class="px-card p-2 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <img src="${this.assets.getCreatureDataUrl(mon.speciesId, 'front')}" data-souldoll-id="${mon.speciesId}" data-souldoll-view="front" class="souldoll-img w-10 h-10 object-contain shrink-0" alt="${getCreatureDisplayName(mon)}" />
              <div class="min-w-0">
                <div class="font-bold text-xs text-porcelain truncate">${getCreatureDisplayName(mon)}</div>
                <div class="text-[11px] text-bone-gray tabular-nums truncate">${ES.party.lv}${mon.level} · ${item.boxName} · ${mon.currentHp}/${mon.stats.hp} ${ES.party.hp}</div>
              </div>
            </div>
            ${
              canWithdraw
                ? `<button data-doll-wd-box="${item.boxIndex}" data-doll-wd-slot="${item.slotIndex}" class="px-btn-arcane min-h-[44px] px-2.5 text-xs font-bold shrink-0 whitespace-nowrap">${ES.housing.restoreDoll}</button>`
                : `<span class="text-[11px] font-bold text-bone-gray px-2 shrink-0 whitespace-nowrap">${ES.housing.partyFullBlock}</span>`
            }
          </div>
        `);
      }
    }

    return {
      activeHtml:
        activeChunks.length === 0
          ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyActiveSouls}</div>`
          : activeChunks.join(''),
      chestHtml:
        chestChunks.length === 0
          ? `<div class="py-8 px-3 text-center text-xs text-bone-gray">${ES.housing.emptyChestSouls}</div>`
          : chestChunks.join(''),
      activeCountLabel: String(activeCount),
      chestCountLabel: String(chestCount),
    };
  }

  private bindEvents(
    save: SaveData,
    render: () => void,
    onClose: () => void,
    onChanged?: () => void
  ): void {
    this.root.querySelector('[data-chest-close]')?.addEventListener('click', () => {
      this.close();
      onClose();
    });

    this.root.querySelectorAll<HTMLElement>('[data-chest-section]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.section = btn.dataset.chestSection as ChestSection;
        this.notice = '';
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-mobile-pane]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.mobilePane = btn.dataset.mobilePane as MobilePane;
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-item-cat]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.itemCategory = btn.dataset.itemCat as ItemCatFilter;
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-card-rarity]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.cardRarity = btn.dataset.cardRarity as CardRarityFilter;
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-soul-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.soulFilter = btn.dataset.soulFilter as SoulFilter;
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-target-box]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.targetBoxIndex = Number(btn.dataset.targetBox);
        render();
      });
    });

    // Item transfers
    this.root.querySelectorAll<HTMLElement>('[data-item-dep-one]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemDepOne!;
        if (depositItemToChest(save, itemId, 1)) {
          this.notice = `Guardaste 1× ${getItem(itemId).name} en el cofre.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-item-dep-all]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemDepAll!;
        const slot = save.bag.find((s) => s.itemId === itemId);
        if (!slot || slot.quantity <= 0) return;
        const qty = slot.quantity;
        if (depositItemToChest(save, itemId, qty)) {
          this.notice = `Guardaste ${qty}× ${getItem(itemId).name} en el cofre.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-item-wd-one]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemWdOne!;
        if (withdrawItemFromChest(save, itemId, 1)) {
          this.notice = `Retiraste 1× ${getItem(itemId).name} a tu mochila.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-item-wd-all]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const itemId = btn.dataset.itemWdAll!;
        const slot = (save.itemChest ?? []).find((s) => s.itemId === itemId);
        if (!slot || slot.quantity <= 0) return;
        const qty = slot.quantity;
        if (withdrawItemFromChest(save, itemId, qty)) {
          this.notice = `Retiraste ${qty}× ${getItem(itemId).name} a tu mochila.`;
          onChanged?.();
          render();
        }
      });
    });

    // Card transfers
    this.root.querySelectorAll<HTMLElement>('[data-card-dep-one]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cardDepOne);
        const res = depositCardToChest(save, id, 1);
        if (res.ok) {
          this.notice = `Guardaste 1× Carta de ${getSpecies(id).name} en el cofre.`;
          onChanged?.();
        } else if (res.reason === 'socketed') {
          this.notice = 'Todas las copias están engarzadas; retira una antes de guardarla.';
        }
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-card-dep-all]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cardDepAll);
        const avail = getAvailableCardCopies(save, id);
        if (avail <= 0) return;
        const res = depositCardToChest(save, id, avail);
        if (res.ok) {
          this.notice = `Guardaste ${avail}× Carta de ${getSpecies(id).name} en el cofre.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-card-wd-one]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cardWdOne);
        const res = withdrawCardFromChest(save, id, 1);
        if (res.ok) {
          this.notice = `Retiraste 1× Carta de ${getSpecies(id).name} a tu álbum.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-card-wd-all]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.cardWdAll);
        const qty = save.cardChest?.[id]?.count ?? 0;
        if (qty <= 0) return;
        const res = withdrawCardFromChest(save, id, qty);
        if (res.ok) {
          this.notice = `Retiraste ${qty}× Carta de ${getSpecies(id).name} a tu álbum.`;
          onChanged?.();
          render();
        }
      });
    });

    // Unbound Soul transfers
    this.root.querySelectorAll<HTMLElement>('[data-soul-dep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.soulDep!;
        const soul = (save.soulReserve ?? []).find((s) => s.uid === uid);
        if (depositSoulToChest(save, uid)) {
          const name = soul ? getSpecies(soul.speciesId).name : 'SoulDoll';
          this.notice = `Guardaste el Alma de ${name} en el cofre.`;
          onChanged?.();
          render();
        }
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-soul-wd]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.soulWd!;
        const soul = (save.soulChest ?? []).find((s) => s.uid === uid);
        if (withdrawSoulFromChest(save, uid)) {
          const name = soul ? getSpecies(soul.speciesId).name : 'SoulDoll';
          this.notice = `Moviste el Alma de ${name} a tu reserva activa.`;
          onChanged?.();
          render();
        }
      });
    });

    // Bound SoulDoll transfers (Party <-> Storage Boxes)
    this.root.querySelectorAll<HTMLElement>('[data-doll-dep]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.dollDep);
        const target = save.party[idx];
        const res = depositPartySoulDollToBox(save, idx, this.targetBoxIndex);
        if (res.ok && res.boxIndex !== undefined) {
          const boxName = save.storageBoxes[res.boxIndex]?.name ?? `Caja ${res.boxIndex + 1}`;
          this.notice = `Guardaste a ${target ? getCreatureDisplayName(target) : 'tu SoulDoll'} en ${boxName}.`;
          onChanged?.();
        } else if (res.reason === 'last_party') {
          this.notice = ES.storage.errLastParty;
        } else if (res.reason === 'box_full') {
          this.notice = ES.storage.storageFull;
        }
        render();
      });
    });

    this.root.querySelectorAll<HTMLElement>('[data-doll-wd-box]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const boxIdx = Number(btn.dataset.dollWdBox);
        const slotIdx = Number(btn.dataset.dollWdSlot);
        const target = save.storageBoxes[boxIdx]?.slots[slotIdx];
        const res = withdrawBoxSoulDollToParty(save, boxIdx, slotIdx);
        if (res.ok) {
          this.notice = `Retiraste a ${target ? getCreatureDisplayName(target) : 'tu SoulDoll'} a tu equipo activo.`;
          onChanged?.();
        } else if (res.reason === 'party_full') {
          this.notice = ES.storage.errPartyFull;
        }
        render();
      });
    });
  }
}
