import React from 'react';
import { PALETTE } from '../../gfx/Palette.ts';
import { ES } from '../../i18n/es.ts';

export const PxSoulDustIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 8 8"
    className={`${className} shrink-0 pixel-canvas`}
    shapeRendering="crispEdges"
    aria-hidden="true"
  >
    <rect x="3" y="0" width="2" height="1" fill={PALETTE.lavenderMist} />
    <rect x="2" y="1" width="4" height="1" fill={PALETTE.ghostViolet} />
    <rect x="1" y="2" width="2" height="2" fill={PALETTE.etherealOrchid} />
    <rect x="3" y="2" width="2" height="3" fill={PALETTE.soulViolet} />
    <rect x="5" y="2" width="2" height="2" fill={PALETTE.arcaneLilac} />
    <rect x="2" y="4" width="4" height="2" fill={PALETTE.arcaneLilac} />
    <rect x="3" y="6" width="2" height="1" fill={PALETTE.royalPurple} />
    <rect x="1" y="6" width="1" height="1" fill={PALETTE.ghostViolet} />
    <rect x="6" y="1" width="1" height="1" fill={PALETTE.lavenderMist} />
  </svg>
);

export interface PxSoulDustCounterProps {
  amount: number;
  compact?: boolean;
  showLabel?: boolean;
  className?: string;
}

export const PxSoulDustCounter: React.FC<PxSoulDustCounterProps> = ({
  amount,
  compact = false,
  showLabel = true,
  className = '',
}) => {
  const safeAmount = Math.max(0, Math.floor(amount));
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-none border-2 border-soul-violet bg-crypt-ink ${
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1 text-xs'
      } font-bold text-ghost-violet shadow-[inset_0_2px_0_0_#3C1C6E,2px_2px_0_0_#050505] tabular-nums whitespace-nowrap shrink-0 ${className}`}
      title={ES.cards.soulDustLabel}
    >
      <PxSoulDustIcon className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
      {showLabel && (
        <>
          <span className="text-bone-gray font-semibold hidden sm:inline">
            {ES.cards.soulDustLabel}:
          </span>
          <span className="text-bone-gray font-semibold sm:hidden">
            {ES.cards.soulDustShort}:
          </span>
        </>
      )}
      <span className="text-lavender-mist font-black">{safeAmount}</span>
    </div>
  );
};

export default PxSoulDustCounter;
