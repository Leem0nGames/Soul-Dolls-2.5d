import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import {
  TUTORIAL_SPEAKER,
  TUTORIAL_STEPS,
  type TutorialFact,
} from '../domain/Tutorial.ts';
import { createBottomPivotPlaneGeometry } from '../engine/BillboardBatch.ts';
import {
  createBattleSpriteMaterial,
  type BattleSpriteMaterialHandle,
} from '../engine/BattleSpriteMat.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import { createGradientSkyTexture } from '../engine/SkyBackdrop.ts';
import { SoulDollIdleRig } from '../engine/SoulDollIdleRig.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';
import { OverworldScene } from './OverworldScene.ts';

interface DioramaDoll {
  speciesId: number;
  mesh: THREE.Mesh;
  matHandle: BattleSpriteMaterialHandle;
  rig: SoulDollIdleRig;
  baseX: number;
  baseZ: number;
}

function createSoftWispTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PALETTE.warmWhite;
  ctx.fillRect(6, 2, 4, 12);
  ctx.fillRect(2, 6, 12, 4);
  ctx.fillRect(4, 4, 8, 8);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createDaisCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const cx = 128;
  const cy = 128;

  ctx.fillStyle = 'rgba(18, 63, 60, 0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, 112, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.resonantGold;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, 108, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = PALETTE.kiCyan;
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function toneBadgeClasses(tone?: TutorialFact['tone']): string {
  switch (tone) {
    case 'cyan':
      return 'border-ki-cyan text-ice-cyan bg-deep-abyss';
    case 'violet':
      return 'border-soul-violet text-ghost-violet bg-nightshade';
    case 'crimson':
      return 'border-rift-crimson text-peach-blush bg-dried-blood';
    case 'gold':
    default:
      return 'border-resonant-gold text-pale-gold bg-crypt-ink';
  }
}

const _camPos = new THREE.Vector3();

export class TutorialScene implements Scene {
  readonly name = 'tutorial';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private overlay: HTMLDivElement;
  private dolls: DioramaDoll[] = [];
  private maestroMesh: THREE.Mesh | null = null;
  private wispGeo: THREE.BufferGeometry | null = null;
  private wispPositions: Float32Array | null = null;
  private wispSpeeds: Float32Array | null = null;
  private wispPhases: Float32Array | null = null;
  private unsubCreatureLoad: (() => void) | null = null;
  private time = 0;
  private reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private stepIndex = 0;
  private charPos = 0;
  private charTimer = 0;
  private dialogTextEl: HTMLDivElement | null = null;
  private finished = false;

  constructor(private readonly game: Game) {
    const skyTex = createGradientSkyTexture(
      hexToNumber(PALETTE.abyssInk),
      hexToNumber(PALETTE.deepAbyss)
    );
    this.disposables.track(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(hexToNumber(PALETTE.deepAbyss), 9, 22);

    this.overlay = document.createElement('div');
    this.overlay.className =
      'pointer-events-auto fixed inset-0 z-20 flex flex-col justify-between gap-2 safe-pad px-3 py-2.5 sm:px-6 sm:py-4';

    this.buildStage();
  }

  private buildStage(): void {
    const hemiLight = new THREE.HemisphereLight(0xd2f5ef, 0x2a1f2d, 1.75);
    const keyLight = new THREE.DirectionalLight(0xfff4d8, 1.35);
    keyLight.position.set(3.2, 7.0, 4.2);
    this.scene.add(hemiLight, keyLight);
    this.disposables.track(hemiLight);
    this.disposables.track(keyLight);

    const groundGeo = new THREE.PlaneGeometry(20, 16);
    groundGeo.rotateX(-Math.PI / 2);
    const uvAttr = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
    uvAttr.setXY(0, 0, 5);
    uvAttr.setXY(1, 5, 5);
    uvAttr.setXY(2, 0, 0);
    uvAttr.setXY(3, 5, 0);

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.game.assets.getGrassTexture(),
      normalMap: this.game.assets.getGrassNormalTexture(),
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.94,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(ground);
    this.disposables.track(groundGeo);
    this.disposables.track(groundMat);

    const daisGeo = new THREE.PlaneGeometry(4.8, 3.6);
    daisGeo.rotateX(-Math.PI / 2);
    const daisTex = createDaisCircleTexture();
    const daisMat = new THREE.MeshBasicMaterial({
      map: daisTex,
      transparent: true,
      depthWrite: false,
    });
    const daisMesh = new THREE.Mesh(daisGeo, daisMat);
    daisMesh.position.set(0, 0.015, 0.6);
    this.scene.add(daisMesh);
    this.disposables.track(daisGeo);
    this.disposables.track(daisTex);
    this.disposables.track(daisMat);

    // Maestro de Marionetas billboard standing on the dais
    const maestroGeo = createBottomPivotPlaneGeometry(1.15, 1.65);
    const maestroMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getCharacterTexture(
        'merchant',
        'down',
        0,
        'maestro_marionetas'
      ),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.maestroMesh = new THREE.Mesh(maestroGeo, maestroMat);
    this.maestroMesh.position.set(0, 0, 0.55);
    this.maestroMesh.renderOrder = 3;
    this.scene.add(this.maestroMesh);
    this.disposables.track(maestroGeo);
    this.disposables.track(maestroMat);

    // Flanking lanterns
    const lampGeo = createBottomPivotPlaneGeometry(0.7, 1.9);
    const lampMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getPropTexture('lamp_double'),
      alphaTest: 0.45,
      side: THREE.DoubleSide,
    });
    this.disposables.track(lampGeo);
    this.disposables.track(lampMat);
    for (const lx of [-2.6, 2.6]) {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, 0, -0.45);
      this.scene.add(lamp);
    }

    // Starter SoulDolls breathing gently beside the Maestro
    const dollGeo = createBottomPivotPlaneGeometry(1, 1, 20, 28);
    this.disposables.track(dollGeo);
    const pairSpecs: Array<{ speciesId: number; x: number; z: number; phase: number }> = [
      { speciesId: 1, x: -1.55, z: 0.9, phase: 0.1 },
      { speciesId: 7, x: 1.55, z: 0.9, phase: 0.55 },
    ];
    for (const spec of pairSpecs) {
      const matHandle = createBattleSpriteMaterial(
        this.game.assets.getCreatureTexture(spec.speciesId, 'front')
      );
      const rig = new SoulDollIdleRig({
        view: 'front',
        flipX: false,
        cycleDuration: 3.4,
        initialPhase: spec.phase,
        breathingEnabled: !this.reducedMotion,
      });
      const anchor = this.game.assets.getCreatureRigAnchor?.(spec.speciesId, 'front');
      if (anchor) rig.setAnchor(anchor);

      const mesh = new THREE.Mesh(dollGeo, matHandle.material);
      mesh.position.set(spec.x, 0, spec.z);
      mesh.scale.setScalar(1.38);
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.disposables.track(matHandle.material);
      this.dolls.push({
        speciesId: spec.speciesId,
        mesh,
        matHandle,
        rig,
        baseX: spec.x,
        baseZ: spec.z,
      });
    }

    if (this.game.assets.onCreatureLoaded) {
      this.unsubCreatureLoad = this.game.assets.onCreatureLoaded((loadedId) => {
        const slot = this.dolls.find((d) => d.speciesId === loadedId);
        const anchor = slot && this.game.assets.getCreatureRigAnchor?.(loadedId, 'front');
        if (slot && anchor) {
          slot.rig.setAnchor(anchor);
        }
      });
    }

    // Floating Ki wisps
    const count = 28;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const phases = new Float32Array(count);
    const paletteColors = [
      new THREE.Color(PALETTE.kiCyan),
      new THREE.Color(PALETTE.resonantGold),
      new THREE.Color(PALETTE.soulViolet),
    ];

    for (let i = 0; i < count; i++) {
      const seed = (i * 7919 + 104729) % 233280;
      const r1 = seed / 233280;
      const r2 = ((seed * 5 + 17) % 233280) / 233280;
      const r3 = ((seed * 13 + 31) % 233280) / 233280;
      positions[i * 3] = (r1 - 0.5) * 6.8;
      positions[i * 3 + 1] = 0.25 + r2 * 2.8;
      positions[i * 3 + 2] = -2.2 + r3 * 2.8;
      speeds[i] = 0.14 + r2 * 0.2;
      phases[i] = r3 * Math.PI * 2;

      const c = paletteColors[i % paletteColors.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const wispGeo = new THREE.BufferGeometry();
    wispGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    wispGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const glowTex = createSoftWispTexture();
    const wispMat = new THREE.PointsMaterial({
      size: 0.22,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(wispGeo, wispMat);
    points.renderOrder = 4;
    this.scene.add(points);
    this.disposables.track(wispGeo);
    this.disposables.track(glowTex);
    this.disposables.track(wispMat);
    this.wispGeo = wispGeo;
    this.wispPositions = positions;
    this.wispSpeeds = speeds;
    this.wispPhases = phases;
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: false,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.touchControls.setVisible(false);
    this.game.cameraRig.setPreset('battle');
    this.game.cameraRig.snapTo(0, 0, 0);
    this.game.bus.emit('audio:music', { track: 'title' });
    this.stepIndex = 0;
    this.resetTypewriter();
    this.renderUi();
    this.game.uiLayer.appendChild(this.overlay);
  }

  private resetTypewriter(): void {
    this.charPos = 0;
    this.charTimer = 0;
  }

  private isLineComplete(): boolean {
    const step = TUTORIAL_STEPS[this.stepIndex];
    return this.charPos >= step.dialog.length;
  }

  private completeLineNow(): void {
    const step = TUTORIAL_STEPS[this.stepIndex];
    this.charPos = step.dialog.length;
    if (this.dialogTextEl) {
      this.dialogTextEl.textContent = step.dialog;
    }
  }

  private goToStep(nextIndex: number): void {
    const clamped = Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, nextIndex));
    if (clamped === this.stepIndex) return;
    this.stepIndex = clamped;
    this.resetTypewriter();
    this.game.bus.emit('audio:sfx', { sfx: 'menu' });
    this.renderUi();
  }

  private advanceAction(): void {
    if (!this.isLineComplete()) {
      this.completeLineNow();
      return;
    }
    if (this.stepIndex < TUTORIAL_STEPS.length - 1) {
      this.goToStep(this.stepIndex + 1);
    } else {
      this.finishTutorial();
    }
  }

  private finishTutorial(): void {
    if (this.finished) return;
    this.finished = true;
    this.game.saveData.flags.tutorial_seen = true;
    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
    this.game.scenes.replace(new OverworldScene(this.game));
  }

  private renderUi(): void {
    const step = TUTORIAL_STEPS[this.stepIndex];
    const isFirst = this.stepIndex === 0;
    const isLast = this.stepIndex === TUTORIAL_STEPS.length - 1;
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const hint = isTouch ? ES.tutorial.touchControlsHint : ES.tutorial.controlsHint;

    const stepSquares = TUTORIAL_STEPS.map((s, idx) => {
      const cls =
        idx === this.stepIndex
          ? 'bg-resonant-gold border-pale-gold'
          : idx < this.stepIndex
            ? 'bg-ki-cyan border-ice-cyan'
            : 'bg-abyss-ink border-cold-stone';
      return `<button type="button" data-step="${idx}" aria-label="${s.title}" class="w-4 h-4 rounded-none border-2 ${cls} cursor-pointer"></button>`;
    }).join('');

    const factCards = step.facts
      .map(
        (fact) => `
          <div class="px-panel px-card p-2 sm:p-2.5 flex items-start gap-2.5">
            <span class="px-panel px-hud-box px-2 py-1 text-[10px] sm:text-xs font-extrabold tracking-wider shrink-0 whitespace-nowrap ${toneBadgeClasses(fact.tone)}">${fact.badge}</span>
            <div class="min-w-0">
              <div class="text-xs sm:text-sm font-bold text-porcelain leading-tight">${fact.label}</div>
              <div class="text-[11px] sm:text-xs text-bone-gray leading-snug mt-0.5">${fact.detail}</div>
            </div>
          </div>
        `
      )
      .join('');

    this.overlay.innerHTML = `
      <header class="flex items-center justify-between gap-2 max-w-2xl w-full mx-auto">
        <div class="px-panel px-hud-box px-3 py-1.5 flex items-center gap-2 min-w-0">
          <span class="text-xs sm:text-sm font-extrabold text-resonant-gold truncate">${TUTORIAL_SPEAKER}</span>
          <span class="text-[10px] sm:text-xs font-bold tracking-wider uppercase text-ki-cyan hidden sm:inline">· ${ES.tutorial.headerBadge}</span>
        </div>
        <button type="button" data-skip class="px-btn px-btn-secondary min-h-[44px] px-3.5 text-xs sm:text-sm font-bold whitespace-nowrap shrink-0">${ES.tutorial.skip}</button>
      </header>

      <main class="px-panel px-panel-violet px-panel-ornate w-full max-w-2xl mx-auto p-3 sm:p-4 flex flex-col gap-2.5 my-auto">
        <div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <div class="inline-block px-panel px-hud-box px-2 py-0.5 text-[10px] font-bold tracking-widest uppercase text-ki-cyan border-ki-cyan">${step.badge}</div>
              <h1 class="mt-1 text-sm sm:text-lg font-extrabold text-pale-gold leading-tight px-text-shadow">${step.title}</h1>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">${stepSquares}</div>
          </div>
          <div class="px-divider mt-2" aria-hidden="true"></div>
        </div>

        <div class="touch-scroll grid grid-cols-1 ${step.facts.length === 4 ? 'sm:grid-cols-2' : 'sm:grid-cols-1'} gap-2 max-h-[34dvh] sm:max-h-[42dvh] overflow-y-auto pr-0.5">
          ${factCards}
        </div>
      </main>

      <footer data-dialog-card class="px-panel px-panel-ornate w-full max-w-2xl mx-auto px-3.5 py-2.5 sm:p-4 cursor-pointer">
        <div class="flex items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-ash-purple">
          <span class="px-panel px-hud-box px-2.5 py-0.5 text-[11px] sm:text-xs font-extrabold uppercase tracking-wider text-resonant-gold">${TUTORIAL_SPEAKER}</span>
          <span class="text-[10px] text-bone-gray hidden sm:inline">${hint}</span>
        </div>

        <div data-dialog-text class="min-h-[2.6rem] sm:min-h-[3.2rem] text-[13px] sm:text-base leading-snug sm:leading-relaxed text-porcelain"></div>

        <div class="px-divider mt-2" aria-hidden="true"></div>
        <div class="mt-2 flex items-center justify-between gap-2">
          <button
            type="button"
            data-prev
            ${isFirst ? 'disabled' : ''}
            class="px-btn px-btn-secondary min-h-[44px] px-3.5 text-xs sm:text-sm font-bold whitespace-nowrap"
          >${ES.tutorial.prev}</button>

          <button
            type="button"
            data-next
            class="px-btn px-btn-primary min-h-[44px] px-4 text-xs sm:text-sm font-extrabold whitespace-nowrap"
          >${isLast ? ES.tutorial.finish : ES.tutorial.next}</button>
        </div>
      </footer>
    `;

    this.dialogTextEl = this.overlay.querySelector('[data-dialog-text]');
    if (this.dialogTextEl) {
      this.dialogTextEl.textContent = step.dialog.slice(0, this.charPos);
    }

    this.overlay.querySelector('[data-skip]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.finishTutorial();
    });

    this.overlay.querySelector('[data-prev]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.stepIndex > 0) this.goToStep(this.stepIndex - 1);
    });

    this.overlay.querySelector('[data-next]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.advanceAction();
    });

    this.overlay.querySelectorAll<HTMLElement>('[data-step]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetIdx = Number(btn.dataset.step);
        if (Number.isFinite(targetIdx)) {
          this.goToStep(targetIdx);
        }
      });
    });

    this.overlay.querySelector('[data-dialog-card]')?.addEventListener('click', () => {
      if (!this.isLineComplete()) {
        this.completeLineNow();
      }
    });
  }

  fixedUpdate(dt: number): void {
    if (this.finished) return;

    if (!this.reducedMotion) {
      this.time += dt;
    }

    // Typewriter update matching DialogBox pacing
    const step = TUTORIAL_STEPS[this.stepIndex];
    if (this.charPos < step.dialog.length && this.dialogTextEl) {
      const speed = this.game.saveData.options.textSpeed === 'fast' ? 95 : 46;
      this.charTimer += dt * speed;
      const nextPos = Math.min(step.dialog.length, Math.floor(this.charTimer));
      if (nextPos > this.charPos) {
        this.charPos = nextPos;
        this.dialogTextEl.textContent = step.dialog.slice(0, this.charPos);
      }
    }

    // 3D stage idle animations
    const cam = this.game.cameraRig.camera;
    _camPos.copy(cam.position);

    if (this.maestroMesh) {
      this.maestroMesh.lookAt(_camPos.x, this.maestroMesh.position.y, _camPos.z);
    }

    for (const doll of this.dolls) {
      if (!this.reducedMotion) {
        doll.rig.update(dt, true);
      }
      doll.mesh.position.set(doll.baseX, 0, doll.baseZ);
      doll.mesh.lookAt(_camPos.x, doll.mesh.position.y, _camPos.z);
      doll.rig.applyToMesh(doll.mesh, doll.matHandle);
    }

    if (this.wispGeo && this.wispPositions && this.wispSpeeds && this.wispPhases && !this.reducedMotion) {
      const count = this.wispSpeeds.length;
      for (let i = 0; i < count; i++) {
        const yIdx = i * 3 + 1;
        this.wispPositions[yIdx] += this.wispSpeeds[i] * dt;
        this.wispPositions[i * 3] += Math.sin(this.time * 1.1 + this.wispPhases[i]) * 0.12 * dt;
        if (this.wispPositions[yIdx] > 3.1) {
          this.wispPositions[yIdx] = 0.2;
        }
      }
      (this.wispGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    const swayX = this.reducedMotion ? 0 : Math.sin(this.time * 0.32) * 0.45;
    this.game.cameraRig.follow(swayX, 0, 0, dt);

    // Keyboard / gamepad navigation
    if (this.game.input.justPressed('a')) {
      this.advanceAction();
    } else if (this.game.input.justPressed('right')) {
      if (this.stepIndex < TUTORIAL_STEPS.length - 1) {
        this.goToStep(this.stepIndex + 1);
      }
    } else if (this.game.input.justPressed('left')) {
      if (this.stepIndex > 0) {
        this.goToStep(this.stepIndex - 1);
      }
    } else if (this.game.input.justPressed('b')) {
      this.finishTutorial();
    }
  }

  render(): void {
    this.game.renderer.render(this.scene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.unsubCreatureLoad?.();
    this.unsubCreatureLoad = null;
    this.overlay.remove();
    this.disposables.disposeAll();
  }
}
