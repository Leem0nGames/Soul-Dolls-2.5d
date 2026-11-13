import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import type { Scene } from '../core/SceneStack.ts';
import { getMove } from '../data/moves.ts';
import { getSpecies } from '../data/species.ts';
import { getCreatureDisplayName } from '../domain/Creature.ts';
import { applyEvolution } from '../domain/Evolution.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import { hexToNumber, PALETTE } from '../gfx/Palette.ts';
import { ES } from '../i18n/es.ts';

export class EvolutionScene implements Scene {
  readonly name = 'evolution';
  private scene = new THREE.Scene();
  private disposables = new DisposableRegistry();
  private spriteMat: THREE.MeshBasicMaterial;
  private spriteMesh: THREE.Mesh;
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

    const geo = new THREE.PlaneGeometry(2.6, 2.6);
    this.spriteMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getCreatureTexture(creature.speciesId, 'front'),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.spriteMesh = new THREE.Mesh(geo, this.spriteMat);
    this.spriteMesh.position.set(0, 1.3, 0);
    this.scene.add(this.spriteMesh);
    this.disposables.track(geo);
    this.disposables.track(this.spriteMat);
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
    this.game.dialog.show([
      ES.evolution.evolving(this.oldName),
      ES.evolution.cancelHint,
    ]);
  }

  fixedUpdate(dt: number): void {
    this.game.dialog.update(dt, this.game.input);

    if (this.phase === 'anim') {
      this.elapsed += dt;
      // Pulsing scale and flash between old and new species
      const freq = 6 + this.elapsed * 5;
      const showNew = Math.sin(this.elapsed * freq) > 0;
      const creature = this.game.saveData.party[this.partyIndex];
      const tex = this.game.assets.getCreatureTexture(
        showNew ? this.targetSpeciesId : creature.speciesId,
        'front'
      );
      if (this.spriteMat.map !== tex) {
        this.spriteMat.map = tex;
        this.spriteMat.needsUpdate = true;
      }
      const s = 1 + Math.sin(this.elapsed * 10) * 0.15;
      this.spriteMesh.scale.set(s, s, 1);

      if (this.game.input.justPressed('b')) {
        this.cancelled = true;
        this.phase = 'done';
        this.spriteMesh.scale.set(1, 1, 1);
        this.spriteMat.map = this.game.assets.getCreatureTexture(creature.speciesId, 'front');
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
        this.spriteMesh.scale.set(1.15, 1.15, 1);
        this.spriteMat.map = this.game.assets.getCreatureTexture(this.targetSpeciesId, 'front');
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
