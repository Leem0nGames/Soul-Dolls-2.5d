import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BagView } from '../components/ui/BagView.tsx';
import {
  getVisibleBagPockets,
  type BagPocketFilter,
  type BagScreenContext,
} from '../domain/BagPresentation.ts';
import type { BagSlot } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ModalOverlay } from './ModalOverlay.ts';

export type { BagScreenContext };

export class BagScreen extends ModalOverlay {
  private reactRoot: Root | null = null;
  private renderNonce = 0;
  private activePocket: BagPocketFilter = 'all';
  private lastSelectedItemId: string | null = null;

  constructor(
    parent: HTMLElement,
    private readonly assets?: AssetProvider
  ) {
    super(parent);
  }

  open(
    bag: BagSlot[],
    inBattle: boolean,
    onUseItem: (itemId: string) => void,
    onClose: () => void,
    soulDust = 0,
    context?: BagScreenContext
  ): void {
    const visiblePockets = getVisibleBagPockets(inBattle);
    if (!visiblePockets.includes(this.activePocket)) {
      this.activePocket = visiblePockets[0];
    }

    if (this.assets) {
      this.bindSoulDolls(this.assets);
    }

    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    this.renderNonce += 1;

    this.showOverlay();
    this.reactRoot.render(
      createElement(BagView, {
        key: `bag-${inBattle ? 'battle' : 'overworld'}-${this.renderNonce}`,
        bag,
        inBattle,
        soulDust,
        assets: this.assets,
        context,
        initialPocket: this.activePocket,
        initialSelectedItemId: this.lastSelectedItemId,
        onSelectionChange: (pocket, itemId) => {
          this.activePocket = pocket;
          this.lastSelectedItemId = itemId;
        },
        onUseItem: (itemId) => {
          this.close();
          onUseItem(itemId);
        },
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
