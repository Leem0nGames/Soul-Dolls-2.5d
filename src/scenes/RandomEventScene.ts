import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import type { RandomEventDef } from '../domain/RandomEvents.ts';
import { createBottomPivotPlaneGeometry } from '../engine/BillboardBatch.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import { createGradientSkyTexture } from '../engine/SkyBackdrop.ts';

const _camPos = new THREE.Vector3();

export class RandomEventScene implements Scene {
  readonly name = 'random_event';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private overlay: HTMLDivElement;
  private npcMesh: THREE.Mesh | null = null;
  private playerMesh: THREE.Mesh | null = null;
  private time = 0;
  private reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private state: 'intro' | 'choices' | 'outcome' = 'intro';
  private selectedOutcomeText = '';
  private charPos = 0;
  private charTimer = 0;
  private currentDisplayText = '';
  private dialogTextEl: HTMLDivElement | null = null;

  constructor(
    private readonly game: Game,
    private readonly eventDef: RandomEventDef
  ) {
    const skyTex = createGradientSkyTexture(0x0a0712, 0x161022);
    this.disposables.track(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(0x161022, 7, 18);

    this.overlay = document.createElement('div');
    this.overlay.className =
      'pointer-events-auto fixed inset-0 z-30 flex flex-col justify-end gap-3 safe-pad p-4 sm:p-6';

    this.buildStage();
  }

  private buildStage(): void {
    const hemiLight = new THREE.HemisphereLight(0xdaf5ed, 0x1c1322, 1.6);
    const keyLight = new THREE.DirectionalLight(0xffe6b0, 1.2);
    keyLight.position.set(3.0, 6.0, 3.5);
    this.scene.add(hemiLight, keyLight);
    this.disposables.track(hemiLight);
    this.disposables.track(keyLight);

    // Small 8x8 clearing ground plane
    const groundGeo = new THREE.PlaneGeometry(10, 10);
    groundGeo.rotateX(-Math.PI / 2);
    const uvAttr = groundGeo.getAttribute('uv') as THREE.BufferAttribute;
    uvAttr.setXY(0, 0, 4);
    uvAttr.setXY(1, 4, 4);
    uvAttr.setXY(2, 0, 0);
    uvAttr.setXY(3, 4, 0);

    const groundMat = new THREE.MeshStandardMaterial({
      map: this.game.assets.getGrassTexture(),
      normalMap: this.game.assets.getGrassNormalTexture(),
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    this.scene.add(ground);
    this.disposables.track(groundGeo);
    this.disposables.track(groundMat);

    // NPC Billboard
    const npcGeo = createBottomPivotPlaneGeometry(1.1, 1.6);
    const npcTex = this.game.assets.getCharacterTexture(
      this.eventDef.npcRole as any,
      'down',
      0,
      this.eventDef.npcVariant ?? 'npc'
    );
    const npcMat = new THREE.MeshBasicMaterial({
      map: npcTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.npcMesh = new THREE.Mesh(npcGeo, npcMat);
    this.npcMesh.position.set(0, 0, -1.2);
    this.npcMesh.renderOrder = 3;
    this.scene.add(this.npcMesh);
    this.disposables.track(npcGeo);
    this.disposables.track(npcMat);

    // Player Billboard
    const playerGeo = createBottomPivotPlaneGeometry(1.0, 1.5);
    const playerTex = this.game.assets.getCharacterTexture('player', 'up', 0);
    const playerMat = new THREE.MeshBasicMaterial({
      map: playerTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.playerMesh = new THREE.Mesh(playerGeo, playerMat);
    this.playerMesh.position.set(0, 0, 1.4);
    this.playerMesh.renderOrder = 3;
    this.scene.add(this.playerMesh);
    this.disposables.track(playerGeo);
    this.disposables.track(playerMat);

    // Surrounding trees / dark forest ring
    const treeGeo = createBottomPivotPlaneGeometry(2.2, 3.4);
    const treeTex = this.game.assets.getPropTexture('pine');
    const treeMat = new THREE.MeshBasicMaterial({
      map: treeTex,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.disposables.track(treeGeo);
    this.disposables.track(treeMat);

    const treePositions = [
      [-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5],
      [-5.0, 0], [5.0, 0], [0, -5.0], [0, 5.0],
      [-3.8, -5.2], [3.8, -5.2], [-5.2, -3.8], [5.2, -3.8],
    ];
    for (const [tx, tz] of treePositions) {
      const tree = new THREE.Mesh(treeGeo, treeMat);
      tree.position.set(tx, 0, tz);
      this.scene.add(tree);
    }
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
    this.game.cameraRig.snapTo(0, 1.2, 2.8);
    this.game.bus.emit('audio:music', { track: 'title' });
    this.state = 'intro';
    this.currentDisplayText = this.eventDef.introText;
    this.resetTypewriter();
    this.renderUi();
    this.game.uiLayer.appendChild(this.overlay);
  }

  private resetTypewriter(): void {
    this.charPos = 0;
    this.charTimer = 0;
  }

  private isLineComplete(): boolean {
    return this.charPos >= this.currentDisplayText.length;
  }

  private completeLineNow(): void {
    this.charPos = this.currentDisplayText.length;
    if (this.dialogTextEl) {
      this.dialogTextEl.textContent = this.currentDisplayText;
    }
  }

  private handleDialogClick(): void {
    if (!this.isLineComplete()) {
      this.completeLineNow();
      return;
    }
    if (this.state === 'intro') {
      this.state = 'choices';
      this.game.bus.emit('audio:sfx', { sfx: 'menu' });
      this.renderUi();
    } else if (this.state === 'outcome') {
      this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
      this.game.scenes.pop();
    }
  }

  private chooseOption(index: number): void {
    const choice = this.eventDef.choices[index];
    if (!choice) return;
    choice.action(this.game);
    this.selectedOutcomeText = choice.outcomeText;
    this.state = 'outcome';
    this.currentDisplayText = this.selectedOutcomeText;
    this.resetTypewriter();
    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
    this.renderUi();
  }

  private renderUi(): void {
    const isTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);
    const hint = isTouch ? 'Toca para continuar' : 'Pulsa A o Click para continuar';

    const choicesHtml =
      this.state === 'choices'
        ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
            <button type="button" data-choice="0" class="px-card px-btn-primary min-h-[50px] p-3 text-xs sm:text-sm font-extrabold text-left leading-snug cursor-pointer flex items-center justify-between">
              <span>${this.eventDef.choices[0].text}</span>
              <span class="text-resonant-gold text-base ml-2">▶</span>
            </button>
            <button type="button" data-choice="1" class="px-card px-btn-secondary min-h-[50px] p-3 text-xs sm:text-sm font-extrabold text-left leading-snug cursor-pointer flex items-center justify-between">
              <span>${this.eventDef.choices[1].text}</span>
              <span class="text-ki-cyan text-base ml-2">▶</span>
            </button>
          </div>
        `
        : '';

    this.overlay.innerHTML = `
      <div class="mx-auto w-full max-w-2xl px-panel p-3.5 sm:p-5 text-porcelain cursor-pointer" data-card>
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b-2 border-ash-purple">
          <div class="flex items-center gap-2">
            <span class="px-hud-box px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-ki-cyan border-ki-cyan">Evento Aleatorio</span>
            <h2 class="text-sm sm:text-base font-extrabold text-pale-gold">${this.eventDef.title}</h2>
          </div>
          <span class="text-[11px] text-bone-gray hidden sm:inline">${hint}</span>
        </div>

        <div data-dialog-text class="min-h-[3.2rem] sm:min-h-[4rem] text-sm sm:text-base leading-snug sm:leading-relaxed text-porcelain"></div>

        ${choicesHtml}
      </div>
    `;

    this.dialogTextEl = this.overlay.querySelector('[data-dialog-text]');
    if (this.dialogTextEl) {
      this.dialogTextEl.textContent = this.currentDisplayText.slice(0, this.charPos);
    }

    this.overlay.querySelector('[data-card]')?.addEventListener('click', () => {
      if (this.state !== 'choices') {
        this.handleDialogClick();
      }
    });

    this.overlay.querySelectorAll<HTMLElement>('[data-choice]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.choice);
        if (Number.isFinite(idx)) {
          this.chooseOption(idx);
        }
      });
    });
  }

  fixedUpdate(dt: number): void {
    if (!this.reducedMotion) {
      this.time += dt;
    }

    // Typewriter
    if (this.charPos < this.currentDisplayText.length && this.dialogTextEl) {
      const speed = this.game.saveData.options.textSpeed === 'fast' ? 95 : 46;
      this.charTimer += dt * speed;
      const nextPos = Math.min(this.currentDisplayText.length, Math.floor(this.charTimer));
      if (nextPos > this.charPos) {
        this.charPos = nextPos;
        this.dialogTextEl.textContent = this.currentDisplayText.slice(0, this.charPos);
      }
    }

    // Cinematic camera & Billboard lookAt
    const cam = this.game.cameraRig.camera;
    _camPos.copy(cam.position);

    if (this.npcMesh) {
      this.npcMesh.lookAt(_camPos.x, this.npcMesh.position.y, _camPos.z);
    }
    if (this.playerMesh) {
      this.playerMesh.lookAt(_camPos.x, this.playerMesh.position.y, _camPos.z);
    }

    // Cinematic subtle camera orbit
    const orbitAngle = this.reducedMotion ? 0 : Math.sin(this.time * 0.25) * 0.8;
    this.game.cameraRig.follow(orbitAngle, 1.2, 2.6, dt);

    // Controls
    if (this.game.input.justPressed('a')) {
      if (this.state !== 'choices') {
        this.handleDialogClick();
      }
    } else if (this.game.input.justPressed('b')) {
      if (this.state === 'intro' || this.state === 'outcome') {
        this.handleDialogClick();
      }
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
