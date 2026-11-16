import * as THREE from 'three';
import type { FxQualityTier } from '../domain/FxPool.ts';
import type { GraphicsQualitySetting } from '../domain/types.ts';
import type { PostFxOptions } from './BiomeGradeShader.ts';

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
      3,
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
  private qualityMode: GraphicsQualitySetting = 'auto';
  private qualityTier: FxQualityTier = 'high';
  private shadowsEnabled = true;
  private ambientParticlesEnabled = true;
  private postFxOptions: PostFxOptions = {
    bloom: true,
    bloomIntensity: 1.0,
    tiltShift: true,
    colorGrading: true,
    vignette: true,
  };
  private avgFrameMs = 16.6;
  private resizeCooldown = 2000;
  private contextLost = false;
  private pixelEffect = false;
  private readonly isSoftwareGl: boolean;
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
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    let softwareGl = true;
    try {
      const gl = this.webgl.getContext();
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param) ?? '');
        softwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      }
    } catch {
      softwareGl = true;
    }
    this.isSoftwareGl = softwareGl;
    this.webgl.shadowMap.enabled = !softwareGl;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;

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

  isPixelEffectEnabled(): boolean {
    return this.pixelEffect;
  }

  isSoftwareRenderer(): boolean {
    return this.isSoftwareGl;
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

  setQualityMode(mode: GraphicsQualitySetting): void {
    this.qualityMode = mode;
    if (mode !== 'auto') {
      this.qualityTier = mode;
    }
    this.syncShadowMapState();
  }

  getQualityMode(): GraphicsQualitySetting {
    return this.qualityMode;
  }

  setShadowsEnabled(enabled: boolean): void {
    this.shadowsEnabled = enabled;
    this.syncShadowMapState();
  }

  areShadowsEnabled(): boolean {
    return this.shadowsEnabled;
  }

  setAmbientParticlesEnabled(enabled: boolean): void {
    this.ambientParticlesEnabled = enabled;
  }

  areAmbientParticlesEnabled(): boolean {
    return this.ambientParticlesEnabled;
  }

  setPostFxOptions(opts: PostFxOptions): void {
    this.postFxOptions = { ...opts };
  }

  getPostFxOptions(): PostFxOptions {
    return this.postFxOptions;
  }

  private syncShadowMapState(): void {
    this.webgl.shadowMap.enabled =
      !this.isSoftwareGl && this.shadowsEnabled && this.qualityTier !== 'low';
  }

  updateDynamicResolution(dtMs: number): void {
    this.avgFrameMs = this.avgFrameMs * 0.9 + dtMs * 0.1;
    if (this.qualityMode !== 'auto') {
      if (this.qualityTier !== this.qualityMode) {
        this.qualityTier = this.qualityMode;
        this.syncShadowMapState();
      }
      return;
    }

    if (this.resizeCooldown > 0) {
      this.resizeCooldown -= dtMs;
      return;
    }

    let nextScale = this.scale;
    let nextTier = this.qualityTier;

    if (this.avgFrameMs > 24) {
      if (this.pixelEffect && this.scale > 0.75) {
        nextScale = Math.max(0.75, Math.round((this.scale - 0.1) * 10) / 10);
      }
      if (this.qualityTier === 'high') nextTier = 'medium';
      else if (this.qualityTier === 'medium') nextTier = 'low';
    } else if (this.avgFrameMs < 17) {
      if (this.pixelEffect && this.scale < 1.0) {
        nextScale = Math.min(1.0, Math.round((this.scale + 0.1) * 10) / 10);
      }
      if (this.qualityTier === 'low') nextTier = 'medium';
      else if (this.qualityTier === 'medium') nextTier = 'high';
    }

    if (nextScale !== this.scale || nextTier !== this.qualityTier) {
      const scaleChanged = nextScale !== this.scale;
      this.scale = nextScale;
      this.qualityTier = nextTier;
      this.syncShadowMapState();
      if (scaleChanged) {
        this.applyInternalSize();
      }
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
