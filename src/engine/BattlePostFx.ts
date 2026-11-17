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
import type { MoveImpactProfile } from './moveVfxProfiles.ts';

const _impactColor = new THREE.Color();
const _clearColor = new THREE.Color();

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
    uImpactTint: { value: new THREE.Vector3(1, 1, 1) },
    uImpactFlash: { value: 0 },
    uSpeedLines: { value: 0 },
    uSpeedLinePhase: { value: 0 },
    tRefraction: { value: null },
    uRefractionMix: { value: 0 },
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
    uniform vec3 uImpactTint;
    uniform float uImpactFlash;
    uniform float uSpeedLines;
    uniform float uSpeedLinePhase;
    uniform sampler2D tRefraction;
    uniform float uRefractionMix;
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

      if (uRefractionMix > 0.0001) {
        vec2 refr = texture2D(tRefraction, vUv).rg * uRefractionMix;
        uv += refr;
        chroma += refr * 1.8;
      }

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

      if (uSpeedLines > 0.0001) {
        vec2 sp = vUv - uCenter;
        sp.x *= uAspect;
        float sr = length(sp);
        float ang = atan(sp.y, sp.x);
        float spokes = pow(max(0.0, sin(ang * 22.0 + uSpeedLinePhase + sin(ang * 5.0) * 1.4)), 14.0);
        float fall = smoothstep(0.16, 0.82, sr) * (1.0 - smoothstep(0.72, 1.12, sr));
        col += uImpactTint * spokes * fall * uSpeedLines;
      }

      if (uImpactFlash > 0.0001) {
        float flashLuma = clamp(uImpactFlash, 0.0, 1.0);
        col = mix(col, uImpactTint, flashLuma * 0.42);
        col += vec3(1.0) * flashLuma * 0.08;
      }

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
  private refractionTarget: THREE.WebGLRenderTarget | null = null;
  private refractionScene: THREE.Scene | null = null;
  private readonly blackTexture = new THREE.DataTexture(
    new Uint8Array([0, 0, 0, 0]),
    1,
    1,
    THREE.RGBAFormat
  );
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

  private flashElapsed = 0;
  private flashDuration = 0.2;
  private flashPeak = 0;
  private speedElapsed = 0;
  private speedDuration = 0.3;
  private speedPeak = 0;
  private bloomPulseElapsed = 0;
  private bloomPulseDuration = 0.5;
  private bloomPulsePeak = 0;

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
    this.blackTexture.needsUpdate = true;
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

      this.refractionTarget = new THREE.WebGLRenderTarget(
        Math.max(1, Math.floor(w / 2)),
        Math.max(1, Math.floor(h / 2)),
        {
          type: THREE.HalfFloatType,
          format: THREE.RGBAFormat,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
          depthBuffer: false,
          stencilBuffer: false,
        }
      );

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
      this.impactPass.uniforms.tRefraction.value =
        this.refractionTarget.texture;
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

  setRefractionScene(scene: THREE.Scene | null): void {
    this.refractionScene = scene;
    if (this.impactPass) {
      this.impactPass.uniforms.tRefraction.value =
        scene && this.refractionTarget
          ? this.refractionTarget.texture
          : this.blackTexture;
    }
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

  private getBaseBloomStrength(): number {
    const intensity = Math.max(0, Math.min(2, this.postFxOptions.bloomIntensity));
    const baseStrength = this.pixelEffect ? 0.16 : 0.22;
    return baseStrength * intensity;
  }

  private applyProfileUniforms(): void {
    if (this.bloomPass) {
      const intensity = Math.max(0, Math.min(2, this.postFxOptions.bloomIntensity));
      this.bloomPass.strength = this.getBaseBloomStrength();
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
    u.uRefractionMix.value =
      this.refractionScene && this.qualityTier === 'high' && !this.pixelEffect ? 1 : 0;
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

  triggerMoveImpact(
    profile: MoveImpactProfile,
    tintHex: number,
    screenX: number,
    screenY: number
  ): void {
    const sx = THREE.MathUtils.clamp(screenX, 0.06, 0.94);
    const sy = THREE.MathUtils.clamp(screenY, 0.06, 0.94);

    if (profile.distortion > 0.0001) {
      this.triggerShockwave(sx, sy, profile.distortion, profile.shockDuration);
    }

    _impactColor.setHex(tintHex);
    if (this.impactPass) {
      this.impactPass.uniforms.uCenter.value.set(sx, sy);
      this.impactPass.uniforms.uImpactTint.value.set(
        _impactColor.r,
        _impactColor.g,
        _impactColor.b
      );
    }

    if (profile.flash > 0.001) {
      this.flashElapsed = 0.001;
      this.flashDuration = Math.max(0.06, profile.flashMs / 1000);
      this.flashPeak = Math.min(0.65, profile.flash);
    }

    if (profile.speedLines > 0.001 && this.qualityTier !== 'low') {
      this.speedElapsed = 0.001;
      this.speedDuration = Math.max(0.12, profile.speedDuration);
      this.speedPeak =
        Math.min(0.55, profile.speedLines) * (this.qualityTier === 'high' ? 1 : 0.6);
    }

    if (profile.bloom > 0.001 && this.qualityTier !== 'low') {
      this.bloomPulseElapsed = 0.001;
      this.bloomPulseDuration = Math.max(0.2, profile.bloomDuration);
      this.bloomPulsePeak = Math.min(0.65, profile.bloom);
    }

    if (profile.dim > 0.001) {
      this.pulseArenaDim(profile.dim, profile.dimDuration);
    }
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

    if (this.flashElapsed > 0) {
      this.flashElapsed += dt;
      if (this.flashElapsed >= this.flashDuration) {
        this.flashElapsed = 0;
        this.impactPass.uniforms.uImpactFlash.value = 0;
      } else {
        const t = this.flashElapsed / this.flashDuration;
        this.impactPass.uniforms.uImpactFlash.value =
          this.flashPeak * Math.pow(1 - t, 2.2);
      }
    }

    if (this.speedElapsed > 0) {
      this.speedElapsed += dt;
      this.impactPass.uniforms.uSpeedLinePhase.value += dt * 18;
      if (this.speedElapsed >= this.speedDuration) {
        this.speedElapsed = 0;
        this.impactPass.uniforms.uSpeedLines.value = 0;
      } else {
        const t = this.speedElapsed / this.speedDuration;
        this.impactPass.uniforms.uSpeedLines.value = this.speedPeak * Math.pow(1 - t, 1.4);
      }
    }

    if (this.bloomPulseElapsed > 0 && this.bloomPass) {
      this.bloomPulseElapsed += dt;
      if (this.bloomPulseElapsed >= this.bloomPulseDuration) {
        this.bloomPulseElapsed = 0;
        this.bloomPass.strength = this.getBaseBloomStrength();
      } else {
        const t = this.bloomPulseElapsed / this.bloomPulseDuration;
        this.bloomPass.strength =
          this.getBaseBloomStrength() + this.bloomPulsePeak * Math.pow(1 - t, 1.8);
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
      this.flashElapsed > 0 ||
      this.speedElapsed > 0 ||
      this.bloomPulseElapsed > 0 ||
      (this.refractionScene !== null && this.qualityTier === 'high') ||
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
      this.refractionTarget?.setSize(
        Math.max(1, Math.floor(w / 2)),
        Math.max(1, Math.floor(h / 2))
      );
      if (this.impactPass) {
        this.impactPass.uniforms.uAspect.value = w / Math.max(1, h);
        this.impactPass.uniforms.uTexelSize.value.set(1 / w, 1 / h);
      }
    }

    this.renderRefraction();
    this.composer.render();
  }

  private renderRefraction(): void {
    if (
      !this.refractionScene ||
      !this.refractionTarget ||
      this.qualityTier !== 'high' ||
      this.pixelEffect
    ) {
      return;
    }

    const prevTarget = this.webgl.getRenderTarget();
    this.webgl.getClearColor(_clearColor);
    const prevAlpha = this.webgl.getClearAlpha();

    this.webgl.setRenderTarget(this.refractionTarget);
    this.webgl.setClearColor(0x000000, 0);
    this.webgl.clear(true, false, false);
    this.webgl.render(this.refractionScene, this.camera);

    this.webgl.setRenderTarget(prevTarget);
    this.webgl.setClearColor(_clearColor, prevAlpha);
  }

  private disposeComposer(): void {
    this.composer?.dispose();
    this.renderTarget?.dispose();
    this.refractionTarget?.dispose();
    this.composer = null;
    this.bloomPass = null;
    this.impactPass = null;
    this.renderTarget = null;
    this.refractionTarget = null;
  }

  dispose(): void {
    this.webgl.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);
    this.disposeComposer();
    this.blackTexture.dispose();
  }
}
