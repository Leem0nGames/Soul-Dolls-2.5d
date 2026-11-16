import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
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

interface StarterSlot {
  speciesId: number;
  mesh: THREE.Mesh;
  shadow: THREE.Mesh;
  matHandle: BattleSpriteMaterialHandle;
  rig: SoulDollIdleRig;
  baseX: number;
  baseZ: number;
  hopTimer: number;
}

interface WispState {
  positions: Float32Array;
  speeds: Float32Array;
  phases: Float32Array;
  geo: THREE.BufferGeometry;
}

const STARTER_ORDER = [1, 4, 7] as const;

function createSoftGlowTexture(): THREE.CanvasTexture {
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

function createShadowDiscTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(11, 8, 14, 0.35)';
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(11, 8, 14, 0.65)';
  ctx.beginPath();
  ctx.arc(16, 16, 10, 0, Math.PI * 2);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function createRuneCircleTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const cx = 256;
  const cy = 256;

  ctx.fillStyle = 'rgba(18, 63, 60, 0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, 224, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = PALETTE.resonantGold;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 216, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = PALETTE.kiCyan;
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 12]);
  ctx.beginPath();
  ctx.arc(cx, cy, 188, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 8 cardinal diamond markers
  ctx.fillStyle = PALETTE.brightBrass;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const rx = cx + Math.cos(a) * 216;
    const ry = cy + Math.sin(a) * 216;
    ctx.save();
    ctx.translate(rx, ry);
    ctx.rotate(a);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

const _raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _camPos = new THREE.Vector3();

export class TitleScene implements Scene {
  readonly name = 'title';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private overlay: HTMLDivElement;
  private starters: StarterSlot[] = [];
  private runeRing: THREE.Mesh | null = null;
  private wisps: WispState | null = null;
  private lastAspect = -1;
  private time = 0;
  private unsubCreatureLoad: (() => void) | null = null;
  private reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private handleStageTap = (e: PointerEvent): void => {
    const canvas = this.game.renderer.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    _ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_ndc, this.game.cameraRig.camera);

    const hits = _raycaster.intersectObjects(
      this.starters.map((s) => s.mesh),
      false
    );
    if (hits.length > 0) {
      const slot = this.starters.find((s) => s.mesh === hits[0].object);
      if (slot) {
        this.game.synth.unlock();
        slot.hopTimer = 0.45;
        slot.rig.injectImpulse(0, 0.36, 0.12);
        this.game.synth.playCry(slot.speciesId);
      }
    }
  };

  constructor(private readonly game: Game) {
    const skyTex = createGradientSkyTexture(
      hexToNumber(PALETTE.abyssInk),
      hexToNumber(PALETTE.deepAbyss)
    );
    this.disposables.track(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(hexToNumber(PALETTE.deepAbyss), 10, 24);

    this.overlay = document.createElement('div');
    this.overlay.className =
      'pointer-events-none fixed inset-0 z-20 flex flex-col justify-between safe-pad px-4 pt-3 pb-0 sm:px-6 sm:pt-5';
    this.buildDiorama();
  }

  private buildDiorama(): void {
    // Night sanctuary lighting for normal-mapped meadow turf
    const hemiLight = new THREE.HemisphereLight(0xd2f5ef, 0x3b4d42, 1.85);
    const keyLight = new THREE.DirectionalLight(0xeefcf8, 1.45);
    keyLight.position.set(3.5, 7.5, 4.0);
    this.scene.add(hemiLight, keyLight);
    this.disposables.track(hemiLight);
    this.disposables.track(keyLight);

    // Rich meadow ground with normal map relief
    const groundGeo = new THREE.PlaneGeometry(22, 18);
    groundGeo.rotateX(-Math.PI / 2);
    const uvAttr = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
    uvAttr.setXY(0, 0, 5);
    uvAttr.setXY(1, 6, 5);
    uvAttr.setXY(2, 0, 0);
    uvAttr.setXY(3, 6, 0);

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.game.assets.getGrassTexture(),
      normalMap: this.game.assets.getGrassNormalTexture(),
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.94,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(ground);
    this.disposables.track(groundGeo);
    this.disposables.track(groundMat);

    // Subtle illuminated astral rune dais under the starter trio
    const runeGeo = new THREE.PlaneGeometry(5.6, 4.2);
    runeGeo.rotateX(-Math.PI / 2);
    const runeTex = createRuneCircleTexture();
    const runeMat = new THREE.MeshBasicMaterial({
      map: runeTex,
      transparent: true,
      depthWrite: false,
    });
    this.runeRing = new THREE.Mesh(runeGeo, runeMat);
    this.runeRing.position.set(0, 0.015, 0.95);
    this.scene.add(this.runeRing);
    this.disposables.track(runeGeo);
    this.disposables.track(runeTex);
    this.disposables.track(runeMat);

    // Starter SoulDolls + grounded contact shadows
    const spriteGeo = createBottomPivotPlaneGeometry(1, 1, 24, 32);
    const shadowGeo = new THREE.PlaneGeometry(1.15, 0.56);
    shadowGeo.rotateX(-Math.PI / 2);
    const shadowTex = createShadowDiscTexture();
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
    });
    this.disposables.track(spriteGeo);
    this.disposables.track(shadowGeo);
    this.disposables.track(shadowTex);
    this.disposables.track(shadowMat);

    STARTER_ORDER.forEach((id, idx) => {
      const matHandle = createBattleSpriteMaterial(
        this.game.assets.getCreatureTexture(id, 'front')
      );
      const rig = new SoulDollIdleRig({
        view: 'front',
        flipX: false,
        cycleDuration: 3.5,
        initialPhase: idx * 0.34,
        breathingEnabled: !this.reducedMotion,
      });
      const anchor = this.game.assets.getCreatureRigAnchor?.(id, 'front');
      if (anchor) rig.setAnchor(anchor);

      const mesh = new THREE.Mesh(spriteGeo, matHandle.material);
      mesh.renderOrder = 3;
      const shadow = new THREE.Mesh(shadowGeo, shadowMat);
      shadow.position.y = 0.022;
      shadow.renderOrder = 2;

      this.scene.add(shadow, mesh);
      this.disposables.track(matHandle.material);
      this.starters.push({
        speciesId: id,
        mesh,
        shadow,
        matHandle,
        rig,
        baseX: 0,
        baseZ: 0.9,
        hopTimer: 0,
      });
    });

    if (this.game.assets.onCreatureLoaded) {
      this.unsubCreatureLoad = this.game.assets.onCreatureLoaded((loadedId) => {
        const slot = this.starters.find((s) => s.speciesId === loadedId);
        const anchor = slot && this.game.assets.getCreatureRigAnchor?.(loadedId, 'front');
        if (slot && anchor) {
          slot.rig.setAnchor(anchor);
        }
      });
    }

    // Sanctuary framing trees, lanterns & foreground foliage (arc framing without blocking starters)
    const propSpecs: Array<{
      kind: 'oak' | 'birch' | 'pine' | 'mushroom_tree_arcane' | 'lamp_double' | 'tall_grass_flower';
      w: number;
      h: number;
      coords: Array<[number, number]>;
    }> = [
      {
        kind: 'oak',
        w: 2.55,
        h: 2.35,
        coords: [
          [-4.3, -2.4],
          [4.3, -2.4],
        ],
      },
      {
        kind: 'birch',
        w: 2.45,
        h: 2.25,
        coords: [
          [-2.35, -3.15],
          [2.35, -3.15],
        ],
      },
      {
        kind: 'pine',
        w: 1.75,
        h: 3.1,
        coords: [
          [0, -4.15],
          [-5.6, -4.0],
          [5.6, -4.0],
        ],
      },
      {
        kind: 'lamp_double',
        w: 0.72,
        h: 1.95,
        coords: [
          [-2.95, -0.55],
          [2.95, -0.55],
        ],
      },
      {
        kind: 'tall_grass_flower',
        w: 1.15,
        h: 0.95,
        coords: [
          [-2.85, 2.0],
          [2.85, 2.0],
        ],
      },
    ];

    for (const spec of propSpecs) {
      const pGeo = createBottomPivotPlaneGeometry(spec.w, spec.h);
      const pMat = new THREE.MeshBasicMaterial({
        map: this.game.assets.getPropTexture(spec.kind),
        alphaTest: 0.45,
        side: THREE.DoubleSide,
      });
      this.disposables.track(pGeo);
      this.disposables.track(pMat);
      for (const [px, pz] of spec.coords) {
        const m = new THREE.Mesh(pGeo, pMat);
        m.position.set(px, 0, pz);
        m.rotation.x = -0.14;
        this.scene.add(m);
      }
    }

    // Floating astral Ki wisps across the clearing
    const count = 42;
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
      const seed = (i * 9301 + 49297) % 233280;
      const r1 = seed / 233280;
      const r2 = ((seed * 7 + 13) % 233280) / 233280;
      const r3 = ((seed * 11 + 29) % 233280) / 233280;
      positions[i * 3] = (r1 - 0.5) * 7.6;
      positions[i * 3 + 1] = 0.2 + r2 * 3.1;
      positions[i * 3 + 2] = -3.0 + r3 * 3.2;
      speeds[i] = 0.14 + r2 * 0.22;
      phases[i] = r3 * Math.PI * 2;

      const c = paletteColors[i % paletteColors.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const wispGeo = new THREE.BufferGeometry();
    wispGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    wispGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const glowTex = createSoftGlowTexture();
    const wispMat = new THREE.PointsMaterial({
      size: 0.24,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(wispGeo, wispMat);
    points.renderOrder = 4;
    this.scene.add(points);
    this.disposables.track(wispGeo);
    this.disposables.track(glowTex);
    this.disposables.track(wispMat);
    this.wisps = { positions, speeds, phases, geo: wispGeo };

    this.layoutForAspect(this.game.renderer.getAspect());
  }

  private layoutForAspect(aspect: number): void {
    this.lastAspect = aspect;
    const isPortrait = aspect < 0.85;
    const spreadX = isPortrait ? 1.12 : 1.82;
    const centerZ = isPortrait ? 1.48 : 1.18;
    const sideZ = isPortrait ? 0.72 : 0.74;
    const scale = isPortrait ? 1.54 : 1.72;

    if (this.runeRing) {
      this.runeRing.scale.set(isPortrait ? 0.76 : 1.0, 1, isPortrait ? 0.88 : 1.0);
    }

    this.starters.forEach((slot, idx) => {
      const offset = idx - 1; // -1, 0, +1
      slot.baseX = offset * spreadX;
      slot.baseZ = offset === 0 ? centerZ : sideZ;
      const slotScale = offset === 0 ? scale * 1.05 : scale * 0.96;
      slot.mesh.position.set(slot.baseX, 0, slot.baseZ);
      slot.mesh.scale.setScalar(slotScale);
      slot.shadow.position.set(slot.baseX, 0.022, slot.baseZ);
      slot.shadow.scale.setScalar(offset === 0 ? 1.05 : 0.95);
    });
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: false,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.cameraRig.setPreset('battle');
    this.game.cameraRig.snapTo(0, 0, 0);
    this.game.bus.emit('audio:music', { track: 'title' });
    this.game.renderer.canvas.addEventListener('pointerdown', this.handleStageTap);
    this.renderUi();
    this.game.uiLayer.appendChild(this.overlay);
  }

  private renderUi(): void {
    const hasSave = this.game.saveManager.hasSave();
    const showInstall =
      !this.game.isStandalone() && (this.game.canInstallPwa() || this.game.isIos());
    const showFullscreen =
      !this.game.isStandalone() &&
      typeof document.documentElement.requestFullscreen === 'function';
    const isTouchDevice =
      window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    const hintText = isTouchDevice
      ? 'Toca una SoulDoll para escucharla · Elige cómo comenzar'
      : 'Pulsa Enter para comenzar · Haz clic en una SoulDoll para escucharla';

    this.overlay.innerHTML = `
      <header class="flex items-center justify-between gap-2">
        <div class="pointer-events-auto">
          <button
            data-mute
            class="min-h-[44px] px-3.5 rounded-none border-2 border-cold-stone bg-crypt-ink hover:border-ki-cyan text-xs font-bold text-porcelain whitespace-nowrap shrink-0 shadow-[2px_2px_0_#050505] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            ${this.game.synth.getMuted() ? 'Audio: OFF' : 'Audio: ON'}
          </button>
        </div>
        <div class="pointer-events-auto flex items-center gap-2">
          <button
            data-options
            class="min-h-[44px] px-3.5 rounded-none border-2 border-cold-stone bg-crypt-ink hover:border-ki-cyan text-xs font-bold text-resonant-gold whitespace-nowrap shrink-0 shadow-[2px_2px_0_#050505] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
          >
            ${ES.menu.options}
          </button>
          ${
            showFullscreen
              ? `<button data-fs class="min-h-[44px] px-3.5 rounded-none border-2 border-cold-stone bg-crypt-ink hover:border-ki-cyan text-xs font-bold text-ice-cyan whitespace-nowrap shrink-0 shadow-[2px_2px_0_#050505] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none">${document.fullscreenElement ? 'Salir' : ES.app.fullscreen}</button>`
              : ''
          }
          ${
            showInstall
              ? `<button data-install class="min-h-[44px] px-3.5 px-btn-primary text-xs font-bold whitespace-nowrap shrink-0">${ES.app.installApp}</button>`
              : ''
          }
        </div>
      </header>

      <div class="pt-3 sm:pt-4 flex flex-col items-center text-center">
        <div class="inline-block bg-crypt-ink border-2 border-ki-cyan px-3 py-1 text-[11px] font-bold tracking-[0.2em] uppercase text-ki-cyan shadow-[2px_2px_0_#050505]">
          RPG Táctico 2.5D · 50 Marionetas
        </div>
        <svg viewBox="0 0 388 84" shape-rendering="crispEdges" class="mt-1.5 w-[min(88vw,400px)] h-auto" aria-label="SoulDolls">
          <defs>
            <clipPath id="pxTitleTopClip">
              <rect x="0" y="0" width="388" height="35" />
            </clipPath>
          </defs>
          <text x="194" y="58" text-anchor="middle" font-family="monospace" font-weight="900" font-size="50" letter-spacing="4" fill="${PALETTE.uiInk}" stroke="${PALETTE.uiInk}" stroke-width="10" stroke-linejoin="miter">${ES.app.title}</text>
          <text x="190" y="54" text-anchor="middle" font-family="monospace" font-weight="900" font-size="50" letter-spacing="4" fill="${PALETTE.cryptInk}" stroke="${PALETTE.cryptInk}" stroke-width="8" stroke-linejoin="miter">${ES.app.title}</text>
          <text x="190" y="54" text-anchor="middle" font-family="monospace" font-weight="900" font-size="50" letter-spacing="4" fill="${PALETTE.resonantGold}">${ES.app.title}</text>
          <text x="190" y="54" text-anchor="middle" font-family="monospace" font-weight="900" font-size="50" letter-spacing="4" fill="${PALETTE.paleGold}" clip-path="url(#pxTitleTopClip)">${ES.app.title}</text>
        </svg>
        <div class="mt-1 flex items-center justify-center gap-2.5 text-xs sm:text-sm font-bold tracking-wider text-porcelain px-text-outline">
          <span class="h-[2px] w-6 bg-resonant-gold"></span>
          <span>${ES.app.subtitle}</span>
          <span class="h-[2px] w-6 bg-resonant-gold"></span>
        </div>
      </div>

      <div class="flex-1 min-h-0"></div>

      <footer class="-mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-5 bg-crypt-ink border-t-2 border-old-bronze shadow-[inset_0_2px_0_#3B2B1A] flex flex-col items-center gap-2.5">
        <div class="pointer-events-auto w-full max-w-md flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5">
          ${
            hasSave
              ? `<button data-continue class="flex-1 min-h-[50px] px-6 px-btn-primary font-extrabold text-base whitespace-nowrap">${ES.app.continueGame}</button>
                 <button data-new class="flex-1 min-h-[50px] px-6 px-btn-secondary font-bold text-base whitespace-nowrap">${ES.app.newGame}</button>`
              : `<button data-new class="w-full sm:w-auto sm:min-w-[240px] min-h-[50px] px-8 px-btn-primary font-extrabold text-base whitespace-nowrap">${ES.app.newGame}</button>`
          }
        </div>
        <div class="text-[11px] text-bone-gray text-center">
          ${hintText}
        </div>
      </footer>
    `;

    this.overlay.querySelector('[data-new]')?.addEventListener('click', () => {
      this.game.synth.unlock();
      this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
      this.game.startNewGame();
    });
    this.overlay.querySelector('[data-continue]')?.addEventListener('click', () => {
      this.game.synth.unlock();
      this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
      this.game.continueGame();
    });
    this.overlay.querySelector('[data-mute]')?.addEventListener('click', () => {
      this.game.synth.unlock();
      this.game.saveData.options.muted = !this.game.saveData.options.muted;
      this.game.applyOptions();
      this.game.persistOptions();
      this.renderUi();
    });
    this.overlay.querySelector('[data-options]')?.addEventListener('click', () => {
      this.game.synth.unlock();
      this.game.bus.emit('audio:sfx', { sfx: 'menu' });
      this.game.menu.openOptionsOnly(this.game.saveData, {
        onOptionsChanged: () => {
          this.game.applyOptions();
          this.game.persistOptions();
        },
        onClose: () => {
          this.renderUi();
        },
      });
    });
    this.overlay.querySelector('[data-fs]')?.addEventListener('click', async () => {
      this.game.synth.unlock();
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Ignore browsers blocking fullscreen requests
      }
      this.renderUi();
    });
    this.overlay.querySelector('[data-install]')?.addEventListener('click', async () => {
      if (this.game.canInstallPwa()) {
        await this.game.promptInstall();
        this.renderUi();
      } else if (this.game.isIos()) {
        this.game.showToast(ES.app.installIosHint);
      }
    });
  }

  fixedUpdate(dt: number): void {
    const aspect = this.game.renderer.getAspect();
    if (Math.abs(aspect - this.lastAspect) > 0.03) {
      this.layoutForAspect(aspect);
    }

    if (!this.reducedMotion) {
      this.time += dt;
    }

    const cam = this.game.cameraRig.camera;
    _camPos.copy(cam.position);

    this.starters.forEach((slot) => {
      let y = 0;
      if (slot.hopTimer > 0) {
        const prevHop = slot.hopTimer;
        slot.hopTimer = Math.max(0, slot.hopTimer - dt);
        const p = 1 - slot.hopTimer / 0.45;
        y = Math.sin(p * Math.PI) * 0.42;
        if (prevHop > 0 && slot.hopTimer === 0) {
          // Ground landing recoil feeds naturally into secondary bust spring
          slot.rig.injectImpulse(0, -0.78, 0.24);
        }
      }
      if (!this.reducedMotion) {
        slot.rig.update(dt, true);
      }
      slot.mesh.position.set(slot.baseX, y, slot.baseZ);
      slot.mesh.lookAt(_camPos.x, slot.mesh.position.y, _camPos.z);
      slot.rig.applyToMesh(slot.mesh, slot.matHandle);
    });

    if (this.wisps && !this.reducedMotion) {
      const { positions, speeds, phases, geo } = this.wisps;
      const count = speeds.length;
      for (let i = 0; i < count; i++) {
        const yIdx = i * 3 + 1;
        positions[yIdx] += speeds[i] * dt;
        positions[i * 3] += Math.sin(this.time * 1.1 + phases[i]) * 0.14 * dt;
        if (positions[yIdx] > 3.5) {
          positions[yIdx] = 0.18;
        }
      }
      (geo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    const swayX = this.reducedMotion ? 0 : Math.sin(this.time * 0.35) * 0.65;
    this.game.cameraRig.follow(swayX, 0, 0, dt);

    if (!this.game.menu.isOpen() && this.game.input.justPressed('a')) {
      this.game.synth.unlock();
      this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
      if (this.game.saveManager.hasSave()) this.game.continueGame();
      else this.game.startNewGame();
    }
  }

  render(): void {
    this.game.renderer.render(this.scene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.unsubCreatureLoad?.();
    this.unsubCreatureLoad = null;
    this.game.renderer.canvas.removeEventListener('pointerdown', this.handleStageTap);
    this.overlay.remove();
    this.disposables.disposeAll();
  }
}
