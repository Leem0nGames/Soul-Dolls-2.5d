import { ABILITIES } from '../data/abilities.ts';
import { ITEMS } from '../data/items.ts';
import { getMove } from '../data/moves.ts';
import { ALL_SPECIES_IDS, getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import {
  getBestiaryCounts,
  getBestiaryEntry,
  getSpeciesEncounterLocations,
  getSpeciesHabitats,
} from '../domain/Bestiary.ts';
import type { EvolutionRule, SaveData, StatName } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { AnimatedSoulDollView } from './components/AnimatedSoulDollView.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

type BestiaryFilter = 'all' | 'caught' | 'seen' | 'unseen';

const STAT_ORDER: readonly StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

function formatEvoRule(rule: EvolutionRule): string {
  const targetName = getSpecies(rule.targetSpeciesId).name;
  switch (rule.method) {
    case 'level':
      return ES.bestiary.evoLevel(rule.level, targetName);
    case 'item':
      return ES.bestiary.evoItem(ITEMS[rule.itemId]?.name ?? rule.itemId, targetName);
    case 'knows_move':
      return ES.bestiary.evoMove(getMove(rule.moveId).name, targetName);
    case 'level_held':
      return ES.bestiary.evoLevelHeld(
        rule.level,
        ITEMS[rule.itemId]?.name ?? rule.itemId,
        targetName
      );
  }
}

export class BestiaryScreen {
  readonly root: HTMLDivElement;
  private filter: BestiaryFilter = 'all';
  private selectedId: number | null = null;
  private unbindImages: (() => void) | null = null;
  private activeAnimView: AnimatedSoulDollView | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-crypt-ink/90 p-3 safe-pad';
    parent.appendChild(this.root);
  }

  open(save: SaveData, onClose: () => void): void {
    this.selectedId = null;

    const render = () => {
      const counts = getBestiaryCounts(save);

      if (this.selectedId !== null) {
        this.renderDetail(save, this.selectedId, () => {
          this.selectedId = null;
          render();
        });
        return;
      }

      const filters: Array<{ id: BestiaryFilter; label: string }> = [
        { id: 'all', label: ES.bestiary.filterAll },
        { id: 'caught', label: ES.bestiary.filterCaught },
        { id: 'seen', label: ES.bestiary.filterSeen },
        { id: 'unseen', label: ES.bestiary.filterUnseen },
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

      const filteredIds = ALL_SPECIES_IDS.filter((id) => {
        const entry = getBestiaryEntry(save.bestiary, id);
        const st =
          entry.state !== 'unseen'
            ? entry.state
            : save.caughtSpecies.includes(id)
              ? 'caught'
              : save.seenSpecies.includes(id)
                ? 'seen'
                : 'unseen';
        if (this.filter === 'all') return true;
        if (this.filter === 'caught') return st === 'caught';
        if (this.filter === 'seen') return st === 'seen' || st === 'caught';
        return st === 'unseen';
      });

      const cardsHtml = filteredIds
        .map((id) => {
          const entry = getBestiaryEntry(save.bestiary, id);
          const caught = entry.state === 'caught' || save.caughtSpecies.includes(id);
          const seen = caught || entry.state === 'seen' || save.seenSpecies.includes(id);
          const spec = getSpecies(id);
          const imgSrc = seen
            ? this.assets.getCreatureDataUrl(id, 'front')
            : this.assets.getCreatureSilhouetteDataUrl(id);
          const typesHtml = seen
            ? spec.types
                .map((t) => {
                  const v = TYPE_VISUALS[t];
                  return `<span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="background:${v.bg};color:${v.color}">${ES.types[t]}</span>`;
                })
                .join(' ')
            : '';

          return `
            <button data-species="${id}" class="text-left rounded-lg border ${
              caught
                ? 'border-resonant-gold/80 bg-crypt-ink'
                : seen
                  ? 'border-cold-stone bg-crypt-ink'
                  : 'border-ash-purple bg-crypt-ink/70'
            } hover:border-ki-cyan p-2 flex items-center gap-2.5 min-h-[64px]">
              <img src="${imgSrc}" data-souldoll-id="${id}" data-souldoll-view="${seen ? 'front' : 'silhouette'}" class="souldoll-img w-12 h-12 object-contain shrink-0 ${
                seen ? '' : 'opacity-70'
              }" alt="${seen ? spec.name : ES.bestiary.unknown}" />
              <div class="min-w-0 flex-1">
                <div class="text-[11px] text-bone-gray tabular-nums">#${String(id).padStart(2, '0')} ${caught ? '<span class="text-resonant-gold">★</span>' : ''}</div>
                <div class="font-bold text-sm truncate ${seen ? 'text-porcelain' : 'text-cold-stone'}">${seen ? spec.name : ES.bestiary.unknown}</div>
                <div class="mt-0.5 flex flex-wrap gap-1">${typesHtml}</div>
              </div>
            </button>
          `;
        })
        .join('');

      this.root.innerHTML = `
        <div class="w-full max-w-3xl max-h-[calc(100dvh-1.5rem)] flex flex-col rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3 gap-2">
            <div>
              <div class="font-bold text-resonant-gold">${ES.bestiary.title}</div>
              <div class="text-xs text-bone-gray tabular-nums">${ES.bestiary.seen}: ${counts.seen}/${counts.total} · ${ES.bestiary.caught}: ${counts.caught}/${counts.total}</div>
            </div>
            <button data-close class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.bestiary.back}</button>
          </div>
          <div class="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5 mb-3">${filterBtns}</div>
          <div class="touch-scroll overflow-y-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pr-1">
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
          this.filter = btn.dataset.filter as BestiaryFilter;
          render();
        });
      });

      this.root.querySelectorAll<HTMLElement>('[data-species]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.selectedId = Number(btn.dataset.species);
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

  private renderDetail(save: SaveData, speciesId: number, onBack: () => void): void {
    const spec = getSpecies(speciesId);
    const entry = getBestiaryEntry(save.bestiary, speciesId);
    const caught = entry.state === 'caught' || save.caughtSpecies.includes(speciesId);
    const seen = caught || entry.state === 'seen' || save.seenSpecies.includes(speciesId);

    if (!seen) {
      this.root.innerHTML = `
        <div class="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-4">
            <div class="font-bold text-bone-gray tabular-nums">#${String(speciesId).padStart(2, '0')} · ${ES.bestiary.unknown}</div>
            <button data-back class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold">${ES.bestiary.back}</button>
          </div>
          <div class="flex flex-col items-center py-6 gap-4 text-center">
            <img src="${this.assets.getCreatureSilhouetteDataUrl(speciesId)}" data-souldoll-id="${speciesId}" data-souldoll-view="silhouette" class="souldoll-img w-28 h-28 object-contain opacity-80" alt="${ES.bestiary.unknown}" />
            <p class="text-sm text-bone-gray">${ES.bestiary.unseenDetail}</p>
          </div>
        </div>
      `;
      this.root.querySelector('[data-back]')?.addEventListener('click', onBack);
      return;
    }

    const typeBadges = spec.types
      .map((t) => {
        const v = TYPE_VISUALS[t];
        return `<span class="px-2 py-0.5 rounded text-xs font-bold border" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
      })
      .join(' ');

    const statBars = STAT_ORDER.map((stat) => {
      const val = spec.baseStats[stat];
      const pct = Math.min(100, Math.round((val / 150) * 100));
      return `
        <div class="flex items-center gap-2 text-xs tabular-nums">
          <span class="w-8 font-bold text-bone-gray">${ES.stats[stat]}</span>
          <span class="w-8 text-right font-bold">${val}</span>
          <div class="flex-1 h-2 rounded bg-smoked-wood overflow-hidden">
            <div class="h-full bg-resonant-gold" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');

    const abilitiesHtml = spec.abilities
      .map((abId) => {
        const ab = ABILITIES[abId];
        if (!ab) return '';
        return `<div class="rounded border border-ash-purple bg-smoked-wood/80 px-2 py-1 text-xs"><span class="font-bold text-ki-cyan">${ab.name}:</span> <span class="text-porcelain">${ab.description}</span></div>`;
      })
      .join('');

    const habitats = getSpeciesHabitats(speciesId);
    const habitatsText =
      habitats.length > 0
        ? habitats.map((h) => ES.habitats[h]).join(', ')
        : ES.bestiary.noLocations;

    const locations = getSpeciesEncounterLocations(speciesId);
    const locationsText =
      locations.length > 0
        ? locations.map((m) => ES.maps[m] ?? m).join(', ')
        : ES.bestiary.noLocations;

    const evosHtml =
      spec.evolutions.length > 0
        ? spec.evolutions.map((r) => `<div class="text-xs text-neon-mint">${formatEvoRule(r)}</div>`).join('')
        : `<div class="text-xs text-bone-gray">${ES.bestiary.noEvolutions}</div>`;

    this.root.innerHTML = `
      <div class="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-4 text-porcelain shadow-2xl">
        <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
          <div class="font-bold text-resonant-gold tabular-nums">#${String(speciesId).padStart(2, '0')} · ${spec.name} ${caught ? '★' : ''}</div>
          <button data-back class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold">${ES.bestiary.back}</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="space-y-3">
            <div class="flex items-center gap-3 rounded-lg border border-ash-purple bg-crypt-ink p-3">
              <div data-anim-portrait class="w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center"></div>
              <div>
                <div class="text-lg font-bold">${spec.name}</div>
                <div class="mt-1 flex gap-1">${typeBadges}</div>
                <div class="mt-2 text-xs text-bone-gray space-y-0.5 tabular-nums">
                  ${entry.firstLocation ? `<div>${ES.bestiary.firstFound}: <span class="text-porcelain">${entry.firstLocation}</span></div>` : ''}
                  <div>${ES.bestiary.timesCaught}: <span class="text-porcelain">${entry.timesCaught}</span></div>
                  ${entry.highestLevel > 0 ? `<div>${ES.bestiary.highestLv}: <span class="text-porcelain">${entry.highestLevel}</span></div>` : ''}
                </div>
              </div>
            </div>

            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 text-xs text-porcelain leading-relaxed">
              ${spec.description}
            </div>

            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 space-y-1.5">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.bestiary.baseStats}</div>
              ${statBars}
            </div>
          </div>

          <div class="space-y-3">
            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 space-y-1.5">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.bestiary.abilities}</div>
              ${abilitiesHtml}
            </div>

            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 space-y-1 text-xs">
              <div class="font-bold uppercase tracking-wider text-bone-gray">${ES.bestiary.habitats}</div>
              <div class="text-porcelain">${habitatsText}</div>
              <div class="pt-2 font-bold uppercase tracking-wider text-bone-gray">${ES.bestiary.locations}</div>
              <div class="text-porcelain">${locationsText}</div>
            </div>

            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 space-y-1">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.bestiary.evolutions}</div>
              ${evosHtml}
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.querySelector('[data-back]')?.addEventListener('click', onBack);

    this.activeAnimView?.dispose();
    this.activeAnimView = new AnimatedSoulDollView(this.assets, speciesId, 'front', 84);
    this.root.querySelector('[data-anim-portrait]')?.replaceChildren(this.activeAnimView.root);
  }

  close(): void {
    this.activeAnimView?.dispose();
    this.activeAnimView = null;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.activeAnimView?.dispose();
    this.activeAnimView = null;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.remove();
  }
}
