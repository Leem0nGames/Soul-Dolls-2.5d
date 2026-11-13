export class Loop {
  private rafId = 0;
  private running = false;
  private paused = false;
  private batterySaver = false;
  private lastTime = 0;
  private accumulator = 0;
  private lastRenderTime = 0;
  private readonly fixedDt = 1 / 60;

  private readonly onFixedUpdate: (dt: number) => void;
  private readonly onRender: (alpha: number, frameMs: number) => void;

  constructor(
    onFixedUpdate: (dt: number) => void,
    onRender: (alpha: number, frameMs: number) => void
  ) {
    this.onFixedUpdate = onFixedUpdate;
    this.onRender = onRender;
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.hidden) {
      this.paused = true;
    } else {
      this.paused = false;
      this.lastTime = performance.now();
      this.lastRenderTime = this.lastTime;
    }
  };

  setBatterySaver(enabled: boolean): void {
    this.batterySaver = enabled;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.lastRenderTime = this.lastTime;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.tick);
    if (this.paused) return;

    const rawDtSec = Math.min(0.1, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.accumulator += rawDtSec;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < 5) {
      this.onFixedUpdate(this.fixedDt);
      this.accumulator -= this.fixedDt;
      steps++;
    }

    const minRenderGap = this.batterySaver ? 32 : 0;
    const elapsedRender = now - this.lastRenderTime;
    if (elapsedRender >= minRenderGap) {
      const renderStart = performance.now();
      this.onRender(this.accumulator / this.fixedDt, elapsedRender);
      this.lastRenderTime = now;
      void renderStart;
    }
  };

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
}
