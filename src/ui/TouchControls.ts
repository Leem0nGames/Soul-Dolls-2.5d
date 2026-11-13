import type { Input, LogicalButton } from '../core/Input.ts';

type DpadDir = 'up' | 'down' | 'left' | 'right';
const DPAD_DIRS: readonly DpadDir[] = ['up', 'down', 'left', 'right'];

const BTN_IDLE_CLS =
  'min-w-[40px] min-h-[40px] rounded-lg border-2 border-cold-stone/60 bg-smoked-wood/85 text-porcelain font-bold text-base flex items-center justify-center pointer-events-none select-none transition-colors';
const BTN_ACTIVE_CLS =
  'min-w-[40px] min-h-[40px] rounded-lg border-2 border-pale-gold bg-resonant-gold text-crypt-ink font-bold text-base flex items-center justify-center pointer-events-none select-none transition-colors';

export class TouchControls {
  readonly root: HTMLDivElement;
  private visible = false;
  private controlsLayer: HTMLDivElement;
  private dpadEl: HTMLDivElement;
  private dpadBtns = new Map<DpadDir, HTMLDivElement>();
  private activeDpadPointerId: number | null = null;
  private activeDpadDir: DpadDir | null = null;

  constructor(parent: HTMLElement, private readonly input: Input) {
    this.root = document.createElement('div');
    this.root.className = 'pointer-events-none fixed inset-0 z-20 safe-pad';

    this.controlsLayer = document.createElement('div');
    this.controlsLayer.className =
      'pointer-events-none flex h-full w-full flex-col justify-between p-2.5 sm:p-3';

    // Top-right camera yaw shoulder buttons (keeps top-left clear for Overworld location HUD)
    const shoulderRow = document.createElement('div');
    shoulderRow.className = 'flex items-start justify-end gap-2 w-full';

    const makeShoulder = (label: string, btn: LogicalButton) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.textContent = label;
      el.className =
        'pointer-events-auto min-w-[52px] min-h-[44px] px-3 rounded-lg border-2 border-ki-cyan/70 bg-smoked-wood/85 text-ice-cyan font-bold text-xs active:bg-ki-cyan active:text-crypt-ink touch-none opacity-85';
      this.bindPointer(el, btn);
      return el;
    };

    shoulderRow.appendChild(makeShoulder('↺ L', 'camLeft'));
    shoulderRow.appendChild(makeShoulder('R ↻', 'camRight'));

    // Bottom D-pad (left) + Menu & A/B cluster (right)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'flex items-end justify-between w-full gap-2 pb-1';

    this.dpadEl = document.createElement('div');
    this.dpadEl.className =
      'pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 sm:w-36 sm:h-36 p-1 rounded-2xl bg-crypt-ink/35 touch-none opacity-90';

    const makePadVisual = (label: string, dir: DpadDir, gridPos: string) => {
      const el = document.createElement('div');
      el.textContent = label;
      el.dataset.pos = gridPos;
      el.className = `${gridPos} ${BTN_IDLE_CLS}`;
      this.dpadBtns.set(dir, el);
      return el;
    };

    this.dpadEl.appendChild(makePadVisual('▲', 'up', 'col-start-2 row-start-1'));
    this.dpadEl.appendChild(makePadVisual('◀', 'left', 'col-start-1 row-start-2'));
    const centerDot = document.createElement('div');
    centerDot.className = 'col-start-2 row-start-2 rounded-lg bg-smoked-wood/45 pointer-events-none';
    this.dpadEl.appendChild(centerDot);
    this.dpadEl.appendChild(makePadVisual('▶', 'right', 'col-start-3 row-start-2'));
    this.dpadEl.appendChild(makePadVisual('▼', 'down', 'col-start-2 row-start-3'));

    this.bindDpadSwipe();

    const rightCluster = document.createElement('div');
    rightCluster.className = 'pointer-events-none flex flex-col items-end gap-2.5 opacity-90';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = 'MENÚ';
    startBtn.className =
      'pointer-events-auto min-w-[64px] min-h-[44px] px-3 rounded-lg border-2 border-cold-stone/70 bg-smoked-wood/85 text-porcelain text-xs font-bold active:bg-cold-stone touch-none';
    this.bindPointer(startBtn, 'start');

    const abRow = document.createElement('div');
    abRow.className = 'pointer-events-auto flex items-end gap-2.5';

    const bBtn = document.createElement('button');
    bBtn.type = 'button';
    bBtn.textContent = 'B';
    bBtn.className =
      'w-[52px] h-[52px] min-w-[52px] min-h-[52px] rounded-full border-2 border-peach-blush/80 bg-rift-crimson/90 text-warm-white font-bold text-lg shadow active:scale-95 touch-none';
    this.bindPointer(bBtn, 'b');

    const aBtn = document.createElement('button');
    aBtn.type = 'button';
    aBtn.textContent = 'A';
    aBtn.className =
      'w-[56px] h-[56px] min-w-[56px] min-h-[56px] -translate-y-2 rounded-full border-2 border-frosted-glass/80 bg-emerald-base/90 text-warm-white font-bold text-lg shadow active:scale-95 touch-none';
    this.bindPointer(aBtn, 'a');

    abRow.appendChild(bBtn);
    abRow.appendChild(aBtn);

    rightCluster.appendChild(startBtn);
    rightCluster.appendChild(abRow);

    bottomRow.appendChild(this.dpadEl);
    bottomRow.appendChild(rightCluster);

    this.controlsLayer.appendChild(shoulderRow);
    this.controlsLayer.appendChild(bottomRow);
    this.root.appendChild(this.controlsLayer);

    this.setVisible(false);
    parent.appendChild(this.root);
  }

  private setDpadDirection(next: DpadDir | null): void {
    if (this.activeDpadDir === next) return;
    if (this.activeDpadDir) {
      this.input.setVirtual(this.activeDpadDir, false);
      const prevEl = this.dpadBtns.get(this.activeDpadDir);
      if (prevEl) {
        prevEl.className = `${prevEl.dataset.pos ?? ''} ${BTN_IDLE_CLS}`;
      }
    }
    this.activeDpadDir = next;
    if (next) {
      this.input.setVirtual(next, true);
      const nextEl = this.dpadBtns.get(next);
      if (nextEl) {
        nextEl.className = `${nextEl.dataset.pos ?? ''} ${BTN_ACTIVE_CLS}`;
      }
    }
  }

  private resolveDpadDir(clientX: number, clientY: number): DpadDir | null {
    const rect = this.dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * 0.5;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const deadzone = Math.min(rect.width, rect.height) * 0.11;
    if (dx * dx + dy * dy < deadzone * deadzone) return null;
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  }

  private bindDpadSwipe(): void {
    this.dpadEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.activeDpadPointerId = e.pointerId;
      this.dpadEl.setPointerCapture(e.pointerId);
      this.setDpadDirection(this.resolveDpadDir(e.clientX, e.clientY));
    });

    this.dpadEl.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.activeDpadPointerId) return;
      e.preventDefault();
      this.setDpadDirection(this.resolveDpadDir(e.clientX, e.clientY));
    });

    const release = (e: PointerEvent) => {
      if (e.pointerId !== this.activeDpadPointerId) return;
      this.activeDpadPointerId = null;
      this.setDpadDirection(null);
    };

    this.dpadEl.addEventListener('pointerup', release);
    this.dpadEl.addEventListener('pointercancel', release);
    this.dpadEl.addEventListener('lostpointercapture', release);
  }

  private bindPointer(el: HTMLElement, btn: LogicalButton): void {
    const activeIds = new Set<number>();

    const release = (e: PointerEvent) => {
      if (activeIds.has(e.pointerId)) {
        activeIds.delete(e.pointerId);
        if (activeIds.size === 0) {
          this.input.setVirtual(btn, false);
        }
      }
    };

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      activeIds.add(e.pointerId);
      this.input.setVirtual(btn, true);
    });
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('lostpointercapture', release);
  }

  setVisible(show: boolean): void {
    this.visible = show;
    this.controlsLayer.style.display = show ? 'flex' : 'none';
    if (!show) {
      this.activeDpadPointerId = null;
      this.setDpadDirection(null);
      for (const dir of DPAD_DIRS) {
        this.input.setVirtual(dir, false);
      }
    }
  }

  isVisible(): boolean {
    return this.visible;
  }

  dispose(): void {
    this.setVisible(false);
    this.root.remove();
  }
}
