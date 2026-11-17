import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { getBodyContainer } from '../data/containers.ts';
import { getMove } from '../data/moves.ts';
import { BattleEngine } from '../domain/BattleEngine.ts';
import {
  BODY_PART_LABELS,
  consumeVessel,
  ensureSaveVesselState,
  pickBestVesselForSpecies,
  rebindCreatureContainer,
} from '../domain/BodyParts.ts';
import {
  addCardToAlbum,
  canDismantleDuplicateCard,
  dismantleDuplicateCard,
  formatCardBonuses,
  getCardDef,
  getSoulDust,
} from '../domain/Cards.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { checkLevelEvolution } from '../domain/Evolution.ts';
import { replaceCreatureMove } from '../domain/Experience.ts';
import { addCapturedCreature } from '../domain/Storage.ts';
import { getTimePhase } from '../domain/TimeOfDay.ts';
import type {
  BattleAction,
  BattleBiome,
  BattleEvent,
  CharacterRole,
  CreatureInstance,
  TrainerDef,
} from '../domain/types.ts';
import { BattleCamera } from '../engine/BattleCamera.ts';
import { BattlePostFx } from '../engine/BattlePostFx.ts';
import {
  createBattleSpriteMaterial,
  type BattleSpriteMaterialHandle,
} from '../engine/BattleSpriteMat.ts';
import {
  BattleStage,
  ENEMY_STATION_POS,
  PLAYER_STATION_POS,
} from '../engine/BattleStage.ts';
import { createBottomPivotPlaneGeometry } from '../engine/BillboardBatch.ts';
import { computeVfxScaleMetrics } from '../engine/AbilityVfxSystem.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import { FxSystem } from '../engine/FxSystem.ts';
import {
  createMeleeStabMaterial,
  loadAttackSheetTexture,
  loadMeleeStabTexture,
  type MeleeStabMaterialHandle,
} from '../engine/MeleeStabSprite.ts';
import { SoulDollIdleRig } from '../engine/SoulDollIdleRig.ts';
import { TweenRunner } from '../engine/Tween.ts';
import {
  evaluateAttackAnimPhase,
  getSpeciesAttackSheetConfig,
  MELEE_STAB_COLS,
  MELEE_STAB_ROWS,
  MELEE_STAB_SHEET_PATH,
  MELEE_STAB_TOTAL_DURATION,
  MELEE_STAB_TOTAL_FRAMES,
  SOULDOLL_15_ATTACK_SHEET,
} from '../domain/MeleeStabTiming.ts';
import { hexToNumber, PALETTE, TYPE_PALETTES } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';
import type { BattleResultDropSummary } from '../ui/BattleHud.ts';
import { CARD_RARITY_STYLES } from '../ui/cardRarityStyles.ts';

const _camPos = new THREE.Vector3();
const _fromPos = new THREE.Vector3();
const _toPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();
const _stabFwd = new THREE.Vector3();
const _stabRight = new THREE.Vector3();
const _stabTipPos = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);

export class BattleScene implements Scene {
  readonly name = 'battle';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private tweens = new TweenRunner();
  private engine: BattleEngine;
  private biome: BattleBiome;
  private isBoss: boolean;

  private stage: BattleStage;
  private battleCamera: BattleCamera;
  private fx: FxSystem;
  private postFx: BattlePostFx;

  private playerMesh: THREE.Mesh;
  private enemyMesh: THREE.Mesh;
  private meleeStabMesh: THREE.Mesh;
  private trainerMesh: THREE.Mesh | null = null;
  private capsuleMesh: THREE.Mesh;

  private playerMatHandle: BattleSpriteMaterialHandle;
  private enemyMatHandle: BattleSpriteMaterialHandle;
  private meleeStabMatHandle: MeleeStabMaterialHandle;
  private attackTextures = new Map<string, THREE.Texture>();
  private activeAttackSheetPath = MELEE_STAB_SHEET_PATH;
  private playerRig: SoulDollIdleRig;
  private enemyRig: SoulDollIdleRig;
  private unsubCreatureLoad: (() => void) | null = null;

  private playerScale = 2.0;
  private enemyScale = 1.6;
  private lastAspect = 0;
  private lastInternalH = 0;
  private playerAnimating = false;
  private enemyAnimating = false;
  private lowHpAlarmTimer = 0;
  private exited = false;
  private introDone = false;

  private eventQueue: BattleEvent[] = [];
  private processingEvent = false;
  private pendingEvolutions: Array<{ partyIndex: number; targetSpeciesId: number }> = [];
  private totalXpEarned = 0;
  private droppedCards: BattleResultDropSummary[] = [];
  private onDone: (outcome: 'win' | 'lose' | 'caught' | 'ran') => void;

  private handleStageTap = (): void => {
    if (this.battleCamera.skipIntro()) return;
    if (this.game.dialog.isOpen()) {
      this.game.dialog.advance();
    }
  };

  constructor(
    private readonly game: Game,
    params: {
      enemyParty: CreatureInstance[];
      trainer?: TrainerDef;
      biome?: BattleBiome;
      onDone: (outcome: 'win' | 'lose' | 'caught' | 'ran') => void;
    }
  ) {
    this.onDone = params.onDone;
    this.biome = params.biome ?? 'meadow';
    this.isBoss = Boolean(params.trainer?.isBoss || params.trainer?.isRival);

    this.engine = new BattleEngine(
      game.saveData.party,
      params.enemyParty,
      game.saveData.bag,
      game.rng,
      params.trainer,
      this.biome,
      { timePhase: getTimePhase(game.saveData.worldClockMinutes) }
    );

    this.stage = new BattleStage(this.scene, game.assets, this.biome, this.isBoss);
    this.stage.setShadowsEnabled(game.renderer.areShadowsEnabled());
    this.stage.setAmbientParticlesEnabled(game.renderer.areAmbientParticlesEnabled());
    this.battleCamera = new BattleCamera(game.cameraRig.camera);
    this.fx = new FxSystem(this.scene);
    this.fx.setFlashCallback((css, ms) => this.game.battleTransition.flashScreen(css, ms));
    this.postFx = new BattlePostFx(game.renderer.webgl, this.scene, game.cameraRig.camera);
    this.postFx.setBiome(this.biome, this.isBoss);
    this.postFx.setPixelEffect(game.renderer.isPixelEffectEnabled());
    this.postFx.setQualityTier(game.renderer.getQualityTier());
    this.postFx.setPostFxOptions(game.renderer.getPostFxOptions());

    this.lastAspect = game.renderer.getAspect();
    this.lastInternalH = game.renderer.getInternalHeight();
    this.playerScale = this.battleCamera.computeNormalizedSpriteScale(
      PLAYER_STATION_POS,
      0.45
    );
    this.enemyScale = this.battleCamera.computeNormalizedSpriteScale(
      ENEMY_STATION_POS,
      0.285
    );

    const unitGeo = createBottomPivotPlaneGeometry(1, 1, 24, 32);
    // Flip horizontally so raw 3/4 profile sheets (front ↘, back ↖) face each other along the battle diagonal
    const uvAttr = unitGeo.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    uvAttr.needsUpdate = true;
    this.disposables.track(unitGeo);

    const activePlayer = this.engine.getActive('player');
    const activeEnemy = this.engine.getActive('enemy');

    this.playerMatHandle = createBattleSpriteMaterial(
      game.assets.getCreatureTexture(activePlayer.speciesId, 'back')
    );
    this.enemyMatHandle = createBattleSpriteMaterial(
      game.assets.getCreatureTexture(activeEnemy.speciesId, 'front')
    );
    this.disposables.track(this.playerMatHandle.material);
    this.disposables.track(this.enemyMatHandle.material);

    this.playerRig = new SoulDollIdleRig({
      view: 'back',
      flipX: true,
      cycleDuration: 3.5,
      initialPhase: 0.14,
    });
    this.enemyRig = new SoulDollIdleRig({
      view: 'front',
      flipX: true,
      cycleDuration: 3.5,
      initialPhase: 0.58,
    });
    this.syncRigAnchors();
    if (game.assets.onCreatureLoaded) {
      this.unsubCreatureLoad = game.assets.onCreatureLoaded(() => {
        if (!this.exited) this.syncRigAnchors();
      });
    }

    this.playerMesh = new THREE.Mesh(unitGeo, this.playerMatHandle.material);
    this.playerMesh.position.set(
      PLAYER_STATION_POS.x,
      this.getGroundedY('player'),
      PLAYER_STATION_POS.z
    );
    this.playerMesh.scale.setScalar(this.playerScale);
    this.playerMesh.visible = false;
    this.playerMesh.renderOrder = 2;

    this.enemyMesh = new THREE.Mesh(unitGeo, this.enemyMatHandle.material);
    this.enemyMesh.position.set(
      ENEMY_STATION_POS.x,
      this.getGroundedY('enemy'),
      ENEMY_STATION_POS.z
    );
    this.enemyMesh.scale.setScalar(this.enemyScale);
    this.enemyMesh.visible = false;
    this.enemyMesh.renderOrder = 2;

    if (params.trainer) {
      const charGeo = createBottomPivotPlaneGeometry(0.67, 1.0);
      const trainerMat = new THREE.MeshBasicMaterial({
        map: game.assets.getCharacterTexture(
          params.trainer.role as CharacterRole,
          'down',
          0,
          params.trainer.id
        ),
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      this.trainerMesh = new THREE.Mesh(charGeo, trainerMat);
      this.trainerMesh.position.set(
        ENEMY_STATION_POS.x + 3.4,
        ENEMY_STATION_POS.y,
        ENEMY_STATION_POS.z
      );
      this.trainerMesh.scale.setScalar(this.enemyScale * 0.85);
      this.trainerMesh.renderOrder = 2;
      this.scene.add(this.trainerMesh);
      this.disposables.track(charGeo);
      this.disposables.track(trainerMat);
    }

    const capGeo = createBottomPivotPlaneGeometry(0.65, 0.65);
    const capMat = new THREE.MeshBasicMaterial({
      map: game.assets.getItemTexture('capsula'),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.capsuleMesh = new THREE.Mesh(capGeo, capMat);
    this.capsuleMesh.position.copy(ENEMY_STATION_POS);
    this.capsuleMesh.visible = false;
    this.capsuleMesh.renderOrder = 4;
    this.disposables.track(capGeo);
    this.disposables.track(capMat);

    const meleeStabGeo = createBottomPivotPlaneGeometry(1, 1);
    const meleeStabTex = loadMeleeStabTexture((loaded) => {
      if (!this.exited) {
        this.attackTextures.set(MELEE_STAB_SHEET_PATH, loaded);
        if (this.activeAttackSheetPath === MELEE_STAB_SHEET_PATH) {
          this.meleeStabMatHandle.setTexture(loaded);
        }
      }
    });
    this.attackTextures.set(MELEE_STAB_SHEET_PATH, meleeStabTex);
    const souldoll15Tex = loadAttackSheetTexture(SOULDOLL_15_ATTACK_SHEET.sheetPath, (loaded) => {
      if (!this.exited) {
        this.attackTextures.set(SOULDOLL_15_ATTACK_SHEET.sheetPath, loaded);
        if (this.activeAttackSheetPath === SOULDOLL_15_ATTACK_SHEET.sheetPath) {
          this.meleeStabMatHandle.setTexture(loaded);
        }
      }
    });
    this.attackTextures.set(SOULDOLL_15_ATTACK_SHEET.sheetPath, souldoll15Tex);

    this.meleeStabMatHandle = createMeleeStabMaterial(meleeStabTex);
    this.meleeStabMesh = new THREE.Mesh(meleeStabGeo, this.meleeStabMatHandle.material);
    this.meleeStabMesh.visible = false;
    this.meleeStabMesh.renderOrder = 3;
    this.disposables.track(meleeStabGeo);
    this.disposables.track(meleeStabTex);
    this.disposables.track(souldoll15Tex);
    this.disposables.track(this.meleeStabMatHandle.material);

    this.scene.add(this.playerMesh, this.enemyMesh, this.meleeStabMesh, this.capsuleMesh);
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: false,
      battleHud: true,
      battleFx: true,
      battleTransition: true,
    });
    this.game.touchControls.setVisible(false);
    this.game.renderer.canvas.addEventListener('pointerdown', this.handleStageTap);

    const trainer = this.engine.state.trainer;
    const track = this.isBoss ? 'boss' : trainer ? 'trainer_battle' : 'battle';
    this.game.bus.emit('audio:music', { track });

    this.stage.setShadowScale('player', 1, false);
    this.stage.setShadowScale('enemy', 1, false);
    this.battleCamera.init(this.isBoss, true);

    this.game.battleTransition.playPreBattle(this.game.assets, trainer, () => {
      if (this.exited) return;
      this.battleCamera.init(this.isBoss, true);
      if (trainer) {
        this.runTrainerEntrance(trainer);
      } else {
        this.runWildEntrance();
      }
    });
  }

  private runWildEntrance(): void {
    const enemy = this.engine.getActive('enemy');
    this.game.markSpeciesSeen(enemy.speciesId, enemy.level);

    this.game.bus.emit('audio:sfx', { sfx: 'rustle' });
    const enemyFx = computeVfxScaleMetrics(this.enemyScale).silhouette;
    _toPos.set(
      ENEMY_STATION_POS.x,
      ENEMY_STATION_POS.y + this.enemyScale * 0.45,
      ENEMY_STATION_POS.z
    );
    this.fx.burst(_toPos, {
      count: 20,
      speedMin: 1.2 * enemyFx,
      speedMax: 3.1 * enemyFx,
      lifeMin: 0.35,
      lifeMax: 0.65,
      sizeStart: 0.25 * enemyFx,
      sizeEnd: 0.06 * enemyFx,
      colorHex: hexToNumber(PALETTE.emerald),
      gravity: -3.8 * enemyFx,
      spreadScale: enemyFx,
    });

    this.enemyAnimating = true;
    this.enemyMesh.visible = true;
    this.stage.setShadowScale('enemy', 1, true);
    this.enemyMatHandle.setFlash(0.42);
    this.syncRigAnchors();
    this.enemyRig.resetSprings();
    this.game.synth.playCry(enemy.speciesId);

    this.tweens.start(
      0.42,
      (t) => {
        const ease = 1 - Math.pow(1 - t, 3);
        this.enemyMesh.scale.set(
          this.enemyScale * (0.4 + 0.6 * ease),
          this.enemyScale * (0.4 + 0.6 * ease),
          1
        );
        this.enemyMesh.position.y =
          this.getGroundedY('enemy') + Math.sin(t * Math.PI) * 0.45;
        this.enemyMatHandle.setFlash(Math.max(0, 0.42 * (1 - t * 1.8)));
      },
      () => {
        if (this.exited) return;
        this.enemyAnimating = false;
        this.enemyMesh.position.set(
          ENEMY_STATION_POS.x,
          this.getGroundedY('enemy'),
          ENEMY_STATION_POS.z
        );
        this.enemyMesh.scale.setScalar(this.enemyScale);
        this.enemyMatHandle.setFlash(0);
        this.enemyRig.injectImpulse(0, -0.58, 0.2);
      }
    );

    this.game.dialog.show(ES.battle.wildAppeared(getCreatureDisplayName(enemy)), () => {
      if (this.exited) return;
      this.sendOutCreature('player', () => {
        this.finishIntro();
      });
    });
  }

  private runTrainerEntrance(trainer: TrainerDef): void {
    const tMesh = this.trainerMesh;
    if (tMesh) {
      this.tweens.start(0.45, (t) => {
        const ease = 1 - Math.pow(1 - t, 3);
        tMesh.position.x = ENEMY_STATION_POS.x + (1 - ease) * 3.4;
      });
    }

    this.game.dialog.show(ES.battle.trainerChallenge(trainer.title, trainer.name), () => {
      if (this.exited) return;
      if (tMesh) {
        this.tweens.start(
          0.32,
          (t) => {
            tMesh.position.x = ENEMY_STATION_POS.x + t * 3.6;
          },
          () => {
            if (this.exited) return;
            tMesh.visible = false;
          }
        );
      }

      const enemy = this.engine.getActive('enemy');
      this.game.markSpeciesSeen(enemy.speciesId, enemy.level);
      this.sendOutCreature('enemy', () => {
        if (this.exited) return;
        this.sendOutCreature('player', () => {
          this.finishIntro();
        });
      });
    });
  }

  private finishIntro(): void {
    if (this.exited) return;
    this.introDone = true;
    this.game.battleHud.show();
    this.refreshHud();
    const entryEvents = this.engine.consumeInitialEntryEvents();
    if (entryEvents.length > 0) {
      this.eventQueue.push(...entryEvents);
      this.pumpEvents();
    } else {
      this.showPlayerCommandMenu();
    }
  }

  private getGroundedY(side: 'player' | 'enemy'): number {
    const stationY = side === 'player' ? PLAYER_STATION_POS.y : ENEMY_STATION_POS.y;
    const scale = side === 'player' ? this.playerScale : this.enemyScale;
    // Compensates 1px PAD_BOTTOM + alpha edge threshold so drawn soles rest firmly on the platform shadow
    return stationY - scale * 0.012;
  }

  private syncRigAnchors(): void {
    const getAnchor = this.game.assets.getCreatureRigAnchor?.bind(this.game.assets);
    if (!getAnchor) return;
    const activePlayer = this.engine.getActive('player');
    const activeEnemy = this.engine.getActive('enemy');
    this.playerRig.setAnchor(getAnchor(activePlayer.speciesId, 'back'));
    this.enemyRig.setAnchor(getAnchor(activeEnemy.speciesId, 'front'));
  }

  private sendOutCreature(side: 'player' | 'enemy', onDone: () => void): void {
    const isPlayer = side === 'player';
    const station = isPlayer ? PLAYER_STATION_POS : ENEMY_STATION_POS;
    const baseScale = isPlayer ? this.playerScale : this.enemyScale;
    const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
    const matHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
    const rig = isPlayer ? this.playerRig : this.enemyRig;
    const creature = this.engine.getActive(side);

    matHandle.setDissolve(0);
    matHandle.setOpacity(1);
    matHandle.setFlash(0);
    matHandle.setTexture(
      this.game.assets.getCreatureTexture(creature.speciesId, isPlayer ? 'back' : 'front')
    );
    this.syncRigAnchors();
    rig.resetSprings();

    const startX = isPlayer ? station.x - 2.6 : station.x + 2.6;
    const startY = station.y + 1.35;
    const startZ = isPlayer ? station.z + 1.2 : station.z - 0.8;

    this.game.bus.emit('audio:sfx', { sfx: 'throw' });
    this.capsuleMesh.visible = true;
    this.capsuleMesh.position.set(startX, startY, startZ);
    this.capsuleMesh.rotation.z = 0;

    this.tweens.start(
      0.34,
      (t) => {
        this.capsuleMesh.position.x = THREE.MathUtils.lerp(startX, station.x, t);
        this.capsuleMesh.position.z = THREE.MathUtils.lerp(startZ, station.z, t);
        this.capsuleMesh.position.y =
          THREE.MathUtils.lerp(startY, station.y + 0.25, t) + Math.sin(t * Math.PI) * 1.1;
        this.capsuleMesh.rotation.z = t * Math.PI * 3;
      },
      () => {
        if (this.exited) return;
        this.capsuleMesh.visible = false;
        this.capsuleMesh.rotation.z = 0;

        const fxScale = computeVfxScaleMetrics(baseScale).silhouette;
        _toPos.set(station.x, station.y + baseScale * 0.45, station.z);
        this.fx.burst(_toPos, {
          count: 24,
          speedMin: 1.4 * fxScale,
          speedMax: 3.4 * fxScale,
          lifeMin: 0.25,
          lifeMax: 0.45,
          sizeStart: 0.28 * fxScale,
          sizeEnd: 0.04 * fxScale,
          colorHex: hexToNumber(isPlayer ? PALETTE.kiCyan : PALETTE.resonantGold),
          gravity: -1.5 * fxScale,
          spreadScale: fxScale,
        });

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;

        mesh.position.set(station.x, this.getGroundedY(side), station.z);
        mesh.visible = true;
        this.stage.setShadowScale(side, 1, true);
        matHandle.setFlash(0.55);
        this.game.synth.playCry(creature.speciesId);

        this.tweens.start(
          0.3,
          (t) => {
            const ease = 1 - Math.pow(1 - t, 3);
            mesh.scale.setScalar(baseScale * (0.18 + 0.82 * ease));
            matHandle.setFlash(Math.max(0, 0.55 * (1 - t * 1.8)));
          },
          () => {
            if (this.exited) return;
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.scale.setScalar(baseScale);
            matHandle.setFlash(0);
            rig.injectImpulse(0, -0.62, 0.22);
            onDone();
          }
        );
      }
    );
  }

  private refreshHud(): void {
    this.game.battleHud.updateSoulDust(getSoulDust(this.game.saveData));
    this.game.battleHud.updateWeather(
      this.engine.state.weather,
      this.engine.state.weatherTurns
    );
    this.game.battleHud.updateBars(
      this.engine.getActive('player'),
      this.engine.getActive('enemy'),
      this.engine.state.isWild,
      this.engine.state.player.party,
      this.engine.state.enemy.party
    );
  }

  private showPlayerCommandMenu(): void {
    if (this.engine.state.finished || this.exited) return;
    const active = this.engine.getActive('player');
    if (active.currentHp <= 0) {
      this.promptForcedSwitch();
      return;
    }

    this.game.battleHud.showMainMenu(
      active,
      this.engine.getActive('enemy'),
      this.engine.state.isWild,
      {
        onMove: (moveIndex) => {
          this.submitAction({ type: 'move', moveIndex });
        },
        onBag: () => {
          this.game.battleHud.hideMenu();
          this.game.bagScreen.open(
            this.game.saveData.bag,
            true,
            (itemId) => {
              this.submitAction({
                type: 'item',
                itemId,
                targetPartyIndex: this.engine.state.player.activeIndex,
              });
            },
            () => {
              this.showPlayerCommandMenu();
            },
            getSoulDust(this.game.saveData)
          );
        },
        onParty: () => {
          this.game.battleHud.hideMenu();
          this.game.partyScreen.open(
            this.game.saveData.party,
            {
              kind: 'switch',
              activeIndex: this.engine.state.player.activeIndex,
              allowCancel: true,
              onPick: (partyIndex) => {
                this.submitAction({ type: 'switch', partyIndex });
              },
            },
            () => {
              this.showPlayerCommandMenu();
            }
          );
        },
        onRun: () => {
          this.submitAction({ type: 'run' });
        },
      }
    );
  }

  private promptForcedSwitch(): void {
    this.game.battleHud.hideMenu();
    this.game.partyScreen.open(
      this.game.saveData.party,
      {
        kind: 'switch',
        activeIndex: this.engine.state.player.activeIndex,
        allowCancel: false,
        onPick: (partyIndex) => {
          const evs = this.engine.forcePlayerSwitch(partyIndex);
          this.eventQueue.push(...evs);
          this.pumpEvents();
        },
      },
      () => {}
    );
  }

  private submitAction(action: BattleAction): void {
    this.game.battleHud.hideMenu();
    const events = this.engine.stepTurn(action);
    this.eventQueue.push(...events);
    this.pumpEvents();
  }

  private spawnFloatingDamage(
    side: 'player' | 'enemy',
    text: string,
    tone: 'normal' | 'super' | 'resist' | 'crit' | 'heal'
  ): void {
    const station = side === 'player' ? PLAYER_STATION_POS : ENEMY_STATION_POS;
    const scale = side === 'player' ? this.playerScale : this.enemyScale;
    _projVec.set(station.x, station.y + scale * 0.85, station.z);
    _projVec.project(this.game.cameraRig.camera);
    const nx = _projVec.x * 0.5 + 0.5;
    const ny = -_projVec.y * 0.5 + 0.5;
    this.game.battleHud.spawnFloatingNumber(nx, ny, text, tone);
  }

  private pumpEvents(): void {
    if (this.processingEvent || this.exited) return;
    const ev = this.eventQueue.shift();
    if (!ev) {
      if (!this.engine.state.finished) {
        this.showPlayerCommandMenu();
      }
      return;
    }

    this.processingEvent = true;
    const done = () => {
      if (this.exited) return;
      this.processingEvent = false;
      this.pumpEvents();
    };

    switch (ev.type) {
      case 'text':
        this.game.dialog.show(ev.message, done);
        break;

      case 'move_use': {
        const isPlayer = ev.side === 'player';
        const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
        const home = isPlayer ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        const target = isPlayer ? ENEMY_STATION_POS : PLAYER_STATION_POS;
        const baseScale = isPlayer ? this.playerScale : this.enemyScale;
        const targetScale = isPlayer ? this.enemyScale : this.playerScale;

        const move = getMove(ev.moveId);
        this.battleCamera.enqueueShot(
          isPlayer ? 'attack_player' : 'attack_enemy',
          0.45,
          true
        );
        if (move.category === 'special' || move.power >= 70) {
          this.postFx.pulseArenaDim(move.power >= 90 ? 0.24 : 0.18, 0.52);
        }

        _fromPos.set(home.x, home.y + baseScale * 0.5, home.z);
        _toPos.set(target.x, target.y + targetScale * 0.5, target.z);

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;
        const actorRig = isPlayer ? this.playerRig : this.enemyRig;

        const attackerMatHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
        const targetRig = isPlayer ? this.enemyRig : this.playerRig;
        const targetSide = isPlayer ? 'enemy' : 'player';

        const groundedY = this.getGroundedY(isPlayer ? 'player' : 'enemy');
        const finishMoveAnim = () => {
          if (isPlayer) this.playerAnimating = false;
          else this.enemyAnimating = false;
          this.meleeStabMesh.visible = false;
          mesh.visible = true;
          attackerMatHandle.setOpacity(1);
          mesh.position.set(home.x, groundedY, home.z);
          mesh.scale.setScalar(baseScale);
          actorRig.injectImpulse(isPlayer ? -0.24 : 0.24, -0.45, 0.14);
          done();
        };

        const fromFx = computeVfxScaleMetrics(baseScale).silhouette;
        const toFx = computeVfxScaleMetrics(targetScale).silhouette;

        if (move.category === 'physical') {
          let impactFired = false;
          let dashDustFired = false;
          actorRig.injectImpulse(isPlayer ? 0.34 : -0.34, 0.36, 0.14);

          const attacker = this.engine.getActive(ev.side);
          const customAttack = getSpeciesAttackSheetConfig(attacker.speciesId);
          const attackSheetPath = customAttack
            ? customAttack.sheetPath
            : MELEE_STAB_SHEET_PATH;
          this.activeAttackSheetPath = attackSheetPath;
          const activeAttackTex = this.attackTextures.get(attackSheetPath);
          if (activeAttackTex) {
            this.meleeStabMatHandle.setTexture(activeAttackTex);
          }

          const totalAnimDuration = customAttack
            ? customAttack.totalDuration
            : MELEE_STAB_TOTAL_DURATION;

          const typePal = TYPE_PALETTES[move.type];
          const elemAccentHex = typePal.accent;
          const elemBaseHex = typePal.base;
          const elemLightHex = typePal.light;
          const elemNum = hexToNumber(elemBaseHex);
          const elemAccentNum = hexToNumber(elemAccentHex);
          const elemLightNum = hexToNumber(elemLightHex);
          const stabHeight = customAttack
            ? targetScale * customAttack.heightScale
            : targetScale * 1.18;
          const stabWidth = customAttack
            ? stabHeight * customAttack.cellAspect
            : stabHeight;
          const targetGroundedY = this.getGroundedY(targetSide);

          this.tweens.start(
            totalAnimDuration,
            (t) => {
              const elapsed = t * totalAnimDuration;
              const st = evaluateAttackAnimPhase(elapsed, customAttack);

              if (st.phase === 'advance') {
                this.meleeStabMesh.visible = false;
                mesh.visible = true;
                attackerMatHandle.setOpacity(st.attackerOpacity);

                const dashFrac = 0.36 * st.advanceLungeT;
                mesh.position.x = THREE.MathUtils.lerp(home.x, target.x, dashFrac);
                mesh.position.z = THREE.MathUtils.lerp(home.z, target.z, dashFrac);
                mesh.position.y = groundedY + Math.sin(st.phaseT * Math.PI) * (baseScale * 0.1);
                mesh.scale.set(
                  baseScale * (1 + 0.08 * st.advanceLungeT),
                  baseScale * (1 - 0.05 * st.advanceLungeT),
                  1
                );

                if (!dashDustFired && st.phaseT >= 0.18) {
                  dashDustFired = true;
                  this.fx.burst(_fromPos, {
                    count: 10,
                    speedMin: 1.0 * fromFx,
                    speedMax: 2.5 * fromFx,
                    lifeMin: 0.18,
                    lifeMax: 0.32,
                    sizeStart: 0.22 * fromFx,
                    sizeEnd: 0.04 * fromFx,
                    colorHex: elemLightNum,
                    gravity: 0.2 * fromFx,
                    spreadScale: fromFx,
                  });
                }
              } else if (st.phase === 'stab') {
                mesh.visible = false;
                attackerMatHandle.setOpacity(0);

                // Compute camera-relative horizontal flank direction around defender
                _stabFwd.set(
                  target.x - this.game.cameraRig.camera.position.x,
                  0,
                  target.z - this.game.cameraRig.camera.position.z
                );
                if (_stabFwd.lengthSq() < 0.0001) _stabFwd.set(0, 0, -1);
                _stabFwd.normalize();
                _stabRight.crossVectors(_stabFwd, _worldUp).normalize();

                // Custom SoulDoll #15 faces right unflipped (attack from left flank when player, right flank flipped when enemy)
                const attackFromLeft = customAttack ? isPlayer : false;
                const flankSign = attackFromLeft ? -1 : 1;
                const flipX = !attackFromLeft;
                const flankOffset = customAttack ? targetScale * 0.56 : targetScale * 0.44;
                this.meleeStabMesh.position.set(
                  target.x + _stabRight.x * (flankOffset * flankSign) - _stabFwd.x * 0.08,
                  targetGroundedY,
                  target.z + _stabRight.z * (flankOffset * flankSign) - _stabFwd.z * 0.08
                );
                this.meleeStabMesh.scale.set(stabWidth, stabHeight, 1);
                this.meleeStabMesh.visible = true;

                if (customAttack) {
                  this.meleeStabMatHandle.setFrame(
                    st.frameIndex,
                    flipX,
                    customAttack.cols,
                    customAttack.rows,
                    customAttack.totalFrames
                  );
                  this.meleeStabMatHandle.setElementEffect(
                    elemAccentHex,
                    st.elementGlow,
                    customAttack.elementTintStrength
                  );
                } else {
                  this.meleeStabMatHandle.setFrame(
                    st.frameIndex,
                    true,
                    MELEE_STAB_COLS,
                    MELEE_STAB_ROWS,
                    MELEE_STAB_TOTAL_FRAMES
                  );
                  this.meleeStabMatHandle.setElementEffect(elemAccentHex, st.elementGlow, 1);
                }
                this.meleeStabMatHandle.setOpacity(st.stabOpacity);

                if (st.impactTriggered && !impactFired) {
                  impactFired = true;

                  // Dynamic camera shake + hit-stop + close attack framing
                  this.battleCamera.playImmediate(
                    isPlayer ? 'attack_player' : 'attack_enemy',
                    0.42,
                    true
                  );
                  this.battleCamera.triggerHitStop(0.048);
                  this.battleCamera.triggerShake(move.power >= 75 ? 0.28 : 0.2, 8.0);
                  targetRig.injectImpulse(isPlayer ? 0.46 : -0.46, -0.64, 0.22);

                  // Arena dim + radial shockwave centered on enemy torso
                  this.postFx.pulseArenaDim(0.24, 0.44);
                  _projVec.set(target.x, target.y + targetScale * 0.5, target.z);
                  _projVec.project(this.game.cameraRig.camera);
                  this.postFx.triggerShockwave(
                    (_projVec.x + 1) * 0.5,
                    (_projVec.y + 1) * 0.5,
                    0.022,
                    0.3
                  );

                  // Elemental flash tint on screen
                  const r = (elemAccentNum >> 16) & 0xff;
                  const g = (elemAccentNum >> 8) & 0xff;
                  const b = elemAccentNum & 0xff;
                  this.fx.flash(`rgba(${r}, ${g}, ${b}, 0.30)`, 120);

                  // Elemental VFX + stab spark burst & expanding ring right where the blade strikes
                  const tipDir = attackFromLeft ? 1 : -1;
                  _stabTipPos.set(
                    this.meleeStabMesh.position.x + _stabRight.x * (stabWidth * 0.28 * tipDir),
                    target.y + targetScale * 0.52,
                    this.meleeStabMesh.position.z + _stabRight.z * (stabWidth * 0.28 * tipDir)
                  );
                  this.fx.playTypeMove(move.type, _stabTipPos, _toPos, 'physical', {
                    power: move.power,
                    fromGroundY: targetGroundedY,
                    toGroundY: target.y,
                    fromScale: stabHeight,
                    toScale: targetScale,
                  });
                  this.fx.burst(_toPos, {
                    count: 24,
                    speedMin: 2.2 * toFx,
                    speedMax: 5.4 * toFx,
                    lifeMin: 0.18,
                    lifeMax: 0.38,
                    sizeStart: 0.32 * toFx,
                    sizeEnd: 0.04 * toFx,
                    colorHex: elemNum,
                    gravity: 0.2 * toFx,
                    spreadScale: toFx,
                  });
                  this.fx.ring(_toPos, {
                    count: 18,
                    radius: 0.18 * toFx,
                    speed: 3.4 * toFx,
                    life: 0.34,
                    sizeStart: 0.26 * toFx,
                    sizeEnd: 0.04 * toFx,
                    colorHex: elemLightNum,
                    vy: 0.4 * toFx,
                  });
                }
              } else {
                // Return phase: restore attacker at home station and fade cleanly back in
                this.meleeStabMesh.visible = false;
                mesh.visible = true;
                mesh.position.set(home.x, groundedY, home.z);
                mesh.scale.setScalar(baseScale);
                attackerMatHandle.setOpacity(st.attackerOpacity);
              }
            },
            finishMoveAnim
          );
        } else if (move.category === 'special') {
          let fxFired = false;
          actorRig.injectImpulse(0, 0.38, 0.14);
          const bx = (home.x - target.x) * 0.08;
          const bz = (home.z - target.z) * 0.08;
          this.fx.ring(_fromPos, {
            count: 14,
            radius: 0.45 * fromFx,
            speed: -1.1 * fromFx,
            life: 0.26,
            sizeStart: 0.22 * fromFx,
            sizeEnd: 0.04 * fromFx,
            colorHex: hexToNumber(PALETTE.warmWhite),
            vy: 0.2 * fromFx,
          });
          this.tweens.start(
            0.42,
            (t) => {
              const hop = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
              mesh.position.x = home.x + bx * hop;
              mesh.position.z = home.z + bz * hop;
              mesh.position.y = groundedY + hop * 0.22;
              if (t >= 0.36 && !fxFired) {
                fxFired = true;
                actorRig.injectImpulse(0, -0.5, 0.18);
                this.fx.playTypeMove(move.type, _fromPos, _toPos, 'special', {
                  power: move.power,
                  fromGroundY: home.y,
                  toGroundY: target.y,
                  fromScale: baseScale,
                  toScale: targetScale,
                });
              }
            },
            finishMoveAnim
          );
        } else {
          actorRig.injectImpulse(0, 0.28, 0.18);
          this.fx.playTypeMove(move.type, _fromPos, _toPos, 'status', {
            power: move.power,
            fromGroundY: home.y,
            toGroundY: target.y,
            fromScale: baseScale,
            toScale: targetScale,
          });
          this.tweens.start(
            0.36,
            (t) => {
              const s = 1 + Math.sin(t * Math.PI * 2) * 0.06;
              mesh.scale.set(baseScale * s, baseScale * (2 - s), 1);
            },
            finishMoveAnim
          );
        }
        break;
      }

      case 'damage': {
        this.refreshHud();
        if (ev.damagedPart) {
          this.game.battleHud.flashBodyPart(ev.target, ev.damagedPart, {
            amount: ev.amount,
            crit: ev.crit,
            effectiveness: ev.effectiveness,
            broken: Boolean(ev.partBroken),
          });
        }
        const isPlayer = ev.target === 'player';
        const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
        const matHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
        const targetRig = isPlayer ? this.playerRig : this.enemyRig;
        const home = isPlayer ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        const targetCreature = this.engine.getActive(ev.target);

        const sfx = ev.crit
          ? 'crit'
          : ev.effectiveness >= 2
            ? 'super'
            : ev.effectiveness < 1
              ? 'hit_weak'
              : 'hit';
        this.game.bus.emit('audio:sfx', { sfx });
        if (ev.partBroken) {
          this.game.battleHud.showBanner(
            '¡Parte Quebrada!',
            `${getCreatureDisplayName(targetCreature)}: ${BODY_PART_LABELS[ev.partBroken]}`
          );
        }

        const strongHit =
          ev.crit ||
          ev.effectiveness >= 2 ||
          ev.amount >= Math.max(4, Math.round(targetCreature.stats.hp * 0.28));

        if (strongHit) {
          this.battleCamera.triggerHitStop(0.055);
          this.battleCamera.triggerShake(ev.effectiveness >= 2 || ev.crit ? 0.24 : 0.14, 8);
        } else {
          this.battleCamera.triggerShake(0.08, 10);
        }

        const targetScale = isPlayer ? this.playerScale : this.enemyScale;
        _projVec.set(home.x, home.y + targetScale * 0.5, home.z);
        _projVec.project(this.game.cameraRig.camera);
        this.postFx.triggerShockwave(
          (_projVec.x + 1) * 0.5,
          (_projVec.y + 1) * 0.5,
          strongHit ? 0.026 : 0.012,
          strongHit ? 0.34 : 0.22
        );

        if (ev.crit) {
          this.battleCamera.playImmediate('crit_punch', 0.36, true);
        }
        if (ev.effectiveness >= 2) {
          this.game.battleTransition.flashScreen('rgba(255, 249, 240, 0.72)', 160);
        }

        const tone = ev.crit
          ? 'crit'
          : ev.effectiveness >= 2
            ? 'super'
            : ev.effectiveness < 1
              ? 'resist'
              : 'normal';
        this.spawnFloatingDamage(ev.target, `-${ev.amount}`, tone);

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;
        matHandle.setFlash(0.92);
        targetRig.injectImpulse(
          isPlayer ? -0.45 : 0.45,
          strongHit ? -0.78 : -0.48,
          strongHit ? 0.26 : 0.15
        );

        this.tweens.start(
          0.34,
          (t) => {
            mesh.position.x = home.x + Math.sin(t * Math.PI * 7) * 0.14 * (1 - t);
            matHandle.setFlash(Math.max(0, 0.92 * Math.max(0, 1 - t * 2.2)));
          },
          () => {
            if (this.exited) return;
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.position.set(home.x, this.getGroundedY(ev.target), home.z);
            matHandle.setFlash(0);
            done();
          }
        );
        break;
      }

      case 'heal': {
        this.refreshHud();
        this.game.bus.emit('audio:sfx', { sfx: 'heal' });
        const home = ev.target === 'player' ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        const targetScale = ev.target === 'player' ? this.playerScale : this.enemyScale;
        const fxScale = computeVfxScaleMetrics(targetScale).silhouette;
        _toPos.set(home.x, home.y + targetScale * 0.48, home.z);
        this.fx.abilityVfx.playHealOrBuff(_toPos, home.y, true, targetScale);
        this.fx.ring(_toPos, {
          count: 16,
          radius: 0.45 * fxScale,
          speed: 0.7 * fxScale,
          life: 0.48,
          sizeStart: 0.22 * fxScale,
          sizeEnd: 0.04 * fxScale,
          colorHex: hexToNumber(PALETTE.emerald),
          vy: 1.2 * fxScale,
        });
        this.spawnFloatingDamage(ev.target, `+${ev.amount}`, 'heal');
        done();
        break;
      }

      case 'status_apply':
      case 'status_clear':
      case 'stat_change': {
        this.refreshHud();
        const side = ev.target;
        const home = side === 'player' ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        const targetScale = side === 'player' ? this.playerScale : this.enemyScale;
        const fxScale = computeVfxScaleMetrics(targetScale).silhouette;
        _toPos.set(home.x, home.y + targetScale * 0.48, home.z);
        const isPos = ev.type === 'status_clear' || (ev.type === 'stat_change' && ev.delta > 0);
        this.fx.abilityVfx.playHealOrBuff(_toPos, home.y, isPos, targetScale);
        this.fx.ring(_toPos, {
          count: 14,
          radius: 0.4 * fxScale,
          speed: 1.2 * fxScale,
          life: 0.4,
          sizeStart: 0.2 * fxScale,
          sizeEnd: 0.04 * fxScale,
          colorHex: hexToNumber(
            ev.type === 'stat_change' && ev.delta > 0 ? PALETTE.resonantGold : PALETTE.soulViolet
          ),
          vy: 0.8 * fxScale,
        });
        done();
        break;
      }

      case 'ability_triggered':
        this.game.battleHud.showBanner(
          ev.abilityName,
          getCreatureDisplayName(this.engine.getActive(ev.side))
        );
        done();
        break;

      case 'held_item_triggered':
        this.refreshHud();
        this.game.battleHud.showBanner(
          ev.itemName,
          getCreatureDisplayName(this.engine.getActive(ev.side))
        );
        done();
        break;

      case 'flinch':
      case 'miss':
        this.refreshHud();
        done();
        break;

      case 'xp_gain':
        this.totalXpEarned += ev.amount;
        this.refreshHud();
        done();
        break;

      case 'status_tick':
        this.refreshHud();
        this.game.bus.emit('audio:sfx', { sfx: 'hit_weak' });
        if (ev.damage > 0) {
          this.spawnFloatingDamage(ev.target, `-${ev.damage}`, 'resist');
        }
        done();
        break;

      case 'faint': {
        const isPlayer = ev.target === 'player';
        const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
        const matHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
        const home = isPlayer ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        const baseScale = isPlayer ? this.playerScale : this.enemyScale;

        this.battleCamera.playImmediate('ko_slowmo', 0.72, false);
        this.game.bus.emit('audio:sfx', { sfx: 'faint' });

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;

        this.tweens.start(
          0.55,
          (t) => {
            mesh.position.y = home.y - t * baseScale * 0.35;
            matHandle.setDissolve(t * 1.05);
            this.stage.setShadowScale(ev.target, 1 - t * 0.8, t < 0.9);
          },
          () => {
            if (this.exited) return;
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.visible = false;
            mesh.position.copy(home);
            matHandle.setDissolve(0);
            this.stage.setShadowScale(ev.target, 1, false);
            done();
          }
        );
        break;
      }

      case 'switch_out': {
        const isPlayer = ev.side === 'player';
        const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
        const matHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
        const baseScale = isPlayer ? this.playerScale : this.enemyScale;

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;
        matHandle.setFlash(0);

        this.tweens.start(
          0.25,
          (t) => {
            matHandle.setFlash(Math.min(1, t * 2));
            mesh.scale.setScalar(baseScale * Math.max(0.08, 1 - t));
          },
          () => {
            if (this.exited) return;
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.visible = false;
            matHandle.setFlash(0);
            this.stage.setShadowScale(ev.side, 1, false);
            done();
          }
        );
        break;
      }

      case 'switch_in': {
        if (ev.side === 'enemy') {
          this.game.markSpeciesSeen(ev.creature.speciesId, ev.creature.level);
        }
        this.refreshHud();
        this.sendOutCreature(ev.side, done);
        break;
      }

      case 'catch_attempt': {
        const startX = PLAYER_STATION_POS.x;
        const startY = PLAYER_STATION_POS.y + 1.0;
        const startZ = PLAYER_STATION_POS.z;

        this.game.bus.emit('audio:sfx', { sfx: 'throw' });
        this.capsuleMesh.visible = true;
        this.capsuleMesh.position.set(startX, startY, startZ);
        this.capsuleMesh.rotation.z = 0;

        this.tweens.start(
          0.36,
          (t) => {
            this.capsuleMesh.position.x = THREE.MathUtils.lerp(
              startX,
              ENEMY_STATION_POS.x,
              t
            );
            this.capsuleMesh.position.z = THREE.MathUtils.lerp(
              startZ,
              ENEMY_STATION_POS.z,
              t
            );
            this.capsuleMesh.position.y =
              THREE.MathUtils.lerp(startY, ENEMY_STATION_POS.y + 0.35, t) +
              Math.sin(t * Math.PI) * 1.4;
            this.capsuleMesh.rotation.z = t * Math.PI * 3;
          },
          () => {
            if (this.exited) return;
            this.enemyMesh.visible = false;
            this.stage.setShadowScale('enemy', 0.5, true);
            this.capsuleMesh.position.set(
              ENEMY_STATION_POS.x,
              ENEMY_STATION_POS.y + 0.25,
              ENEMY_STATION_POS.z
            );
            this.capsuleMesh.rotation.z = 0;

            let lastShakeIdx = -1;
            const totalDur = Math.max(0.45, 0.35 + ev.shakes * 0.45);
            this.tweens.start(
              totalDur,
              (t) => {
                if (ev.shakes > 0) {
                  const shakePhase = t * ev.shakes;
                  const shakeIdx = Math.floor(shakePhase);
                  if (shakeIdx > lastShakeIdx && shakeIdx < ev.shakes) {
                    lastShakeIdx = shakeIdx;
                    this.game.bus.emit('audio:sfx', { sfx: 'menu' });
                    _toPos.set(
                      ENEMY_STATION_POS.x,
                      ENEMY_STATION_POS.y + 0.45,
                      ENEMY_STATION_POS.z
                    );
                    this.fx.burst(_toPos, {
                      count: 8,
                      speedMin: 1.0,
                      speedMax: 2.2,
                      lifeMin: 0.2,
                      lifeMax: 0.35,
                      sizeStart: 0.18,
                      sizeEnd: 0.03,
                      colorHex: hexToNumber(PALETTE.paleGold),
                      gravity: -2.0,
                    });
                  }
                  const local = shakePhase - shakeIdx;
                  this.capsuleMesh.rotation.z =
                    local < 0.65 ? Math.sin((local / 0.65) * Math.PI * 2) * 0.38 : 0;
                }
              },
              () => {
                if (this.exited) return;
                this.capsuleMesh.rotation.z = 0;
                const enemyFx = computeVfxScaleMetrics(this.enemyScale).silhouette;
                _toPos.set(
                  ENEMY_STATION_POS.x,
                  ENEMY_STATION_POS.y + this.enemyScale * 0.45,
                  ENEMY_STATION_POS.z
                );
                if (ev.caught) {
                  this.game.bus.emit('audio:sfx', { sfx: 'capture' });
                  this.fx.abilityVfx.playCaptureBurst(
                    _toPos,
                    ENEMY_STATION_POS.y,
                    true,
                    this.enemyScale
                  );
                  this.fx.burst(_toPos, {
                    count: 34,
                    speedMin: 1.8 * enemyFx,
                    speedMax: 4.5 * enemyFx,
                    lifeMin: 0.4,
                    lifeMax: 0.75,
                    sizeStart: 0.3 * enemyFx,
                    sizeEnd: 0.05 * enemyFx,
                    colorHex: hexToNumber(PALETTE.uiGold),
                    gravity: -2.5 * enemyFx,
                    spreadScale: enemyFx,
                  });
                  const wild = this.engine.getActive('enemy');
                  ensureSaveVesselState(this.game.saveData);
                  const vesselId = pickBestVesselForSpecies(this.game.saveData, wild.speciesId);
                  this.game.markSpeciesCaught(wild.speciesId, wild.level, true);
                  this.game.saveData.stats.creaturesCaught += 1;

                  if (vesselId) {
                    consumeVessel(this.game.saveData, vesselId);
                    rebindCreatureContainer(wild, vesselId);
                    const dest = addCapturedCreature(
                      this.game.saveData.party,
                      this.game.saveData.storageBoxes,
                      wild
                    );
                    if (dest.destination === 'box' && dest.boxIndex !== undefined) {
                      const boxName =
                        this.game.saveData.storageBoxes[dest.boxIndex]?.name ??
                        `Caja ${dest.boxIndex + 1}`;
                      this.game.showToast(
                        ES.storage.sentToBox(getCreatureDisplayName(wild), boxName)
                      );
                    } else if (dest.destination === 'none') {
                      this.game.showToast(ES.storage.storageFull);
                    } else {
                      this.game.showToast(
                        ES.battle.caughtBound(
                          getCreatureDisplayName(wild),
                          getBodyContainer(vesselId).name
                        )
                      );
                    }
                  } else {
                    this.game.saveData.soulReserve!.push({
                      uid: wild.uid,
                      speciesId: wild.speciesId,
                      level: wild.level,
                      caughtAt: Date.now(),
                      soulpotId: ev.itemId,
                    });
                    this.game.showToast(
                      ES.battle.caughtSoulOnly(getCreatureDisplayName(wild))
                    );
                  }
                } else {
                  this.fx.burst(_toPos, {
                    count: 18,
                    speedMin: 1.4 * enemyFx,
                    speedMax: 3.0 * enemyFx,
                    lifeMin: 0.25,
                    lifeMax: 0.45,
                    sizeStart: 0.24 * enemyFx,
                    sizeEnd: 0.04 * enemyFx,
                    colorHex: hexToNumber(PALETTE.warmWhite),
                    gravity: -1.5 * enemyFx,
                    spreadScale: enemyFx,
                  });
                  this.capsuleMesh.visible = false;
                  this.enemyMesh.visible = true;
                  this.stage.setShadowScale('enemy', 1, true);
                }
                done();
              }
            );
          }
        );
        break;
      }

      case 'level_up': {
        this.game.bus.emit('audio:sfx', { sfx: 'levelup' });
        const playerFx = computeVfxScaleMetrics(this.playerScale).silhouette;
        _fromPos.set(
          PLAYER_STATION_POS.x,
          PLAYER_STATION_POS.y + this.playerScale * 0.48,
          PLAYER_STATION_POS.z
        );
        this.fx.ring(_fromPos, {
          count: 20,
          radius: 0.55 * playerFx,
          speed: 1.4 * playerFx,
          life: 0.55,
          sizeStart: 0.26 * playerFx,
          sizeEnd: 0.04 * playerFx,
          colorHex: hexToNumber(PALETTE.kiCyan),
          vy: 1.5 * playerFx,
        });
        this.refreshHud();
        done();
        break;
      }

      case 'learn_move_prompt': {
        const creature = this.game.saveData.party[ev.partyIndex];
        if (!creature) {
          done();
          break;
        }
        const newMoveName = getMove(ev.moveId).name;
        this.game.battleHud.showLearnMovePrompt(creature, ev.moveId, (replaceIndex) => {
          if (replaceIndex !== null) {
            const oldId = replaceCreatureMove(creature, replaceIndex, ev.moveId);
            const oldName = oldId ? getMove(oldId).name : '';
            this.game.dialog.show(
              ES.battle.forgotAndLearned(
                getCreatureDisplayName(creature),
                oldName,
                newMoveName
              ),
              done
            );
          } else {
            this.game.dialog.show(
              ES.battle.didNotLearn(getCreatureDisplayName(creature), newMoveName),
              done
            );
          }
        });
        break;
      }

      case 'evolution_ready':
        if (!this.pendingEvolutions.some((e) => e.partyIndex === ev.partyIndex)) {
          this.pendingEvolutions.push({
            partyIndex: ev.partyIndex,
            targetSpeciesId: ev.targetSpeciesId,
          });
        }
        done();
        break;

      case 'card_drop': {
        const { isNew } = addCardToAlbum(this.game.saveData, ev.speciesId);
        this.droppedCards.push({
          speciesId: ev.speciesId,
          creatureName: ev.creatureName,
          isDuplicate: !isNew,
          dismantled: false,
        });
        const card = getCardDef(ev.speciesId);
        const rarityStyle = CARD_RARITY_STYLES[card.rarity];
        const rarityTag = ES.cards.rarity[card.rarity];
        this.game.bus.emit('audio:sfx', { sfx: 'capture' });
        const enemyFx = computeVfxScaleMetrics(this.enemyScale).silhouette;
        _toPos.set(
          ENEMY_STATION_POS.x,
          ENEMY_STATION_POS.y + this.enemyScale * 0.45,
          ENEMY_STATION_POS.z
        );
        this.fx.burst(_toPos, {
          count: 24,
          speedMin: 1.5 * enemyFx,
          speedMax: 3.8 * enemyFx,
          lifeMin: 0.35,
          lifeMax: 0.7,
          sizeStart: 0.28 * enemyFx,
          sizeEnd: 0.04 * enemyFx,
          colorHex: hexToNumber(rarityStyle.fxColor || PALETTE.resonantGold),
          gravity: -1.8 * enemyFx,
          spreadScale: enemyFx,
        });
        this.game.battleHud.showBanner(
          isNew
            ? `Nueva Carta [${rarityTag}]: ${card.name}`
            : `Carta [${rarityTag}]: ${card.name} (+1 copia)`,
          formatCardBonuses(card.bonuses)
        );
        this.game.showToast(`[${rarityTag}] ${card.name} · ${formatCardBonuses(card.bonuses)}`);
        done();
        break;
      }

      case 'weather_change': {
        this.game.battleHud.updateWeather(ev.weather, ev.turns);
        if (ev.weather !== 'none') {
          const weatherColor =
            ev.weather === 'sun'
              ? PALETTE.resonantGold
              : ev.weather === 'rain'
                ? PALETTE.kiCyan
                : ev.weather === 'sandstorm'
                  ? PALETTE.paleGold
                  : PALETTE.iceCyan;
          const enemyFx = computeVfxScaleMetrics(this.enemyScale).silhouette;
          _toPos.set(
            ENEMY_STATION_POS.x,
            ENEMY_STATION_POS.y + this.enemyScale * 0.45,
            ENEMY_STATION_POS.z
          );
          this.fx.ring(_toPos, {
            count: 16,
            radius: 0.45 * enemyFx,
            speed: 1.4 * enemyFx,
            life: 0.48,
            sizeStart: 0.24 * enemyFx,
            sizeEnd: 0.04 * enemyFx,
            colorHex: hexToNumber(weatherColor),
            vy: ev.weather === 'sun' ? 1.2 * enemyFx : -0.6 * enemyFx,
          });
        }
        done();
        break;
      }

      case 'weather_tick':
        this.refreshHud();
        this.game.bus.emit('audio:sfx', { sfx: 'hit_weak' });
        if (ev.damage > 0) {
          this.spawnFloatingDamage(ev.target, `-${ev.damage}`, 'resist');
        }
        done();
        break;

      case 'run_success':
      case 'run_fail':
        done();
        break;

      case 'battle_end': {
        this.game.battleTransition.setVignette(false);
        const dropped = this.droppedCards.map((d) => ({ ...d }));
        let victoryApplied = false;

        const applyVictoryRewardsOnce = () => {
          if (victoryApplied || ev.outcome !== 'win') return;
          victoryApplied = true;
          this.game.saveData.money += ev.rewardMoney;
          this.game.saveData.stats.battlesWon += 1;
        };

        const startSoloVictoryShowcase = () => {
          const activePlayer = this.engine.getActive('player');
          this.enemyMesh.visible = false;
          this.meleeStabMesh.visible = false;
          if (this.trainerMesh) this.trainerMesh.visible = false;

          // Showcase player's SoulDoll from front view while camera orbits her alone
          this.playerMesh.visible = true;
          this.playerMatHandle.setOpacity(1);
          this.playerMatHandle.setDissolve(0);
          this.playerMatHandle.setFlash(0);
          this.playerMatHandle.setTexture(
            this.game.assets.getCreatureTexture(activePlayer.speciesId, 'front')
          );
          this.playerRig.setView('front', true);
          const frontAnchor = this.game.assets.getCreatureRigAnchor?.(
            activePlayer.speciesId,
            'front'
          );
          if (frontAnchor) this.playerRig.setAnchor(frontAnchor);
          this.playerRig.injectImpulse(0, 0.55, 0.24);

          const pFx = computeVfxScaleMetrics(this.playerScale).silhouette;
          _fromPos.set(
            PLAYER_STATION_POS.x,
            PLAYER_STATION_POS.y + this.playerScale * 0.45,
            PLAYER_STATION_POS.z
          );
          this.fx.ring(_fromPos, {
            count: 24,
            radius: 0.4 * pFx,
            speed: 1.9 * pFx,
            life: 0.65,
            sizeStart: 0.26 * pFx,
            sizeEnd: 0.04 * pFx,
            colorHex: hexToNumber(PALETTE.resonantGold),
            vy: 1.4 * pFx,
          });
          this.fx.burst(_fromPos, {
            count: 20,
            speedMin: 1.2 * pFx,
            speedMax: 3.0 * pFx,
            lifeMin: 0.4,
            lifeMax: 0.75,
            sizeStart: 0.24 * pFx,
            sizeEnd: 0.04 * pFx,
            colorHex: hexToNumber(PALETTE.kiCyan),
            gravity: 0.6 * pFx,
            spreadScale: pFx,
          });

          this.game.battleHud.setVictoryShowcaseMode(true);
          this.battleCamera.playImmediate('victory_orbit', 2.0, false);
          this.game.bus.emit('audio:sfx', { sfx: 'victory_fanfare' });
          this.game.bus.emit('audio:music', { track: 'victory' });
        };

        const proceedToFinish = () => {
          applyVictoryRewardsOnce();
          this.finishBattle(ev.outcome);
        };

        const showResultOverlay = () => {
          const activePlayer = this.engine.getActive('player');
          this.game.battleHud.showBattleResultOverlay(
            {
              xpTotal: this.totalXpEarned,
              soulDust: getSoulDust(this.game.saveData),
              championName: getCreatureDisplayName(activePlayer),
              rewardMoney: ev.rewardMoney,
              droppedCards: dropped,
            },
            openAlbum,
            proceedToFinish,
            handleDismantle
          );
        };

        const handleDismantle = (index: number) => {
          const item = dropped[index];
          if (!item || !item.isDuplicate || item.dismantled) return;
          const res = dismantleDuplicateCard(this.game.saveData, item.speciesId);
          if (res.ok) {
            item.dismantled = true;
            item.dustGained = res.dustGained;
            this.game.battleHud.updateSoulDust(res.soulDust);
            this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
            this.game.saveManager.save(this.game.saveData);
            showResultOverlay();
          } else if (res.reason === 'all_socketed') {
            this.game.showToast(ES.cards.dismantleAllSocketed);
          } else {
            item.isDuplicate = false;
            showResultOverlay();
          }
        };

        const openAlbum = () => {
          this.game.cardAlbumScreen.open(
            this.game.saveData,
            () => {
              for (const item of dropped) {
                if (
                  item.isDuplicate &&
                  !item.dismantled &&
                  !canDismantleDuplicateCard(this.game.saveData, item.speciesId).ok
                ) {
                  item.isDuplicate = false;
                }
              }
              this.game.battleHud.updateSoulDust(getSoulDust(this.game.saveData));
              showResultOverlay();
            },
            () => {
              this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
              this.game.battleHud.updateSoulDust(getSoulDust(this.game.saveData));
              this.game.saveManager.save(this.game.saveData);
            }
          );
        };

        if (ev.outcome === 'win') {
          applyVictoryRewardsOnce();
          startSoloVictoryShowcase();
          showResultOverlay();
        } else {
          proceedToFinish();
        }
        break;
      }
    }
  }

  private finishBattle(outcome: 'win' | 'lose' | 'caught' | 'ran'): void {
    if (this.exited) return;

    if (outcome === 'win' && this.pendingEvolutions.length > 0) {
      const queue = this.pendingEvolutions.splice(0);
      const finishAllEvolutions = () => {
        this.game.scenes.pop();
        this.onDone(outcome);
      };

      const runNextEvolution = () => {
        while (queue.length > 0) {
          const next = queue.shift()!;
          const creature = this.game.saveData.party[next.partyIndex];
          const liveTarget = creature ? checkLevelEvolution(creature) : null;
          if (liveTarget !== null) {
            this.game.startEvolution(
              next.partyIndex,
              liveTarget,
              (evolved) => {
                if (evolved) {
                  this.game.saveManager.save(this.game.saveData);
                }
                runNextEvolution();
              },
              { replaceTop: true, autoPop: false }
            );
            return;
          }
        }
        finishAllEvolutions();
      };

      runNextEvolution();
      return;
    }

    this.game.scenes.pop();
    this.onDone(outcome);
  }

  fixedUpdate(dt: number): void {
    const tier = this.game.renderer.getQualityTier();
    this.stage.setQualityTier(tier);
    this.stage.setShadowsEnabled(this.game.renderer.areShadowsEnabled());
    this.stage.setAmbientParticlesEnabled(this.game.renderer.areAmbientParticlesEnabled());
    this.fx.setQualityTier(tier);
    this.postFx.setQualityTier(tier);

    const curAspect = this.game.renderer.getAspect();
    const curInternalH = this.game.renderer.getInternalHeight();
    if (
      Math.abs(curAspect - this.lastAspect) > 0.02 ||
      curInternalH !== this.lastInternalH
    ) {
      this.lastAspect = curAspect;
      this.lastInternalH = curInternalH;
      this.playerScale = this.battleCamera.computeNormalizedSpriteScale(
        PLAYER_STATION_POS,
        0.45
      );
      this.enemyScale = this.battleCamera.computeNormalizedSpriteScale(
        ENEMY_STATION_POS,
        0.285
      );
      if (this.trainerMesh && this.trainerMesh.visible) {
        this.trainerMesh.scale.setScalar(this.enemyScale * 0.85);
      }
    }

    this.battleCamera.update(dt);
    const cam = this.game.cameraRig.camera;
    _camPos.copy(cam.position);

    const hitStopped = this.battleCamera.isHitStopped();
    const scaledDt = hitStopped ? 0 : dt * this.battleCamera.getTimeScale();
    this.postFx.update(dt);

    if (scaledDt > 0) {
      this.tweens.update(scaledDt);
      if (this.game.renderer.areAmbientParticlesEnabled()) {
        this.fx.emitAmbient(this.biome, scaledDt);
      }
      this.fx.update(scaledDt, _camPos);
      this.stage.update(scaledDt, _camPos);
      if (this.playerMesh.visible) {
        this.playerRig.update(scaledDt);
      }
      if (this.enemyMesh.visible) {
        this.enemyRig.update(scaledDt);
      }
    }

    // Grounded torso-driven idle breathing (feet strictly anchored at grounded station Y, POSE_ACTUAL = POSE_BASE * BREATH_QUAT)
    if (this.playerMesh.visible) {
      if (!this.playerAnimating) {
        this.playerMesh.position.y = this.getGroundedY('player');
        this.playerMesh.scale.setScalar(this.playerScale);
      }
      this.playerMesh.lookAt(_camPos.x, this.playerMesh.position.y, _camPos.z);
      this.playerRig.applyToMesh(this.playerMesh, this.playerMatHandle);
    }

    if (this.enemyMesh.visible) {
      if (!this.enemyAnimating) {
        this.enemyMesh.position.y = this.getGroundedY('enemy');
        this.enemyMesh.scale.setScalar(this.enemyScale);
      }
      this.enemyMesh.lookAt(_camPos.x, this.enemyMesh.position.y, _camPos.z);
      this.enemyRig.applyToMesh(this.enemyMesh, this.enemyMatHandle);
    }

    if (this.meleeStabMesh.visible) {
      this.meleeStabMesh.lookAt(_camPos.x, this.meleeStabMesh.position.y, _camPos.z);
    }
    if (this.trainerMesh && this.trainerMesh.visible) {
      this.trainerMesh.lookAt(_camPos.x, this.trainerMesh.position.y, _camPos.z);
    }
    if (this.capsuleMesh.visible) {
      this.capsuleMesh.lookAt(_camPos.x, this.capsuleMesh.position.y, _camPos.z);
    }

    // Low-HP warning vignette & alarm beep
    const activePlayer = this.engine.getActive('player');
    const isLowHp =
      this.introDone &&
      !this.engine.state.finished &&
      activePlayer.currentHp > 0 &&
      activePlayer.currentHp / Math.max(1, activePlayer.stats.hp) <= 0.2;

    if (isLowHp) {
      this.game.battleTransition.setVignette(true);
      this.lowHpAlarmTimer -= dt;
      if (this.lowHpAlarmTimer <= 0) {
        this.lowHpAlarmTimer = 1.65;
        this.game.bus.emit('audio:sfx', { sfx: 'low_hp' });
      }
    } else {
      this.game.battleTransition.setVignette(false);
      this.lowHpAlarmTimer = 0.2;
    }

    this.game.battleHud.update(dt);
    this.game.dialog.update(dt, this.game.input);

    if (this.game.input.justPressed('a')) {
      this.battleCamera.skipIntro();
    }
  }

  render(): void {
    if (this.game.renderer.isContextLost()) return;
    this.postFx.setQualityTier(this.game.renderer.getQualityTier());
    this.postFx.setPixelEffect(this.game.renderer.isPixelEffectEnabled());
    this.postFx.setPostFxOptions(this.game.renderer.getPostFxOptions());
    this.postFx.render();
  }

  onExit(): void {
    this.exited = true;
    this.unsubCreatureLoad?.();
    this.unsubCreatureLoad = null;
    this.game.renderer.canvas.removeEventListener('pointerdown', this.handleStageTap);
    this.tweens.clear();
    this.game.battleTransition.hide();
    this.game.battleHud.hide();
    this.fx.dispose();
    this.postFx.dispose();
    this.stage.dispose();
    this.disposables.disposeAll();
  }
}
