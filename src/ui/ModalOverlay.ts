import type { AssetProvider } from '../gfx/AssetProvider.ts';
import { bindSoulDollImageUpdates } from './bindSoulDollImages.ts';

const DEFAULT_OVERLAY_CLASS =
  'pointer-events-auto fixed inset-0 z-40 hidden items-center justify-center bg-abyss-ink p-3 safe-pad';

export abstract class ModalOverlay {
  readonly root: HTMLDivElement;
  private unbindImages: (() => void) | null = null;

  constructor(parent: HTMLElement, className = DEFAULT_OVERLAY_CLASS) {
    this.root = document.createElement('div');
    this.root.className = className;
    parent.appendChild(this.root);
  }

  protected bindSoulDolls(assets: AssetProvider): void {
    this.unbindImages?.();
    this.unbindImages = bindSoulDollImageUpdates(this.root, assets);
  }

  protected showOverlay(): void {
    this.root.classList.remove('hidden');
    this.root.classList.add('flex');
  }

  protected onBeforeClose(): void {}

  isOpen(): boolean {
    return this.root.classList.contains('flex');
  }

  close(): void {
    this.onBeforeClose();
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.classList.add('hidden');
    this.root.classList.remove('flex');
  }

  dispose(): void {
    this.onBeforeClose();
    this.unbindImages?.();
    this.unbindImages = null;
    this.root.remove();
  }
}
