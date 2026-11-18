import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SpriteInspectorView } from '../components/ui/SpriteInspectorView.tsx';
import { ModalOverlay } from './ModalOverlay.ts';

export class SpriteInspectorModal extends ModalOverlay {
  private reactRoot: Root | null = null;

  constructor(parent: HTMLElement) {
    super(
      parent,
      'pointer-events-auto fixed inset-0 z-50 hidden items-center justify-center bg-abyss-ink/90 p-1.5 sm:p-4 safe-pad animate-fadeIn'
    );
  }

  open(onClose: () => void): void {
    this.showOverlay();

    this.root.innerHTML = '';
    const rootEl = document.createElement('div');
    rootEl.className = 'w-full flex items-center justify-center';
    this.root.appendChild(rootEl);

    if (!this.reactRoot) {
      this.reactRoot = createRoot(rootEl);
    }

    const handleClose = () => {
      this.close();
      onClose();
    };

    this.reactRoot.render(
      createElement(SpriteInspectorView, {
        onClose: handleClose,
      })
    );
  }

  close(): void {
    super.close();
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.root.innerHTML = '';
  }
}
