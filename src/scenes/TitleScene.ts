import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { createBottomPivotPlaneGeometry } from '../engine/BillboardBatch.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import {
  buildCloudBillboards,
  createGradientSkyTexture,
  updateCloudBillboards,
  type CloudDriftItem,
} from '../engine/SkyBackdrop.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';

export class TitleScene implements Scene {
  readonly name = 'title';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private overlay: HTMLDivElement;
  private creatures: THREE.Mesh[] = [];
  private clouds: CloudDriftItem[] = [];
  private time = 0;

  constructor(private readonly game: Game) {
    const skyTex = createGradientSkyTexture(
      hexToNumber(PALETTE.cryptInk),
      hexToNumber(PALETTE.vibrantAqua)
    );
    this.disposables.track(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(hexToNumber(PALETTE.vibrantAqua), 16, 40);

    this.overlay = document.createElement('div');
    this.overlay.className =
      'pointer-events-none fixed inset-0 z-20 flex flex-col justify-between safe-pad p-4 sm:p-6';
    this.buildDiorama();
  }

  private buildDiorama(): void {
    // Ground patch
    const geo = new THREE.PlaneGeometry(16, 12);
    geo.rotateX(-Math.PI / 2);
    const uvAttr = geo.getAttribute('uv') as THREE.BufferAttribute;
    uvAttr.setXY(0, 0, 3);
    uvAttr.setXY(1, 4, 3);
    uvAttr.setXY(2, 0, 0);
    uvAttr.setXY(3, 4, 0);

    const groundMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getGrassTexture(),
    });
    const ground = new THREE.Mesh(geo, groundMat);
    this.scene.add(ground);
    this.disposables.track(geo);
    this.disposables.track(groundMat);

    // Three starter billboards
    const starterIds = [1, 4, 7];
    const spriteGeo = createBottomPivotPlaneGeometry(1.5, 1.5);
    this.disposables.track(spriteGeo);

    starterIds.forEach((id, i) => {
      const mat = new THREE.MeshBasicMaterial({
        map: this.game.assets.getCreatureTexture(id, 'front'),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(spriteGeo, mat);
      mesh.position.set((i - 1) * 2.1, 0, 0.8);
      mesh.rotation.x = -0.2;
      this.scene.add(mesh);
      this.disposables.track(mat);
      this.creatures.push(mesh);
    });

    const treeGeo = createBottomPivotPlaneGeometry(2.45, 2.2);
    const oakMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getPropTexture('oak'),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    const willowMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getPropTexture('birch'),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.disposables.track(treeGeo);
    this.disposables.track(oakMat);
    this.disposables.track(willowMat);

    const trees: Array<[number, number, boolean]> = [
      [-4.6, -2.5, true],
      [-2.3, -3.4, false],
      [2.3, -3.4, false],
      [4.6, -2.5, true],
    ];
    for (const [tx, tz, isOak] of trees) {
      const tree = new THREE.Mesh(treeGeo, isOak ? oakMat : willowMat);
      tree.position.set(tx, 0, tz);
      tree.rotation.x = -0.15;
      this.scene.add(tree);
    }

    this.clouds = buildCloudBillboards(this.scene, this.disposables, 0, -6, 14, 5, 77, 6.5);
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
    const hintText = isTouchDevice ? ES.app.touchControlsHint : ES.app.controlsHint;

    this.overlay.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div class="pointer-events-auto">
          <button data-mute class="min-h-[44px] px-3 rounded-lg border border-cold-stone bg-smoked-wood/90 text-xs font-bold text-porcelain">
            ${this.game.synth.getMuted() ? '🔇 Audio: OFF' : '🔊 Audio: ON'}
          </button>
        </div>
        <div class="pointer-events-auto flex items-center gap-2">
          ${
            showFullscreen
              ? `<button data-fs class="min-h-[44px] px-3 rounded-lg border border-ki-cyan/80 bg-smoked-wood/90 text-xs font-bold text-ice-cyan">${document.fullscreenElement ? '⛶ Salir' : `⛶ ${ES.app.fullscreen}`}</button>`
              : ''
          }
          ${
            showInstall
              ? `<button data-install class="min-h-[44px] px-3 rounded-lg border border-resonant-gold/80 bg-smoked-wood/95 text-xs font-bold text-resonant-gold">${ES.app.installApp}</button>`
              : ''
          }
        </div>
      </div>

      <div class="flex flex-col items-center text-center my-auto">
        <svg viewBox="0 0 360 72" class="w-[min(86vw,380px)] h-auto drop-shadow-[0_4px_12px_rgba(11,8,14,0.85)]" aria-label="SoulDolls">
          <defs>
            <linearGradient id="mxTitleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${PALETTE.paleGold}"/>
              <stop offset="55%" stop-color="${PALETTE.resonantGold}"/>
              <stop offset="100%" stop-color="${PALETTE.rust}"/>
            </linearGradient>
          </defs>
          <text x="180" y="52" text-anchor="middle" font-family="monospace" font-weight="900" font-size="48" letter-spacing="4" fill="${PALETTE.cryptInk}" stroke="${PALETTE.cryptInk}" stroke-width="8">${ES.app.title}</text>
          <text x="180" y="52" text-anchor="middle" font-family="monospace" font-weight="900" font-size="48" letter-spacing="4" fill="url(#mxTitleGrad)">${ES.app.title}</text>
        </svg>
        <div class="mt-1 text-xs sm:text-sm font-bold tracking-widest uppercase text-crypt-ink bg-porcelain/90 border border-old-bronze/60 px-3 py-0.5 rounded-lg shadow-sm">${ES.app.subtitle}</div>

        <div class="pointer-events-auto mt-6 flex flex-wrap justify-center gap-3">
          ${
            hasSave
              ? `<button data-continue class="min-h-[48px] px-6 rounded-xl border-2 border-frosted-glass/80 bg-emerald-base hover:bg-oceanic-teal text-warm-white font-bold text-base shadow-lg">${ES.app.continueGame}</button>`
              : ''
          }
          <button data-new class="min-h-[48px] px-6 rounded-xl border-2 border-pale-gold bg-resonant-gold hover:bg-bright-brass text-crypt-ink font-bold text-base shadow-lg">${ES.app.newGame}</button>
        </div>
      </div>

      <div class="text-center space-y-1">
        <div class="text-[11px] text-porcelain font-bold bg-crypt-ink/85 border border-cold-stone/60 inline-block px-3 py-1 rounded-lg">${hintText}</div>
        <div class="text-[10px] text-porcelain font-semibold drop-shadow-[0_1px_2px_rgba(11,8,14,0.9)]">${ES.app.credits}</div>
      </div>
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
      this.renderUi();
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
    this.time += dt;
    this.creatures.forEach((m, idx) => {
      m.position.y = Math.abs(Math.sin(this.time * 3.2 + idx * 1.1)) * 0.16;
    });
    updateCloudBillboards(this.clouds, 0, dt);
    this.game.cameraRig.follow(Math.sin(this.time * 0.35) * 1.1, 0, 0, dt);

    if (this.game.input.justPressed('a')) {
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
    this.overlay.remove();
    this.disposables.disposeAll();
  }
}
