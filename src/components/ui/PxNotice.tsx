import React from 'react';

export type PxNoticeTone = 'info' | 'success' | 'warning' | 'danger';

export interface PxNoticeProps {
  tone?: PxNoticeTone;
  className?: string;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<PxNoticeTone, string> = {
  info: 'border-ki-cyan bg-deep-abyss text-frosted-glass',
  success: 'border-neon-mint bg-forest-green text-warm-white',
  warning: 'border-resonant-gold bg-dark-oak text-pale-gold',
  danger: 'border-rift-crimson bg-dried-blood text-pale-rose',
};

export const PxNotice: React.FC<PxNoticeProps> = ({
  tone = 'info',
  className = '',
  children,
}) => (
  <div
    className={`rounded-none border-2 px-2.5 py-1.5 text-xs font-bold shadow-[2px_2px_0_#050505] ${TONE_CLASSES[tone]} ${className}`}
    role="status"
  >
    {children}
  </div>
);

export default PxNotice;
