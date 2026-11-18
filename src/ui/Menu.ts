import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  PauseMenuView,
  type PauseMenuViewCallbacks,
  type PauseOptionsTab,
} from '../components/ui/PauseMenuView.tsx';
import type { GameOptions, SaveData } from '../domain/types.ts';
import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

export type OptionsTab = PauseOptionsTab;

export interface MenuCallbacks {
  onParty: () => void;
  onBag: () => void;
  onVessels?: () => void;
  onBestiary?: () => void;
  onCards?: () => void;
  onQuests?: () => void;
  onSpriteInspector?: () => void;
  onSave: () => boolean;
  onOptionsChanged: (options: GameOptions) => void;
  onClose: () => void;
  slotLabel?: string;
}

export interface OptionsOnlyCallbacks {
  onOptionsChanged: (options: GameOptions) => void;
  onClose: () => void;
}

export class PauseMenu {
  readonly root: HTMLDivElement;
  private reactRoot: Root | null = null;
  private isOpenFlag = false;
  private unbindImages: (() => void) | null = null;
  private activeOptionsTab: OptionsTab = 'sound';
  private renderNonce = 0;

  constructor(
    parent: HTMLElement,
    private readonly assets: AssetProvider
  ) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center sm:justify-end bg-abyss-ink p-3 sm:p-4 safe-pad';
    parent.appendChild(this.root);
  }

  isOpen(): boolean {
    return this.isOpenFlag;
  }

  open(save: SaveData, callbacks: MenuCallbacks): void {
    this.isOpenFlag = true;
    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, this.assets);
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    this.mountMenu(save, callbacks, false);
  }

  openOptionsOnly(save: SaveData, callbacks: OptionsOnlyCallbacks): void {
    this.isOpenFlag = true;
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
    const wrapped: MenuCallbacks = {
      onParty: () => {},
      onBag: () => {},
      onSave: () => false,
      onOptionsChanged: callbacks.onOptionsChanged,
      onClose: callbacks.onClose,
    };
    this.mountMenu(save, wrapped, true);
  }

  private mountMenu(save: SaveData, callbacks: MenuCallbacks, optionsOnly: boolean): void {
    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    this.renderNonce += 1;

    const wrappedCallbacks: PauseMenuViewCallbacks = {
      onParty: () => {
        this.close();
        callbacks.onParty();
      },
      onBag: () => {
        this.close();
        callbacks.onBag();
      },
      onVessels: callbacks.onVessels
        ? () => {
            this.close();
            callbacks.onVessels?.();
          }
        : undefined,
      onBestiary: callbacks.onBestiary
        ? () => {
            this.close();
            callbacks.onBestiary?.();
          }
        : undefined,
      onCards: callbacks.onCards
        ? () => {
            this.close();
            callbacks.onCards?.();
          }
        : undefined,
      onQuests: callbacks.onQuests
        ? () => {
            this.close();
            callbacks.onQuests?.();
          }
        : undefined,
      onSpriteInspector: callbacks.onSpriteInspector
        ? () => {
            this.close();
            callbacks.onSpriteInspector?.();
          }
        : undefined,
      onSave: callbacks.onSave,
      onOptionsChanged: callbacks.onOptionsChanged,
      onClose: () => {
        this.close();
        callbacks.onClose();
      },
    };

    this.reactRoot.render(
      createElement(PauseMenuView, {
        key: `${optionsOnly ? 'opts' : 'main'}-${this.renderNonce}`,
        save,
        assets: this.assets,
        slotLabel: callbacks.slotLabel,
        optionsOnly,
        initialOptionsTab: this.activeOptionsTab,
        onOptionsTabChange: (tab) => {
          this.activeOptionsTab = tab;
        },
        callbacks: wrappedCallbacks,
      })
    );
  }

  close(): void {
    this.isOpenFlag = false;
    this.unbindImages?.();
    this.unbindImages = null;
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.close();
    this.root.remove();
  }
}
