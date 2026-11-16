import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { FxQualityTier } from '../domain/FxPool.ts';
import type { BattleBiome } from '../domain/types.ts';
import {
  getBiomeVisualProfile,
  type BiomeVisualProfile,
  type PostFxOptions,
} from './BiomeGradeShader.ts';

export const ImpactShockwaveShader = {
  uniforms: {
    tDiffuse: { value: null },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uShockProgress: { value: 0 },
    uShockStrength: { value: 0 },
    uDimAmount: { value: 0 },
    uAspect: { value: 1.77 },
    uTexelSize: { value: new THREE.Vector2(1 / 1280, 1 / 720) },
    uTiltStrength: { value: 0.0022 },
    uFocusY: { value: 0.56 },
    uFocusSpan: { value: 0.23 },
    uTint: { value: new THREE.Vector3(1.03, 1.01, 0.96) },
    uLift: { value: new THREE.Vector3(0.008, 0.005, 0.0) },
    uContrast: { value: 1.05 },
    uSaturation: { value: 1.08 },
    uGradeMix: { value: 1.0 },
    uVignette: { value: 0.1 },
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
    uniform vec2 uTexelSize;
    uniform float uTiltStrength;
    uniform float uFocusY;
    uniform float uFocusSpan;
    uniform vec3 uTint;
    uniform vec3 uLift;
    uniform float uContrast;
    uniform float uSaturation;
    uniform float uGradeMix;
    uniform float uVignette;
    varying vec2 vUv;

    vec3 sampleTiltOrRaw(vec2 uv, float blurAmt) {
      if (blurAmt <= 0.00015) {
        return texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
      }
      float aspect = uTexelSize.y / max(0.00001, uTexelSize.x);
      vec2 rad = vec2(blurAmt / max(0.45, aspect), blurAmt);
      vec3 acc = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb * 0.20;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.92,  0.38) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.92, -0.38) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.38,  0.92) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.38, -0.92) * rad, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.45, -0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.45,  0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2( 0.45,  0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      acc += texture2D(tDiffuse, clamp(uv + vec2(-0.45, -0.45) * rad * 0.65, 0.001, 0.999)).rgb * 0.10;
      return acc;
    }

    void main() {
      vec2 uv = vUv;
      vec2 chroma = vec2(0.0);
      float radialBlur = 0.0;
      vec2 shockDir = vec2(0.0);

      if (uShockProgress > 0.001 && uShockProgress < 0.999 && uShockStrength > 0.0001) {
        vec2 diff = uv - uCenter;
        vec2 aspectDiff = vec2(diff.x * uAspect, diff.y);
        float dist = length(aspectDiff);
        vec2 dir = dist > 0.0001 ? normalize(diff) : vec2(0.0);
        shockDir = dir;
        float waveRadius = mix(0.02, 0.78, uShockProgress);
        float ring = smoothstep(0.16, 0.0, abs(dist - waveRadius));
        float decay = (1.0 - uShockProgress);
        float disp = ring * uShockStrength * decay;
        uv -= dir * disp;
        chroma = dir * disp * 1.35;
        radialBlur = uShockStrength * decay * 0.32 * smoothstep(0.08, 0.65, dist);
      }

      float distFromFocus = abs(vUv.y - uFocusY);
      float coc = smoothstep(uFocusSpan, min(0.95, uFocusSpan + 0.24), distFromFocus);
      vec3 col = sampleTiltOrRaw(uv, coc * uTiltStrength);

      if (radialBlur > 0.0002) {
        vec3 blurA = texture2D(tDiffuse, clamp(uv - shockDir * radialBlur, 0.001, 0.999)).rgb;
        vec3 blurB = texture2D(tDiffuse, clamp(uv + shockDir * radialBlur * 0.6, 0.001, 0.999)).rgb;
        col = col * 0.56 + (blurA + blurB) * 0.22;
      }

      if (length(chroma) > 0.0001) {
        float r = texture2D(tDiffuse, clamp(uv + chroma, 0.001, 0.999)).r;
        float b = texture2D(tDiffuse, clamp(uv - chroma, 0.001, 0.999)).b;
        col.r = r;
        col.b = b;
      }

      // Gentle filmic highlight roll-off + biome color grading + soft vignette
      vec3 rawCol = max(col, vec3(0.0));
      vec3 rolled = rawCol / (1.0 + rawCol * 0.12);
      vec3 graded = mix(rawCol, rolled * 1.12, 0.62);
      graded = graded * uTint + uLift * (1.0 - clamp(dot(graded, vec3(0.299, 0.587, 0.114)), 0.0, 1.0));
      graded = max(vec3(0.0), (graded - 0.38) * uContrast + 0.38);
      float luma = dot(graded, vec3(0.2126, 0.7152, 0.0722));
      graded = mix(vec3(luma), graded, uSaturation);
      col = mix(rawCol, graded, uGradeMix);

      float vigDist = length((vUv - 0.5) * vec2(1.15, 1.0));
      float baseVig = smoothstep(0.48, 1.05, vigDist) * uVignette;
      float dimVig = uDimAmount > 0.001 ? smoothstep(0.54, 1.02, length(vUv - 0.5)) * uDimAmount : 0.0;
      col *= 1.0 - clamp(baseVig + dimVig, 0.0, 0.65);

      gl_FragColor = vec4(col, 1.0);
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
  private qualityTier: FxQualityTier = 'high';
  private pixelEffect = false;
  private postFxOptions: PostFxOptions = {
    bloom: true,
    bloomIntensity: 1.0,
    tiltShift: true,
    colorGrading: true,
    vignette: true,
  };
  private profile: BiomeVisualProfile = getBiomeVisualProfile('meadow', { isBattle: true });

  private shockElapsed = 0;
  private shockDuration = 0.3;
  private shockStrength = 0;
  private dimElapsed = 0;
  private dimDuration = 0.5;
  private dimPeak = 0;

  private readonly handleContextRestored = (): void => {
    this.disposeComposer();
    if (!this.isSoftwareGl) {
      this.initComposer();
    }
  };

  constructor(
    private readonly webgl: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera
  ) {
    this.isSoftwareGl = detectSoftwareWebGl(webgl);
    if (!this.isSoftwareGl) {
      this.initComposer();
    }
    this.webgl.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);
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
        0.22, // crisp localized glow on HDR VFX cores without washing out SoulDolls
        0.24,
        1.1 // threshold > 1.0: keeps SDR sky/clouds/sprites untouched
      );
      this.composer.addPass(this.bloomPass);

      this.impactPass = new ShaderPass(ImpactShockwaveShader);
      this.impactPass.uniforms.uAspect.value = w / Math.max(1, h);
      this.impactPass.uniforms.uTexelSize.value.set(1 / w, 1 / h);
      this.composer.addPass(this.impactPass);

      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);

      this.applyProfileUniforms();
    } catch {
      this.disposeComposer();
    }
  }

  setBiome(biome: BattleBiome, isBoss = false): void {
    this.profile = getBiomeVisualProfile(biome, { isBoss, isBattle: true });
    this.applyProfileUniforms();
  }

  setPixelEffect(enabled: boolean): void {
    if (this.pixelEffect === enabled) return;
    this.pixelEffect = enabled;
    this.applyProfileUniforms();
  }

  setQualityTier(tier: FxQualityTier): void {
    this.qualityTier = tier;
    this.applyProfileUniforms();
  }

  setPostFxOptions(opts: PostFxOptions): void {
    if (
      this.postFxOptions.bloom === opts.bloom &&
      this.postFxOptions.bloomIntensity === opts.bloomIntensity &&
      this.postFxOptions.tiltShift === opts.tiltShift &&
      this.postFxOptions.colorGrading === opts.colorGrading &&
      this.postFxOptions.vignette === opts.vignette
    ) {
      return;
    }
    this.postFxOptions = { ...opts };
    this.applyProfileUniforms();
  }

  private applyProfileUniforms(): void {
    if (this.bloomPass) {
      const intensity = Math.max(0, Math.min(2, this.postFxOptions.bloomIntensity));
      const baseStrength = this.pixelEffect ? 0.16 : 0.22;
      this.bloomPass.strength = baseStrength * intensity;
      this.bloomPass.enabled =
        this.qualityTier !== 'low' && this.postFxOptions.bloom && intensity > 0.02;
    }
    if (!this.impactPass) return;

    const u = this.impactPass.uniforms;
    const allowTiltShift =
      this.qualityTier === 'high' && !this.pixelEffect && this.postFxOptions.tiltShift;
    u.uTiltStrength.value = allowTiltShift ? this.profile.tiltStrength : 0;
    u.uFocusY.value = this.profile.focusY;
    u.uFocusSpan.value = this.profile.focusSpan;
    u.uTint.value.copy(this.profile.tint);
    u.uLift.value.copy(this.profile.lift);
    u.uContrast.value = this.profile.contrast;
    u.uSaturation.value = this.profile.saturation;
    u.uGradeMix.value = this.postFxOptions.colorGrading ? 1.0 : 0.0;
    u.uVignette.value = this.postFxOptions.vignette ? this.profile.vignette : 0.0;
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
    try {
      const gl = this.webgl.getContext();
      if (gl?.isContextLost?.()) return;
    } catch {
      return;
    }
    const anyPostFx =
      this.shockElapsed > 0 ||
      this.dimElapsed > 0 ||
      (this.qualityTier !== 'low' && this.postFxOptions.bloom) ||
      (this.qualityTier === 'high' && !this.pixelEffect && this.postFxOptions.tiltShift) ||
      this.postFxOptions.colorGrading ||
      this.postFxOptions.vignette;
    if (this.isSoftwareGl || !this.composer || !anyPostFx) {
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
        this.impactPass.uniforms.uTexelSize.value.set(1 / w, 1 / h);
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
    this.webgl.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.disposeComposer();
  }
}
