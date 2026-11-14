import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { applyEvolution } from '../domain/Evolution.ts';
import {
  createBattleSpriteMaterial,
  type BattleSpriteMaterialHandle,
} from '../engine/BattleSpriteMat.ts';
import { createBottomPivotPlaneGeometry } from '../engine/BillboardBatch.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import { SoulDollIdleRig } from '../engine/SoulDollIdleRig.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';

export class EvolutionScene implements Scene {
  readonly name = 'evolution';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private spriteMatHandle: BattleSpriteMaterialHandle;
  private spriteMesh: THREE.Mesh;
  private rig: SoulDollIdleRig;
  private currentTexSpeciesId: number;
  private elapsed = 0;
  private phase: 'anim' | 'done' = 'anim';
  private cancelled = false;
  private oldName: string;

  constructor(
    private readonly game: Game,
    private readonly partyIndex: number,
    private readonly targetSpeciesId: number,
    private readonly onDone: () => void
  ) {
    this.scene.background = new THREE.Color(hexToNumber(PALETTE.abyssInk));
    const creature = this.game.saveData.party[partyIndex];
    this.oldName = getCreatureDisplayName(creature);
    this.currentTexSpeciesId = creature.speciesId;

    const geo = createBottomPivotPlaneGeometry(1, 1, 24, 32);
    this.spriteMatHandle = createBattleSpriteMaterial(
      this.game.assets.getCreatureTexture(creature.speciesId, 'front')
    );
    this.rig = new SoulDollIdleRig({
      view: 'front',
      flipX: false,
      cycleDuration: 3.5,
      initialPhase: 0.2,
    });
    const anchor = this.game.assets.getCreatureRigAnchor?.(creature.speciesId, 'front');
    if (anchor) this.rig.setAnchor(anchor);

    this.spriteMesh = new THREE.Mesh(geo, this.spriteMatHandle.material);
    this.spriteMesh.position.set(0, 0, 0);
    this.spriteMesh.scale.set(2.5, 2.5, 2.5);
    this.scene.add(this.spriteMesh);
    this.disposables.track(geo);
    this.disposables.track(this.spriteMatHandle.material);
  }

  onEnter(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: false,
      touchControls: true,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.touchControls.setVisible(true);
    this.game.cameraRig.setPreset('battle');
    this.game.cameraRig.snapTo(0, 0, 0);
    this.spriteMesh.lookAt(
      this.game.cameraRig.camera.position.x,
      this.spriteMesh.position.y,
      this.game.cameraRig.camera.position.z
    );
    this.game.dialog.show([
      ES.evolution.evolving(this.oldName),
      ES.evolution.cancelHint,
    ]);
  }

  fixedUpdate(dt: number): void {
    const camPos = this.game.cameraRig.camera.position;
    this.spriteMesh.lookAt(camPos.x, this.spriteMesh.position.y, camPos.z);
    this.game.dialog.update(dt, this.game.input);

    this.rig.update(dt, this.phase === 'done');
    this.rig.applyToMesh(this.spriteMesh, this.spriteMatHandle);

    if (this.phase === 'anim') {
      this.elapsed += dt;
      // Pulsing scale and flash between old and new species
      const freq = 6 + this.elapsed * 5;
      const showNew = Math.sin(this.elapsed * freq) > 0;
      const creature = this.game.saveData.party[this.partyIndex];
      const activeId = showNew ? this.targetSpeciesId : creature.speciesId;
      if (this.currentTexSpeciesId !== activeId) {
        this.currentTexSpeciesId = activeId;
        this.spriteMatHandle.setTexture(this.game.assets.getCreatureTexture(activeId, 'front'));
        const anchor = this.game.assets.getCreatureRigAnchor?.(activeId, 'front');
        if (anchor) this.rig.setAnchor(anchor);
      }
      const s = 2.5 * (1 + Math.sin(this.elapsed * 10) * 0.12);
      this.spriteMesh.scale.set(s, s, 2.5);

      if (this.game.input.justPressed('b')) {
        this.cancelled = true;
        this.phase = 'done';
        this.spriteMesh.scale.set(2.5, 2.5, 2.5);
        this.currentTexSpeciesId = creature.speciesId;
        this.spriteMatHandle.setTexture(
          this.game.assets.getCreatureTexture(creature.speciesId, 'front')
        );
        const anchor = this.game.assets.getCreatureRigAnchor?.(creature.speciesId, 'front');
        if (anchor) this.rig.setAnchor(anchor);
        this.game.bus.emit('audio:sfx', { sfx: 'cancel' });
        this.game.dialog.show(ES.evolution.cancelled(this.oldName), () => {
          this.game.scenes.pop();
          this.onDone();
        });
        return;
      }

      if (this.elapsed >= 3.0) {
        this.phase = 'done';
        const res = applyEvolution(creature, this.targetSpeciesId);
        this.game.markSpeciesCaught(this.targetSpeciesId, creature.level, false);
        const newSpec = getSpecies(this.targetSpeciesId);
        this.spriteMesh.scale.set(2.5 * 1.15, 2.5 * 1.15, 2.5);
        this.currentTexSpeciesId = this.targetSpeciesId;
        this.spriteMatHandle.setTexture(
          this.game.assets.getCreatureTexture(this.targetSpeciesId, 'front')
        );
        const anchor = this.game.assets.getCreatureRigAnchor?.(this.targetSpeciesId, 'front');
        if (anchor) this.rig.setAnchor(anchor);
        this.rig.injectImpulse(0, -0.55, 0.22);
        this.game.bus.emit('audio:sfx', { sfx: 'levelup' });

        const lines = [ES.evolution.completed(this.oldName, newSpec.name)];
        for (const mId of res.autoLearnedMoves) {
          lines.push(ES.battle.learnedMove(newSpec.name, getMove(mId).name));
        }

        this.game.dialog.show(lines, () => {
          this.game.scenes.pop();
          this.onDone();
        });
      }
    }
    void this.cancelled;
  }

  render(): void {
    this.game.renderer.render(this.scene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.disposables.disposeAll();
  }
}
