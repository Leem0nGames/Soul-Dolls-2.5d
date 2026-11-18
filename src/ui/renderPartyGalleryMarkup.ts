import { getBodyContainer, getSpeciesDollProfile } from '../data/containers.ts';
import { getSpecies } from '../data/species.ts';
import { getCreatureAbilityDef } from '../domain/Abilities.ts';
import { getContainerAffinityMatch } from '../domain/BodyParts.ts';
import { formatCardBonuses, getCardDef, getEffectiveCardDef } from '../domain/Cards.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { getHeldItemDef } from '../domain/HeldItems.ts';
import type { BagSlot, CreatureInstance, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ES } from '../i18n/es.ts';
import { renderTypeBadges } from './renderTypeBadge.ts';

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

export function renderPartyGalleryMarkup(
  party: readonly CreatureInstance[],
  mode: PartyMode,
  assets: Pick<AssetProvider, 'getCreatureDataUrl' | 'getItemIconDataUrl'>
): string {
  const canCancel = mode.kind !== 'switch' || mode.allowCancel;
  const aliveCount = party.filter((c) => c.currentHp > 0).length;
  const avgLevel =
    party.length > 0
      ? Math.round(party.reduce((acc, c) => acc + c.level, 0) / party.length)
      : 0;

  const cardsHtml =
    party.length === 0
      ? `<div class="px-panel px-card col-span-full text-center py-10 px-4 text-bone-gray text-sm">${ES.party.empty}</div>`
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
            const affinityMatch = getContainerAffinityMatch(c);
            const cal = c.vesselCalibration;
            const containerTags: string[] = [];
            if (cal?.temperLevel && cal.temperLevel > 0) {
              containerTags.push(`+${cal.temperLevel}`);
            }
            if (cal?.affinityOverride) {
              containerTags.push(`Runa ${ES.types[cal.affinityOverride]}`);
            }
            if (affinityMatch.level === 'full') {
              containerTags.push('Resonancia ★');
            } else if (affinityMatch.level === 'partial') {
              containerTags.push('Resonancia');
            }
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
            const slotNumber = `#${String(idx + 1).padStart(2, '0')}`;

            const stateBadge = isFainted
              ? `<span class="px-1.5 py-0.5 border border-rift-crimson bg-abyss-ink text-[10px] font-bold uppercase tracking-wider text-coral-red">${ES.party.fainted}</span>`
              : isActiveInBattle
                ? `<span class="px-1.5 py-0.5 border border-ki-cyan bg-abyss-ink text-[10px] font-bold uppercase tracking-wider text-ki-cyan">${ES.party.inBattle}</span>`
                : isLead
                  ? `<span class="px-1.5 py-0.5 border border-resonant-gold bg-abyss-ink text-[10px] font-bold uppercase tracking-wider text-resonant-gold">${ES.party.leadTag}</span>`
                  : '';

            const statusText =
              c.status !== 'none'
                ? `<span class="text-ethereal-orchid font-bold">${ES.statusShort[c.status]}</span>`
                : '';

            const switchLabel = isFainted
              ? ES.party.fainted
              : isActiveInBattle
                ? ES.party.inBattle
                : ES.party.sendOut;

            const actionButtonsHtml =
              mode.kind === 'manage'
                ? `
                  <button data-summary="${idx}" aria-label="${escapeHtml(`${ES.party.summary}: ${displayName}`)}" class="px-btn px-btn-secondary flex-1 min-h-[44px] px-3 py-2 text-xs font-bold whitespace-nowrap">${ES.party.summary}</button>
                  ${
                    idx > 0
                      ? `<button data-lead="${idx}" aria-label="${escapeHtml(`${ES.party.makeLead}: ${displayName}`)}" class="px-btn px-btn-arcane min-h-[44px] px-3 py-2 text-xs font-bold whitespace-nowrap">${ES.party.makeLead}</button>`
                      : ''
                  }
                `
                : mode.kind === 'switch'
                  ? `<button data-pick="${idx}" aria-label="${escapeHtml(`${switchLabel}: ${displayName}`)}" class="px-btn ${
                      isFainted || isActiveInBattle ? 'px-btn-secondary' : 'px-btn-success'
                    } w-full min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${switchLabel}</button>`
                  : `<button data-pick="${idx}" aria-label="${escapeHtml(`${ES.party.useItem}: ${displayName}`)}" class="px-btn px-btn-success w-full min-h-[44px] px-4 py-2 text-xs font-bold whitespace-nowrap">${ES.party.useItem}</button>`;

            const heldLine = heldItem
              ? `<div class="flex items-center gap-1.5 min-w-0">
                   <img src="${assets.getItemIconDataUrl(heldItem.id)}" class="pixel-canvas w-4 h-4 object-contain shrink-0" alt="" />
                   <span class="truncate text-porcelain">${escapeHtml(heldItem.name)}</span>
                 </div>`
              : `<span class="text-bone-gray">${ES.summary.noHeldItem}</span>`;

            const cardBorderCls = isFainted
              ? 'border-rift-crimson bg-dried-blood'
              : isActiveInBattle || isLead
                ? 'border-old-bronze bg-crypt-ink'
                : 'border-ash-purple bg-crypt-ink';

            return `
              <article data-party-slot="${idx}" class="px-panel px-card ${cardBorderCls} p-3 flex flex-col gap-2.5 min-w-0">
                <header class="flex items-start justify-between gap-2 pb-2 border-b border-ash-purple">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                      <span class="px-1.5 py-0.5 border border-ash-purple bg-abyss-ink text-[10px] font-bold text-bone-gray tabular-nums">${slotNumber}</span>
                      ${stateBadge}
                    </div>
                    <div class="font-bold text-sm text-warm-white truncate">${escapeHtml(displayName)}</div>
                    <div class="text-[11px] text-bone-gray truncate">${escapeHtml(dollProfile.className)}</div>
                  </div>
                  <div class="text-right shrink-0 text-xs font-bold text-resonant-gold tabular-nums">
                    ${ES.party.lv}${c.level}
                  </div>
                </header>

                <div class="px-panel px-hud-box p-2.5 flex items-center gap-3 min-w-0">
                  <div class="w-20 h-20 shrink-0 bg-abyss-ink border-2 border-ash-purple flex items-center justify-center p-1">
                    <img
                      src="${assets.getCreatureDataUrl(c.speciesId, 'front')}"
                      data-souldoll-id="${c.speciesId}"
                      data-souldoll-view="front"
                      class="souldoll-img w-16 h-16 object-contain block"
                      alt="${escapeHtml(displayName)}"
                    />
                  </div>
                  <div class="min-w-0 flex-1 space-y-1">
                    <div class="text-[11px] font-bold text-bone-gray tabular-nums truncate">
                      #${String(c.speciesId).padStart(2, '0')} · ${escapeHtml(spec.name)}
                    </div>
                    <div class="flex items-center gap-1 flex-wrap">${renderTypeBadges(spec.types, 'sm')}</div>
                    <div class="text-[11px] font-bold text-frosted-glass truncate">${escapeHtml(dollProfile.weaponName)}</div>
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between gap-2 text-[11px] tabular-nums mb-1">
                    <span class="font-bold text-porcelain">${ES.party.hp} ${c.currentHp}/${c.stats.hp} <span class="text-bone-gray font-normal">(${pct}%)</span></span>
                    ${statusText}
                  </div>
                  <div class="relative h-2.5 w-full rounded-none border border-ash-purple bg-ui-ink overflow-hidden">
                    <div class="h-full ${barColor}" style="width:${pct}%"></div>
                    <div class="pointer-events-none absolute inset-0 px-meter-segmented"></div>
                  </div>
                </div>

                <div class="grid grid-cols-4 gap-1 py-1.5 bg-abyss-ink border border-ash-purple text-center text-[11px] tabular-nums">
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
                    <span class="text-porcelain truncate">
                      ${escapeHtml(containerDef.name)}${
                        containerTags.length > 0
                          ? ` <em class="not-italic text-ki-cyan">(${escapeHtml(containerTags.join(' · '))})</em>`
                          : ''
                      }
                    </span>
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

                <footer class="mt-auto pt-1 flex flex-wrap gap-2">
                  ${actionButtonsHtml}
                </footer>
              </article>
            `;
          })
          .join('');

  return `
    <div class="px-panel px-panel-ornate w-full max-w-5xl max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-5 text-porcelain">
      <div class="shrink-0">
        <div class="flex items-start justify-between gap-2.5">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="text-xs leading-none text-resonant-gold" aria-hidden="true">◆</span>
              <h2 class="text-base sm:text-lg font-bold tracking-wide text-resonant-gold m-0 leading-snug">${
                mode.kind === 'switch' ? ES.party.chooseSwitch : ES.party.title
              }</h2>
            </div>
            <div class="text-xs text-bone-gray tabular-nums mt-0.5">
              ${ES.party.subtitle} · ${party.length}/6 en formación · ${aliveCount} listas${
                party.length > 0 ? ` · ${ES.party.lv} prom. ${avgLevel}` : ''
              }
            </div>
          </div>
          ${
            canCancel
              ? `<button data-close class="px-btn px-btn-secondary min-h-[44px] px-3.5 sm:px-4 py-2 text-sm font-bold whitespace-nowrap shrink-0">${ES.party.back}</button>`
              : ''
          }
        </div>
        <div class="px-divider mt-3" aria-hidden="true"></div>
        <div data-msg class="mt-2 mb-2 text-xs text-coral-red min-h-[1rem]"></div>
      </div>

      <div data-party-scroll class="flex-1 min-h-0 overflow-y-auto touch-scroll pr-1.5">
        <div data-party-gallery class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-3.5 px-0.5 pt-0.5 pb-1.5">
          ${cardsHtml}
        </div>
      </div>
    </div>
  `;
}
