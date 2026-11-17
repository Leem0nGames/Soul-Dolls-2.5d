import React from 'react';

export type PxProgressTone =
  | 'hp'
  | 'xp'
  | 'stamina'
  | 'cyan'
  | 'gold'
  | 'violet'
  | 'crimson'
  | 'emerald';

export type PxProgressHeight = 'xs' | 'sm' | 'md';

export interface PxProgressBarProps {
  value: number;
  max: number;
  ghostValue?: number;
  tone?: PxProgressTone;
  height?: PxProgressHeight;
  segmented?: boolean;
  label?: React.ReactNode;
  valueText?: React.ReactNode;
  ariaLabel?: string;
  lowPulse?: boolean;
  className?: string;
}

const HEIGHT_CLASSES: Record<PxProgressHeight, string> = {
  xs: 'h-[4px]',
  sm: 'h-[8px]',
  md: 'h-2.5',
};

function resolveFillClass(tone: PxProgressTone, pct: number): string {
  if (tone === 'hp') {
    return pct > 50 ? 'bg-ui-success' : pct > 20 ? 'bg-ui-warning' : 'bg-ui-danger';
  }
  if (tone === 'stamina') {
    return pct <= 25 ? 'bg-rift-crimson' : pct <= 55 ? 'bg-resonant-gold' : 'bg-ki-cyan';
  }
  if (tone === 'xp' || tone === 'cyan') return 'bg-ki-cyan';
  if (tone === 'gold') return 'bg-resonant-gold';
  if (tone === 'violet') return 'bg-soul-violet';
  if (tone === 'crimson') return 'bg-rift-crimson';
  return 'bg-emerald-base';
}

export const PxProgressBar: React.FC<PxProgressBarProps> = ({
  value,
  max,
  ghostValue,
  tone = 'cyan',
  height = 'sm',
  segmented = true,
  label,
  valueText,
  ariaLabel,
  lowPulse = false,
  className = '',
}) => {
  const safeMax = Math.max(1, max);
  const clamped = Math.max(0, Math.min(safeMax, value));
  const pct = Math.max(0, Math.min(100, Math.round((clamped / safeMax) * 100)));
  const ghostPct =
    ghostValue !== undefined
      ? Math.max(pct, Math.min(100, Math.round((Math.max(0, ghostValue) / safeMax) * 100)))
      : undefined;
  const fillClass = resolveFillClass(tone, pct);

  return (
    <div className={className}>
      {(label || valueText) && (
        <div className="flex items-center justify-between gap-2 text-[10px] font-bold tracking-wider uppercase mb-1">
          <span className="text-bone-gray">{label}</span>
          {valueText && <span className="text-porcelain tabular-nums">{valueText}</span>}
        </div>
      )}
      <div
        className={`relative w-full rounded-none border border-cold-stone bg-abyss-ink shadow-[inset_0_1px_0_#050505] overflow-hidden ${HEIGHT_CLASSES[height]}`}
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuenow={Math.round(clamped)}
      >
        {ghostPct !== undefined && (
          <div
            className="absolute inset-y-0 left-0 bg-pale-gold transition-[width] duration-700 ease-out delay-150"
            style={{ width: `${ghostPct}%` }}
          />
        )}
        <div
          className={`relative h-full ${fillClass} transition-[width] duration-300 ease-out ${
            lowPulse && pct > 0 && pct <= 20 ? 'battle-low-hp' : ''
          }`}
          style={{ width: `${pct}%` }}
        />
        {segmented && (
          <div
            className="pointer-events-none absolute inset-0 px-meter-segmented"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
};

export default PxProgressBar;
