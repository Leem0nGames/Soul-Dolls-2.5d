import * as THREE from 'three';
import type { FxQualityTier } from '../domain/FxPool.ts';

export const BASE_RENDER_W = 427;
export const BASE_RENDER_H = 240;

export interface RenderSize {
  width: number;
  height: number;
}

export function computeRenderSize(
  viewportWidth: number,
  viewportHeight: number,
  pixelEffect: boolean,
  scale: number,
  devicePixelRatio = 1
): RenderSize {
  const aspect =
    viewportWidth > 0 && viewportHeight > 0
      ? Math.max(0.42, Math.min(2.35, viewportWidth / viewportHeight))
      : BASE_RENDER_W / BASE_RENDER_H;

  if (!pixelEffect) {
    const pixelCount = Math.max(1, viewportWidth * viewportHeight);
    const maxPixels = 4_194_304;
    const ratio = Math.min(
      Math.max(1, devicePixelRatio),
      2,
      Math.sqrt(maxPixels / pixelCount)
    );
    return {
      width: Math.max(1, Math.floor(viewportWidth * ratio)),
      height: Math.max(1, Math.floor(viewportHeight * ratio)),
    };
  }

  if (aspect >= 1) {
    const height = Math.max(144, Math.round(BASE_RENDER_H * scale));
    return {
      width: Math.max(200, Math.round(height * aspect)),
      height,
    };
  }

  const width = Math.max(160, Math.round(BASE_RENDER_H * scale));
  return {
    width,
    height: Math.max(220, Math.round(width / aspect)),
  };
}

export class PixelRenderer {
  readonly webgl: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  private scale = 1.0;
  private qualityTier: FxQualityTier = 'high';
  private avgFrameMs = 16.6;
  private resizeCooldown = 2000;
  private contextLost = false;
  private pixelEffect = true;
  private onContextLostCb?: () => void;
  private onContextRestoredCb?: () => void;

  constructor(
    container: HTMLElement,
    onContextLost?: () => void,
    onContextRestored?: () => void
  ) {
    this.onContextLostCb = onContextLost;
    this.onContextRestoredCb = onContextRestored;

    this.webgl = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'low-power',
      alpha: false,
    });
    this.webgl.outputColorSpace = THREE.SRGBColorSpace;
    this.webgl.setPixelRatio(1);
    this.webgl.shadowMap.enabled = false;

    this.canvas = this.webgl.domElement;
    this.canvas.className = 'pixel-canvas w-full h-full block bg-crypt-ink';
    container.appendChild(this.canvas);

    this.applyInternalSize();

    this.canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.addEventListener('webglcontextrestored', this.handleContextRestored);
    window.addEventListener('resize', this.handleWindowResize);
    window.addEventListener('orientationchange', this.handleWindowResize);
    window.visualViewport?.addEventListener('resize', this.handleWindowResize);
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.onContextLostCb?.();
  };

  private handleContextRestored = (): void => {
    this.contextLost = false;
    this.applyInternalSize();
    this.onContextRestoredCb?.();
  };

  private handleWindowResize = (): void => {
    this.applyInternalSize();
  };

  private applyInternalSize(): void {
    const vw = window.visualViewport?.width ?? window.innerWidth;
    const vh = window.visualViewport?.height ?? window.innerHeight;
    const size = computeRenderSize(
      vw,
      vh,
      this.pixelEffect,
      this.scale,
      window.devicePixelRatio
    );
    this.webgl.setSize(size.width, size.height, false);
  }

  setPixelEffect(enabled: boolean): void {
    if (this.pixelEffect === enabled) return;
    this.pixelEffect = enabled;
    this.applyInternalSize();
  }

  getAspect(): number {
    return this.canvas.width / Math.max(1, this.canvas.height);
  }

  getInternalHeight(): number {
    return this.canvas.height;
  }

  getQualityTier(): FxQualityTier {
    return this.qualityTier;
  }

  updateDynamicResolution(dtMs: number): void {
    this.avgFrameMs = this.avgFrameMs * 0.9 + dtMs * 0.1;
    if (this.resizeCooldown > 0) {
      this.resizeCooldown -= dtMs;
      return;
    }

    let nextScale = this.scale;
    let nextTier = this.qualityTier;

    if (this.avgFrameMs > 24) {
      if (this.scale > 0.6) {
        nextScale = Math.max(0.6, Math.round((this.scale - 0.1) * 10) / 10);
      }
      if (this.qualityTier === 'high') nextTier = 'medium';
      else if (this.qualityTier === 'medium') nextTier = 'low';
    } else if (this.avgFrameMs < 17) {
      if (this.scale < 1.0) {
        nextScale = Math.min(1.0, Math.round((this.scale + 0.1) * 10) / 10);
      }
      if (this.qualityTier === 'low') nextTier = 'medium';
      else if (this.qualityTier === 'medium') nextTier = 'high';
    }

    if (nextScale !== this.scale || nextTier !== this.qualityTier) {
      this.scale = nextScale;
      this.qualityTier = nextTier;
      this.applyInternalSize();
      this.resizeCooldown = 1800;
    }
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    if (this.contextLost) return;
    this.webgl.render(scene, camera);
  }

  isContextLost(): boolean {
    return this.contextLost;
  }

  dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.handleContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.handleContextRestored);
    window.removeEventListener('resize', this.handleWindowResize);
    window.removeEventListener('orientationchange', this.handleWindowResize);
    window.visualViewport?.removeEventListener('resize', this.handleWindowResize);
    this.webgl.dispose();
    this.canvas.remove();
  }
}
