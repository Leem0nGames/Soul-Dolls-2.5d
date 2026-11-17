import React from 'react';

export type PxButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'arcane'
  | 'violet'
  | 'danger'
  | 'ghost';

export type PxButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type PxButtonAlign = 'center' | 'start' | 'between';

export interface PxButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PxButtonVariant;
  size?: PxButtonSize;
  active?: boolean;
  fullWidth?: boolean;
  align?: PxButtonAlign;
  showSelector?: boolean;
  icon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<PxButtonVariant, string> = {
  primary: 'px-btn px-btn-primary',
  secondary: 'px-btn px-btn-secondary',
  success: 'px-btn px-btn-success',
  arcane: 'px-btn px-btn-arcane',
  violet: 'px-btn px-btn-violet',
  danger: 'px-btn px-btn-danger',
  ghost: 'px-btn px-btn-ghost',
};

const SIZE_CLASSES: Record<PxButtonSize, string> = {
  xs: 'min-h-[36px] px-2.5 py-1 text-[11px]',
  sm: 'min-h-[40px] px-3 py-1.5 text-xs',
  md: 'min-h-[44px] px-4 py-2 text-xs sm:text-sm',
  lg: 'min-h-[50px] px-6 py-2.5 text-sm sm:text-base',
};

const ALIGN_CLASSES: Record<PxButtonAlign, string> = {
  center: 'justify-center text-center',
  start: 'justify-start text-left',
  between: 'justify-between text-left',
};

export const PxButton: React.FC<PxButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  active = false,
  fullWidth = false,
  align = 'center',
  showSelector = true,
  icon,
  type = 'button',
  className = '',
  children,
  ...rest
}) => {
  const resolvedVariant = active && variant === 'secondary' ? 'primary' : variant;
  const classes = [
    VARIANT_CLASSES[resolvedVariant],
    SIZE_CLASSES[size],
    ALIGN_CLASSES[align],
    'inline-flex items-center gap-1.5 font-bold whitespace-nowrap shrink-0 select-none',
    !showSelector ? 'px-btn-no-caret' : '',
    fullWidth ? 'w-full' : '',
    active && variant !== 'secondary' ? 'border-warm-white' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} data-px-btn={resolvedVariant} {...rest}>
      {icon && <span className="shrink-0 inline-flex items-center">{icon}</span>}
      {children}
    </button>
  );
};

export default PxButton;
