import { getBodyContainer } from '../data/containers.ts';
import {
  ALL_BLUEPRINT_IDS,
  ensureSaveSideQuestState,
  getBlueprint,
  getSideQuestProgress,
  getSideQuestStatus,
  SIDE_QUESTS,
  type SideQuestDef,
  type SideQuestStatus,
} from '../domain/SideQuests.ts';
import type { SaveData } from '../domain/types.ts';
import { ES } from '../i18n/es.ts';
import { ModalOverlay } from './ModalOverlay.ts';

type JournalFilter = 'all' | 'active' | 'completed' | 'locked';

export class QuestJournalModal extends ModalOverlay {
  private filter: JournalFilter = 'all';

  constructor(parent: HTMLElement) {
    super(parent);
  }

  open(save: SaveData, onClose: () => void): void {
    ensureSaveSideQuestState(save);

    const render = () => {
      ensureSaveSideQuestState(save);
      const ownedBlueprints = save.blueprints ?? [];

      const entries = SIDE_QUESTS.map((quest) => {
        const status = getSideQuestStatus(quest, save);
        const progress = getSideQuestProgress(quest, save);
        return { quest, status, progress };
      });

      const activeGroupCount = entries.filter(
        (e) => e.status === 'active' || e.status === 'available'
      ).length;
      const completedCount = entries.filter((e) => e.status === 'completed').length;
      const lockedCount = entries.filter((e) => e.status === 'locked').length;

      const filtered = entries.filter((e) => {
        if (this.filter === 'all') return true;
        if (this.filter === 'active') {
          return e.status === 'active' || e.status === 'available';
        }
        if (this.filter === 'completed') return e.status === 'completed';
        return e.status === 'locked';
      });

      const filters: Array<{ id: JournalFilter; label: string }> = [
        { id: 'all', label: `Todas (${entries.length})` },
        { id: 'active', label: `Activas (${activeGroupCount})` },
        { id: 'completed', label: `Completadas (${completedCount})` },
        { id: 'locked', label: `Bloqueadas (${lockedCount})` },
      ];

      const filterBtns = filters
        .map(
          (f) =>
            `<button data-qfilter="${f.id}" class="min-h-[44px] px-2.5 text-xs font-bold whitespace-nowrap ${
              this.filter === f.id ? 'px-btn-primary' : 'px-btn-secondary'
            }">${f.label}</button>`
        )
        .join('');

      const blueprintsChips =
        ownedBlueprints.length > 0
          ? `<div class="mb-3 rounded-none border-2 border-ash-purple bg-smoked-wood p-2">
              <div class="text-[10px] font-bold uppercase tracking-wider text-resonant-gold mb-1">Planos desbloqueados (${ownedBlueprints.length}/${ALL_BLUEPRINT_IDS.length}) · Forja en Cuerpos</div>
              <div class="flex flex-wrap gap-1.5">
                ${ownedBlueprints
                  .map((bpId) => {
                    const bp = getBlueprint(bpId);
                    return `<span class="rounded-none border border-ki-cyan bg-deep-abyss px-2 py-0.5 text-[10px] font-bold text-frosted-glass">${bp.name} (${bp.craftGoldCost} ◈)</span>`;
                  })
                  .join('')}
              </div>
            </div>`
          : '';

      const cardsHtml =
        filtered.length === 0
          ? `<div class="px-card p-6 text-center text-xs text-bone-gray">No hay misiones secundarias en esta categoría.</div>`
          : filtered
              .map((entry) => this.renderQuestCard(entry.quest, entry.status, entry.progress))
              .join('');

      this.root.innerHTML = `
        <div class="px-panel w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col p-3.5 sm:p-4 text-porcelain">
          <div class="flex items-center justify-between gap-2 border-b-2 border-ash-purple pb-2 mb-3">
            <div>
              <div class="font-bold text-resonant-gold">DIARIO DE MISIONES</div>
              <div class="text-xs text-bone-gray tabular-nums">
                Oro: <span class="text-pale-gold font-bold">${save.money} ◈</span> · Completadas: ${completedCount}/${entries.length} · Planos: ${ownedBlueprints.length}/${ALL_BLUEPRINT_IDS.length}
              </div>
            </div>
            <button data-qclose class="px-btn-secondary min-h-[44px] px-4 text-sm font-bold whitespace-nowrap">Cerrar</button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-3">
            ${filterBtns}
          </div>

          ${blueprintsChips}

          <div class="touch-scroll overflow-y-auto space-y-2.5 pr-0.5">
            ${cardsHtml}
          </div>
        </div>
      `;

      this.root.querySelector('[data-qclose]')?.addEventListener('click', () => {
        this.close();
        onClose();
      });

      this.root.querySelectorAll<HTMLElement>('[data-qfilter]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.filter = btn.dataset.qfilter as JournalFilter;
          render();
        });
      });
    };

    this.showOverlay();
    render();
  }

  private renderQuestCard(
    quest: SideQuestDef,
    status: SideQuestStatus,
    progress: ReturnType<typeof getSideQuestProgress>
  ): string {
    const mapLabel = ES.maps[quest.mapId] ?? quest.mapId;
    const bp = getBlueprint(quest.rewardBlueprintId);
    const targetContainer = getBodyContainer(bp.containerId);

    let badgeLabel = '';
    let badgeClass = '';
    let borderClass = 'border-ash-purple';

    if (status === 'completed') {
      badgeLabel = 'COMPLETADA';
      badgeClass = 'border-neon-mint bg-deep-abyss text-neon-mint';
      borderClass = 'border-emerald-shadow';
    } else if (status === 'active' && progress.ready) {
      badgeLabel = '¡ENTREGAR (?)!';
      badgeClass = 'border-resonant-gold bg-deep-abyss text-pale-gold';
      borderClass = 'border-resonant-gold';
    } else if (status === 'active') {
      badgeLabel = 'ACTIVA';
      badgeClass = 'border-ki-cyan bg-deep-abyss text-ki-cyan';
      borderClass = 'border-ki-cyan';
    } else if (status === 'available') {
      badgeLabel = 'DISPONIBLE (!)';
      badgeClass = 'border-resonant-gold bg-smoked-wood text-resonant-gold';
      borderClass = 'border-resonant-gold';
    } else {
      badgeLabel = 'BLOQUEADA';
      badgeClass = 'border-cold-stone bg-abyss-ink text-cold-stone';
      borderClass = 'border-ash-purple';
    }

    const pct =
      progress.target > 0
        ? Math.min(100, Math.round((progress.current / progress.target) * 100))
        : 0;

    let statusSectionHtml = '';
    if (status === 'locked') {
      statusSectionHtml = `
        <div class="rounded-none border border-ash-purple bg-abyss-ink px-2.5 py-1.5 text-[11px] text-bone-gray">
          <span class="font-bold text-cold-stone uppercase">Requisito:</span> ${
            quest.unlockRequirementText ?? 'Avanza en tu aventura para desbloquear esta misión.'
          }
        </div>
      `;
    } else if (status === 'available') {
      statusSectionHtml = `
        <div class="rounded-none border border-resonant-gold bg-abyss-ink px-2.5 py-1.5 text-[11px] text-pale-gold">
          Habla con <span class="font-bold">${quest.giverName}</span> en <span class="font-bold">${mapLabel}</span> (icono <span class="font-bold">!</span>) para aceptar.
        </div>
      `;
    } else if (status === 'active') {
      statusSectionHtml = `
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="${progress.ready ? 'text-pale-gold font-bold' : 'text-ice-cyan font-bold'}">
              ${
                progress.ready
                  ? `¡Objetivo listo! Vuelve con ${quest.giverName} (${mapLabel})`
                  : progress.label
              }
            </span>
            <span class="tabular-nums text-bone-gray font-bold">${progress.current}/${progress.target}</span>
          </div>
          <div class="h-2 w-full rounded-none border border-ash-purple bg-abyss-ink overflow-hidden">
            <div class="h-full ${progress.ready ? 'bg-resonant-gold' : 'bg-ki-cyan'}" style="width:${pct}%"></div>
          </div>
        </div>
      `;
    } else {
      statusSectionHtml = `
        <div class="text-[11px] font-bold text-neon-mint">
          ✓ Recompensa cobrada ante ${quest.giverName} (${mapLabel})
        </div>
      `;
    }

    return `
      <div class="px-card ${borderClass} p-3 space-y-2 ${status === 'locked' ? 'opacity-80' : ''}">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <div class="text-sm font-bold text-porcelain">${quest.title}</div>
            <div class="text-[11px] text-bone-gray">
              NPC: <span class="text-porcelain font-semibold">${quest.giverName}</span> · ${mapLabel}
            </div>
          </div>
          <span class="shrink-0 rounded-none border px-2 py-0.5 text-[10px] font-bold tracking-wider ${badgeClass}">
            ${badgeLabel}
          </span>
        </div>

        <p class="text-xs leading-relaxed text-bone-gray">
          ${status === 'locked' ? 'Misión aún bloqueada. Cumple el requisito inferior para revelarla.' : quest.description}
        </p>

        ${statusSectionHtml}

        <div class="rounded-none border border-ash-purple bg-smoked-wood px-2.5 py-2 text-[11px] space-y-0.5">
          <div class="font-bold uppercase tracking-wider text-[10px] text-resonant-gold">Recompensa</div>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-porcelain">
            <span class="font-bold text-pale-gold tabular-nums">+${quest.rewardGold} Oro (◈)</span>
            <span class="text-ki-cyan font-bold">${bp.name}</span>
          </div>
          <div class="text-[10px] text-bone-gray">
            Plano de crafteo para forjar <span class="text-porcelain font-semibold">${targetContainer.name}</span> (${bp.craftGoldCost} Oro) en Cuerpos.
          </div>
        </div>
      </div>
    `;
  }
}
