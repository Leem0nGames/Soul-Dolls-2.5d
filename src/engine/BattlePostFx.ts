import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { FxQualityTier } from '../domain/FxPool.ts';

export const ImpactShockwaveShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uShockProgress: { value: 0 },
    uShockStrength: { value: 0 },
    uDimAmount: { value: 0 },
    uAspect: { value: 1.77 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uCenter;
    uniform float uShockProgress;
    uniform float uShockStrength;
    uniform float uDimAmount;
    uniform float uAspect;
    varying vec2 vUv;

    void main() {
      vec2 uv = vUv;
      vec2 chroma = vec2(0.0);

      if (uShockProgress > 0.001 && uShockProgress < 0.999 && uShockStrength > 0.0001) {
        vec2 diff = uv - uCenter;
        vec2 aspectDiff = vec2(diff.x * uAspect, diff.y);
        float dist = length(aspectDiff);
        vec2 dir = dist > 0.0001 ? normalize(diff) : vec2(0.0);
        float waveRadius = mix(0.02, 0.78, uShockProgress);
        float ring = smoothstep(0.16, 0.0, abs(dist - waveRadius));
        float decay = (1.0 - uShockProgress);
        float disp = ring * uShockStrength * decay;
        uv -= dir * disp;
        chroma = dir * disp * 1.35;
      }

      vec4 base = texture2D(tDiffuse, clamp(uv, 0.001, 0.999));
      if (length(chroma) > 0.0001) {
        float r = texture2D(tDiffuse, clamp(uv + chroma, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(uv - chroma, 0.001, 0.999)).b;
        base.r = r;
        base.b = b;
      }

      if (uDimAmount > 0.001) {
        float edge = smoothstep(0.54, 1.02, length(vUv - 0.5));
        base.rgb *= 1.0 - edge * uDimAmount;
      }

      gl_FragColor = base;
    }
  `,
};

function detectSoftwareWebGl(webgl: THREE.WebGLRenderer): boolean {
  try {
    const gl = webgl.getContext();
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class BattlePostFx {
  private readonly isSoftwareGl: boolean;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private impactPass: ShaderPass | null = null;
  private renderTarget: THREE.WebGLRenderTarget | null = null;
  private lastWidth = 0;
  private lastHeight = 0;

  private shockElapsed = 0;
  private shockDuration = 0.3;
  private shockStrength = 0;
  private dimElapsed = 0;
  private dimDuration = 0.5;
  private dimPeak = 0;

  constructor(
    private readonly webgl: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera
  ) {
    this.isSoftwareGl = detectSoftwareWebGl(webgl);
    if (!this.isSoftwareGl) {
      this.initComposer();
    }
  }

  private initComposer(): void {
    try {
      const w = Math.max(1, this.webgl.domElement.width);
      const h = Math.max(1, this.webgl.domElement.height);
      this.lastWidth = w;
      this.lastHeight = h;

      this.renderTarget = new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
      });

      this.composer = new EffectComposer(this.webgl, this.renderTarget);
      this.composer.setPixelRatio(1);
      this.composer.setSize(w, h);

      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(w, h),
        0.2, // strength: crisp localized glow on HDR VFX cores without washing out SoulDolls
        0.2, // radius
        1.15 // threshold > 1.0: keeps SDR sky/clouds/sprites untouched
      );
      this.composer.addPass(this.bloomPass);

      this.impactPass = new ShaderPass(ImpactShockwaveShader);
      this.impactPass.uniforms.uAspect.value = w / Math.max(1, h);
      this.composer.addPass(this.impactPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);
    } catch {
      this.disposeComposer();
    }
  }

  setQualityTier(tier: FxQualityTier): void {
    if (this.bloomPass) {
      this.bloomPass.strength = 0.2;
      this.bloomPass.enabled = tier !== 'low';
    }
  }

  triggerShockwave(screenX: number, screenY: number, strength = 0.022, duration = 0.32): void {
    this.shockElapsed = 0.001;
    this.shockDuration = Math.max(0.12, duration);
    this.shockStrength = Math.min(0.045, Math.max(0, strength));
    if (this.impactPass) {
      this.impactPass.uniforms.uCenter.value.set(
        THREE.MathUtils.clamp(screenX, 0.08, 0.92),
        THREE.MathUtils.clamp(screenY, 0.08, 0.92)
      );
      this.impactPass.uniforms.uShockStrength.value = this.shockStrength;
    }
  }

  pulseArenaDim(peak = 0.22, duration = 0.52): void {
    this.dimElapsed = 0.001;
    this.dimDuration = Math.max(0.15, duration);
    this.dimPeak = Math.min(0.24, Math.max(0, peak));
  }

  update(dt: number): void {
    if (!this.impactPass || dt <= 0) return;

    if (this.shockElapsed > 0) {
      this.shockElapsed += dt;
      if (this.shockElapsed >= this.shockDuration) {
        this.shockElapsed = 0;
        this.impactPass.uniforms.uShockProgress.value = 0;
      } else {
        this.impactPass.uniforms.uShockProgress.value =
          this.shockElapsed / this.shockDuration;
      }
    }

    if (this.dimElapsed > 0) {
      this.dimElapsed += dt;
      if (this.dimElapsed >= this.dimDuration) {
        this.dimElapsed = 0;
        this.impactPass.uniforms.uDimAmount.value = 0;
      } else {
        const t = this.dimElapsed / this.dimDuration;
        const env = t < 0.25 ? t / 0.25 : 1 - (t - 0.25) / 0.75;
        this.impactPass.uniforms.uDimAmount.value = this.dimPeak * Math.max(0, env);
      }
    }
  }

  render(): void {
    if (this.isSoftwareGl || !this.composer) {
      this.webgl.render(this.scene, this.camera);
      return;
    }

    const w = Math.max(1, this.webgl.domElement.width);
    const h = Math.max(1, this.webgl.domElement.height);
    if (w !== this.lastWidth || h !== this.lastHeight) {
      this.lastWidth = w;
      this.lastHeight = h;
      this.composer.setSize(w, h);
      this.bloomPass?.resolution.set(w, h);
      if (this.impactPass) {
        this.impactPass.uniforms.uAspect.value = w / Math.max(1, h);
      }
    }

    this.composer.render();
  }

  private disposeComposer(): void {
    this.composer?.dispose();
    this.renderTarget?.dispose();
    this.composer = null;
    this.bloomPass = null;
    this.impactPass = null;
    this.renderTarget = null;
  }

  dispose(): void {
    this.disposeComposer();
  }
}
