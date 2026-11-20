import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BAG_SORT_LABELS,
  filterAndSortBagEntries,
  getBagPartyCompatibility,
  getBagSummaryCounts,
  getBagTabSummaries,
  getNextBagSortMode,
  getVisibleBagPockets,
  type BagItemEntry,
  type BagPocketFilter,
  type BagScreenContext,
  type BagSortMode,
} from '../../domain/BagPresentation.ts';
import type { BagSlot } from '../../domain/types.ts';
import type { AssetProvider } from '../../gfx/AssetProvider.ts';
import { ES } from '../../i18n/es.ts';
import { PxTypeBadge } from './PxBadge.tsx';
import { PxButton } from './PxButton.tsx';
import { PxNotice } from './PxNotice.tsx';
import { PxPanel, PxPanelHeader } from './PxPanel.tsx';
import { PxSoulDustCounter } from './PxSoulDustCounter.tsx';

export interface BagViewProps {
  bag: readonly BagSlot[];
  inBattle: boolean;
  soulDust?: number;
  assets?: AssetProvider;
  context?: BagScreenContext;
  initialPocket?: BagPocketFilter;
  initialSelectedItemId?: string | null;
  onSelectionChange?: (pocket: BagPocketFilter, itemId: string | null) => void;
  onUseItem: (itemId: string) => void;
  onClose: () => void;
}

const READINESS_TEXT_CLASS: Record<'ready' | 'info' | 'muted', string> = {
  ready: 'text-neon-mint',
  info: 'text-ki-cyan',
  muted: 'text-bone-gray',
};

export const BagView: React.FC<BagViewProps> = ({
  bag,
  inBattle,
  soulDust = 0,
  assets,
  context,
  initialPocket = 'all',
  initialSelectedItemId = null,
  onSelectionChange,
  onUseItem,
  onClose,
}) => {
  const visiblePockets = useMemo(() => getVisibleBagPockets(inBattle), [inBattle]);
  const resolvedInitialPocket: BagPocketFilter = visiblePockets.includes(initialPocket)
    ? initialPocket
    : visiblePockets[0];

  const [pocket, setPocket] = useState<BagPocketFilter>(resolvedInitialPocket);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<BagSortMode>('default');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialSelectedItemId);
  const [mobileDetailExpanded, setMobileDetailExpanded] = useState(false);

  const tabSummaries = useMemo(() => getBagTabSummaries(bag, inBattle), [bag, inBattle]);
  const bagCounts = useMemo(() => getBagSummaryCounts(bag, inBattle), [bag, inBattle]);

  const entries = useMemo(
    () =>
      filterAndSortBagEntries(bag, {
        category: pocket,
        query,
        sort,
        inBattle,
        isWild: context?.isWild,
      }),
    [bag, pocket, query, sort, inBattle, context?.isWild]
  );

  const selectedEntry: BagItemEntry | null = useMemo(() => {
    if (entries.length === 0) return null;
    if (selectedItemId) {
      const match = entries.find((e) => e.item.id === selectedItemId);
      if (match) return match;
    }
    return entries[0];
  }, [entries, selectedItemId]);

  const activeItemId = selectedEntry?.item.id ?? null;
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onSelectionChange?.(pocket, activeItemId);
  }, [pocket, activeItemId, onSelectionChange]);

  useEffect(() => {
    if (!activeItemId || !listRef.current) return;
    const itemBtn = Array.from(
      listRef.current.querySelectorAll<HTMLButtonElement>('[data-bag-item]')
    ).find((el) => el.dataset.bagItem === activeItemId);
    itemBtn?.scrollIntoView({ block: 'nearest' });
  }, [activeItemId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inTextInput =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT';

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      if (inTextInput) return;

      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && entries.length > 0) {
        e.preventDefault();
        const curIdx = entries.findIndex((entry) => entry.item.id === activeItemId);
        const baseIdx = curIdx >= 0 ? curIdx : 0;
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const nextIdx = (baseIdx + delta + entries.length) % entries.length;
        setSelectedItemId(entries[nextIdx].item.id);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [entries, activeItemId, onClose]);

  const partyRows = useMemo(() => {
    if (!selectedEntry) return [];
    return getBagPartyCompatibility(selectedEntry.item, context?.party, {
      inBattle,
      activePartyIndex: context?.activePartyIndex,
    });
  }, [selectedEntry, context?.party, context?.activePartyIndex, inBattle]);

  const selectedIconUrl =
    selectedEntry && assets ? assets.getItemIconDataUrl(selectedEntry.item.id) : '';

  const subtitleText = useMemo(() => {
    const base = `${bagCounts.totalQuantity} uds · ${bagCounts.distinctCount} tipos`;
    if (inBattle) {
      return context?.isWild === false
        ? `${base} · Duelo contra Soultrainer`
        : `${base} · En combate`;
    }
    if (context?.repelSteps && context.repelSteps > 0) {
      return `${base} · Repelente: ${context.repelSteps} pasos`;
    }
    return base;
  }, [bagCounts, inBattle, context?.isWild, context?.repelSteps]);

  const handleClearFilters = () => {
    setQuery('');
    setPocket('all');
    setSort('default');
  };

  const renderPartyCompatibility = (entry: BagItemEntry) => {
    if (entry.item.category === 'capsule') {
      const catchInfo =
        context?.isWild === false
          ? 'Los Soulpots están bloqueados en duelos contra otros Soultrainers.'
          : inBattle
            ? `Listo para lanzar sobre la SoulDoll salvaje (multiplicador ×${(entry.item.catchMultiplier ?? 1).toFixed(1)}).`
            : 'Se lanza desde la Mochila durante encuentros salvajes en combate.';
      return (
        <div className="border-t border-ash-purple pt-2.5">
          <div className="text-[11px] font-bold text-pale-gold mb-1">Uso de Soulpot</div>
          <p className="text-xs leading-snug text-bone-gray">{catchInfo}</p>
        </div>
      );
    }

    if (entry.item.category === 'utility') {
      const utilityHint = entry.item.arGacha
        ? 'Abre el visor astral para escanear códigos QR o simular invocaciones.'
        : entry.item.repelSteps
          ? context?.repelSteps && context.repelSteps > 0
            ? `Repelente activo actual: ${context.repelSteps} pasos restantes.`
            : 'Evita encuentros salvajes durante los próximos 100 pasos.'
          : 'Regresa al instante a la plaza segura de Villa Origen.';
      return (
        <div className="border-t border-ash-purple pt-2.5">
          <div className="text-[11px] font-bold text-pale-gold mb-1">Efecto en exploración</div>
          <p className="text-xs leading-snug text-bone-gray">{utilityHint}</p>
        </div>
      );
    }

    if (partyRows.length === 0) return null;

    const sectionTitle = inBattle
      ? 'Objetivo en combate'
      : entry.item.category === 'tm'
        ? 'Compatibilidad en equipo'
        : entry.item.category === 'stone'
          ? 'Evolución en equipo'
          : entry.item.category === 'held'
            ? 'Ranuras equipables'
            : 'Estado del equipo';

    return (
      <div className="border-t border-ash-purple pt-2.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[11px] font-bold text-pale-gold">{sectionTitle}</span>
          {!inBattle && partyRows.some((r) => r.tone === 'ready') && (
            <span className="text-[11px] font-bold text-neon-mint tabular-nums">
              {partyRows.filter((r) => r.tone === 'ready').length} lista(s)
            </span>
          )}
        </div>
        <div className="space-y-1">
          {partyRows.map((row) => (
            <div
              key={`${row.partyIndex}-${row.speciesId}`}
              className="flex items-center justify-between gap-2 px-2 py-1 border border-ash-purple/80 bg-abyss-ink text-xs"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {assets && (
                  <img
                    src={assets.getCreatureDataUrl(row.speciesId, 'front')}
                    alt=""
                    className="souldoll-img w-5 h-5 object-contain shrink-0"
                  />
                )}
                <span className="font-bold text-porcelain truncate">{row.name}</span>
                <span className="text-[10px] text-bone-gray tabular-nums shrink-0">
                  Nv.{row.level}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-[11px] tabular-nums">
                <span className="text-bone-gray hidden sm:inline">
                  {row.currentHp}/{row.maxHp}
                </span>
                <span className={`font-bold ${READINESS_TEXT_CLASS[row.tone]}`}>
                  {row.readinessText}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInspectorBody = (entry: BagItemEntry) => {
    const previewFacts =
      entry.facts.length > 0
        ? entry.facts
        : [entry.categoryLabel];

    return (
      <>
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 border-2 border-old-bronze bg-abyss-ink flex items-center justify-center shrink-0">
            {selectedIconUrl ? (
              <img
                src={selectedIconUrl}
                alt={entry.item.name}
                className="pixel-canvas w-9 h-9 object-contain"
              />
            ) : (
              <span className="text-sm font-bold text-resonant-gold">◆</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-bold text-sm sm:text-base text-warm-white leading-tight">
                {entry.item.name}
              </h3>
              {entry.badgeType && <PxTypeBadge type={entry.badgeType} size="sm" />}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-bone-gray tabular-nums">
              <span>{entry.categoryLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="text-resonant-gold font-bold">En mochila: ×{entry.slot.quantity}</span>
              {entry.sellPrice > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Venta: {entry.sellPrice} ◈</span>
                </>
              )}
            </div>
          </div>
        </div>

        <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-porcelain">
          {entry.item.description}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs font-bold text-ki-cyan tabular-nums">
          {previewFacts.map((fact, idx) => (
            <React.Fragment key={fact}>
              {idx > 0 && (
                <span className="text-cold-stone font-normal" aria-hidden="true">
                  ·
                </span>
              )}
              <span>{fact}</span>
            </React.Fragment>
          ))}
        </div>

        {!entry.usable && entry.disabledReason && (
          <PxNotice tone="warning" className="mt-2.5 text-xs">
            {entry.disabledReason}
          </PxNotice>
        )}

        <div className="mt-2.5">{renderPartyCompatibility(entry)}</div>
      </>
    );
  };

  return (
    <PxPanel
      variant="gold"
      padding="md"
      ornate
      role="dialog"
      aria-modal="true"
      aria-label={ES.bag.title}
      data-testid="bag-modal"
      className="w-full max-w-4xl max-h-[calc(100dvh-1.25rem)] flex flex-col text-porcelain"
    >
      <PxPanelHeader
        title={ES.bag.title}
        subtitle={subtitleText}
        ornate
        className="mb-2 sm:mb-2.5 shrink-0"
        right={
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <div data-bag-soul-dust className="shrink-0">
                <PxSoulDustCounter amount={soulDust} compact showLabel />
              </div>
              {context?.money !== undefined && (
                <span
                  className="text-xs font-bold text-pale-gold tabular-nums whitespace-nowrap"
                  data-testid="bag-money"
                >
                  {context.money} ◈
                </span>
              )}
            </div>
            <PxButton variant="secondary" size="md" data-close onClick={onClose}>
              {ES.bag.back}
            </PxButton>
          </div>
        }
      />

      {/* Mobile resource strip so header subtitle never truncates on <640px screens */}
      <div className="sm:hidden flex items-center justify-between gap-2 pb-2 mb-2 border-b border-ash-purple/80 shrink-0">
        <div data-bag-soul-dust-mobile className="shrink-0">
          <PxSoulDustCounter amount={soulDust} compact showLabel />
        </div>
        {context?.money !== undefined && (
          <span className="text-xs font-bold text-pale-gold tabular-nums whitespace-nowrap">
            {context.money} ◈
          </span>
        )}
      </div>

      {/* Category Pockets */}
      <div
        role="tablist"
        aria-label="Categorías de la mochila"
        className="flex items-center gap-1.5 overflow-x-auto md:overflow-visible md:flex-wrap pb-1 mb-2.5 shrink-0"
      >
        {tabSummaries.map((tab) => {
          const active = tab.id === pocket;
          return (
            <PxButton
              key={tab.id}
              role="tab"
              aria-selected={active}
              data-cat={tab.id}
              variant={active ? 'primary' : 'secondary'}
              size="md"
              showSelector={false}
              onClick={() => setPocket(tab.id)}
              className="px-2.5 text-xs"
            >
              {active && (
                <span className="text-[9px] leading-none shrink-0" aria-hidden="true">
                  ◆
                </span>
              )}
              <span>{tab.label}</span>
              <span className="tabular-nums opacity-85">({tab.slotCount})</span>
            </PxButton>
          );
        })}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3 shrink-0">
        <div className="relative flex-1 min-w-0">
          <label htmlFor="bag-search-input" className="sr-only">
            Buscar objeto en la mochila
          </label>
          <input
            id="bag-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
            placeholder="Buscar objeto, técnica o efecto..."
            className="w-full min-h-[44px] bg-abyss-ink border-2 border-ash-purple focus:border-ki-cyan px-3 pr-10 text-xs sm:text-sm text-porcelain placeholder:text-cold-stone outline-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              aria-label="Limpiar búsqueda"
              onClick={() => setQuery('')}
              className="absolute right-1 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-xs font-bold text-bone-gray hover:text-warm-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
        <PxButton
          variant="ghost"
          size="md"
          showSelector={false}
          data-testid="bag-sort-btn"
          onClick={() => setSort((prev) => getNextBagSortMode(prev))}
          className="px-3.5 text-xs tabular-nums"
        >
          {BAG_SORT_LABELS[sort]}
        </PxButton>
      </div>

      {/* Master-Detail Workspace */}
      <div className="grid grid-cols-1 md:grid-cols-[1.12fr_0.88fr] gap-3 flex-1 min-h-0">
        {/* Left: Item List */}
        <div
          ref={listRef}
          className="touch-scroll overflow-y-auto pr-1 space-y-1.5 min-h-[140px]"
          data-testid="bag-item-list"
        >
          {entries.length === 0 ? (
            <div className="px-panel px-card p-6 text-center space-y-3">
              <div className="text-sm text-bone-gray">
                {query.trim().length > 0
                  ? `No se encontraron objetos para "${query.trim()}".`
                  : ES.bag.empty}
              </div>
              {(query.trim().length > 0 || pocket !== 'all') && bagCounts.distinctCount > 0 && (
                <PxButton variant="secondary" size="sm" onClick={handleClearFilters}>
                  Ver todos los objetos ({bagCounts.distinctCount})
                </PxButton>
              )}
            </div>
          ) : (
            entries.map((entry) => {
              const isSelected = selectedEntry?.item.id === entry.item.id;
              const iconUrl = assets ? assets.getItemIconDataUrl(entry.item.id) : '';
              const quickFact = entry.facts[0] ?? entry.item.description;

              return (
                <button
                  key={entry.item.id}
                  type="button"
                  data-bag-item={entry.item.id}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedItemId(entry.item.id)}
                  className={`w-full text-left flex items-center justify-between gap-2.5 p-2.5 min-h-[56px] border-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-ki-cyan bg-deep-abyss/45 shadow-[inset_0_1px_0_0_#5FE3D2,2px_2px_0_0_#050505]'
                      : 'border-ash-purple bg-crypt-ink hover:border-old-bronze'
                  } ${entry.usable ? '' : 'opacity-80'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={`w-10 h-10 border flex items-center justify-center shrink-0 bg-abyss-ink ${
                        isSelected ? 'border-ki-cyan' : 'border-ash-purple'
                      }`}
                    >
                      {iconUrl ? (
                        <img
                          src={iconUrl}
                          alt=""
                          className="pixel-canvas w-7 h-7 object-contain"
                        />
                      ) : (
                        <span className="text-xs text-resonant-gold">◆</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-bold text-sm text-porcelain truncate">
                          {entry.item.name}
                        </span>
                        {entry.badgeType && <PxTypeBadge type={entry.badgeType} size="chip" />}
                      </div>
                      <div className="text-[11px] text-bone-gray truncate tabular-nums mt-0.5">
                        {entry.categoryLabel} · {quickFact}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-resonant-gold tabular-nums">
                      ×{entry.slot.quantity}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right: Desktop Inspector Pane */}
        <aside
          aria-label="Detalles del objeto seleccionado"
          data-testid="bag-inspector"
          className="hidden md:flex flex-col min-h-0 border-2 border-ash-purple bg-crypt-ink p-3"
        >
          {selectedEntry ? (
            <>
              <div className="flex-1 min-h-0 touch-scroll overflow-y-auto pr-0.5">
                {renderInspectorBody(selectedEntry)}
              </div>
              <div className="mt-3 pt-2.5 border-t border-ash-purple shrink-0">
                <PxButton
                  variant={selectedEntry.usable ? 'success' : 'secondary'}
                  size="md"
                  fullWidth
                  disabled={!selectedEntry.usable}
                  data-use={selectedEntry.item.id}
                  onClick={() => onUseItem(selectedEntry.item.id)}
                >
                  {selectedEntry.actionLabel}
                </PxButton>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-bone-gray p-4">
              {bagCounts.distinctCount === 0
                ? 'Tu mochila está vacía. Visita la Tienda de Suministros o busca objetos en el mapa.'
                : 'Selecciona un objeto de la lista para ver sus efectos y compatibilidad.'}
            </div>
          )}
        </aside>
      </div>

      {/* Mobile Selected-Item Action Bar (Always reachable without scrolling) */}
      {selectedEntry && (
        <div
          className="md:hidden mt-2.5 pt-2.5 border-t-2 border-ash-purple shrink-0 space-y-2"
          data-testid="bag-mobile-bar"
        >
          {mobileDetailExpanded ? (
            <div className="max-h-[34dvh] touch-scroll overflow-y-auto border border-ash-purple bg-crypt-ink p-2.5">
              {renderInspectorBody(selectedEntry)}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-warm-white truncate">
                  {selectedEntry.item.name}{' '}
                  <span className="text-resonant-gold tabular-nums">
                    ×{selectedEntry.slot.quantity}
                  </span>
                </div>
                <div className="text-[11px] text-bone-gray line-clamp-2">
                  {selectedEntry.disabledReason ?? selectedEntry.item.description}
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 min-w-0">
            <PxButton
              variant="ghost"
              size="md"
              showSelector={false}
              onClick={() => setMobileDetailExpanded((v) => !v)}
              className="px-3 text-xs"
            >
              {mobileDetailExpanded ? 'Ocultar' : 'Detalles'}
            </PxButton>
            <div className="flex-1 min-w-0">
              <PxButton
                variant={selectedEntry.usable ? 'success' : 'secondary'}
                size="md"
                fullWidth
                disabled={!selectedEntry.usable}
                data-use-mobile={selectedEntry.item.id}
                onClick={() => onUseItem(selectedEntry.item.id)}
              >
                {selectedEntry.actionLabel}
              </PxButton>
            </div>
          </div>
        </div>
      )}
    </PxPanel>
  );
};

export default BagView;
