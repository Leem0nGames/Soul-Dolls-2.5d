import React from 'react';

export type PxPanelVariant = 'gold' | 'violet' | 'crimson' | 'cyan' | 'hud' | 'card';
export type PxPanelPadding = 'none' | 'xs' | 'sm' | 'md' | 'lg';
export type PxPanelElement = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'main';

export interface PxPanelProps extends React.HTMLAttributes<HTMLElement> {
  variant?: PxPanelVariant;
  padding?: PxPanelPadding;
  ornate?: boolean;
  scrollable?: boolean;
  as?: PxPanelElement;
  children?: React.ReactNode;
}

const VARIANT_CLASSES: Record<PxPanelVariant, string> = {
  gold: 'px-panel',
  violet: 'px-panel px-panel-violet',
  crimson: 'px-panel px-panel-crimson',
  cyan: 'px-panel px-panel-cyan',
  hud: 'px-panel px-hud-box',
  card: 'px-panel px-card',
};

const PADDING_CLASSES: Record<PxPanelPadding, string> = {
  none: '',
  xs: 'px-2.5 py-1.5',
  sm: 'p-2.5 sm:p-3',
  md: 'p-3.5 sm:p-4',
  lg: 'p-4 sm:p-5',
};

export const PxPanel: React.FC<PxPanelProps> = ({
  variant = 'gold',
  padding = 'md',
  ornate = false,
  scrollable = false,
  as = 'div',
  className = '',
  children,
  ...rest
}) => {
  const Tag = as;
  const classes = [
    VARIANT_CLASSES[variant],
    ornate ? 'px-panel-ornate' : '',
    PADDING_CLASSES[padding],
    scrollable ? 'touch-scroll overflow-y-auto' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      className={classes}
      data-px-panel={variant}
      data-px-ornate={ornate ? 'true' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
};

export interface PxPanelHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  ornate?: boolean;
  className?: string;
}

export const PxPanelHeader: React.FC<PxPanelHeaderProps> = ({
  title,
  subtitle,
  right,
  ornate = false,
  className = '',
}) => (
  <div className={`mb-3 ${className}`}>
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="font-bold text-resonant-gold tracking-wide truncate flex items-center gap-1.5">
          {ornate && (
            <span className="text-[10px] text-bright-brass shrink-0" aria-hidden="true">
              ◆
            </span>
          )}
          <span className="truncate">{title}</span>
        </div>
        {subtitle && (
          <div className="text-xs text-bone-gray tabular-nums truncate">{subtitle}</div>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </div>
    <div className="px-divider mt-2" aria-hidden="true" />
  </div>
);

export interface PxPanelFooterProps {
  align?: 'between' | 'end' | 'center';
  className?: string;
  children: React.ReactNode;
}

const FOOTER_ALIGN: Record<NonNullable<PxPanelFooterProps['align']>, string> = {
  between: 'justify-between',
  end: 'justify-end',
  center: 'justify-center',
};

export const PxPanelFooter: React.FC<PxPanelFooterProps> = ({
  align = 'between',
  className = '',
  children,
}) => (
  <div className={`mt-3 ${className}`}>
    <div className="px-divider mb-2.5" aria-hidden="true" />
    <div className={`flex items-center gap-2 ${FOOTER_ALIGN[align]}`}>{children}</div>
  </div>
);

export default PxPanel;
