import React from 'react';
import { TYPE_VISUALS } from '../../data/types.ts';
import type { CreatureType } from '../../domain/types.ts';
import { ES } from '../../i18n/es.ts';

export type PxBadgeTone =
  | 'gold'
  | 'cyan'
  | 'violet'
  | 'crimson'
  | 'emerald'
  | 'warning'
  | 'danger'
  | 'neutral';

export type PxBadgeSize = 'xs' | 'sm' | 'md';

export interface PxBadgeProps {
  tone?: PxBadgeTone;
  size?: PxBadgeSize;
  uppercase?: boolean;
  className?: string;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<PxBadgeTone, string> = {
  gold: 'border-resonant-gold bg-dark-oak text-pale-gold',
  cyan: 'border-ki-cyan bg-deep-abyss text-frosted-glass',
  violet: 'border-ethereal-orchid bg-royal-purple text-lavender-mist',
  crimson: 'border-rift-crimson bg-dried-blood text-pale-rose',
  emerald: 'border-neon-mint bg-forest-green text-warm-white',
  warning: 'border-ui-warning bg-dark-oak text-pale-gold',
  danger: 'border-ui-danger bg-dried-blood text-warm-white',
  neutral: 'border-cold-stone bg-crypt-ink text-porcelain',
};

const SIZE_CLASSES: Record<PxBadgeSize, string> = {
  xs: 'px-1 py-[1px] text-[9px] leading-none',
  sm: 'px-1.5 py-0.5 text-[10px] leading-none',
  md: 'px-2 py-0.5 text-xs leading-tight',
};

export const PxBadge: React.FC<PxBadgeProps> = ({
  tone = 'neutral',
  size = 'sm',
  uppercase = false,
  className = '',
  children,
}) => (
  <span
    className={`inline-flex items-center gap-1 rounded-none border font-bold whitespace-nowrap shrink-0 ${
      TONE_CLASSES[tone]
    } ${SIZE_CLASSES[size]} ${uppercase ? 'uppercase tracking-wider' : ''} ${className}`}
  >
    {children}
  </span>
);

export interface PxTypeBadgeProps {
  type: CreatureType;
  size?: 'chip' | 'sm' | 'move' | 'md';
  className?: string;
}

const TYPE_SIZE_CLASSES: Record<NonNullable<PxTypeBadgeProps['size']>, string> = {
  chip: 'px-1 py-[1px] text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wider leading-none',
  sm: 'px-1.5 py-0.5 text-[10px] font-bold leading-none',
  move: 'px-1.5 py-0.5 text-[11px] font-bold leading-none',
  md: 'px-2 py-0.5 text-xs font-bold leading-none',
};

export const PxTypeBadge: React.FC<PxTypeBadgeProps> = ({
  type,
  size = 'md',
  className = '',
}) => {
  const v = TYPE_VISUALS[type];
  return (
    <span
      className={`inline-flex items-center rounded-none border whitespace-nowrap shrink-0 ${TYPE_SIZE_CLASSES[size]} ${className}`}
      style={{
        backgroundColor: v.bg,
        color: v.color,
        borderColor: v.border,
      }}
    >
      {ES.types[type]}
    </span>
  );
};

export default PxBadge;
