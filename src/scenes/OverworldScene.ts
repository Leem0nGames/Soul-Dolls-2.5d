import * as THREE from 'three';
import type { Game } from '../core/Game.ts';
import { createRng } from '../core/Rng.ts';
import type { Scene } from '../core/SceneStack.ts';
import {
  ALL_CONTAINER_IDS,
  getBodyContainer,
  SHARDS_PER_CONTAINER,
} from '../data/containers.ts';
import { getItem } from '../data/items.ts';
import { getMap } from '../data/maps/index.ts';
import { getSpecies } from '../data/species.ts';
import { getTrainer } from '../data/trainers.ts';
import { getClaimableMilestones, claimBestiaryMilestone } from '../domain/Bestiary.ts';
import {
  addBodyPartShard,
  addVessel,
  ensureSaveVesselState,
} from '../domain/BodyParts.ts';
import { createCreature, getCreatureDisplayName } from '../domain/Creature.ts';
import { checkItemEvolution } from '../domain/Evolution.ts';
import { equipHeldItem } from '../domain/HeldItems.ts';
import {
  addItem,
  applyMedicineToCreature,
  removeItem,
} from '../domain/Inventory.ts';
import { addToParty, healPartyFull } from '../domain/Party.ts';
import {
  cameraRelativeMove,
  getTileHeightLevel,
  getTileWorldY,
  isInsideBuilding,
  isTileWalkable,
  relativeSpriteDir,
  sampleInterpolatedHeight,
} from '../domain/TerrainRules.ts';
import type {
  CharacterFrame,
  CharacterRole,
  Direction,
  MapDef,
  NpcDef,
  PropKind,
} from '../domain/types.ts';
import {
  buildEncounterGrassPlacements,
  buildInstancedPropBatches,
  createBottomPivotPlaneGeometry,
  updatePropBatchAnimation,
  type PropBatchGroup,
  type PropInstancePlacement,
} from '../engine/BillboardBatch.ts';
import { buildBuildingsMesh } from '../engine/BuildingMesher.ts';
import { DisposableRegistry } from '../engine/Disposables.ts';
import {
  buildCloudBillboards,
  createGradientSkyTexture,
  updateCloudBillboards,
  type CloudDriftItem,
} from '../engine/SkyBackdrop.ts';
import {
  buildTerrainChunks,
  updateTerrainWaterFrame,
  updateVisibleTerrainChunks,
  type TerrainChunk,
} from '../engine/TerrainMesher.ts';
import { ES } from '../i18n/es.ts';

interface RuntimeNpc {
  def: NpcDef;
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  visible: boolean;
  isPedestal: boolean;
}

interface RuntimePickup {
  id: string;
  x: number;
  y: number;
  itemId: string;
  quantity: number;
  hidden: boolean;
  mesh: THREE.Mesh | null;
}

const STARTER_IDS = [1, 4, 7] as const;

const SOLID_SEED_PROPS: ReadonlySet<PropKind> = new Set([
  'oak',
  'pine',
  'birch',
  'snow_pine',
  'mushroom_tree',
  'mushroom_tree_arcane',
  'boulder',
]);

export class OverworldScene implements Scene {
  readonly name = 'overworld';
  private scene = new THREE.Scene();
  private mapDisposables = new DisposableRegistry();
  private persistentDisposables = new DisposableRegistry();

  private currentMap!: MapDef;
  private chunks: TerrainChunk[] = [];
  private propBatches: PropBatchGroup[] = [];
  private clouds: CloudDriftItem[] = [];
  private npcs: RuntimeNpc[] = [];
  private pickups: RuntimePickup[] = [];
  private blockedTiles = new Set<string>();

  private playerMesh: THREE.Mesh;
  private playerMat: THREE.MeshBasicMaterial;
  private charGeo: THREE.PlaneGeometry;

  private gridX = 24;
  private gridY = 26;
  private dir: Direction = 'up';
  private moving = false;
  private moveFromX = 24;
  private moveFromY = 26;
  private moveToX = 24;
  private moveToY = 26;
  private moveProgress = 0;
  private walkFrame: CharacterFrame = 0;
  private walkAnimTimer = 0;
  private waterTimer = 0;
  private waterFrame: 0 | 1 = 0;
  private lastSpriteYawStep = -1;
  private sceneTime = 0;

  private hudBadge: HTMLDivElement;

  private readonly sampleTerrain = (wx: number, wz: number): number =>
    sampleInterpolatedHeight(this.currentMap, wx, wz);

  constructor(private readonly game: Game) {
    this.charGeo = createBottomPivotPlaneGeometry(0.95, 1.4);
    this.persistentDisposables.track(this.charGeo);

    this.playerMat = new THREE.MeshBasicMaterial({
      map: game.assets.getCharacterTexture('player', 'up', 0),
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
    this.persistentDisposables.track(this.playerMat);

    this.playerMesh = new THREE.Mesh(this.charGeo, this.playerMat);
    this.scene.add(this.playerMesh);

    this.hudBadge = document.createElement('div');
    this.hudBadge.className =
      'pointer-events-none fixed top-2.5 left-3 z-20 rounded-lg border border-cold-stone bg-crypt-ink/85 px-3 py-1.5 text-xs font-bold text-porcelain shadow';
    this.hudBadge.style.top = 'calc(0.625rem + env(safe-area-inset-top, 0px))';
    this.hudBadge.style.left = 'calc(0.75rem + env(safe-area-inset-left, 0px))';
  }

  onEnter(): void {
    this.game.uiLayer.appendChild(this.hudBadge);
    this.game.uiLayers.register('overworldHud', this.hudBadge);
    this.game.uiLayers.applySceneVisibility({
      overworldHud: true,
      touchControls: true,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.touchControls.setVisible(true);
    this.game.cameraRig.setPreset('overworld');

    const save = this.game.saveData;
    ensureSaveVesselState(save);
    this.loadMap(save.mapId, save.playerX, save.playerY, save.playerDir, false);

    if (!save.flags.isekai_intro_seen) {
      save.flags.isekai_intro_seen = true;
      this.game.saveManager.save(save);
      this.game.dialog.show(ES.dialogs.isekai_intro_1, () => {
        this.game.dialog.show(ES.dialogs.isekai_intro_2);
      });
    }
  }

  onResume(): void {
    this.game.uiLayers.applySceneVisibility({
      overworldHud: true,
      touchControls: true,
      battleHud: false,
      battleFx: false,
      battleTransition: false,
    });
    this.game.touchControls.setVisible(true);
    this.game.cameraRig.setPreset('overworld');
    this.game.cameraRig.snapTo(
      this.playerMesh.position.x,
      this.playerMesh.position.y,
      this.playerMesh.position.z
    );
    this.game.bus.emit('audio:music', { track: this.currentMap.music });
    this.refreshNpcVisibility();
    this.updateBadge();
  }

  private updateBadge(): void {
    const mapLabel = ES.maps[this.currentMap.id] ?? this.currentMap.id;
    const repel =
      this.game.saveData.repelSteps > 0
        ? ` · 🛡️${this.game.saveData.repelSteps}`
        : '';
    this.hudBadge.textContent = `${mapLabel} · ${this.game.saveData.money} ◈${repel}`;
  }

  private collectPropPlacements(map: MapDef): PropInstancePlacement[] {
    const placements: PropInstancePlacement[] = [];
    const occupied = new Set<string>();

    const mark = (x: number, z: number, solid: boolean) => {
      const key = `${x},${z}`;
      occupied.add(key);
      if (solid) this.blockedTiles.add(key);
    };

    // Reserve warps (+ 1-tile apron), NPCs, signs, buildings (+ front apron)
    for (const w of map.warps) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          occupied.add(`${w.x + dx},${w.y + dz}`);
        }
      }
    }
    for (const npc of map.npcs) {
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          occupied.add(`${npc.x + dx},${npc.y + dz}`);
        }
      }
    }
    for (const b of map.buildings) {
      for (let dz = -1; dz <= b.depth + 1; dz++) {
        for (let dx = -1; dx <= b.width; dx++) {
          occupied.add(`${b.x + dx},${b.z + dz}`);
        }
      }
    }
    for (const pk of map.pickups ?? []) {
      occupied.add(`${pk.x},${pk.y}`);
    }

    // Hand-placed props & signs
    for (const p of map.props) {
      const y = getTileWorldY(map, p.x, p.z);
      placements.push({ kind: p.kind, x: p.x, y, z: p.z, scale: 1 });
      mark(p.x, p.z, true);
    }
    for (const s of map.signs) {
      const y = getTileWorldY(map, s.x, s.y);
      placements.push({ kind: 'sign', x: s.x, y, z: s.y, scale: 1 });
      mark(s.x, s.y, true);
    }

    placements.push(...buildEncounterGrassPlacements(map));

    // Seeded decoration pass across terrain
    const dec = map.decoration;
    const rng = createRng(dec.seed);
    const height = map.grid.length;
    const width = map.grid[0]?.length ?? 0;

    for (let z = 1; z < height - 1; z++) {
      const row = map.grid[z];
      for (let x = 1; x < width - 1; x++) {
        const key = `${x},${z}`;
        if (occupied.has(key)) continue;
        if (isInsideBuilding(map.buildings, x, z)) continue;

        const ch = row[x];
        const leg = map.legend[ch];
        if (!leg) continue;

        // Avoid placing seeded props on roads, water, bridges, stairs, tall grass, or arena floor
        if (
          leg.tile === 'water' ||
          leg.tile === 'cobble' ||
          leg.tile === 'bridge' ||
          leg.tile === 'stairs' ||
          leg.tile === 'arena_floor' ||
          leg.tile === 'tall_grass' ||
          leg.tile === 'dirt'
        ) {
          continue;
        }

        // Check slope around (x, z) so tall props don't sit on steep cliff faces
        const hC = getTileHeightLevel(map, x, z);
        const maxDiff = Math.max(
          Math.abs(getTileHeightLevel(map, x + 1, z) - hC),
          Math.abs(getTileHeightLevel(map, x - 1, z) - hC),
          Math.abs(getTileHeightLevel(map, x, z + 1) - hC),
          Math.abs(getTileHeightLevel(map, x, z - 1) - hC)
        );
        if (maxDiff > 1) continue;

        const worldY = hC * 0.5;
        const roll = rng.next();
        let chosen: PropKind | null = null;

        if (dec.treeKinds.length > 0 && roll < dec.treeDensity) {
          if (map.snowLine !== undefined && hC >= map.snowLine && dec.treeKinds.includes('snow_pine')) {
            chosen = 'snow_pine';
          } else {
            chosen = rng.pick(dec.treeKinds);
            if (chosen === 'mushroom_tree') {
              chosen = rng.next() < 0.55 ? 'mushroom_tree' : 'mushroom_tree_arcane';
            }
          }
        } else if (roll < dec.treeDensity + dec.rockDensity) {
          chosen = 'boulder';
        } else if (roll < dec.treeDensity + dec.rockDensity + dec.bushDensity) {
          chosen = rng.next() < 0.55 ? 'bush' : 'bush_arcane';
        } else if (
          roll <
          dec.treeDensity + dec.rockDensity + dec.bushDensity + dec.flowerDensity
        ) {
          chosen = 'flower_patch';
        } else if (
          roll <
          dec.treeDensity +
            dec.rockDensity +
            dec.bushDensity +
            dec.flowerDensity +
            dec.mushroomDensity
        ) {
          chosen = 'mushroom';
        } else if (leg.tile === 'grass' && rng.next() < 0.06) {
          chosen = rng.next() < 0.5 ? 'tall_grass_clump' : 'tall_grass_flower';
        }

        if (chosen) {
          const scale = 0.88 + rng.next() * 0.26;
          placements.push({ kind: chosen, x, y: worldY, z, scale });
          const isSolid = SOLID_SEED_PROPS.has(chosen) || leg.solid;
          mark(x, z, isSolid);
        }
      }
    }

    return placements;
  }

  private loadMap(
    mapId: string,
    x: number,
    y: number,
    dir: Direction,
    autoSave: boolean
  ): void {
    // Clear previous map scene objects and disposables
    this.chunks = [];
    this.propBatches = [];
    this.clouds = [];
    this.npcs = [];
    this.pickups = [];
    this.blockedTiles.clear();
    this.lastSpriteYawStep = -1;

    const toRemove: THREE.Object3D[] = [];
    for (const child of this.scene.children) {
      if (child !== this.playerMesh) toRemove.push(child);
    }
    for (const c of toRemove) this.scene.remove(c);
    this.mapDisposables.disposeAll();

    const map = getMap(mapId);
    this.currentMap = map;
    this.gridX = x;
    this.gridY = y;
    this.dir = dir;
    this.moving = false;

    this.game.saveData.mapId = mapId;
    this.game.saveData.playerX = x;
    this.game.saveData.playerY = y;
    this.game.saveData.playerDir = dir;

    const skyTex = createGradientSkyTexture(map.skyTopColor, map.skyBottomColor);
    this.mapDisposables.track(skyTex);
    this.scene.background = skyTex;
    this.scene.fog = new THREE.Fog(map.fogColor, 18, 44);

    const atlasMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getTileAtlasTexture(),
      vertexColors: true,
    });
    const grassMat = new THREE.MeshBasicMaterial({
      map: this.game.assets.getGrassTexture(),
      vertexColors: true,
    });
    this.mapDisposables.track(atlasMat);
    this.mapDisposables.track(grassMat);

    // 1. Heightfield terrain chunks
    this.chunks = buildTerrainChunks(map, atlasMat, grassMat);
    for (const chunk of this.chunks) {
      this.mapDisposables.track(chunk.mesh.geometry);
      this.scene.add(chunk.mesh);
    }

    // 2. Low-poly 3D buildings
    const buildingsGroup = buildBuildingsMesh(map, atlasMat, (kind) =>
      this.game.assets.getRoofTexture(kind)
    );
    if (buildingsGroup) {
      for (const child of buildingsGroup.children) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) this.mapDisposables.track(mesh.geometry);
        if (mesh.material && mesh.material !== atlasMat && !Array.isArray(mesh.material)) {
          this.mapDisposables.track(mesh.material);
        }
      }
      this.scene.add(buildingsGroup);
    }

    // 3. Hand-placed + seeded decoration props
    const propPlacements = this.collectPropPlacements(map);
    this.propBatches = buildInstancedPropBatches(propPlacements, this.game.assets);
    for (const batch of this.propBatches) {
      this.mapDisposables.track(batch.mesh.geometry);
      this.mapDisposables.track(batch.mesh.material as THREE.Material);
      this.scene.add(batch.mesh);
    }

    // 4. Sky cloud billboards (outdoor maps)
    if (map.music !== 'cave') {
      const mw = (map.grid[0]?.length ?? 48) * 0.5;
      const mh = map.grid.length * 0.5;
      this.clouds = buildCloudBillboards(
        this.scene,
        this.mapDisposables,
        mw,
        mh,
        28,
        10,
        map.decoration.seed + 55,
        13.5
      );
    }

    // 5. NPC billboards placed at interpolated terrain height
    const pedestalGeo = createBottomPivotPlaneGeometry(0.95, 0.95);
    this.mapDisposables.track(pedestalGeo);

    const yawStep = this.game.cameraRig.getYawStep();
    for (const npcDef of map.npcs) {
      const isStarter = npcDef.starterIndex !== undefined;
      const isHealMachine = npcDef.id === 'arena_heal';
      const isPedestal = isStarter || isHealMachine;

      const relDir = relativeSpriteDir(npcDef.dir, yawStep);
      const tex = isStarter
        ? this.game.assets.getPropTexture('capsule_pedestal')
        : isHealMachine
          ? this.game.assets.getPropTexture('heal_machine')
          : this.game.assets.getCharacterTexture(
              npcDef.role as CharacterRole,
              relDir,
              0,
              npcDef.trainerId ?? npcDef.id
            );

      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      });
      this.mapDisposables.track(mat);

      const mesh = new THREE.Mesh(isPedestal ? pedestalGeo : this.charGeo, mat);
      const ny = getTileWorldY(map, npcDef.x, npcDef.y);
      mesh.position.set(npcDef.x, ny, npcDef.y);
      this.scene.add(mesh);

      this.npcs.push({ def: npcDef, mesh, mat, visible: true, isPedestal });
    }

    // 6. Ground pickups not yet collected
    for (const pk of map.pickups ?? []) {
      if (this.game.saveData.collectedPickups.includes(pk.id)) continue;
      let mesh: THREE.Mesh | null = null;
      if (!pk.hidden) {
        const tex = this.game.assets.getPropTexture(
          pk.itemId === 'fragmento_alma' ? 'crystal' : 'capsule_pedestal'
        );
        const pkMat = new THREE.MeshBasicMaterial({
          map: tex,
          alphaTest: 0.5,
          side: THREE.DoubleSide,
        });
        this.mapDisposables.track(pkMat);
        mesh = new THREE.Mesh(pedestalGeo, pkMat);
        const py = getTileWorldY(map, pk.x, pk.y);
        mesh.position.set(pk.x, py, pk.y);
        this.scene.add(mesh);
      }
      this.pickups.push({
        id: pk.id,
        x: pk.x,
        y: pk.y,
        itemId: pk.itemId,
        quantity: pk.quantity ?? 1,
        hidden: Boolean(pk.hidden),
        mesh,
      });
    }

    this.refreshNpcVisibility();
    this.syncPlayerVisual();
    this.syncBillboardYaw(0);

    const startY = sampleInterpolatedHeight(map, x, y);
    this.game.cameraRig.snapTo(x, startY, y);
    updateVisibleTerrainChunks(this.chunks, x, y);
    this.game.bus.emit('audio:music', { track: map.music });
    this.updateBadge();

    if (autoSave) {
      this.game.saveManager.save(this.game.saveData);
    }
  }

  private refreshNpcVisibility(): void {
    const flags = this.game.saveData.flags;
    for (const npc of this.npcs) {
      let show = true;
      if (npc.def.flagHidden && flags[npc.def.flagHidden]) show = false;
      if (npc.def.flagRequired && !flags[npc.def.flagRequired]) show = false;
      npc.visible = show;
      npc.mesh.visible = show;
    }
  }

  private syncPlayerVisual(): void {
    const x = this.moving
      ? THREE.MathUtils.lerp(this.moveFromX, this.moveToX, this.moveProgress)
      : this.gridX;
    const z = this.moving
      ? THREE.MathUtils.lerp(this.moveFromY, this.moveToY, this.moveProgress)
      : this.gridY;
    const y = sampleInterpolatedHeight(this.currentMap, x, z);

    this.playerMesh.position.set(x, y, z);

    const relDir = relativeSpriteDir(this.dir, this.game.cameraRig.getYawStep());
    const tex = this.game.assets.getCharacterTexture('player', relDir, this.walkFrame);
    if (this.playerMat.map !== tex) {
      this.playerMat.map = tex;
      this.playerMat.needsUpdate = true;
    }
  }

  private syncBillboardYaw(dt: number): void {
    this.sceneTime += dt;
    const yaw = this.game.cameraRig.getCurrentYaw();
    const yawStep = this.game.cameraRig.getYawStep();

    this.playerMesh.rotation.y = yaw;
    for (let i = 0; i < this.npcs.length; i++) {
      const npc = this.npcs[i];
      npc.mesh.rotation.y = yaw;
      if (yawStep !== this.lastSpriteYawStep && !npc.isPedestal) {
        const relDir = relativeSpriteDir(npc.def.dir, yawStep);
        const tex = this.game.assets.getCharacterTexture(
          npc.def.role as CharacterRole,
          relDir,
          0,
          npc.def.trainerId ?? npc.def.id
        );
        if (npc.mat.map !== tex) {
          npc.mat.map = tex;
          npc.mat.needsUpdate = true;
        }
      }
    }
    this.lastSpriteYawStep = yawStep;

    for (let i = 0; i < this.pickups.length; i++) {
      const m = this.pickups[i].mesh;
      if (m && m.visible) m.rotation.y = yaw;
    }

    const playerX = this.playerMesh.position.x;
    const playerZ = this.playerMesh.position.z;
    updatePropBatchAnimation(this.propBatches, yaw, this.sceneTime, playerX, playerZ);

    if (this.clouds.length > 0) {
      updateCloudBillboards(this.clouds, yaw, dt);
    }
  }

  private isTileBlocked(nx: number, ny: number): boolean {
    if (!isTileWalkable(this.currentMap, this.gridX, this.gridY, nx, ny, this.blockedTiles)) {
      return true;
    }
    for (let i = 0; i < this.npcs.length; i++) {
      const n = this.npcs[i];
      if (n.visible && n.def.x === nx && n.def.y === ny) return true;
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const p = this.pickups[i];
      if (!p.hidden && p.mesh?.visible && p.x === nx && p.y === ny) return true;
    }
    return false;
  }

  private isBlockingUiOpen(): boolean {
    return (
      this.game.dialog.isOpen() ||
      this.game.menu.isOpen() ||
      this.game.partyScreen.root.classList.contains('flex') ||
      this.game.bagScreen.root.classList.contains('flex') ||
      this.game.bestiaryScreen.root.classList.contains('flex') ||
      this.game.storageScreen.root.classList.contains('flex') ||
      this.game.summary.root.classList.contains('flex') ||
      this.game.endingModal.root.classList.contains('flex') ||
      this.game.arGachaModal.root.classList.contains('flex') ||
      this.game.vesselScreen.root.classList.contains('flex')
    );
  }

  fixedUpdate(dt: number): void {
    this.game.saveData.stats.playTimeSec += dt;

    // 2-frame water animation
    this.waterTimer += dt;
    if (this.waterTimer >= 0.45) {
      this.waterTimer = 0;
      this.waterFrame = this.waterFrame === 0 ? 1 : 0;
      updateTerrainWaterFrame(this.chunks, this.waterFrame);
    }

    this.game.dialog.update(dt, this.game.input);

    if (this.isBlockingUiOpen()) {
      this.syncBillboardYaw(dt);
      return;
    }

    if (this.game.input.justPressed('start')) {
      this.openPauseMenu();
      return;
    }

    // 90-degree shoulder camera rotation (L/R or Q/E)
    if (this.game.input.justPressed('camLeft')) {
      this.game.cameraRig.rotateStep(-1);
      this.game.bus.emit('audio:sfx', { sfx: 'menu' });
    } else if (this.game.input.justPressed('camRight')) {
      this.game.cameraRig.rotateStep(1);
      this.game.bus.emit('audio:sfx', { sfx: 'menu' });
    }

    if (this.moving) {
      const speed = this.game.input.isHeld('b') ? 7.4 : 4.4;
      this.moveProgress += dt * speed;
      this.walkAnimTimer += dt * speed;
      if (this.walkAnimTimer >= 0.25) {
        this.walkAnimTimer -= 0.25;
        this.walkFrame = ((this.walkFrame + 1) % 4) as CharacterFrame;
      }

      if (this.moveProgress >= 1) {
        this.moving = false;
        this.moveProgress = 0;
        this.walkFrame = 0;
        this.gridX = this.moveToX;
        this.gridY = this.moveToY;
        this.game.saveData.playerX = this.gridX;
        this.game.saveData.playerY = this.gridY;
        this.game.saveData.playerDir = this.dir;
        this.game.saveData.stats.steps += 1;
        this.syncPlayerVisual();
        this.syncBillboardYaw(dt);
        updateVisibleTerrainChunks(this.chunks, this.gridX, this.gridY);
        this.onStepCompleted();
        return;
      }

      this.syncPlayerVisual();
      this.syncBillboardYaw(dt);
      this.game.cameraRig.follow(
        this.playerMesh.position.x,
        this.playerMesh.position.y,
        this.playerMesh.position.z,
        dt,
        this.sampleTerrain
      );
      return;
    }

    this.walkFrame = 0;
    this.syncPlayerVisual();
    this.syncBillboardYaw(dt);
    this.game.cameraRig.follow(
      this.playerMesh.position.x,
      this.playerMesh.position.y,
      this.playerMesh.position.z,
      dt,
      this.sampleTerrain
    );

    if (this.game.input.justPressed('a')) {
      this.tryInteract();
      return;
    }

    let rawInputDir: Direction | null = null;
    if (this.game.input.isHeld('up')) rawInputDir = 'up';
    else if (this.game.input.isHeld('down')) rawInputDir = 'down';
    else if (this.game.input.isHeld('left')) rawInputDir = 'left';
    else if (this.game.input.isHeld('right')) rawInputDir = 'right';

    if (rawInputDir) {
      const move = cameraRelativeMove(rawInputDir, this.game.cameraRig.getYawStep());
      this.dir = move.dir;
      this.game.saveData.playerDir = move.dir;
      const nx = this.gridX + move.dx;
      const ny = this.gridY + move.dy;
      if (!this.isTileBlocked(nx, ny)) {
        this.moving = true;
        this.moveFromX = this.gridX;
        this.moveFromY = this.gridY;
        this.moveToX = nx;
        this.moveToY = ny;
        this.moveProgress = 0;
      } else {
        this.syncPlayerVisual();
      }
    }
  }

  private onStepCompleted(): void {
    // 1. Check warps
    const warp = this.currentMap.warps.find(
      (w) => w.x === this.gridX && w.y === this.gridY
    );
    if (warp) {
      this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
      this.loadMap(
        warp.targetMap,
        warp.targetX,
        warp.targetY,
        warp.dir ?? this.dir,
        true
      );
      return;
    }

    // 1b. Check hidden pickups on tile
    const hiddenPickup = this.pickups.find(
      (p) => p.hidden && p.x === this.gridX && p.y === this.gridY
    );
    if (hiddenPickup) {
      this.collectPickup(hiddenPickup);
      return;
    }

    // 2. Check trainer line-of-sight
    const spotted = this.findSpottingTrainer();
    if (spotted && this.game.saveData.party.length > 0) {
      this.triggerTrainerBattle(spotted);
      return;
    }

    // 3. Decrement Repel
    if (this.game.saveData.repelSteps > 0) {
      this.game.saveData.repelSteps -= 1;
      this.updateBadge();
    }

    // 4. Random encounter check
    const ch = this.currentMap.grid[this.gridY]?.[this.gridX] ?? '.';
    const leg = this.currentMap.legend[ch];
    if (
      leg?.encounter &&
      this.currentMap.encounters &&
      this.game.saveData.repelSteps <= 0 &&
      this.game.saveData.party.length > 0
    ) {
      if (this.game.rng.next() < this.currentMap.encounters.rate) {
        this.triggerWildEncounter();
      }
    }
  }

  private findSpottingTrainer(): NpcDef | null {
    for (const npc of this.npcs) {
      if (!npc.visible || !npc.def.trainerId || !npc.def.sightRange) continue;
      if (this.game.saveData.defeatedTrainers.includes(npc.def.trainerId)) continue;
      const range = npc.def.sightRange;
      const dx = this.gridX - npc.def.x;
      const dy = this.gridY - npc.def.y;
      if (npc.def.dir === 'up' && dx === 0 && dy < 0 && -dy <= range) return npc.def;
      if (npc.def.dir === 'down' && dx === 0 && dy > 0 && dy <= range) return npc.def;
      if (npc.def.dir === 'left' && dy === 0 && dx < 0 && -dx <= range) return npc.def;
      if (npc.def.dir === 'right' && dy === 0 && dx > 0 && dx <= range) return npc.def;
    }
    return null;
  }

  private triggerWildEncounter(): void {
    const table = this.currentMap.encounters;
    if (!table || table.entries.length === 0) return;

    const totalWeight = table.entries.reduce((s, e) => s + e.weight, 0);
    let roll = this.game.rng.next() * totalWeight;
    let picked = table.entries[0];
    for (const entry of table.entries) {
      roll -= entry.weight;
      if (roll <= 0) {
        picked = entry;
        break;
      }
    }

    const level = this.game.rng.int(picked.minLevel, picked.maxLevel);
    const wild = createCreature(picked.speciesId, level, this.game.rng);

    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
    this.game.startBattle({
      enemyParty: [wild],
      biome: this.currentMap.biome,
      onDone: (outcome) => {
        if (outcome === 'lose') {
          this.handleBlackout();
        }
      },
    });
  }

  private triggerTrainerBattle(npc: NpcDef): void {
    if (!npc.trainerId) return;
    const trainer = getTrainer(npc.trainerId);
    const enemyParty = trainer.party.map((spec) =>
      createCreature(spec.speciesId, spec.level, this.game.rng)
    );

    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
    this.game.dialog.show(trainer.introText, () => {
      this.game.startBattle({
        enemyParty,
        trainer,
        biome: this.currentMap.biome,
        onDone: (outcome) => {
          if (outcome === 'win') {
            if (!this.game.saveData.defeatedTrainers.includes(trainer.id)) {
              this.game.saveData.defeatedTrainers.push(trainer.id);
            }
            if (trainer.setsFlag) {
              this.game.saveData.flags[trainer.setsFlag] = true;
            }
            const lootMsg = this.awardTrainerContainerLoot(trainer.isBoss || trainer.isRival);
            this.refreshNpcVisibility();
            this.updateBadge();
            this.game.saveManager.save(this.game.saveData);
            if (lootMsg) {
              this.game.showToast(lootMsg);
            }

            this.game.dialog.show(trainer.defeatText, () => {
              if (trainer.isBoss) {
                this.game.bus.emit('audio:music', { track: 'victory' });
                this.game.endingModal.open(
                  this.game.saveData,
                  () => {
                    this.game.bus.emit('audio:music', { track: this.currentMap.music });
                  },
                  () => {
                    this.game.startTitle();
                  }
                );
              }
            });
          } else if (outcome === 'lose') {
            this.handleBlackout();
          }
        },
      });
    });
  }

  private handleBlackout(): void {
    healPartyFull(this.game.saveData.party);
    this.loadMap('villa_origen', 24, 26, 'up', true);
  }

  private tryInteract(): void {
    const deltas: Record<Direction, [number, number]> = {
      up: [0, -1],
      down: [0, 1],
      left: [-1, 0],
      right: [1, 0],
    };
    const [dx, dy] = deltas[this.dir];
    const tx = this.gridX + dx;
    const ty = this.gridY + dy;

    const sign = this.currentMap.signs.find((s) => s.x === tx && s.y === ty);
    if (sign) {
      this.game.bus.emit('audio:sfx', { sfx: 'menu' });
      const text = (ES.dialogs as Record<string, unknown>)[sign.textKey];
      if (typeof text === 'string') {
        this.game.dialog.show(text);
      }
      return;
    }

    const pickup = this.pickups.find(
      (p) => !p.hidden && p.mesh?.visible && p.x === tx && p.y === ty
    );
    if (pickup) {
      this.collectPickup(pickup);
      return;
    }

    const npc = this.npcs.find((n) => n.visible && n.def.x === tx && n.def.y === ty);
    if (!npc) return;
    this.interactNpc(npc.def);
  }

  private collectPickup(pickup: RuntimePickup): void {
    this.pickups = this.pickups.filter((p) => p.id !== pickup.id);
    if (pickup.mesh) {
      pickup.mesh.visible = false;
      this.scene.remove(pickup.mesh);
    }
    if (!this.game.saveData.collectedPickups.includes(pickup.id)) {
      this.game.saveData.collectedPickups.push(pickup.id);
    }
    addItem(this.game.saveData.bag, pickup.itemId, pickup.quantity);
    this.game.bus.emit('audio:sfx', { sfx: 'levelup' });
    this.game.saveManager.save(this.game.saveData);
    const itemName = getItem(pickup.itemId).name;
    this.game.dialog.show(`¡Encontraste ${pickup.quantity}× ${itemName}!`);
  }

  private awardTrainerContainerLoot(isMajor?: boolean): string {
    const pool = ALL_CONTAINER_IDS.filter((id) => id !== 'cuerpo_aprendiz');
    const cid = pool.length > 0 ? this.game.rng.pick(pool) : 'cuerpo_aprendiz';
    const def = getBodyContainer(cid);
    if (isMajor) {
      addVessel(this.game.saveData, cid, 1);
      addItem(this.game.saveData.bag, 'fragmento_alma', 1);
      return `Botín: 1× ${def.name} y 1× Fragmento de Alma`;
    }
    const res = addBodyPartShard(this.game.saveData, cid, 2);
    if (res.assembledCount > 0) {
      return `Botín: ¡Ensamblaste 1× ${def.name}!`;
    }
    return `Botín: +2 piezas de ${def.name} (${res.currentShards}/${SHARDS_PER_CONTAINER})`;
  }

  private interactNpc(npc: NpcDef): void {
    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });

    if (npc.starterIndex !== undefined) {
      if (this.game.saveData.flags.starter_chosen) {
        this.game.dialog.show(ES.dialogs.starter_already);
        return;
      }
      const speciesId = STARTER_IDS[npc.starterIndex];
      const spec = getSpecies(speciesId);
      const typeLabel = ES.types[spec.types[0]];
      this.game.dialog.show(
        ES.dialogs.starter_prompt(spec.name, typeLabel),
        undefined,
        [
          {
            label: '¡Elegir!',
            onSelect: () => {
              const starter = createCreature(speciesId, 5, this.game.rng);
              addToParty(this.game.saveData.party, starter);
              this.game.markSpeciesCaught(speciesId, 5, true);
              this.game.saveData.flags.starter_chosen = true;
              addItem(this.game.saveData.bag, 'capsula', 2);
              this.refreshNpcVisibility();
              this.game.bus.emit('audio:sfx', { sfx: 'levelup' });
              this.game.saveManager.save(this.game.saveData);
              this.game.dialog.show(ES.dialogs.starter_chosen(spec.name));
            },
          },
          { label: 'Luego', onSelect: () => {} },
        ]
      );
      return;
    }

    if (npc.trainerId) {
      if (this.game.saveData.defeatedTrainers.includes(npc.trainerId)) {
        const trainer = getTrainer(npc.trainerId);
        this.game.dialog.show(
          trainer.isBoss ? ES.dialogs.leader_after : trainer.defeatText
        );
      } else if (this.game.saveData.party.length === 0) {
        this.game.dialog.show(ES.dialogs.prof_welcome);
      } else {
        this.triggerTrainerBattle(npc);
      }
      return;
    }

    if (npc.shopStock) {
      this.game.dialog.show(ES.dialogs.merchant_mateo, () => {
        this.game.openShop(npc.shopStock!, () => {
          this.updateBadge();
        });
      });
      return;
    }

    if (npc.healOnTalk) {
      if (npc.id === 'prof_robledo') {
        if (!this.game.saveData.flags.starter_chosen) {
          this.game.dialog.show(ES.dialogs.prof_welcome);
          return;
        }
        const claimable = getClaimableMilestones(this.game.saveData);
        if (claimable.length > 0) {
          const m = claimBestiaryMilestone(this.game.saveData, claimable[0].id);
          if (m) {
            const label = `${m.count} ${m.kind === 'caught' ? 'capturadas' : 'vistas'}`;
            const itemName = getItem(m.rewardItemId).name;
            this.game.bus.emit('audio:sfx', { sfx: 'levelup' });
            this.updateBadge();
            this.game.saveManager.save(this.game.saveData);
            this.game.dialog.show(
              ES.dialogs.prof_milestone_reward(label, itemName, m.rewardQty, m.rewardMoney)
            );
            return;
          }
        }
        healPartyFull(this.game.saveData.party);
        this.game.bus.emit('audio:sfx', { sfx: 'heal' });
        this.game.dialog.show(ES.dialogs.prof_healed);
        return;
      }

      if (npc.id === 'arena_heal') {
        healPartyFull(this.game.saveData.party);
        this.game.bus.emit('audio:sfx', { sfx: 'heal' });
        this.game.dialog.show(ES.dialogs.heal_machine_use);
        return;
      }

      this.game.dialog.show(ES.dialogs.healer_menu, undefined, [
        {
          label: 'Curar equipo',
          onSelect: () => {
            healPartyFull(this.game.saveData.party);
            this.game.bus.emit('audio:sfx', { sfx: 'heal' });
            const msg =
              ((ES.dialogs as Record<string, unknown>)[npc.dialogKey] as string) ??
              ES.dialogs.healer_clara;
            this.game.dialog.show(msg);
          },
        },
        {
          label: 'Cajas PC',
          onSelect: () => {
            this.game.storageScreen.open(this.game.saveData, () => {
              this.game.saveManager.save(this.game.saveData);
            });
          },
        },
        { label: 'Salir', onSelect: () => {} },
      ]);
      return;
    }

    const dialogText = (ES.dialogs as Record<string, unknown>)[npc.dialogKey];
    if (typeof dialogText === 'string') {
      this.game.dialog.show(dialogText);
    }
  }

  private openPauseMenu(): void {
    this.game.bus.emit('audio:sfx', { sfx: 'menu' });
    this.game.menu.open(this.game.saveData, {
      onParty: () => {
        this.game.partyScreen.open(
          this.game.saveData.party,
          { kind: 'manage', bag: this.game.saveData.bag },
          () => {}
        );
      },
      onBag: () => {
        this.openOverworldBag();
      },
      onVessels: () => {
        this.game.vesselScreen.open(
          this.game.saveData,
          this.game.rng,
          () => {
            this.updateBadge();
            this.game.saveManager.save(this.game.saveData);
          },
          () => {}
        );
      },
      onBestiary: () => {
        this.game.bestiaryScreen.open(this.game.saveData, () => {});
      },
      onSave: () => {
        const ok = this.game.saveManager.save(this.game.saveData);
        if (ok) this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
        return ok;
      },
      onOptionsChanged: () => {
        this.game.applyOptions();
      },
      onClose: () => {},
    });
  }

  private openOverworldBag(): void {
    this.game.bagScreen.open(
      this.game.saveData.bag,
      false,
      (itemId) => {
        const item = getItem(itemId);
        if (item.arGacha) {
          this.game.arGachaModal.open(
            this.game.saveData,
            this.game.rng,
            () => {
              this.updateBadge();
              this.game.saveManager.save(this.game.saveData);
            },
            () => {}
          );
          return;
        }
        if (item.repelSteps) {
          removeItem(this.game.saveData.bag, itemId, 1);
          this.game.saveData.repelSteps += item.repelSteps;
          this.updateBadge();
          this.game.dialog.show(ES.bag.repelActivated);
          return;
        }
        if (item.escape) {
          removeItem(this.game.saveData.bag, itemId, 1);
          this.game.dialog.show(ES.bag.escapeUsed, () => {
            this.loadMap('villa_origen', 24, 26, 'up', true);
          });
          return;
        }
        if (
          item.category === 'medicine' ||
          item.category === 'stone' ||
          item.category === 'held'
        ) {
          this.game.partyScreen.open(
            this.game.saveData.party,
            {
              kind: 'item_target',
              onPick: (partyIndex) => {
                const creature = this.game.saveData.party[partyIndex];
                if (item.category === 'held') {
                  if (equipHeldItem(this.game.saveData.bag, creature, itemId)) {
                    this.game.bus.emit('audio:sfx', { sfx: 'confirm' });
                    this.game.dialog.show(
                      ES.bag.equippedItem(item.name, getCreatureDisplayName(creature))
                    );
                  }
                  return;
                }
                if (item.category === 'stone') {
                  const targetId = checkItemEvolution(creature, itemId);
                  if (targetId === null) {
                    this.game.dialog.show(ES.bag.noEffect);
                    return;
                  }
                  removeItem(this.game.saveData.bag, itemId, 1);
                  this.game.startEvolution(partyIndex, targetId, () => {});
                  return;
                }
                const applied = applyMedicineToCreature(itemId, creature);
                if (!applied.applied) {
                  this.game.dialog.show(ES.bag.noEffect);
                  return;
                }
                removeItem(this.game.saveData.bag, itemId, 1);
                this.game.bus.emit('audio:sfx', { sfx: 'heal' });
                this.game.dialog.show(
                  `${ES.bag.usedItem(item.name)} (${getCreatureDisplayName(creature)})`
                );
              },
              onCancel: () => {},
            },
            () => {}
          );
        }
      },
      () => {}
    );
  }

  render(): void {
    this.game.renderer.render(this.scene, this.game.cameraRig.camera);
  }

  onExit(): void {
    this.game.uiLayers.unregister('overworldHud');
    this.hudBadge.remove();
    this.mapDisposables.disposeAll();
    this.persistentDisposables.disposeAll();
  }
}
