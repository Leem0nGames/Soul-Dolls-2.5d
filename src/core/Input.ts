export type LogicalButton =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'sprint'
  | 'start'
  | 'camLeft'
  | 'camRight';

const ALL_BUTTONS: readonly LogicalButton[] = [
  'up',
  'down',
  'left',
  'right',
  'a',
  'b',
  'sprint',
  'start',
  'camLeft',
  'camRight',
];

export class Input {
  private keyHeld = new Set<LogicalButton>();
  private touchHeld = new Set<LogicalButton>();
  private prevHeld = new Set<LogicalButton>();
  private queuedPress = new Set<LogicalButton>();
  private unlockListeners = new Set<() => void>();

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pointerdown', this.notifyUnlock, { passive: true });
  }

  onFirstGesture(cb: () => void): void {
    this.unlockListeners.add(cb);
  }

  private notifyUnlock = (): void => {
    for (const cb of this.unlockListeners) cb();
  };

  private mapKey(code: string): LogicalButton | null {
    switch (code) {
      case 'ArrowUp':
      case 'KeyW':
        return 'up';
      case 'ArrowDown':
      case 'KeyS':
        return 'down';
      case 'ArrowLeft':
      case 'KeyA':
        return 'left';
      case 'ArrowRight':
      case 'KeyD':
        return 'right';
      case 'KeyZ':
      case 'Enter':
      case 'Space':
        return 'a';
      case 'KeyX':
      case 'Backspace':
        return 'b';
      case 'ShiftLeft':
      case 'ShiftRight':
        return 'sprint';
      case 'KeyM':
      case 'Escape':
        return 'start';
      case 'KeyQ':
        return 'camLeft';
      case 'KeyE':
        return 'camRight';
      default:
        return null;
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.notifyUnlock();
    const btn = this.mapKey(e.code);
    if (!btn) return;
    if (e.code.startsWith('Arrow') || e.code === 'Space') {
      e.preventDefault();
    }
    if (!this.keyHeld.has(btn)) {
      this.queuedPress.add(btn);
    }
    this.keyHeld.add(btn);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const btn = this.mapKey(e.code);
    if (!btn) return;
    this.keyHeld.delete(btn);
  };

  private onBlur = (): void => {
    this.keyHeld.clear();
    this.touchHeld.clear();
    this.prevHeld.clear();
    this.queuedPress.clear();
  };

  clearAll(): void {
    this.onBlur();
  }

  setVirtual(btn: LogicalButton, pressed: boolean): void {
    this.notifyUnlock();
    if (pressed) {
      if (!this.touchHeld.has(btn)) {
        this.queuedPress.add(btn);
      }
      this.touchHeld.add(btn);
    } else {
      this.touchHeld.delete(btn);
    }
  }

  isHeld(btn: LogicalButton): boolean {
    return this.keyHeld.has(btn) || this.touchHeld.has(btn);
  }

  justPressed(btn: LogicalButton): boolean {
    if (this.queuedPress.has(btn)) return true;
    return this.isHeld(btn) && !this.prevHeld.has(btn);
  }

  endFixedStep(): void {
    this.queuedPress.clear();
    this.prevHeld.clear();
    for (const btn of ALL_BUTTONS) {
      if (this.isHeld(btn)) {
        this.prevHeld.add(btn);
      }
    }
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('pointerdown', this.notifyUnlock);
  }
}
