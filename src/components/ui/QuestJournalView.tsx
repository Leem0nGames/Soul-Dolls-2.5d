import React, { useMemo, useState } from 'react';
import { getBodyContainer } from '../../data/containers.ts';
import { MAPS } from '../../data/maps/index.ts';
import {
  clampQuestIndex,
  getActiveQuest,
  MAIN_QUESTS,
  resolveQuestNavTarget,
  type QuestDef,
} from '../../domain/Quests.ts';
import {
  ALL_BLUEPRINT_IDS,
  ensureSaveSideQuestState,
  getBlueprint,
  getSideQuestProgress,
  getSideQuestStatus,
  SIDE_QUESTS,
  type SideQuestDef,
  type SideQuestStatus,
} from '../../domain/SideQuests.ts';
import type { MapDef, SaveData } from '../../domain/types.ts';
import { ES } from '../../i18n/es.ts';
import { PxBadge } from './PxBadge.tsx';
import { PxButton } from './PxButton.tsx';
import { PxPanel, PxPanelHeader } from './PxPanel.tsx';
import { PxProgressBar } from './PxProgressBar.tsx';
import { PxTabs, type PxTabItem } from './PxTabs.tsx';

export type QuestJournalTab = 'en_curso' | 'historia' | 'secundarias';
export type SideQuestFilter = 'all' | 'active' | 'completed' | 'locked';

export interface QuestNavContext {
  map: MapDef;
  x: number;
  y: number;
}

export interface QuestJournalViewProps {
  save: SaveData;
  navContext?: QuestNavContext;
  initialTab?: QuestJournalTab;
  onClose: () => void;
}

export const QuestJournalView: React.FC<QuestJournalViewProps> = ({
  save,
  navContext,
  initialTab = 'en_curso',
  onClose,
}) => {
  ensureSaveSideQuestState(save);

  const [tab, setTab] = useState<QuestJournalTab>(initialTab);
  const [filter, setFilter] = useState<SideQuestFilter>('all');

  const questIdx = clampQuestIndex(save.questIndex);
  const activeMain = getActiveQuest(questIdx);
  const ownedBlueprints = save.blueprints ?? [];

  const sideEntries = useMemo(
    () =>
      SIDE_QUESTS.map((quest) => ({
        quest,
        status: getSideQuestStatus(quest, save),
        progress: getSideQuestProgress(quest, save),
      })),
    [save]
  );

  const completedSideCount = sideEntries.filter((e) => e.status === 'completed').length;
  const activeOrAvailSide = sideEntries.filter(
    (e) => e.status === 'active' || e.status === 'available'
  );
  const lockedSideCount = sideEntries.filter((e) => e.status === 'locked').length;

  const filteredSide = useMemo(() => {
    if (filter === 'all') return sideEntries;
    if (filter === 'active') return activeOrAvailSide;
    if (filter === 'completed') return sideEntries.filter((e) => e.status === 'completed');
    return sideEntries.filter((e) => e.status === 'locked');
  }, [sideEntries, activeOrAvailSide, filter]);

  const activeNavLine = useMemo(() => {
    if (!activeMain) return 'Todos los capítulos principales completados.';
    if (navContext) {
      const nav = resolveQuestNavTarget(
        activeMain,
        navContext.map,
        navContext.x,
        navContext.y,
        MAPS
      );
      const viaLabel = ES.maps[nav.viaMapId] ?? nav.viaMapId;
      const steps = Math.max(0, Math.round(nav.distance));
      return nav.isCrossMap
        ? `Ruta brújula: Hacia ${viaLabel} (${Math.round(nav.x)}, ${Math.round(nav.y)}) · ${steps} pasos`
        : `Destino directo: ${viaLabel} (${activeMain.targetX}, ${activeMain.targetY}) · ${steps} pasos`;
    }
    const mapLabel = ES.maps[activeMain.targetMapId] ?? activeMain.targetMapId;
    return `Destino: ${mapLabel} (${activeMain.targetX}, ${activeMain.targetY})`;
  }, [activeMain, navContext]);

  const tabs: PxTabItem<QuestJournalTab>[] = [
    { id: 'en_curso', label: 'En Curso' },
    { id: 'historia', label: `Historia (${questIdx}/${MAIN_QUESTS.length})` },
    { id: 'secundarias', label: `Secundarias (${completedSideCount}/${SIDE_QUESTS.length})` },
  ];

  const renderActiveMainCard = () => {
    if (!activeMain) {
      return (
        <PxPanel variant="cyan" padding="sm" className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-ki-cyan uppercase tracking-wider">
              Historia Principal Completada
            </span>
            <PxBadge tone="emerald" size="xs">
              {MAIN_QUESTS.length}/{MAIN_QUESTS.length}
            </PxBadge>
          </div>
          <div className="text-xs text-porcelain">
            Has recorrido todos los enclaves principales desde Villa Origen hasta la Arena Cumbre.
          </div>
        </PxPanel>
      );
    }

    return (
      <PxPanel variant="card" padding="sm" className="border-resonant-gold space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-widest text-resonant-gold tabular-nums">
              Brújula Activa · Misión Principal {questIdx + 1}/{MAIN_QUESTS.length}
            </div>
            <div className="text-sm font-bold text-warm-white mt-0.5">{activeMain.title}</div>
          </div>
          <PxBadge tone="gold" size="xs">
            ACTIVA
          </PxBadge>
        </div>

        <div className="text-xs text-porcelain leading-relaxed">{activeMain.objective}</div>

        <div className="text-[11px] font-bold text-ice-cyan tabular-nums">{activeNavLine}</div>

        <PxProgressBar
          value={questIdx}
          max={MAIN_QUESTS.length}
          tone="gold"
          height="sm"
          ariaLabel="Progreso de historia principal"
          label="Capítulos"
          valueText={`${questIdx}/${MAIN_QUESTS.length}`}
        />
      </PxPanel>
    );
  };

  const renderMainChapterCard = (q: QuestDef, index: number) => {
    const done = index < questIdx;
    const current = index === questIdx;
    const mapLabel = ES.maps[q.targetMapId] ?? q.targetMapId;

    return (
      <PxPanel
        key={q.id}
        variant="card"
        padding="sm"
        className={`space-y-1.5 ${
          done
            ? 'border-emerald-base'
            : current
              ? 'border-resonant-gold bg-dark-oak'
              : 'border-ash-purple opacity-80'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold text-porcelain truncate">
              {index + 1}. {q.title}
            </div>
            <div className="text-[11px] text-bone-gray">
              Zona: <span className="text-ice-cyan">{mapLabel}</span> · Coord ({q.targetX}, {q.targetY})
            </div>
          </div>
          <PxBadge tone={done ? 'emerald' : current ? 'gold' : 'neutral'} size="xs">
            {done ? 'COMPLETADA' : current ? 'ACTUAL' : 'PENDIENTE'}
          </PxBadge>
        </div>
        <div className="text-xs text-porcelain leading-snug">{q.objective}</div>
      </PxPanel>
    );
  };

  const renderEnCursoTab = () => (
    <div className="space-y-3">
      {renderActiveMainCard()}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-bold uppercase tracking-wider text-ki-cyan">
            Misiones Secundarias Activas y Disponibles ({activeOrAvailSide.length})
          </span>
          <span className="text-[11px] text-bone-gray tabular-nums">
            Planos: {ownedBlueprints.length}/{ALL_BLUEPRINT_IDS.length}
          </span>
        </div>

        {activeOrAvailSide.length === 0 ? (
          <PxPanel variant="card" padding="sm" className="text-xs text-bone-gray text-center">
            No tienes encargos secundarios activos ahora mismo. Revisa la pestaña Secundarias para ver requisitos.
          </PxPanel>
        ) : (
          activeOrAvailSide.map((entry) => (
            <SideQuestCard
              key={entry.quest.id}
              quest={entry.quest}
              status={entry.status}
              progress={entry.progress}
            />
          ))
        )}
      </div>
    </div>
  );

  const renderHistoriaTab = () => (
    <div className="space-y-2">
      {renderActiveMainCard()}
      <div className="space-y-2 pt-1">
        {MAIN_QUESTS.map((q, idx) => renderMainChapterCard(q, idx))}
      </div>
    </div>
  );

  const renderSecundariasTab = () => {
    const filters: Array<{ id: SideQuestFilter; label: string }> = [
      { id: 'all', label: `Todas (${sideEntries.length})` },
      { id: 'active', label: `Activas (${activeOrAvailSide.length})` },
      { id: 'completed', label: `Completadas (${completedSideCount})` },
      { id: 'locked', label: `Bloqueadas (${lockedSideCount})` },
    ];

    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {filters.map((f) => (
            <PxButton
              key={f.id}
              variant={filter === f.id ? 'primary' : 'secondary'}
              size="sm"
              showSelector={false}
              onClick={() => setFilter(f.id)}
              className="whitespace-nowrap"
            >
              {f.label}
            </PxButton>
          ))}
        </div>

        {ownedBlueprints.length > 0 && (
          <div className="rounded-none border-2 border-ash-purple bg-smoked-wood p-2.5 space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-resonant-gold tabular-nums">
              Planos desbloqueados ({ownedBlueprints.length}/{ALL_BLUEPRINT_IDS.length}) · Forja en el Taller
            </div>
            <div className="text-[11px] text-frosted-glass leading-relaxed">
              {ownedBlueprints
                .map((bpId) => {
                  const bp = getBlueprint(bpId);
                  return `${bp.name} (${bp.craftGoldCost} ◈)`;
                })
                .join(' · ')}
            </div>
          </div>
        )}

        {filteredSide.length === 0 ? (
          <PxPanel variant="card" padding="md" className="text-center text-xs text-bone-gray">
            No hay misiones secundarias en esta categoría.
          </PxPanel>
        ) : (
          <div className="space-y-2">
            {filteredSide.map((entry) => (
              <SideQuestCard
                key={entry.quest.id}
                quest={entry.quest}
                status={entry.status}
                progress={entry.progress}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <PxPanel
      variant="gold"
      padding="md"
      ornate
      className="w-full max-w-2xl max-h-[calc(100dvh-1.5rem)] flex flex-col text-porcelain"
    >
      <PxPanelHeader
        title="DIARIO DE MISIONES"
        ornate
        subtitle={`Historia: ${questIdx}/${MAIN_QUESTS.length} · Secundarias: ${completedSideCount}/${SIDE_QUESTS.length} · Planos: ${ownedBlueprints.length}/${ALL_BLUEPRINT_IDS.length} · Oro: ${save.money} ◈`}
        right={
          <PxButton variant="secondary" size="md" onClick={onClose}>
            Cerrar
          </PxButton>
        }
      />

      <PxTabs
        items={tabs}
        value={tab}
        onChange={setTab}
        columns={3}
        size="sm"
        className="mb-3"
      />

      <div className="touch-scroll overflow-y-auto pr-0.5 flex-1">
        {tab === 'en_curso' && renderEnCursoTab()}
        {tab === 'historia' && renderHistoriaTab()}
        {tab === 'secundarias' && renderSecundariasTab()}
      </div>
    </PxPanel>
  );
};

interface SideQuestCardProps {
  quest: SideQuestDef;
  status: SideQuestStatus;
  progress: ReturnType<typeof getSideQuestProgress>;
}

const SideQuestCard: React.FC<SideQuestCardProps> = ({ quest, status, progress }) => {
  const mapLabel = ES.maps[quest.mapId] ?? quest.mapId;
  const bp = getBlueprint(quest.rewardBlueprintId);
  const targetContainer = getBodyContainer(bp.containerId);

  let badgeLabel = 'BLOQUEADA';
  let badgeTone: 'emerald' | 'gold' | 'cyan' | 'neutral' = 'neutral';
  let borderCls = 'border-ash-purple';

  if (status === 'completed') {
    badgeLabel = 'COMPLETADA';
    badgeTone = 'emerald';
    borderCls = 'border-emerald-base';
  } else if (status === 'active' && progress.ready) {
    badgeLabel = '¡ENTREGAR (?)!';
    badgeTone = 'gold';
    borderCls = 'border-resonant-gold';
  } else if (status === 'active') {
    badgeLabel = 'ACTIVA';
    badgeTone = 'cyan';
    borderCls = 'border-ki-cyan';
  } else if (status === 'available') {
    badgeLabel = 'DISPONIBLE (!)';
    badgeTone = 'gold';
    borderCls = 'border-resonant-gold';
  }

  return (
    <PxPanel
      variant="card"
      padding="sm"
      className={`${borderCls} space-y-2 ${status === 'locked' ? 'opacity-80' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-porcelain">{quest.title}</div>
          <div className="text-[11px] text-bone-gray">
            NPC: <span className="text-porcelain font-semibold">{quest.giverName}</span> · {mapLabel}
          </div>
        </div>
        <PxBadge tone={badgeTone} size="xs">
          {badgeLabel}
        </PxBadge>
      </div>

      <p className="text-xs leading-relaxed text-bone-gray m-0">
        {status === 'locked'
          ? 'Misión aún bloqueada. Cumple el requisito inferior para revelarla.'
          : quest.description}
      </p>

      {status === 'locked' && (
        <div className="rounded-none border border-ash-purple bg-abyss-ink px-2.5 py-1.5 text-[11px] text-bone-gray">
          <span className="font-bold text-cold-stone uppercase">Requisito:</span>{' '}
          {quest.unlockRequirementText ?? 'Avanza en tu aventura para desbloquear esta misión.'}
        </div>
      )}

      {status === 'available' && (
        <div className="rounded-none border border-resonant-gold bg-abyss-ink px-2.5 py-1.5 text-[11px] text-pale-gold">
          Habla con <span className="font-bold">{quest.giverName}</span> en{' '}
          <span className="font-bold">{mapLabel}</span> (icono <span className="font-bold">!</span>) para aceptar.
        </div>
      )}

      {status === 'active' && (
        <PxProgressBar
          value={progress.current}
          max={Math.max(1, progress.target)}
          tone={progress.ready ? 'gold' : 'cyan'}
          height="sm"
          ariaLabel={`Progreso de ${quest.title}`}
          label={
            progress.ready
              ? `¡Objetivo listo! Vuelve con ${quest.giverName} (${mapLabel})`
              : progress.label
          }
          valueText={`${progress.current}/${progress.target}`}
        />
      )}

      {status === 'completed' && (
        <div className="text-[11px] font-bold text-neon-mint">
          ✓ Recompensa cobrada ante {quest.giverName} ({mapLabel})
        </div>
      )}

      <div className="rounded-none border border-ash-purple bg-smoked-wood px-2.5 py-2 text-[11px] space-y-0.5">
        <div className="font-bold uppercase tracking-wider text-[10px] text-resonant-gold">
          Recompensa
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-porcelain tabular-nums">
          <span className="font-bold text-pale-gold">+{quest.rewardGold} Oro (◈)</span>
          <span className="text-ki-cyan font-bold">{bp.name}</span>
        </div>
        <div className="text-[10px] text-bone-gray">
          Plano de crafteo para forjar <span className="text-porcelain font-semibold">{targetContainer.name}</span> ({bp.craftGoldCost} Oro) en el Taller.
        </div>
      </div>
    </PxPanel>
  );
};

export default QuestJournalView;
