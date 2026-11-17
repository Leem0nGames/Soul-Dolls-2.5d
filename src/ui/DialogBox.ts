import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DialogPanelView } from '../components/ui/DialogPanelView.tsx';
import type { Input } from '../core/Input.ts';

export interface DialogChoice {
  label: string;
  onSelect: () => void;
}

export class DialogBox {
  readonly root: HTMLDivElement;
  private reactRoot: Root | null = null;

  private queue: string[] = [];
  private fullText = '';
  private charPos = 0;
  private charTimer = 0;
  private active = false;
  private fastMode = false;
  private onComplete?: () => void;
  private choices?: DialogChoice[];
  private choiceIndex = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className =
      'pointer-events-auto fixed inset-x-0 bottom-1.5 sm:bottom-3 z-30 mx-auto hidden w-[min(95vw,680px)]';
    this.root.style.marginBottom = 'env(safe-area-inset-bottom, 0px)';
    parent.appendChild(this.root);
  }

  setFastMode(fast: boolean): void {
    this.fastMode = fast;
  }

  isOpen(): boolean {
    return this.active;
  }

  enqueue(line: string): void {
    if (this.active) {
      this.queue.push(line);
    } else {
      this.show(line);
    }
  }

  show(
    lines: string | string[],
    onComplete?: () => void,
    choices?: DialogChoice[]
  ): void {
    this.queue = Array.isArray(lines) ? lines.slice() : [lines];
    this.onComplete = onComplete;
    this.choices = choices;
    this.choiceIndex = 0;
    this.active = true;
    this.root.classList.remove('hidden');
    this.startNextLine();
  }

  private renderView(): void {
    if (!this.active) return;
    if (!this.reactRoot) {
      this.reactRoot = createRoot(this.root);
    }
    const lineComplete = this.charPos >= this.fullText.length;
    const showChoices = Boolean(lineComplete && this.choices && this.queue.length === 0);
    const showContinueHint = lineComplete && !showChoices;

    this.reactRoot.render(
      createElement(DialogPanelView, {
        visibleText: this.fullText.slice(0, this.charPos),
        choices: this.choices,
        choiceIndex: this.choiceIndex,
        showChoices,
        showContinueHint,
        onAdvance: () => this.advance(),
        onPickChoice: (choice) => {
          this.close();
          choice.onSelect();
        },
      })
    );
  }

  private startNextLine(): void {
    this.fullText = this.queue.shift() ?? '';
    this.charPos = 0;
    this.charTimer = 0;
    this.renderView();
  }

  update(dt: number, input: Input): void {
    if (!this.active) return;

    if (this.charPos < this.fullText.length) {
      const speed = this.fastMode ? 95 : 46;
      this.charTimer += dt * speed;
      const nextPos = Math.min(this.fullText.length, Math.floor(this.charTimer));
      if (nextPos > this.charPos) {
        this.charPos = nextPos;
        this.renderView();
      } else if (input.justPressed('a') || input.justPressed('b')) {
        this.charPos = this.fullText.length;
        this.renderView();
      }
      return;
    }

    if (this.choices && this.queue.length === 0) {
      if (input.justPressed('left') || input.justPressed('up')) {
        this.choiceIndex = (this.choiceIndex + this.choices.length - 1) % this.choices.length;
        this.renderView();
      } else if (input.justPressed('right') || input.justPressed('down')) {
        this.choiceIndex = (this.choiceIndex + 1) % this.choices.length;
        this.renderView();
      } else if (input.justPressed('a')) {
        const picked = this.choices[this.choiceIndex];
        this.close();
        picked?.onSelect();
      } else if (input.justPressed('b')) {
        const last = this.choices[this.choices.length - 1];
        this.close();
        last?.onSelect();
      }
      return;
    }

    if (input.justPressed('a') || input.justPressed('b')) {
      this.advance();
    }
  }

  advance(): void {
    if (!this.active) return;
    if (this.charPos < this.fullText.length) {
      this.charPos = this.fullText.length;
      this.renderView();
      return;
    }
    if (this.queue.length > 0) {
      this.startNextLine();
      return;
    }
    if (this.choices) return;
    const cb = this.onComplete;
    this.close();
    cb?.();
  }

  close(): void {
    this.active = false;
    this.queue = [];
    this.choices = undefined;
    this.onComplete = undefined;
    this.reactRoot?.unmount();
    this.reactRoot = null;
    this.root.classList.add('hidden');
  }

  dispose(): void {
    this.close();
    this.root.remove();
  }
}
