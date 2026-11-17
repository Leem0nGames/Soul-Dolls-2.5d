import React, { useEffect } from 'react';
import { PxPanel, type PxPanelPadding, type PxPanelVariant } from './PxPanel.tsx';

export type PxModalAlign = 'center' | 'end' | 'bottom-right';

export interface PxModalProps {
  open: boolean;
  onClose?: () => void;
  align?: PxModalAlign;
  variant?: PxPanelVariant;
  padding?: PxPanelPadding;
  ornate?: boolean;
  maxWidthClass?: string;
  zClass?: string;
  transparentBackdrop?: boolean;
  panelClassName?: string;
  children: React.ReactNode;
}

const ALIGN_CLASSES: Record<PxModalAlign, string> = {
  center: 'items-center justify-center',
  end: 'items-center justify-center sm:justify-end',
  'bottom-right': 'items-end justify-center sm:items-center sm:justify-end',
};

export const PxModal: React.FC<PxModalProps> = ({
  open,
  onClose,
  align = 'center',
  variant = 'gold',
  padding = 'md',
  ornate = true,
  maxWidthClass = 'max-w-xl',
  zClass = 'z-40',
  transparentBackdrop = false,
  panelClassName = '',
  children,
}) => {
  useEffect(() => {
    if (!open || !onClose) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={`${
        transparentBackdrop ? 'pointer-events-none bg-transparent' : 'pointer-events-auto bg-abyss-ink'
      } fixed inset-0 ${zClass} flex ${ALIGN_CLASSES[align]} p-2.5 sm:p-4 safe-pad`}
      role="dialog"
      aria-modal={!transparentBackdrop}
    >
      <PxPanel
        variant={variant}
        padding={padding}
        ornate={ornate}
        scrollable
        className={`pointer-events-auto w-full ${maxWidthClass} max-h-[calc(100dvh-1.5rem)] ${panelClassName}`}
      >
        {children}
      </PxPanel>
    </div>
  );
};

export default PxModal;
