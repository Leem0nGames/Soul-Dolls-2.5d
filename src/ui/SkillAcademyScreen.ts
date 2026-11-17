import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SkillAcademyView, type SkillAcademyTab } from '../components/ui/SkillAcademyView.tsx';
import type { SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { ModalOverlay } from './ModalOverlay.ts';

export type { SkillAcademyTab };

export class SkillAcademyScreen extends ModalOverlay {
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
    onMutated: () => void,
    onClose: () => void,
    onCraftSfx?: () => void,
    initialTab: SkillAcademyTab = 'movimientos',
    onOpenShop?: () => void
  ): void {
    this.bindSoulDolls(this.assets);

    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    this.renderNonce += 1;

    this.showOverlay();
    this.reactRoot.render(
      createElement(SkillAcademyView, {
        key: `skill-academy-${this.renderNonce}`,
        save,
        assets: this.assets,
        initialTab,
        onMutated,
        onCraftSfx,
        onOpenShop: onOpenShop
          ? () => {
              this.close();
              onOpenShop();
            }
          : undefined,
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
