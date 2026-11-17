import type { Input, LogicalButton } from '../core/Input.ts';
import {
  beginCameraTouch,
  createCameraTouchGestureState,
  endCameraTouch,
  moveCameraTouch,
  resetCameraTouch,
  setCameraTouchGestureMode,
  type CameraTouchGestureState,
} from '../domain/CameraOrbit.ts';
import type { CameraMode } from '../domain/types.ts';

type DpadDir = 'up' | 'down' | 'left' | 'right';
const DPAD_DIRS: readonly DpadDir[] = ['up', 'down', 'left', 'right'];

const BTN_IDLE_CLS =
  'min-w-[40px] min-h-[40px] rounded-none border-2 border-cold-stone bg-smoked-wood text-porcelain font-bold text-base flex items-center justify-center pointer-events-none select-none shadow-[2px_2px_0_#050505]';
const BTN_ACTIVE_CLS =
  'min-w-[40px] min-h-[40px] rounded-none border-2 border-pale-gold bg-resonant-gold text-ui-ink font-bold text-base flex items-center justify-center pointer-events-none select-none';

export interface CameraTouchHandlers {
  onStep: (delta: -1 | 1) => void;
  onOrbit: (deltaRad: number) => void;
}

export class TouchControls {
  readonly root: HTMLDivElement;
  readonly cameraTouchEl: HTMLDivElement;
  private visible = false;
  private cameraTouchEnabled = true;
  private controlsLayer: HTMLDivElement;
  private dpadEl: HTMLDivElement;
  private dpadBtns = new Map<DpadDir, HTMLDivElement>();
  private activeDpadPointerId: number | null = null;
  private activeDpadDir: DpadDir | null = null;

  private cameraGesture: CameraTouchGestureState = createCameraTouchGestureState('fixed');
  private cameraHandlers: CameraTouchHandlers | null = null;

  constructor(parent: HTMLElement, private readonly input: Input) {
    // Full-viewport horizontal touch surface sitting behind Overworld HUD (z-15) and TouchControls (z-20)
    this.cameraTouchEl = document.createElement('div');
    this.cameraTouchEl.className = 'pointer-events-auto fixed inset-0 z-10 touch-none select-none';
    this.cameraTouchEl.setAttribute('aria-label', 'Zona táctil de rotación de cámara');
    this.cameraTouchEl.style.display = 'none';
    parent.appendChild(this.cameraTouchEl);
    this.bindCameraTouch();

    this.root = document.createElement('div');
    this.root.className = 'pointer-events-none fixed inset-0 z-20 safe-pad';

    this.controlsLayer = document.createElement('div');
    this.controlsLayer.className =
      'pointer-events-none flex h-full w-full flex-col justify-end p-2.5 sm:p-3';

    // Bottom D-pad (left) + Menu & A/B cluster (right)
    const bottomRow = document.createElement('div');
    bottomRow.className = 'flex items-end justify-between w-full gap-2 pb-1';

    this.dpadEl = document.createElement('div');
    this.dpadEl.className =
      'pointer-events-auto grid grid-cols-3 grid-rows-3 gap-1 w-32 h-32 sm:w-36 sm:h-36 p-1 px-panel px-hud-box border-ash-purple touch-none';

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
    centerDot.className =
      'col-start-2 row-start-2 rounded-none border border-ash-purple bg-smoked-wood pointer-events-none';
    this.dpadEl.appendChild(centerDot);
    this.dpadEl.appendChild(makePadVisual('▶', 'right', 'col-start-3 row-start-2'));
    this.dpadEl.appendChild(makePadVisual('▼', 'down', 'col-start-2 row-start-3'));

    this.bindDpadSwipe();

    const rightCluster = document.createElement('div');
    rightCluster.className = 'pointer-events-none flex flex-col items-end gap-2.5';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.textContent = 'MENÚ';
    startBtn.className =
      'pointer-events-auto min-w-[64px] min-h-[44px] px-3 px-btn px-btn-ghost px-btn-no-caret text-xs font-bold touch-none';
    this.bindPointer(startBtn, 'start');

    const abRow = document.createElement('div');
    abRow.className = 'pointer-events-auto flex items-end gap-2.5';

    const bBtn = document.createElement('button');
    bBtn.type = 'button';
    bBtn.setAttribute('aria-label', 'Correr / Atrás');
    bBtn.innerHTML =
      '<span class="block text-base leading-none">B</span><span class="block text-[8px] leading-none tracking-wider text-pale-rose mt-0.5">CORRER</span>';
    bBtn.className =
      'w-[54px] h-[54px] min-w-[54px] min-h-[54px] flex flex-col items-center justify-center px-btn px-btn-danger px-btn-no-caret font-bold touch-none';
    this.bindPointer(bBtn, 'b');

    const aBtn = document.createElement('button');
    aBtn.type = 'button';
    aBtn.textContent = 'A';
    aBtn.className =
      'w-[56px] h-[56px] min-w-[56px] min-h-[56px] -translate-y-2 px-btn px-btn-success px-btn-no-caret font-bold text-lg touch-none';
    this.bindPointer(aBtn, 'a');

    abRow.appendChild(bBtn);
    abRow.appendChild(aBtn);

    rightCluster.appendChild(startBtn);
    rightCluster.appendChild(abRow);

    bottomRow.appendChild(this.dpadEl);
    bottomRow.appendChild(rightCluster);

    this.controlsLayer.appendChild(bottomRow);
    this.root.appendChild(this.controlsLayer);

    this.setVisible(false);
    parent.appendChild(this.root);
  }

  setCameraMode(mode: CameraMode): void {
    setCameraTouchGestureMode(this.cameraGesture, mode);
  }

  setCameraHandlers(handlers: CameraTouchHandlers | null): void {
    this.cameraHandlers = handlers;
    if (!handlers) {
      resetCameraTouch(this.cameraGesture);
    }
  }

  setCameraTouchEnabled(enabled: boolean): void {
    this.cameraTouchEnabled = enabled;
    if (!enabled) {
      resetCameraTouch(this.cameraGesture);
    }
    this.syncCameraSurfaceVisibility();
  }

  private syncCameraSurfaceVisibility(): void {
    this.cameraTouchEl.style.display =
      this.visible && this.cameraTouchEnabled ? 'block' : 'none';
  }

  private bindCameraTouch(): void {
    this.cameraTouchEl.addEventListener('pointerdown', (e) => {
      if (!this.visible || !this.cameraTouchEnabled || !this.cameraHandlers) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (beginCameraTouch(this.cameraGesture, e.pointerId, e.clientX)) {
        try {
          this.cameraTouchEl.setPointerCapture(e.pointerId);
        } catch {
          // Ignore if synthetic event cannot capture
        }
      }
    });

    this.cameraTouchEl.addEventListener('pointermove', (e) => {
      if (!this.visible || !this.cameraTouchEnabled || !this.cameraHandlers) return;
      const res = moveCameraTouch(this.cameraGesture, e.pointerId, e.clientX);
      if (res.stepDelta !== 0) {
        e.preventDefault();
        this.cameraHandlers.onStep(res.stepDelta);
      } else if (res.orbitDeltaRad !== 0) {
        e.preventDefault();
        this.cameraHandlers.onOrbit(res.orbitDeltaRad);
      }
    });

    const release = (e: PointerEvent) => {
      endCameraTouch(this.cameraGesture, e.pointerId);
    };

    this.cameraTouchEl.addEventListener('pointerup', release);
    this.cameraTouchEl.addEventListener('pointercancel', release);
    this.cameraTouchEl.addEventListener('lostpointercapture', release);
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
    this.syncCameraSurfaceVisibility();
    if (!show) {
      resetCameraTouch(this.cameraGesture);
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
    this.cameraHandlers = null;
    this.cameraTouchEl.remove();
    this.root.remove();
  }
}
