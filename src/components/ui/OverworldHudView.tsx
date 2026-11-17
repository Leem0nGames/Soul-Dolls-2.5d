import React from 'react';
import { PALETTE } from '../../gfx/Palette.ts';
import { PxButton } from './PxButton.tsx';
import { PxPanel } from './PxPanel.tsx';
import { PxProgressBar } from './PxProgressBar.tsx';

export interface OverworldHudViewProps {
  locationLine: string;
  timeLabel?: string;
  staminaCurrent: number;
  staminaMax: number;
  staminaExhausted: boolean;
  questCollapsed: boolean;
  questComplete: boolean;
  questStepLabel: string;
  questTitle: string;
  questObjective: string;
  questTargetLabel: string;
  questDistShort: string;
  questDistLong: string;
  arrowAngleDeg: number;
  journalBadgeText: string;
  journalBadgeTone: 'ready' | 'available' | 'active' | 'done';
  onToggleQuest: () => void;
  onOpenJournal: () => void;
}

const JOURNAL_STATUS_TEXT_TONE: Record<OverworldHudViewProps['journalBadgeTone'], string> = {
  ready: 'text-ki-cyan',
  available: 'text-pale-gold',
  active: 'text-ice-cyan',
  done: 'text-neon-mint',
};

export const OverworldHudView: React.FC<OverworldHudViewProps> = ({
  locationLine,
  timeLabel,
  staminaCurrent,
  staminaMax,
  staminaExhausted,
  questCollapsed,
  questComplete,
  questStepLabel,
  questTitle,
  questObjective,
  questTargetLabel,
  questDistShort,
  questDistLong,
  arrowAngleDeg,
  journalBadgeText,
  journalBadgeTone,
  onToggleQuest,
  onOpenJournal,
}) => {
  const pct = Math.max(
    0,
    Math.min(100, Math.round((staminaCurrent / Math.max(1, staminaMax)) * 100))
  );
  const staminaValueCls =
    staminaExhausted || pct <= 25
      ? 'text-coral-red'
      : pct <= 55
        ? 'text-resonant-gold'
        : 'text-ki-cyan';

  return (
    <div className="flex flex-col items-start gap-1.5 w-full">
      {/* Location & Stamina HUD Card */}
      <PxPanel variant="hud" padding="xs" className="pointer-events-none w-full">
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs font-bold text-porcelain truncate">{locationLine}</div>
          {timeLabel && (
            <span className="text-[10px] font-bold text-pale-gold tabular-nums shrink-0">
              {timeLabel}
            </span>
          )}
        </div>
        <div className="mt-1.5 pt-1 border-t border-ash-purple">
          <PxProgressBar
            value={staminaExhausted ? Math.max(0, staminaCurrent) : staminaCurrent}
            max={staminaMax}
            tone={staminaExhausted ? 'crimson' : 'stamina'}
            height="md"
            ariaLabel="Estamina"
            label="Estamina"
            valueText={
              <span className={staminaValueCls}>
                {staminaExhausted ? 'AGOTADA' : `${pct}%`}
              </span>
            }
          />
        </div>
      </PxPanel>

      {/* Unified Quest Tracker: Compass Arrow + Objective + Journal Trigger */}
      <PxPanel variant="hud" padding="none" className="pointer-events-auto w-full">
        <button
          type="button"
          aria-expanded={!questCollapsed}
          aria-label="Alternar detalles de misión"
          onClick={(e) => {
            e.stopPropagation();
            onToggleQuest();
          }}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-left rounded-none bg-crypt-ink hover:bg-smoked-wood active:bg-ash-purple cursor-pointer select-none"
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 shrink-0 rounded-none border border-ash-purple bg-abyss-ink flex items-center justify-center">
              <svg
                viewBox="0 0 16 16"
                width={16}
                height={16}
                shapeRendering="crispEdges"
                className="block"
                style={{
                  transform: questComplete
                    ? 'rotate(0deg)'
                    : `rotate(${arrowAngleDeg.toFixed(1)}deg)`,
                }}
              >
                {questComplete ? (
                  <polygon
                    points="4,8 7,11 13,4 14,6 7,13 3,9"
                    fill={PALETTE.kiCyan}
                    stroke={PALETTE.uiInk}
                    strokeWidth="1"
                  />
                ) : (
                  <polygon
                    points="8,1 14,9 10,9 10,15 6,15 6,9 2,9"
                    fill={PALETTE.resonantGold}
                    stroke={PALETTE.uiInk}
                    strokeWidth="1"
                  />
                )}
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div
                className={`text-[9px] font-bold tracking-widest uppercase leading-none ${
                  questComplete ? 'text-ki-cyan' : 'text-resonant-gold'
                }`}
              >
                {questStepLabel}
              </div>
              <div className="text-[11px] font-bold text-porcelain truncate leading-tight mt-0.5">
                {questTitle}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-ki-cyan tabular-nums">
              {questDistShort}
            </span>
            <span className="text-[10px] font-bold text-bone-gray">
              {questCollapsed ? '▶' : '▼'}
            </span>
          </div>
        </button>

        {!questCollapsed && (
          <div className="px-2.5 pb-2 pt-1.5 border-t border-ash-purple">
            <div className="text-[11px] leading-snug text-porcelain">{questObjective}</div>
            <div className="mt-1 flex items-center justify-between gap-2 text-[9px] font-bold uppercase tracking-wider">
              <span className="text-ice-cyan truncate">{questTargetLabel}</span>
              <span className="text-bone-gray tabular-nums shrink-0">{questDistLong}</span>
            </div>
          </div>
        )}

        <div className="border-t border-ash-purple bg-abyss-ink px-2 py-1 flex items-center justify-between gap-2">
          <span
            className={`text-[10px] font-bold tabular-nums truncate ${JOURNAL_STATUS_TEXT_TONE[journalBadgeTone]}`}
          >
            Secundarias · {journalBadgeText}
          </span>
          <PxButton
            variant="primary"
            size="xs"
            showSelector={false}
            aria-label="Abrir Diario de Misiones"
            onClick={(e) => {
              e.stopPropagation();
              onOpenJournal();
            }}
            className="min-h-[30px] px-2.5 shrink-0 whitespace-nowrap"
          >
            Diario
          </PxButton>
        </div>
      </PxPanel>
    </div>
  );
};

export default OverworldHudView;
