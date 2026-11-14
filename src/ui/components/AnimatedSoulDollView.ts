import { SoulDollIdleRig } from '../../engine/SoulDollIdleRig.ts';
import type { AssetProvider } from '../../gfx/AssetProvider.ts';

export class AnimatedSoulDollView {
  readonly root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private rig: SoulDollIdleRig;
  private animFrameId: number | null = null;
  private lastTime = performance.now();

  constructor(
    private readonly assets: AssetProvider,
    private readonly speciesId: number,
    private readonly view: 'front' | 'back' = 'front',
    size: number = 56
  ) {
    this.root = document.createElement('div');
    this.root.className = 'relative inline-flex items-center justify-center shrink-0 pixel-canvas';
    this.root.style.width = `${size}px`;
    this.root.style.height = `${size}px`;

    this.canvas = document.createElement('canvas');
    this.canvas.width = size * 2;
    this.canvas.height = size * 2;
    this.canvas.className = 'w-full h-full object-contain pixel-canvas';
    this.ctx = this.canvas.getContext('2d');
    if (this.ctx) {
      this.ctx.imageSmoothingEnabled = false;
    }

    this.root.appendChild(this.canvas);

    this.rig = new SoulDollIdleRig({
      view,
      flipX: view === 'back',
      cycleDuration: 3.5,
      initialPhase: Math.random(),
    });

    const anchor = assets.getCreatureRigAnchor?.(speciesId, view);
    if (anchor) {
      this.rig.setAnchor(anchor);
    }

    this.startLoop();
  }

  private startLoop(): void {
    const render = (now: number) => {
      const dt = Math.min(0.1, (now - this.lastTime) / 1000);
      this.lastTime = now;

      this.rig.update(dt);
      this.draw();

      this.animFrameId = requestAnimationFrame(render);
    };
    this.animFrameId = requestAnimationFrame(render);
  }

  private draw(): void {
    if (!this.ctx) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.ctx.clearRect(0, 0, w, h);

    const tex = this.assets.getCreatureTexture(this.speciesId, this.view);
    const img = tex.image as HTMLCanvasElement | HTMLImageElement | ImageBitmap;
    if (!img) return;

    const breathW = this.rig.getBreathWeight();
    const jiggleX = this.rig.getState().jiggleX;
    const jiggleY = this.rig.getState().jiggleY;

    this.ctx.save();
    this.ctx.imageSmoothingEnabled = false;

    const scaleY = 1 + breathW * 0.045 + jiggleY * 0.15;
    const scaleX = 1 + breathW * 0.035 + jiggleX * 0.12;
    const offsetX = jiggleX * w * 0.2;
    const offsetY = -breathW * h * 0.03 - jiggleY * h * 0.2;

    this.ctx.translate(w * 0.5 + offsetX, h * 0.85 + offsetY);
    this.ctx.scale(scaleX, scaleY);
    this.ctx.drawImage(img, -w * 0.5, -h * 0.85, w, h);

    this.ctx.restore();
  }

  dispose(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.root.remove();
  }
}
