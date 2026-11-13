import type { Input } from '../core/Input.ts';

export interface DialogChoice {
  label: string;
  onSelect: () => void;
}

export class DialogBox {
  readonly root: HTMLDivElement;
  private textEl: HTMLDivElement;
  private nextHint: HTMLDivElement;
  private choicesEl: HTMLDivElement;

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
      'pointer-events-auto fixed inset-x-0 bottom-2 sm:bottom-3 z-30 mx-auto hidden w-[min(94vw,680px)] rounded-xl border-2 border-porcelain bg-crypt-ink/95 p-3.5 sm:p-4 shadow-xl';
    this.root.style.marginBottom = 'env(safe-area-inset-bottom, 0px)';

    this.textEl = document.createElement('div');
    this.textEl.className = 'min-h-[3.0rem] text-sm sm:text-base leading-relaxed text-porcelain';

    this.choicesEl = document.createElement('div');
    this.choicesEl.className = 'mt-3 hidden flex-wrap gap-2 justify-end';

    this.nextHint = document.createElement('div');
    this.nextHint.className =
      'mt-1 text-right text-xs font-bold text-resonant-gold battle-arrow-bob';
    this.nextHint.textContent = '▼ Continuar';

    this.root.appendChild(this.textEl);
    this.root.appendChild(this.choicesEl);
    this.root.appendChild(this.nextHint);

    this.root.addEventListener('pointerdown', (e) => {
      if (this.choices && this.charPos >= this.fullText.length) return;
      e.stopPropagation();
      this.advance();
    });

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

  private startNextLine(): void {
    this.fullText = this.queue.shift() ?? '';
    this.charPos = 0;
    this.charTimer = 0;
    this.textEl.textContent = '';
    this.choicesEl.classList.add('hidden');
    this.choicesEl.innerHTML = '';
    this.nextHint.style.visibility = 'hidden';
  }

  update(dt: number, input: Input): void {
    if (!this.active) return;

    if (this.charPos < this.fullText.length) {
      const speed = this.fastMode ? 95 : 46;
      this.charTimer += dt * speed;
      const nextPos = Math.min(this.fullText.length, Math.floor(this.charTimer));
      if (nextPos > this.charPos) {
        this.charPos = nextPos;
        this.textEl.textContent = this.fullText.slice(0, this.charPos);
      }
      if (this.charPos >= this.fullText.length) {
        this.onLineFinished();
      } else if (input.justPressed('a') || input.justPressed('b')) {
        this.charPos = this.fullText.length;
        this.textEl.textContent = this.fullText;
        this.onLineFinished();
      }
      return;
    }

    if (this.choices && this.queue.length === 0) {
      if (input.justPressed('left') || input.justPressed('up')) {
        this.choiceIndex = (this.choiceIndex + this.choices.length - 1) % this.choices.length;
        this.renderChoices();
      } else if (input.justPressed('right') || input.justPressed('down')) {
        this.choiceIndex = (this.choiceIndex + 1) % this.choices.length;
        this.renderChoices();
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

  private onLineFinished(): void {
    if (this.choices && this.queue.length === 0) {
      this.nextHint.style.visibility = 'hidden';
      this.renderChoices();
    } else {
      this.nextHint.style.visibility = 'visible';
    }
  }

  private renderChoices(): void {
    if (!this.choices) return;
    this.choicesEl.classList.remove('hidden');
    this.choicesEl.classList.add('flex');
    this.choicesEl.innerHTML = '';
    this.choices.forEach((choice, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = choice.label;
      btn.className =
        idx === this.choiceIndex
          ? 'min-h-[44px] px-4 py-2 rounded-lg border-2 border-bright-brass bg-resonant-gold text-crypt-ink font-bold text-sm'
          : 'min-h-[44px] px-4 py-2 rounded-lg border-2 border-cold-stone bg-smoked-wood text-porcelain font-semibold text-sm hover:border-porcelain';
      btn.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        this.close();
        choice.onSelect();
      });
      this.choicesEl.appendChild(btn);
    });
  }

  advance(): void {
    if (!this.active) return;
    if (this.charPos < this.fullText.length) {
      this.charPos = this.fullText.length;
      this.textEl.textContent = this.fullText;
      this.onLineFinished();
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
    this.root.classList.add('hidden');
  }

  dispose(): void {
    this.root.remove();
  }
}
