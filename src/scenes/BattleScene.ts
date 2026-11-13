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
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { replaceCreatureMove } from '../domain/Experience.ts';
import { addCapturedCreature } from '../domain/Storage.ts';
import type {
  BattleAction,
  BattleBiome,
  BattleEvent,
  CharacterRole,
  CreatureInstance,
  TrainerDef,
} from '../domain/types.ts';
import { BattleCamera } from '../engine/BattleCamera.ts';
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
import { DisposableRegistry } from '../engine/Disposables.ts';
import { FxSystem } from '../engine/FxSystem.ts';
import { TweenRunner } from '../engine/Tween.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';

const _camPos = new THREE.Vector3();
const _fromPos = new THREE.Vector3();
const _toPos = new THREE.Vector3();
const _projVec = new THREE.Vector3();

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

  private playerMesh: THREE.Mesh;
  private enemyMesh: THREE.Mesh;
  private playerSilMesh: THREE.Mesh;
  private enemySilMesh: THREE.Mesh;
  private trainerMesh: THREE.Mesh | null = null;
  private capsuleMesh: THREE.Mesh;

  private playerMatHandle: BattleSpriteMaterialHandle;
  private enemyMatHandle: BattleSpriteMaterialHandle;
  private playerSilMat: THREE.MeshBasicMaterial;
  private enemySilMat: THREE.MeshBasicMaterial;

  private playerScale = 2.0;
  private enemyScale = 1.6;
  private lastAspect = 0;
  private lastInternalH = 0;
  private playerAnimating = false;
  private enemyAnimating = false;
  private idleTime = 0;
  private lowHpAlarmTimer = 0;
  private exited = false;
  private introDone = false;

  private eventQueue: BattleEvent[] = [];
  private processingEvent = false;
  private pendingEvolutions: Array<{ partyIndex: number; targetSpeciesId: number }> = [];
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
      this.biome
    );

    this.stage = new BattleStage(this.scene, game.assets, this.biome, this.isBoss);
    this.battleCamera = new BattleCamera(game.cameraRig.camera);
    this.fx = new FxSystem(this.scene);
    this.fx.setFlashCallback((css, ms) => this.game.battleTransition.flashScreen(css, ms));

    const internalH = game.renderer.getInternalHeight();
    this.lastAspect = game.renderer.getAspect();
    this.lastInternalH = internalH;
    this.playerScale = this.battleCamera.computeIntegerPixelScale(
      PLAYER_STATION_POS,
      0.36,
      internalH
    );
    this.enemyScale = this.battleCamera.computeIntegerPixelScale(
      ENEMY_STATION_POS,
      0.26,
      internalH
    );

    const unitGeo = createBottomPivotPlaneGeometry(1, 1);
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

    this.playerMesh = new THREE.Mesh(unitGeo, this.playerMatHandle.material);
    this.playerMesh.position.copy(PLAYER_STATION_POS);
    this.playerMesh.scale.setScalar(this.playerScale);
    this.playerMesh.visible = false;
    this.playerMesh.renderOrder = 2;

    this.enemyMesh = new THREE.Mesh(unitGeo, this.enemyMatHandle.material);
    this.enemyMesh.position.copy(ENEMY_STATION_POS);
    this.enemyMesh.scale.setScalar(this.enemyScale);
    this.enemyMesh.visible = false;
    this.enemyMesh.renderOrder = 2;

    // White source-in silhouette overlays for hit flash & capsule send-out
    this.playerSilMat = new THREE.MeshBasicMaterial({
      map: game.assets.getCreatureSilhouetteTexture(activePlayer.speciesId, 'back'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.enemySilMat = new THREE.MeshBasicMaterial({
      map: game.assets.getCreatureSilhouetteTexture(activeEnemy.speciesId, 'front'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.disposables.track(this.playerSilMat);
    this.disposables.track(this.enemySilMat);

    this.playerSilMesh = new THREE.Mesh(unitGeo, this.playerSilMat);
    this.playerSilMesh.position.set(0, 0, 0.015);
    this.playerSilMesh.renderOrder = 3;
    this.playerSilMesh.visible = false;
    this.playerMesh.add(this.playerSilMesh);

    this.enemySilMesh = new THREE.Mesh(unitGeo, this.enemySilMat);
    this.enemySilMesh.position.set(0, 0, 0.015);
    this.enemySilMesh.renderOrder = 3;
    this.enemySilMesh.visible = false;
    this.enemyMesh.add(this.enemySilMesh);

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
      this.trainerMesh.scale.setScalar(this.enemyScale * 0.94);
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

    this.scene.add(this.playerMesh, this.enemyMesh, this.capsuleMesh);
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
    _toPos.set(ENEMY_STATION_POS.x, ENEMY_STATION_POS.y + 0.5, ENEMY_STATION_POS.z);
    this.fx.burst(_toPos, {
      count: 20,
      speedMin: 1.2,
      speedMax: 3.1,
      lifeMin: 0.35,
      lifeMax: 0.65,
      sizeStart: 0.25,
      sizeEnd: 0.06,
      colorHex: hexToNumber(PALETTE.emerald),
      gravity: -3.8,
    });

    this.enemyAnimating = true;
    this.enemyMesh.visible = true;
    this.stage.setShadowScale('enemy', 1, true);
    this.enemySilMat.opacity = 0.85;
    this.enemySilMesh.visible = true;
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
        this.enemyMesh.position.y = ENEMY_STATION_POS.y + Math.sin(t * Math.PI) * 0.45;
        this.enemySilMat.opacity = Math.max(0, 0.85 * (1 - t * 1.3));
      },
      () => {
        this.enemyAnimating = false;
        this.enemyMesh.position.copy(ENEMY_STATION_POS);
        this.enemyMesh.scale.setScalar(this.enemyScale);
        this.enemySilMat.opacity = 0;
        this.enemySilMesh.visible = false;
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

  private sendOutCreature(side: 'player' | 'enemy', onDone: () => void): void {
    const isPlayer = side === 'player';
    const station = isPlayer ? PLAYER_STATION_POS : ENEMY_STATION_POS;
    const baseScale = isPlayer ? this.playerScale : this.enemyScale;
    const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
    const silMesh = isPlayer ? this.playerSilMesh : this.enemySilMesh;
    const silMat = isPlayer ? this.playerSilMat : this.enemySilMat;
    const matHandle = isPlayer ? this.playerMatHandle : this.enemyMatHandle;
    const creature = this.engine.getActive(side);

    matHandle.setDissolve(0);
    matHandle.setOpacity(1);
    matHandle.setTexture(
      this.game.assets.getCreatureTexture(creature.speciesId, isPlayer ? 'back' : 'front')
    );
    silMat.map = this.game.assets.getCreatureSilhouetteTexture(
      creature.speciesId,
      isPlayer ? 'back' : 'front'
    );
    silMat.needsUpdate = true;

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
        this.capsuleMesh.visible = false;
        this.capsuleMesh.rotation.z = 0;

        _toPos.set(station.x, station.y + 0.55, station.z);
        this.fx.burst(_toPos, {
          count: 24,
          speedMin: 1.4,
          speedMax: 3.4,
          lifeMin: 0.25,
          lifeMax: 0.45,
          sizeStart: 0.28,
          sizeEnd: 0.04,
          colorHex: hexToNumber(isPlayer ? PALETTE.kiCyan : PALETTE.resonantGold),
          gravity: -1.5,
        });

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;

        mesh.position.copy(station);
        mesh.visible = true;
        this.stage.setShadowScale(side, 1, true);
        silMesh.visible = true;
        silMat.opacity = 1.0;
        this.game.synth.playCry(creature.speciesId);

        this.tweens.start(
          0.3,
          (t) => {
            const ease = 1 - Math.pow(1 - t, 3);
            mesh.scale.setScalar(baseScale * (0.18 + 0.82 * ease));
            silMat.opacity = Math.max(0, 1 - t * 1.25);
          },
          () => {
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.scale.setScalar(baseScale);
            silMat.opacity = 0;
            silMesh.visible = false;
            onDone();
          }
        );
      }
    );
  }

  private refreshHud(): void {
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
            }
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

        _fromPos.set(home.x, home.y + baseScale * 0.5, home.z);
        _toPos.set(target.x, target.y + targetScale * 0.5, target.z);

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;

        const finishMoveAnim = () => {
          if (isPlayer) this.playerAnimating = false;
          else this.enemyAnimating = false;
          mesh.position.copy(home);
          mesh.scale.setScalar(baseScale);
          done();
        };

        if (move.category === 'physical') {
          let fxFired = false;
          const dx = (target.x - home.x) * 0.24;
          const dz = (target.z - home.z) * 0.24;
          this.tweens.start(
            0.34,
            (t) => {
              const p = Math.sin(t * Math.PI);
              mesh.position.x = home.x + dx * p;
              mesh.position.z = home.z + dz * p;
              mesh.position.y = home.y + p * 0.18;
              mesh.scale.set(
                baseScale * (1 + 0.1 * p),
                baseScale * (1 - 0.07 * p),
                1
              );
              if (t >= 0.45 && !fxFired) {
                fxFired = true;
                this.fx.playTypeMove(move.type, _fromPos, _toPos, 'physical');
                this.fx.burst(_toPos, {
                  count: 10,
                  speedMin: 2.2,
                  speedMax: 4.5,
                  lifeMin: 0.16,
                  lifeMax: 0.3,
                  sizeStart: 0.28,
                  sizeEnd: 0.04,
                  colorHex: hexToNumber(PALETTE.warmWhite),
                  gravity: 0,
                });
              }
            },
            finishMoveAnim
          );
        } else if (move.category === 'special') {
          let fxFired = false;
          const bx = (home.x - target.x) * 0.08;
          const bz = (home.z - target.z) * 0.08;
          this.fx.ring(_fromPos, {
            count: 14,
            radius: 0.45,
            speed: -1.1,
            life: 0.26,
            sizeStart: 0.22,
            sizeEnd: 0.04,
            colorHex: hexToNumber(PALETTE.warmWhite),
            vy: 0.2,
          });
          this.tweens.start(
            0.42,
            (t) => {
              const hop = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) : 0;
              mesh.position.x = home.x + bx * hop;
              mesh.position.z = home.z + bz * hop;
              mesh.position.y = home.y + hop * 0.22;
              if (t >= 0.36 && !fxFired) {
                fxFired = true;
                this.fx.playTypeMove(move.type, _fromPos, _toPos, 'special');
              }
            },
            finishMoveAnim
          );
        } else {
          this.fx.playTypeMove(move.type, _fromPos, _toPos, 'status');
          this.tweens.start(
            0.36,
            (t) => {
              const s = 1 + Math.sin(t * Math.PI * 2) * 0.08;
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
          this.game.battleHud.flashBodyPart(ev.target, ev.damagedPart);
        }
        const isPlayer = ev.target === 'player';
        const mesh = isPlayer ? this.playerMesh : this.enemyMesh;
        const silMesh = isPlayer ? this.playerSilMesh : this.enemySilMesh;
        const silMat = isPlayer ? this.playerSilMat : this.enemySilMat;
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
        silMesh.visible = true;
        silMat.opacity = 0.92;

        this.tweens.start(
          0.34,
          (t) => {
            mesh.position.x = home.x + Math.sin(t * Math.PI * 7) * 0.14 * (1 - t);
            silMat.opacity = Math.max(0, 0.92 * Math.max(0, 1 - t * 2.2));
          },
          () => {
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.position.copy(home);
            silMat.opacity = 0;
            silMesh.visible = false;
            done();
          }
        );
        break;
      }

      case 'heal': {
        this.refreshHud();
        this.game.bus.emit('audio:sfx', { sfx: 'heal' });
        const home = ev.target === 'player' ? PLAYER_STATION_POS : ENEMY_STATION_POS;
        _toPos.set(home.x, home.y + 0.6, home.z);
        this.fx.ring(_toPos, {
          count: 16,
          radius: 0.45,
          speed: 0.7,
          life: 0.48,
          sizeStart: 0.22,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.emerald),
          vy: 1.2,
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
        _toPos.set(home.x, home.y + 0.65, home.z);
        this.fx.ring(_toPos, {
          count: 14,
          radius: 0.4,
          speed: 1.2,
          life: 0.4,
          sizeStart: 0.2,
          sizeEnd: 0.04,
          colorHex: hexToNumber(
            ev.type === 'stat_change' && ev.delta > 0 ? PALETTE.resonantGold : PALETTE.soulViolet
          ),
          vy: 0.8,
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
      case 'xp_gain':
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
        const silMesh = isPlayer ? this.playerSilMesh : this.enemySilMesh;
        const silMat = isPlayer ? this.playerSilMat : this.enemySilMat;
        const baseScale = isPlayer ? this.playerScale : this.enemyScale;

        if (isPlayer) this.playerAnimating = true;
        else this.enemyAnimating = true;
        silMesh.visible = true;
        silMat.opacity = 0;

        this.tweens.start(
          0.25,
          (t) => {
            silMat.opacity = Math.min(1, t * 2);
            mesh.scale.setScalar(baseScale * Math.max(0.08, 1 - t));
          },
          () => {
            if (isPlayer) this.playerAnimating = false;
            else this.enemyAnimating = false;
            mesh.visible = false;
            silMesh.visible = false;
            silMat.opacity = 0;
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
                this.capsuleMesh.rotation.z = 0;
                _toPos.set(
                  ENEMY_STATION_POS.x,
                  ENEMY_STATION_POS.y + 0.55,
                  ENEMY_STATION_POS.z
                );
                if (ev.caught) {
                  this.game.bus.emit('audio:sfx', { sfx: 'capture' });
                  this.fx.burst(_toPos, {
                    count: 34,
                    speedMin: 1.8,
                    speedMax: 4.5,
                    lifeMin: 0.4,
                    lifeMax: 0.75,
                    sizeStart: 0.3,
                    sizeEnd: 0.05,
                    colorHex: hexToNumber(PALETTE.uiGold),
                    gravity: -2.5,
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
                    speedMin: 1.4,
                    speedMax: 3.0,
                    lifeMin: 0.25,
                    lifeMax: 0.45,
                    sizeStart: 0.24,
                    sizeEnd: 0.04,
                    colorHex: hexToNumber(PALETTE.warmWhite),
                    gravity: -1.5,
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
        _fromPos.set(
          PLAYER_STATION_POS.x,
          PLAYER_STATION_POS.y + 0.65,
          PLAYER_STATION_POS.z
        );
        this.fx.ring(_fromPos, {
          count: 20,
          radius: 0.55,
          speed: 1.4,
          life: 0.55,
          sizeStart: 0.26,
          sizeEnd: 0.04,
          colorHex: hexToNumber(PALETTE.kiCyan),
          vy: 1.5,
        });
        this.refreshHud();
        done();
        break;
      }

      case 'learn_move_prompt': {
        const creature = this.game.saveData.party[ev.partyIndex];
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
        this.pendingEvolutions.push({
          partyIndex: ev.partyIndex,
          targetSpeciesId: ev.targetSpeciesId,
        });
        done();
        break;

      case 'run_success':
      case 'run_fail':
        done();
        break;

      case 'battle_end': {
        this.game.battleTransition.setVignette(false);
        if (ev.outcome === 'win') {
          this.game.saveData.money += ev.rewardMoney;
          this.game.saveData.stats.battlesWon += 1;
          this.battleCamera.playImmediate('victory_orbit', 2.0, true);
          this.game.bus.emit('audio:sfx', { sfx: 'victory_fanfare' });
          this.game.bus.emit('audio:music', { track: 'victory' });
          this.tweens.start(
            0.95,
            () => {},
            () => {
              this.finishBattle(ev.outcome);
            }
          );
        } else {
          this.finishBattle(ev.outcome);
        }
        break;
      }
    }
  }

  private finishBattle(outcome: 'win' | 'lose' | 'caught' | 'ran'): void {
    if (this.exited) return;
    const popAndCallback = () => {
      this.game.scenes.pop();
      this.onDone(outcome);
    };

    if (outcome === 'win' && this.pendingEvolutions.length > 0) {
      const next = this.pendingEvolutions.shift()!;
      this.game.scenes.pop();
      this.game.startEvolution(next.partyIndex, next.targetSpeciesId, () => {
        this.onDone(outcome);
      });
      return;
    }

    popAndCallback();
  }

  fixedUpdate(dt: number): void {
    const tier = this.game.renderer.getQualityTier();
    this.stage.setQualityTier(tier);
    this.fx.setQualityTier(tier);

    const curAspect = this.game.renderer.getAspect();
    const curInternalH = this.game.renderer.getInternalHeight();
    if (
      Math.abs(curAspect - this.lastAspect) > 0.02 ||
      curInternalH !== this.lastInternalH
    ) {
      this.lastAspect = curAspect;
      this.lastInternalH = curInternalH;
      this.playerScale = this.battleCamera.computeIntegerPixelScale(
        PLAYER_STATION_POS,
        0.36,
        curInternalH
      );
      this.enemyScale = this.battleCamera.computeIntegerPixelScale(
        ENEMY_STATION_POS,
        0.26,
        curInternalH
      );
      if (this.trainerMesh && this.trainerMesh.visible) {
        this.trainerMesh.scale.setScalar(this.enemyScale * 0.94);
      }
    }

    this.battleCamera.update(dt);
    const cam = this.game.cameraRig.camera;
    _camPos.copy(cam.position);

    const hitStopped = this.battleCamera.isHitStopped();
    const scaledDt = hitStopped ? 0 : dt * this.battleCamera.getTimeScale();

    if (scaledDt > 0) {
      this.idleTime += scaledDt;
      this.tweens.update(scaledDt);
      this.fx.emitAmbient(this.biome, scaledDt);
      this.fx.update(scaledDt, _camPos);
      this.stage.update(scaledDt, _camPos);
    }

    // Idle squash-and-stretch bob + Y-locked billboard lookAt
    if (this.playerMesh.visible) {
      if (!this.playerAnimating) {
        const bob = Math.sin(this.idleTime * 4.2);
        this.playerMesh.position.y = PLAYER_STATION_POS.y + Math.max(0, bob) * 0.03;
        this.playerMesh.scale.set(
          this.playerScale * (1 - bob * 0.025),
          this.playerScale * (1 + bob * 0.035),
          1
        );
      }
      this.playerMesh.lookAt(_camPos.x, this.playerMesh.position.y, _camPos.z);
    }

    if (this.enemyMesh.visible) {
      if (!this.enemyAnimating) {
        const bob = Math.sin(this.idleTime * 4.5 + 1.3);
        this.enemyMesh.position.y = ENEMY_STATION_POS.y + Math.max(0, bob) * 0.03;
        this.enemyMesh.scale.set(
          this.enemyScale * (1 - bob * 0.025),
          this.enemyScale * (1 + bob * 0.035),
          1
        );
      }
      this.enemyMesh.lookAt(_camPos.x, this.enemyMesh.position.y, _camPos.z);
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
    this.game.renderer.render(this.scene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.exited = true;
    this.game.renderer.canvas.removeEventListener('pointerdown', this.handleStageTap);
    this.tweens.clear();
    this.game.battleTransition.hide();
    this.game.battleHud.hide();
    this.fx.dispose();
    this.stage.dispose();
    this.disposables.disposeAll();
  }
}
