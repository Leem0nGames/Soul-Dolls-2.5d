import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  QuestJournalView,
  type QuestJournalTab,
  type QuestNavContext,
} from '../components/ui/QuestJournalView.tsx';
import type { SaveData } from '../domain/types.ts';
import { ModalOverlay } from './ModalOverlay.ts';

export type { QuestJournalTab, QuestNavContext };

export class QuestJournalModal extends ModalOverlay {
  private reactRoot: Root | null = null;
  private renderNonce = 0;

  constructor(parent: HTMLElement) {
    super(parent);
  }

  open(
    save: SaveData,
    onClose: () => void,
    navContext?: QuestNavContext,
    initialTab: QuestJournalTab = 'en_curso'
  ): void {
    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    this.renderNonce += 1;

    this.showOverlay();
    this.reactRoot.render(
      createElement(QuestJournalView, {
        key: `quest-journal-${this.renderNonce}`,
        save,
        navContext,
        initialTab,
        onClose: () => {
          this.close();
          onClose();
        },
      })
    );
  }

  protected override onBeforeClose(): void {
    this.reactRoot?.unmount();
    this.reactRoot = null;
  }
}
