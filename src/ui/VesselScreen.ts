import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Rng } from '../core/Rng.ts';
import { WorkshopView, type WorkshopTab } from '../components/ui/WorkshopView.tsx';
import type { SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ModalOverlay } from './ModalOverlay.ts';

export type { WorkshopTab };

export class VesselScreen extends ModalOverlay {
  private reactRoot: Root | null = null;
  private renderNonce = 0;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    super(parent);
  }

  open(
    save: SaveData,
    rng: Rng,
    onMutated: () => void,
    onClose: () => void,
    onCraftSfx?: () => void,
    initialTab: WorkshopTab = 'forja'
  ): void {
    this.bindSoulDolls(this.assets);

    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    this.renderNonce += 1;

    this.showOverlay();
    this.reactRoot.render(
      createElement(WorkshopView, {
        key: `workshop-${this.renderNonce}`,
        save,
        rng,
        assets: this.assets,
        initialTab,
        onMutated,
        onCraftSfx,
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
