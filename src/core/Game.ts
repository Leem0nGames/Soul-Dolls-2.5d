import { Synth } from '../audio/Synth.ts';
import { CameraRig } from '../engine/CameraRig.ts';
import { PixelRenderer } from '../engine/Renderer.ts';
import { ProceduralAssetProvider, type AssetProvider } from '../gfx/AssetProvider.ts';
import { SaveManager } from '../save/SaveManager.ts';
import { ArGachaModal } from '../ui/ArGachaModal.ts';
import { BagScreen } from '../ui/BagScreen.ts';
import { BattleHud } from '../ui/BattleHud.ts';
import { BattleTransition } from '../ui/BattleTransition.ts';
import { BestiaryScreen } from '../ui/BestiaryScreen.ts';
import { CardAlbumScreen } from '../ui/CardAlbumScreen.ts';
import { DialogBox } from '../ui/DialogBox.ts';
import { EndingModal } from '../ui/EndingModal.ts';
import { PauseMenu } from '../ui/Menu.ts';
import { PartyScreen } from '../ui/PartyScreen.ts';
import { StorageScreen } from '../ui/StorageScreen.ts';
import { SummaryScreen } from '../ui/SummaryScreen.ts';
import { TouchControls } from '../ui/TouchControls.ts';
import { UiLayerManager } from '../ui/UiLayerManager.ts';
import { VesselScreen } from '../ui/VesselScreen.ts';
import { markBestiaryCaught, markBestiarySeen } from '../domain/Bestiary.ts';
import { ES } from '../i18n/es.ts';
import type {
  BattleBiome,
  CreatureInstance,
  SaveData,
  TrainerDef,
} from '../domain/types.ts';
import { BattleScene } from '../scenes/BattleScene.ts';
import { EvolutionScene } from '../scenes/EvolutionScene.ts';
import { GalleryScene } from '../scenes/GalleryScene.ts';
import { OverworldScene } from '../scenes/OverworldScene.ts';
import { ShopScene } from '../scenes/ShopScene.ts';
import { TitleScene } from '../scenes/TitleScene.ts';
import { EventBus } from './EventBus.ts';
import { Input } from './Input.ts';
import { Loop } from './Loop.ts';
import { createRng, type Rng } from './Rng.ts';
import { SceneStack } from './SceneStack.ts';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export class Game {
  readonly container: HTMLElement;
  readonly renderer: PixelRenderer;
  readonly cameraRig: CameraRig;
  readonly assets: AssetProvider;
  readonly bus: EventBus;
  readonly input: Input;
  readonly synth: Synth;
  readonly saveManager: SaveManager;
  readonly scenes: SceneStack;
  readonly loop: Loop;
  readonly rng: Rng;

  readonly uiLayer: HTMLDivElement;
  readonly uiLayers = new UiLayerManager();
  readonly touchControls: TouchControls;
  readonly dialog: DialogBox;
  readonly menu: PauseMenu;
  readonly summary: SummaryScreen;
  readonly partyScreen: PartyScreen;
  readonly bagScreen: BagScreen;
  readonly bestiaryScreen: BestiaryScreen;
  readonly cardAlbumScreen: CardAlbumScreen;
  readonly storageScreen: StorageScreen;
  readonly battleHud: BattleHud;
  readonly battleTransition: BattleTransition;
  readonly endingModal: EndingModal;
  readonly arGachaModal: ArGachaModal;
  readonly vesselScreen: VesselScreen;

  saveData: SaveData;
  private deferredInstall: BeforeInstallPromptEvent | null = null;
  private toastEl: HTMLDivElement;
  private toastTimer = 0;

  constructor(container: HTMLElement) {
    this.container = container;
    this.bus = new EventBus();
    this.input = new Input();
    this.synth = new Synth();
    this.saveManager = new SaveManager();
    this.saveData = this.saveManager.createNew();
    this.rng = createRng(Date.now() >>> 0);
    this.assets = new ProceduralAssetProvider();

    this.renderer = new PixelRenderer(container);
    this.cameraRig = new CameraRig(this.renderer.getAspect());
    this.scenes = new SceneStack();

    this.uiLayer = document.createElement('div');
    this.uiLayer.className = 'pointer-events-none fixed inset-0 z-10';
    container.appendChild(this.uiLayer);

    this.touchControls = new TouchControls(this.uiLayer, this.input);
    this.dialog = new DialogBox(this.uiLayer);
    this.summary = new SummaryScreen(this.uiLayer, this.assets);
    this.partyScreen = new PartyScreen(this.uiLayer, this.assets, this.summary);
    this.bagScreen = new BagScreen(this.uiLayer, this.assets);
    this.bestiaryScreen = new BestiaryScreen(this.uiLayer, this.assets);
    this.cardAlbumScreen = new CardAlbumScreen(this.uiLayer, this.assets);
    this.storageScreen = new StorageScreen(this.uiLayer, this.assets, this.summary);
    this.menu = new PauseMenu(this.uiLayer, this.assets);
    this.battleHud = new BattleHud(this.uiLayer);
    this.battleHud.setAssets(this.assets);
    this.battleTransition = new BattleTransition(this.uiLayer);
    this.endingModal = new EndingModal(this.uiLayer, this.assets);
    this.arGachaModal = new ArGachaModal(this.uiLayer, this.assets);
    this.vesselScreen = new VesselScreen(this.uiLayer, this.assets);

    this.toastEl = document.createElement('div');
    this.toastEl.className =
      'pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-50 hidden rounded-none border-2 border-resonant-gold bg-crypt-ink px-3 py-1.5 text-xs font-bold text-pale-gold shadow-[3px_3px_0_#050505]';
    this.uiLayer.appendChild(this.toastEl);

    this.uiLayers.register('touchControls', this.touchControls.root);
    this.uiLayers.register('battleHud', this.battleHud.root);
    this.uiLayers.register('battleFx', this.battleHud.fxOverlay, this.battleTransition.fxRoot);
    this.uiLayers.register('dialog', this.dialog.root);
    this.uiLayers.register('battleTransition', this.battleTransition.transitionRoot);
    this.uiLayers.register(
      'menus',
      this.menu.root,
      this.partyScreen.root,
      this.bagScreen.root,
      this.bestiaryScreen.root,
      this.cardAlbumScreen.root,
      this.storageScreen.root,
      this.summary.root,
      this.endingModal.root,
      this.arGachaModal.root,
      this.vesselScreen.root
    );
    this.uiLayers.register('toast', this.toastEl);

    this.input.onFirstGesture(() => {
      this.synth.unlock();
    });

    this.bus.on('audio:sfx', ({ sfx }) => this.synth.playSfx(sfx));
    this.bus.on('audio:music', ({ track }) => this.synth.playMusic(track));
    this.bus.on('game:toast', ({ message }) => this.showToast(message));

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredInstall = e as BeforeInstallPromptEvent;
    });

    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    window.addEventListener('pagehide', this.handlePageHide);

    this.loop = new Loop(
      (dt) => {
        this.cameraRig.setAspect(this.renderer.getAspect());
        if (this.toastTimer > 0) {
          this.toastTimer -= dt;
          if (this.toastTimer <= 0) {
            this.toastEl.classList.add('hidden');
          }
        }
        this.scenes.fixedUpdate(dt);
        this.input.endFixedStep();
      },
      (alpha, frameMs) => {
        this.renderer.updateDynamicResolution(frameMs);
        this.scenes.render(alpha);
      }
    );

    this.applyOptions();
    if (new URLSearchParams(window.location.search).has('gallery')) {
      this.touchControls.setVisible(false);
      this.battleHud.hide();
      this.battleTransition.hide();
      this.scenes.replace(new GalleryScene(this));
    } else {
      this.startTitle();
    }
    this.loop.start();
  }

  applyOptions(): void {
    const opt = this.saveData.options;
    this.synth.setVolume(opt.volume);
    this.synth.setMuted(opt.muted);
    this.loop.setBatterySaver(opt.batterySaver);
    this.dialog.setFastMode(opt.textSpeed === 'fast');
    this.renderer.setPixelEffect(opt.pixelEffect);
    document.documentElement.classList.toggle('pixel-effect-off', !opt.pixelEffect);
  }

  showToast(message: string): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.remove('hidden');
    this.toastTimer = 2.4;
  }

  canInstallPwa(): boolean {
    return this.deferredInstall !== null;
  }

  isStandalone(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  }

  isIos(): boolean {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  async promptInstall(): Promise<boolean> {
    if (!this.deferredInstall) return false;
    await this.deferredInstall.prompt();
    const choice = await this.deferredInstall.userChoice;
    this.deferredInstall = null;
    return choice.outcome === 'accepted';
  }

  markSpeciesSeen(speciesId: number, level = 0): void {
    const loc = ES.maps[this.saveData.mapId] ?? this.saveData.mapId;
    markBestiarySeen(this.saveData, speciesId, loc, level);
  }

  markSpeciesCaught(
    speciesId: number,
    level = 0,
    incrementCatchCount = true
  ): void {
    const loc = ES.maps[this.saveData.mapId] ?? this.saveData.mapId;
    markBestiaryCaught(this.saveData, speciesId, loc, level, incrementCatchCount);
  }

  startTitle(): void {
    this.touchControls.setVisible(false);
    this.battleHud.hide();
    this.battleTransition.hide();
    this.scenes.replace(new TitleScene(this));
  }

  startNewGame(): void {
    this.saveData = this.saveManager.createNew();
    this.applyOptions();
    this.scenes.replace(new OverworldScene(this));
  }

  continueGame(): void {
    const loaded = this.saveManager.load();
    if (loaded) {
      this.saveData = loaded;
    } else {
      this.saveData = this.saveManager.createNew();
    }
    this.applyOptions();
    this.scenes.replace(new OverworldScene(this));
  }

  startBattle(params: {
    enemyParty: CreatureInstance[];
    trainer?: TrainerDef;
    biome?: BattleBiome;
    onDone: (outcome: 'win' | 'lose' | 'caught' | 'ran') => void;
  }): void {
    this.scenes.push(new BattleScene(this, params));
  }

  startEvolution(
    partyIndex: number,
    targetSpeciesId: number,
    onDone: () => void
  ): void {
    this.scenes.push(new EvolutionScene(this, partyIndex, targetSpeciesId, onDone));
  }

  openShop(stock: string[], onDone: () => void): void {
    this.scenes.push(new ShopScene(this, stock, onDone));
  }

  private handlePageHide = (): void => {
    this.input.clearAll();
    this.synth.suspend();
    if (this.saveData.flags.starter_chosen) {
      this.saveManager.save(this.saveData);
    }
  };

  private handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.handlePageHide();
    } else {
      this.synth.resumeIfActive();
    }
  };

  dispose(): void {
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    window.removeEventListener('pagehide', this.handlePageHide);
    this.loop.dispose();
    this.input.dispose();
    this.synth.dispose();
    this.battleTransition.dispose();
    this.battleHud.dispose();
    this.arGachaModal.dispose();
    this.vesselScreen.dispose();
    this.cardAlbumScreen.dispose();
    this.assets.dispose();
    this.renderer.dispose();
    this.uiLayer.remove();
  }
}
