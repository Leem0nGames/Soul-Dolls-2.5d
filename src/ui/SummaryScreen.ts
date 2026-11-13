import { getBodyContainer, getSpeciesDollProfile } from '../data/containers.ts';
import { getItem } from '../data/items.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { TYPE_VISUALS } from '../data/types.ts';
import { getCreatureAbilityDef } from '../domain/Abilities.ts';
import { getCreatureDisplayName, xpForLevel } from '../domain/Creature.ts';
import { equipHeldItem, getHeldItemDef, unequipHeldItem } from '../domain/HeldItems.ts';
import type { BagSlot, CreatureInstance } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { renderDollIntegrityHtml } from './DollIntegrityView.ts';

export interface SummaryHeldConfig {
  bag: BagSlot[];
  onChanged?: () => void;
}

export class SummaryScreen {
  readonly root: HTMLDivElement;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-crypt-ink/90 p-3 safe-pad';
    parent.appendChild(this.root);
  }

  open(
    creature: CreatureInstance,
    onClose: () => void,
    heldConfig?: SummaryHeldConfig
  ): void {
    let pickingHeld = false;

    const render = () => {
      const spec = getSpecies(creature.speciesId);
      const ability = getCreatureAbilityDef(creature);
      const heldItem = getHeldItemDef(creature);
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

      const typeBadges = spec.types
        .map((t) => {
          const v = TYPE_VISUALS[t];
          return `<span class="px-2 py-0.5 rounded text-xs font-bold border" style="background:${v.bg};color:${v.color};border-color:${v.border}">${ES.types[t]}</span>`;
        })
        .join(' ');

      const movesHtml = creature.moves
        .map((slot) => {
          const m = getMove(slot.moveId);
          const v = TYPE_VISUALS[m.type];
          return `
            <div class="rounded-lg border border-ash-purple bg-crypt-ink p-2">
              <div class="flex items-center justify-between gap-2">
                <span class="font-bold text-sm text-porcelain">${m.name}</span>
                <span class="px-1.5 py-0.5 rounded text-[11px] font-bold" style="background:${v.bg};color:${v.color}">${ES.types[m.type]}</span>
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
             <button data-equip-open class="min-h-[40px] px-3 rounded-lg bg-oceanic-teal hover:bg-vibrant-aqua text-warm-white text-xs font-bold">${ES.summary.equipItem}</button>
             ${
               heldItem
                 ? `<button data-unequip class="min-h-[40px] px-3 rounded-lg bg-rosewood hover:bg-rift-crimson text-warm-white text-xs font-bold">${ES.summary.removeItem}</button>`
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
                          <button data-pick-held="${def.id}" class="w-full min-h-[48px] rounded-lg border border-ash-purple bg-crypt-ink hover:border-resonant-gold p-2 flex items-center gap-2.5 text-left">
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
                <div class="fixed inset-0 z-50 flex items-center justify-center bg-crypt-ink/85 p-3">
                  <div class="w-full max-w-md max-h-[80dvh] flex flex-col rounded-xl border-2 border-resonant-gold bg-smoked-wood p-3.5 text-porcelain shadow-2xl">
                    <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-2">
                      <span class="font-bold text-sm text-resonant-gold">${ES.summary.equipItem}</span>
                      <button data-pick-cancel class="min-h-[40px] px-3 rounded-lg border border-cold-stone bg-ash-purple text-xs font-bold">${ES.summary.back}</button>
                    </div>
                    <div class="touch-scroll overflow-y-auto space-y-1.5">${list}</div>
                  </div>
                </div>
              `;
            })()
          : '';

      this.root.innerHTML = `
        <div class="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] touch-scroll overflow-y-auto rounded-xl border-2 border-cold-stone bg-smoked-wood p-3.5 sm:p-4 text-porcelain shadow-2xl">
          <div class="flex items-center justify-between border-b border-ash-purple pb-2 mb-3">
            <div class="text-base font-bold text-resonant-gold">${ES.summary.title}</div>
            <button data-close class="min-h-[44px] px-4 rounded-lg border border-cold-stone bg-ash-purple text-sm font-bold hover:bg-cold-stone/40">${ES.summary.back}</button>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div class="flex flex-col gap-3">
              <div class="flex items-center gap-3 rounded-lg border border-ash-purple bg-crypt-ink p-3">
                <img src="${this.assets.getCreatureDataUrl(creature.speciesId, 'front')}" class="pixel-canvas w-20 h-20 object-contain" alt="${spec.name}" />
                <div>
                  <div class="text-lg font-bold">${getCreatureDisplayName(creature)}</div>
                  <div class="text-xs text-bone-gray tabular-nums">${ES.party.lv}${creature.level} · #${String(spec.id).padStart(2, '0')} · ${dollProfile.className}</div>
                  <div class="mt-1 flex gap-1">${typeBadges}</div>
                  <div class="mt-1 text-[11px] text-ki-cyan">Arma: ${dollProfile.weaponName}</div>
                  <div class="mt-0.5 text-xs text-bone-gray">${ES.status[creature.status]}</div>
                </div>
              </div>

              <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 text-xs space-y-2">
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
              </div>

              <div class="rounded-lg border border-ash-purple bg-crypt-ink p-3 text-xs space-y-1.5 tabular-nums">
                <div class="flex justify-between"><span>${ES.party.hp} Total</span><span>${creature.currentHp} / ${creature.stats.hp}</span></div>
                <div class="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 border-t border-ash-purple">
                  <div class="flex justify-between"><span>${ES.stats.atk}</span><span>${creature.stats.atk} <em class="text-bone-gray/75">(IV ${creature.ivs.atk})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.def}</span><span>${creature.stats.def} <em class="text-bone-gray/75">(IV ${creature.ivs.def})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spa}</span><span>${creature.stats.spa} <em class="text-bone-gray/75">(IV ${creature.ivs.spa})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spd}</span><span>${creature.stats.spd} <em class="text-bone-gray/75">(IV ${creature.ivs.spd})</em></span></div>
                  <div class="flex justify-between"><span>${ES.stats.spe}</span><span>${creature.stats.spe} <em class="text-bone-gray/75">(IV ${creature.ivs.spe})</em></span></div>
                </div>
                <div class="pt-1 border-t border-ash-purple">
                  <div class="flex justify-between mb-1"><span>${ES.summary.xp}</span><span>${creature.xp} / ${nextLvXp}</span></div>
                  <div class="h-2 w-full rounded bg-smoked-wood overflow-hidden">
                    <div class="h-full bg-ki-cyan" style="width:${expPct}%"></div>
                  </div>
                </div>
              </div>
              <div class="text-xs text-porcelain/90 leading-snug">${spec.description}</div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="text-xs font-bold uppercase tracking-wider text-bone-gray">${ES.summary.moves}</div>
              ${movesHtml}
            </div>
          </div>
          ${heldPickerModal}
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
