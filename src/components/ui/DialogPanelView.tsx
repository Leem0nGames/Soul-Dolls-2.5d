import React from 'react';
import { PxButton } from './PxButton.tsx';
import { PxPanel } from './PxPanel.tsx';

export interface DialogChoiceItem {
  label: string;
  onSelect: () => void;
}

export interface DialogPanelViewProps {
  visibleText: string;
  choices?: readonly DialogChoiceItem[];
  choiceIndex: number;
  showChoices: boolean;
  showContinueHint: boolean;
  onAdvance: () => void;
  onPickChoice: (choice: DialogChoiceItem) => void;
}

export const DialogPanelView: React.FC<DialogPanelViewProps> = ({
  visibleText,
  choices,
  choiceIndex,
  showChoices,
  showContinueHint,
  onAdvance,
  onPickChoice,
}) => (
  <PxPanel
    variant="gold"
    padding="none"
    ornate
    className="px-3.5 py-2.5 sm:p-4"
    onPointerDown={(e) => {
      if (showChoices) return;
      e.stopPropagation();
      onAdvance();
    }}
  >
    <div className="min-h-[2.1rem] sm:min-h-[2.8rem] text-[13px] sm:text-base leading-snug sm:leading-relaxed text-porcelain">
      {visibleText}
    </div>

    {showChoices && choices && choices.length > 0 && (
      <div className="mt-2.5 sm:mt-3 flex flex-wrap gap-2 justify-end">
        {choices.map((choice, idx) => (
          <PxButton
            key={`${choice.label}-${idx}`}
            variant={idx === choiceIndex ? 'primary' : 'secondary'}
            size="md"
            className={idx === choiceIndex ? 'font-bold' : 'font-semibold'}
            onPointerDown={(e) => {
              e.stopPropagation();
              onPickChoice(choice);
            }}
          >
            {choice.label}
          </PxButton>
        ))}
      </div>
    )}

    <div
      className="mt-0.5 sm:mt-1 text-right text-[11px] sm:text-xs font-bold text-resonant-gold battle-arrow-bob"
      style={{ visibility: showContinueHint ? 'visible' : 'hidden' }}
    >
      ▼ Continuar
    </div>
  </PxPanel>
);

export default DialogPanelView;
