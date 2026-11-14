import * as THREE from 'three';
import type { CharacterFrame, CharacterRole, Direction, PropKind } from '../domain/types.ts';
import { generateCharacterSpriteCanvas } from './CharacterSprites.ts';
import { generateCreatureSpriteCanvas } from './CreatureSpriteGen.ts';
import { generateItemIconCanvas } from './ItemIconGen.ts';
import { PALETTE } from './Palette.ts';
import { buildTileAtlasCanvas } from './ProceduralTiles.ts';
import { generatePropCanvas } from './PropSprites.ts';
import {
  extractAndNormalizeSoulDollPair,
  getSoulDollSheetId,
  getSoulDollSheetUrl,
  type NormalizedSoulDollPair,
} from './SoulDollSheets.ts';
import npcSheet07Url from '../../NPC07.jpg';
import npcSheet08Url from '../../NPC08.jpg';
import playerSheetUrl from '../../PLAYER.jpeg';

export type BattleIconKind = 'fight' | 'bag' | 'party' | 'run';
export type RoofTextureKind = 'terracotta' | 'indigo' | 'patina' | 'wood';

export interface AssetProvider {
  getTileAtlasTexture(): THREE.CanvasTexture;
  getGrassTexture(): THREE.CanvasTexture;
  getRoofTexture(kind: RoofTextureKind): THREE.CanvasTexture;
  getCreatureTexture(speciesId: number, view: 'front' | 'back'): THREE.CanvasTexture;
  getCreatureSilhouetteTexture(speciesId: number, view: 'front' | 'back'): THREE.CanvasTexture;
  getCreatureDataUrl(speciesId: number, view?: 'front' | 'back'): string;
  getCreatureSilhouetteDataUrl(speciesId: number): string;
  onCreatureLoaded?(listener: (speciesId: number) => void): () => void;
  getItemIconDataUrl(itemId: string): string;
  getItemTexture(itemId: string): THREE.CanvasTexture;
  getCharacterTexture(
    role: CharacterRole,
    dir: Direction,
    frame: CharacterFrame,
    variant?: string
  ): THREE.CanvasTexture;
  getCharacterDataUrl(role: CharacterRole, dir?: Direction, variant?: string): string;
  getPropTexture(kind: PropKind): THREE.CanvasTexture;
  getBattleIconDataUrl(kind: BattleIconKind): string;
  dispose(): void;
}

function makePixelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function makeSoulDollTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

interface CharacterTextureRequest {
  role: CharacterRole;
  dir: Direction;
  frame: CharacterFrame;
  variant?: string;
}

function getNpcSpriteIndex(variant: string): number {
  let hash = 2166136261;
  for (let i = 0; i < variant.length; i++) {
    hash = Math.imul(hash ^ variant.charCodeAt(i), 16777619);
  }
  return (hash >>> 0) % 32;
}

function getCharacterTextureKey(
  role: CharacterRole,
  dir: Direction,
  frame: CharacterFrame,
  variant?: string
): string {
  return role === 'player'
    ? `player_${dir}_${frame}`
    : `npc_${getNpcSpriteIndex(variant ?? role)}`;
}

function makeTintedSilhouetteCanvas(
  source: HTMLCanvasElement,
  color: string
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}

function makeBattleIconCanvas(kind: BattleIconKind): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };

  switch (kind) {
    case 'fight':
      // Pixel crossed sword
      px(3, 11, 2, 2, PALETTE.brightBrass);
      px(4, 10, 2, 2, PALETTE.resonantGold);
      px(5, 8, 2, 2, PALETTE.boneGray);
      px(7, 6, 2, 2, PALETTE.warmWhite);
      px(9, 4, 2, 2, PALETTE.warmWhite);
      px(11, 2, 3, 3, PALETTE.porcelain);
      px(3, 8, 4, 2, PALETTE.oldBronze);
      px(6, 11, 2, 3, PALETTE.oldBronze);
      break;
    case 'bag':
      // Pixel satchel
      px(5, 2, 6, 2, PALETTE.darkOak);
      px(3, 4, 10, 9, PALETTE.burntUmber);
      px(4, 5, 8, 3, PALETTE.leatherBrown);
      px(7, 7, 2, 3, PALETTE.resonantGold);
      px(4, 9, 8, 3, PALETTE.dirtBrown);
      break;
    case 'party':
      // Pixel Soulpot
      px(7, 2, 2, 1, PALETTE.resonantGold);
      px(5, 3, 6, 2, PALETTE.cryptInk);
      px(6, 3, 4, 1, PALETTE.porcelain);
      px(3, 6, 10, 7, PALETTE.cryptInk);
      px(4, 6, 8, 6, PALETTE.riftCrimson);
      px(4, 8, 8, 2, PALETTE.smokedWood);
      px(7, 8, 2, 2, PALETTE.kiCyan);
      px(5, 13, 6, 1, PALETTE.cryptInk);
      break;
    case 'run':
      // Pixel swift wing
      px(2, 9, 10, 3, PALETTE.vibrantAqua);
      px(4, 6, 9, 3, PALETTE.kiCyan);
      px(7, 3, 7, 3, PALETTE.frostedGlass);
      px(2, 12, 6, 2, PALETTE.oceanicTeal);
      break;
  }

  return canvas;
}

class LruTextureCache {
  private map = new Map<string, THREE.CanvasTexture>();
  private readonly maxEntries: number;

  constructor(maxEntries: number) {
    this.maxEntries = maxEntries;
  }

  peek(key: string): THREE.CanvasTexture | undefined {
    return this.map.get(key);
  }

  get(key: string): THREE.CanvasTexture | undefined {
    const val = this.map.get(key);
    if (!val) return undefined;
    this.map.delete(key);
    this.map.set(key, val);
    return val;
  }

  set(key: string, tex: THREE.CanvasTexture): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        const oldest = this.map.get(oldestKey);
        oldest?.dispose();
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, tex);
  }

  clear(): void {
    for (const tex of this.map.values()) {
      tex.dispose();
    }
    this.map.clear();
  }
}

interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

const LAMP_SHEET_CROPS: Partial<Record<PropKind, CropRect>> = {
  lamp_post: { sx: 0, sy: 0, sw: 34, sh: 192 },
  lamp_wood: { sx: 40, sy: 0, sw: 59, sh: 192 },
  lamp_stone: { sx: 105, sy: 0, sw: 32, sh: 192 },
  lamp_double: { sx: 143, sy: 0, sw: 69, sh: 192 },
};

const ROOF_TEXTURE_PATHS: Record<RoofTextureKind, string> = {
  terracotta: '/assets/roof_terracotta.png',
  indigo: '/assets/roof_indigo.png',
  patina: '/assets/roof_patina.png',
  wood: '/assets/roof_wood.png',
};

function makeGrassFallbackCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PALETTE.pitchBlackGreen;
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 2) {
    for (let x = 0; x < 16; x += 2) {
      if ((x + y * 3) % 5 === 0) {
        ctx.fillStyle = PALETTE.forestGreen;
        ctx.fillRect(x, y, 2, 1);
      } else if ((x * 2 + y) % 7 === 0) {
        ctx.fillStyle = PALETTE.oceanicTeal;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

function makeRoofFallbackCanvas(kind: RoofTextureKind): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d')!;
  const colors =
    kind === 'terracotta'
      ? [PALETTE.rust, PALETTE.oldBronze, PALETTE.darkOak]
      : kind === 'indigo'
        ? [PALETTE.deepAbyss, PALETTE.oceanicTeal, PALETTE.deepAmethyst]
        : kind === 'patina'
          ? [PALETTE.burntUmber, PALETTE.vibrantAqua, PALETTE.darkOak]
          : [PALETTE.coldStone, PALETTE.boneGray, PALETTE.stoneShadow];

  ctx.fillStyle = colors[0];
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y += 4) {
    ctx.fillStyle = colors[2];
    ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = y % 8 === 0 ? colors[0] : colors[1];
    ctx.fillRect(0, y + 1, 16, 3);
    for (let x = (y / 4) % 2 === 0 ? 0 : 4; x < 16; x += 8) {
      ctx.fillStyle = colors[2];
      ctx.fillRect(x, y, 1, 4);
    }
  }
  return canvas;
}

export class ProceduralAssetProvider implements AssetProvider {
  private tileAtlas: THREE.CanvasTexture | null = null;
  private grassTexture: THREE.CanvasTexture | null = null;
  private creatureCache = new LruTextureCache(104);
  private silhouetteCache = new LruTextureCache(104);
  private creatureUrls = new Map<string, string>();
  private silhouetteUrls = new Map<number, string>();
  private souldollPairs = new Map<number, NormalizedSoulDollPair>();
  private souldollLoading = new Set<number>();
  private souldollAttempted = new Set<number>();
  private souldollQueue: number[] = [];
  private souldollActiveLoads = 0;
  private creatureListeners = new Set<(speciesId: number) => void>();
  private itemIconUrls = new Map<string, string>();
  private itemTextures = new Map<string, THREE.CanvasTexture>();
  private charCache = new Map<string, THREE.CanvasTexture>();
  private charRequests = new Map<string, CharacterTextureRequest>();
  private charUrls = new Map<string, string>();
  private propCache = new Map<PropKind, THREE.CanvasTexture>();
  private roofCache = new Map<RoofTextureKind, THREE.CanvasTexture>();
  private roofImages = new Map<RoofTextureKind, HTMLImageElement>();
  private battleIconUrls = new Map<BattleIconKind, string>();

  private mushroomTreeImg: HTMLImageElement | null = null;
  private mushroomArcaneTreeImg: HTMLImageElement | null = null;
  private oakTreeImg: HTMLImageElement | null = null;
  private willowTreeImg: HTMLImageElement | null = null;
  private pineTreeImg: HTMLImageElement | null = null;
  private snowPineTreeImg: HTMLImageElement | null = null;
  private thornyBushImg: HTMLImageElement | null = null;
  private arcaneBushImg: HTMLImageElement | null = null;
  private tallGrassClumpImg: HTMLImageElement | null = null;
  private tallGrassFlowerImg: HTMLImageElement | null = null;
  private grassImg: HTMLImageElement | null = null;
  private lampsSheetImg: HTMLImageElement | null = null;
  private playerSpriteSheetImg: HTMLImageElement | null = null;
  private npcSpriteSheetImgs: [HTMLImageElement | null, HTMLImageElement | null] = [null, null];
  private disposed = false;

  constructor() {
    this.preloadExternalProps();
  }

  private preloadExternalProps(): void {
    if (typeof Image === 'undefined') return;

    this.preloadSoulDollSheets();
    this.preloadCharacterSpriteSheets();

    const treeImg = new Image();
    treeImg.onload = () => {
      if (this.disposed) return;
      this.mushroomTreeImg = treeImg;
      const existing = this.propCache.get('mushroom_tree');
      if (existing) {
        this.applyImageToTexture(existing, treeImg, 0, 0, treeImg.naturalWidth, treeImg.naturalHeight);
      }
    };
    treeImg.src = '/assets/arbol_hongo.png';

    const arcaneTreeImg = new Image();
    arcaneTreeImg.onload = () => {
      if (this.disposed) return;
      this.mushroomArcaneTreeImg = arcaneTreeImg;
      const existing = this.propCache.get('mushroom_tree_arcane');
      if (existing) {
        this.applyImageToTexture(
          existing,
          arcaneTreeImg,
          0,
          0,
          arcaneTreeImg.naturalWidth,
          arcaneTreeImg.naturalHeight
        );
      }
    };
    arcaneTreeImg.src = '/assets/arbol_hongo_arcano.png';

    const pineImg = new Image();
    pineImg.onload = () => {
      if (this.disposed) return;
      this.pineTreeImg = pineImg;
      const existing = this.propCache.get('pine');
      if (existing) {
        this.applyImageToTexture(existing, pineImg, 0, 0, pineImg.naturalWidth, pineImg.naturalHeight);
      }
    };
    pineImg.src = '/assets/arbol_pino.png';

    const snowPineImg = new Image();
    snowPineImg.onload = () => {
      if (this.disposed) return;
      this.snowPineTreeImg = snowPineImg;
      const existing = this.propCache.get('snow_pine');
      if (existing) {
        this.applyImageToTexture(
          existing,
          snowPineImg,
          0,
          0,
          snowPineImg.naturalWidth,
          snowPineImg.naturalHeight
        );
      }
    };
    snowPineImg.src = '/assets/arbol_pino_nieve.png';

    const oakImg = new Image();
    oakImg.onload = () => {
      if (this.disposed) return;
      this.oakTreeImg = oakImg;
      const existing = this.propCache.get('oak');
      if (existing) {
        this.applyImageToTexture(existing, oakImg, 0, 0, oakImg.naturalWidth, oakImg.naturalHeight);
      }
    };
    oakImg.src = '/assets/arbol_roble.png';

    const willowImg = new Image();
    willowImg.onload = () => {
      if (this.disposed) return;
      this.willowTreeImg = willowImg;
      const existing = this.propCache.get('birch');
      if (existing) {
        this.applyImageToTexture(
          existing,
          willowImg,
          0,
          0,
          willowImg.naturalWidth,
          willowImg.naturalHeight
        );
      }
    };
    willowImg.src = '/assets/arbol_sauce.png';

    const bushImg = new Image();
    bushImg.onload = () => {
      if (this.disposed) return;
      this.thornyBushImg = bushImg;
      const existing = this.propCache.get('bush');
      if (existing) {
        this.applyImageToTexture(
          existing,
          bushImg,
          0,
          0,
          bushImg.naturalWidth,
          bushImg.naturalHeight
        );
      }
    };
    bushImg.src = '/assets/arbusto_espinoso.png';

    const arcaneBushImg = new Image();
    arcaneBushImg.onload = () => {
      if (this.disposed) return;
      this.arcaneBushImg = arcaneBushImg;
      const existing = this.propCache.get('bush_arcane');
      if (existing) {
        this.applyImageToTexture(
          existing,
          arcaneBushImg,
          0,
          0,
          arcaneBushImg.naturalWidth,
          arcaneBushImg.naturalHeight
        );
      }
    };
    arcaneBushImg.src = '/assets/arbusto_arcano.png';

    const tallGrassClumpImg = new Image();
    tallGrassClumpImg.onload = () => {
      if (this.disposed) return;
      this.tallGrassClumpImg = tallGrassClumpImg;
      const existing = this.propCache.get('tall_grass_clump');
      if (existing) {
        this.applyImageToTexture(
          existing,
          tallGrassClumpImg,
          0,
          0,
          tallGrassClumpImg.naturalWidth,
          tallGrassClumpImg.naturalHeight
        );
      }
    };
    tallGrassClumpImg.src = '/assets/hierba_alta_clump.png';

    const tallGrassFlowerImg = new Image();
    tallGrassFlowerImg.onload = () => {
      if (this.disposed) return;
      this.tallGrassFlowerImg = tallGrassFlowerImg;
      const existing = this.propCache.get('tall_grass_flower');
      if (existing) {
        this.applyImageToTexture(
          existing,
          tallGrassFlowerImg,
          0,
          0,
          tallGrassFlowerImg.naturalWidth,
          tallGrassFlowerImg.naturalHeight
        );
      }
    };
    tallGrassFlowerImg.src = '/assets/hierba_alta_flower.png';

    const grassImg = new Image();
    grassImg.onload = () => {
      if (this.disposed) return;
      this.grassImg = grassImg;
      if (this.grassTexture) {
        this.applyImageToTexture(
          this.grassTexture,
          grassImg,
          0,
          0,
          grassImg.naturalWidth,
          grassImg.naturalHeight
        );
      }
    };
    grassImg.src = '/assets/suelo_pasto.png';

    const lampsImg = new Image();
    lampsImg.onload = () => {
      if (this.disposed) return;
      this.lampsSheetImg = lampsImg;
      for (const [kind, rect] of Object.entries(LAMP_SHEET_CROPS) as Array<[PropKind, CropRect]>) {
        const existing = this.propCache.get(kind);
        if (existing) {
          this.applyImageToTexture(existing, lampsImg, rect.sx, rect.sy, rect.sw, rect.sh);
        }
      }
    };
    lampsImg.src = '/assets/faroles_ciudad.png';

    for (const [kind, path] of Object.entries(ROOF_TEXTURE_PATHS) as Array<[RoofTextureKind, string]>) {
      const roofImg = new Image();
      roofImg.onload = () => {
        if (this.disposed) return;
        this.roofImages.set(kind, roofImg);
        const existing = this.roofCache.get(kind);
        if (existing) {
          this.applyImageToTexture(existing, roofImg, 0, 0, roofImg.naturalWidth, roofImg.naturalHeight);
        }
      };
      roofImg.src = path;
    }
  }

  private preloadCharacterSpriteSheets(): void {
    const load = (
      url: string,
      onLoad: (image: HTMLImageElement) => void
    ): void => {
      const image = new Image();
      image.onload = () => {
        if (this.disposed) return;
        onLoad(image);
        this.refreshCharacterTextures();
      };
      image.onerror = () => console.error(`Failed to load character sprite sheet: ${url}`);
      image.src = url;
    };

    load(playerSheetUrl, (image) => {
      this.playerSpriteSheetImg = image;
    });
    load(npcSheet07Url, (image) => {
      this.npcSpriteSheetImgs[0] = image;
    });
    load(npcSheet08Url, (image) => {
      this.npcSpriteSheetImgs[1] = image;
    });
  }

  private createKeyedSpriteCell(
    image: HTMLImageElement,
    row: number,
    column: number
  ): HTMLCanvasElement {
    const cellWidth = image.naturalWidth / 4;
    const cellHeight = image.naturalHeight / 4;
    if (!Number.isInteger(cellWidth) || !Number.isInteger(cellHeight)) {
      throw new Error('Character sprite sheets must be divisible into a 4x4 grid');
    }

    const canvas = document.createElement('canvas');
    canvas.width = cellWidth;
    canvas.height = cellHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to create character sprite canvas context');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      column * cellWidth,
      row * cellHeight,
      cellWidth,
      cellHeight,
      0,
      0,
      cellWidth,
      cellHeight
    );

    const imageData = ctx.getImageData(0, 0, cellWidth, cellHeight);
    const { data } = imageData;
    const pixelCount = cellWidth * cellHeight;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);
    let head = 0;
    let tail = 0;
    const isGreenBackground = (pixel: number): boolean => {
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      return green > 75 && green - red > 22 && green - blue > 22;
    };
    const enqueue = (x: number, y: number): void => {
      const pixel = y * cellWidth + x;
      if (visited[pixel] || !isGreenBackground(pixel)) return;
      visited[pixel] = 1;
      queue[tail++] = pixel;
    };

    for (let x = 0; x < cellWidth; x++) {
      enqueue(x, 0);
      enqueue(x, cellHeight - 1);
    }
    for (let y = 0; y < cellHeight; y++) {
      enqueue(0, y);
      enqueue(cellWidth - 1, y);
    }

    while (head < tail) {
      const pixel = queue[head++];
      data[pixel * 4 + 3] = 0;
      const x = pixel % cellWidth;
      const y = Math.floor(pixel / cellWidth);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < cellWidth && ny >= 0 && ny < cellHeight) {
            enqueue(nx, ny);
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  private createCharacterCanvas(request: CharacterTextureRequest): HTMLCanvasElement {
    if (request.role === 'player' && this.playerSpriteSheetImg) {
      const directionRows: Record<Direction, number> = {
        down: 0,
        left: 1,
        right: 2,
        up: 3,
      };
      return this.createKeyedSpriteCell(
        this.playerSpriteSheetImg,
        directionRows[request.dir],
        request.frame
      );
    }

    if (request.role !== 'player') {
      const index = getNpcSpriteIndex(request.variant ?? request.role);
      const sheetIndex = Math.floor(index / 16);
      const image = this.npcSpriteSheetImgs[sheetIndex];
      if (image) {
        const cell = index % 16;
        return this.createKeyedSpriteCell(image, Math.floor(cell / 4), cell % 4);
      }
    }

    return generateCharacterSpriteCanvas(request.role, request.dir, request.frame);
  }

  private updateTextureFromCanvas(
    texture: THREE.CanvasTexture,
    source: HTMLCanvasElement
  ): void {
    const canvas = texture.image as HTMLCanvasElement;
    const resized = canvas.width !== source.width || canvas.height !== source.height;
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Unable to update character sprite texture');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);
    if (resized) {
      texture.dispose();
    }
    texture.needsUpdate = true;
  }

  private preloadSoulDollSheets(): void {
    // Prioritize starter SoulDolls first, then queue remaining sheets 1..50
    for (const id of [1, 4, 7]) {
      this.enqueueSoulDollLoad(id, true);
    }
    for (let id = 1; id <= 50; id++) {
      this.enqueueSoulDollLoad(id, false);
    }
  }

  private enqueueSoulDollLoad(speciesId: number, highPriority: boolean): void {
    if (this.disposed || typeof Image === 'undefined') return;
    const sheetId = getSoulDollSheetId(speciesId);
    if (
      this.souldollPairs.has(sheetId) ||
      this.souldollLoading.has(sheetId) ||
      this.souldollAttempted.has(sheetId)
    ) {
      return;
    }

    const existingIdx = this.souldollQueue.indexOf(sheetId);
    if (existingIdx !== -1) {
      if (highPriority && existingIdx > 0) {
        this.souldollQueue.splice(existingIdx, 1);
        this.souldollQueue.unshift(sheetId);
      }
    } else if (highPriority) {
      this.souldollQueue.unshift(sheetId);
    } else {
      this.souldollQueue.push(sheetId);
    }

    this.pumpSoulDollQueue();
  }

  private pumpSoulDollQueue(): void {
    const maxConcurrent = 6;
    while (!this.disposed && this.souldollActiveLoads < maxConcurrent && this.souldollQueue.length > 0) {
      const sheetId = this.souldollQueue.shift()!;
      if (this.souldollPairs.has(sheetId) || this.souldollLoading.has(sheetId)) {
        continue;
      }
      this.souldollLoading.add(sheetId);
      this.souldollAttempted.add(sheetId);
      this.souldollActiveLoads += 1;

      const img = new Image();
      const url = getSoulDollSheetUrl(sheetId);
      const finish = () => {
        this.souldollLoading.delete(sheetId);
        this.souldollActiveLoads = Math.max(0, this.souldollActiveLoads - 1);
        this.pumpSoulDollQueue();
      };

      img.onload = () => {
        if (this.disposed) return;
        const pair = extractAndNormalizeSoulDollPair(img);
        if (pair) {
          this.souldollPairs.set(sheetId, pair);
          this.refreshSoulDollAssets(sheetId, pair);
        }
        finish();
      };
      img.onerror = () => {
        finish();
      };
      img.src = url;
    }
  }

  private refreshSoulDollAssets(sheetId: number, pair: NormalizedSoulDollPair): void {
    this.creatureUrls.delete(`${sheetId}_front`);
    this.creatureUrls.delete(`${sheetId}_back`);
    this.silhouetteUrls.delete(sheetId);

    for (const view of ['front', 'back'] as const) {
      const key = `${sheetId}_${view}`;
      const tex = this.creatureCache.peek(key);
      if (tex) {
        this.updateTextureFromCanvas(tex, pair[view]);
      }
      const silTex = this.silhouetteCache.peek(key);
      if (silTex) {
        this.updateTextureFromCanvas(
          silTex,
          makeTintedSilhouetteCanvas(pair[view], PALETTE.warmWhite)
        );
      }
    }

    for (const listener of this.creatureListeners) {
      listener(sheetId);
    }
  }

  private getCreatureCanvas(speciesId: number, view: 'front' | 'back'): HTMLCanvasElement {
    const sheetId = getSoulDollSheetId(speciesId);
    this.enqueueSoulDollLoad(sheetId, true);
    const pair = this.souldollPairs.get(sheetId);
    if (pair) {
      return pair[view];
    }
    return generateCreatureSpriteCanvas(speciesId, view);
  }

  private refreshCharacterTextures(): void {
    this.charUrls.clear();
    for (const [key, texture] of this.charCache) {
      const request = this.charRequests.get(key);
      if (request) {
        this.updateTextureFromCanvas(texture, this.createCharacterCanvas(request));
      }
    }
  }

  private applyImageToTexture(
    tex: THREE.CanvasTexture,
    img: HTMLImageElement,
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ): void {
    const canvas = tex.image as HTMLCanvasElement;
    const resized = canvas.width !== sw || canvas.height !== sh;
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, sw, sh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    if (sw >= 64 && sh >= 64) {
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
    }
    if (resized) {
      tex.dispose();
    }
    tex.needsUpdate = true;
  }

  getTileAtlasTexture(): THREE.CanvasTexture {
    if (!this.tileAtlas) {
      this.tileAtlas = makePixelTexture(buildTileAtlasCanvas());
    }
    return this.tileAtlas;
  }

  getGrassTexture(): THREE.CanvasTexture {
    if (!this.grassTexture) {
      const tex = new THREE.CanvasTexture(makeGrassFallbackCanvas());
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      this.grassTexture = tex;

      if (this.grassImg) {
        this.applyImageToTexture(
          tex,
          this.grassImg,
          0,
          0,
          this.grassImg.naturalWidth,
          this.grassImg.naturalHeight
        );
      }
    }
    return this.grassTexture;
  }

  getRoofTexture(kind: RoofTextureKind): THREE.CanvasTexture {
    let tex = this.roofCache.get(kind);
    if (!tex) {
      tex = new THREE.CanvasTexture(makeRoofFallbackCanvas(kind));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      tex.needsUpdate = true;
      this.roofCache.set(kind, tex);

      const loadedImg = this.roofImages.get(kind);
      if (loadedImg) {
        this.applyImageToTexture(
          tex,
          loadedImg,
          0,
          0,
          loadedImg.naturalWidth,
          loadedImg.naturalHeight
        );
      }
    }
    return tex;
  }

  onCreatureLoaded(listener: (speciesId: number) => void): () => void {
    this.creatureListeners.add(listener);
    return () => {
      this.creatureListeners.delete(listener);
    };
  }

  getCreatureTexture(
    speciesId: number,
    view: 'front' | 'back'
  ): THREE.CanvasTexture {
    const key = `${speciesId}_${view}`;
    const hit = this.creatureCache.get(key);
    if (hit) {
      this.enqueueSoulDollLoad(speciesId, true);
      return hit;
    }
    const tex = makeSoulDollTexture(this.getCreatureCanvas(speciesId, view));
    this.creatureCache.set(key, tex);
    return tex;
  }

  getCreatureSilhouetteTexture(
    speciesId: number,
    view: 'front' | 'back'
  ): THREE.CanvasTexture {
    const key = `${speciesId}_${view}`;
    const hit = this.silhouetteCache.get(key);
    if (hit) {
      this.enqueueSoulDollLoad(speciesId, true);
      return hit;
    }
    const base = this.getCreatureCanvas(speciesId, view);
    const tex = makeSoulDollTexture(makeTintedSilhouetteCanvas(base, PALETTE.warmWhite));
    this.silhouetteCache.set(key, tex);
    return tex;
  }

  getCreatureDataUrl(speciesId: number, view: 'front' | 'back' = 'front'): string {
    const key = `${speciesId}_${view}`;
    let url = this.creatureUrls.get(key);
    if (!url) {
      const canvas = this.getCreatureCanvas(speciesId, view);
      url = canvas.toDataURL('image/png');
      this.creatureUrls.set(key, url);
    }
    return url;
  }

  getCreatureSilhouetteDataUrl(speciesId: number): string {
    let url = this.silhouetteUrls.get(speciesId);
    if (!url) {
      const base = this.getCreatureCanvas(speciesId, 'front');
      url = makeTintedSilhouetteCanvas(base, PALETTE.smokedWood).toDataURL('image/png');
      this.silhouetteUrls.set(speciesId, url);
    }
    return url;
  }

  getItemIconDataUrl(itemId: string): string {
    let url = this.itemIconUrls.get(itemId);
    if (!url) {
      url = generateItemIconCanvas(itemId).toDataURL('image/png');
      this.itemIconUrls.set(itemId, url);
    }
    return url;
  }

  getItemTexture(itemId: string): THREE.CanvasTexture {
    let tex = this.itemTextures.get(itemId);
    if (!tex) {
      tex = makePixelTexture(generateItemIconCanvas(itemId));
      this.itemTextures.set(itemId, tex);
    }
    return tex;
  }

  getCharacterTexture(
    role: CharacterRole,
    dir: Direction,
    frame: CharacterFrame,
    variant?: string
  ): THREE.CanvasTexture {
    const request = { role, dir, frame, variant };
    const key = getCharacterTextureKey(role, dir, frame, variant);
    let tex = this.charCache.get(key);
    if (!tex) {
      tex = makePixelTexture(this.createCharacterCanvas(request));
      this.charCache.set(key, tex);
      this.charRequests.set(key, request);
    }
    return tex;
  }

  getCharacterDataUrl(
    role: CharacterRole,
    dir: Direction = 'down',
    variant?: string
  ): string {
    const key = getCharacterTextureKey(role, dir, 0, variant);
    let url = this.charUrls.get(key);
    if (!url) {
      url = this.createCharacterCanvas({ role, dir, frame: 0, variant }).toDataURL('image/png');
      this.charUrls.set(key, url);
    }
    return url;
  }

  getPropTexture(kind: PropKind): THREE.CanvasTexture {
    let tex = this.propCache.get(kind);
    if (!tex) {
      tex = makePixelTexture(generatePropCanvas(kind));
      this.propCache.set(kind, tex);

      if (kind === 'mushroom_tree' && this.mushroomTreeImg) {
        this.applyImageToTexture(
          tex,
          this.mushroomTreeImg,
          0,
          0,
          this.mushroomTreeImg.naturalWidth,
          this.mushroomTreeImg.naturalHeight
        );
      } else if (kind === 'mushroom_tree_arcane' && this.mushroomArcaneTreeImg) {
        this.applyImageToTexture(
          tex,
          this.mushroomArcaneTreeImg,
          0,
          0,
          this.mushroomArcaneTreeImg.naturalWidth,
          this.mushroomArcaneTreeImg.naturalHeight
        );
      } else if (kind === 'pine' && this.pineTreeImg) {
        this.applyImageToTexture(
          tex,
          this.pineTreeImg,
          0,
          0,
          this.pineTreeImg.naturalWidth,
          this.pineTreeImg.naturalHeight
        );
      } else if (kind === 'snow_pine' && this.snowPineTreeImg) {
        this.applyImageToTexture(
          tex,
          this.snowPineTreeImg,
          0,
          0,
          this.snowPineTreeImg.naturalWidth,
          this.snowPineTreeImg.naturalHeight
        );
      } else if (kind === 'oak' && this.oakTreeImg) {
        this.applyImageToTexture(
          tex,
          this.oakTreeImg,
          0,
          0,
          this.oakTreeImg.naturalWidth,
          this.oakTreeImg.naturalHeight
        );
      } else if (kind === 'birch' && this.willowTreeImg) {
        this.applyImageToTexture(
          tex,
          this.willowTreeImg,
          0,
          0,
          this.willowTreeImg.naturalWidth,
          this.willowTreeImg.naturalHeight
        );
      } else if (kind === 'bush' && this.thornyBushImg) {
        this.applyImageToTexture(
          tex,
          this.thornyBushImg,
          0,
          0,
          this.thornyBushImg.naturalWidth,
          this.thornyBushImg.naturalHeight
        );
      } else if (kind === 'bush_arcane' && this.arcaneBushImg) {
        this.applyImageToTexture(
          tex,
          this.arcaneBushImg,
          0,
          0,
          this.arcaneBushImg.naturalWidth,
          this.arcaneBushImg.naturalHeight
        );
      } else if (kind === 'tall_grass_clump' && this.tallGrassClumpImg) {
        this.applyImageToTexture(
          tex,
          this.tallGrassClumpImg,
          0,
          0,
          this.tallGrassClumpImg.naturalWidth,
          this.tallGrassClumpImg.naturalHeight
        );
      } else if (kind === 'tall_grass_flower' && this.tallGrassFlowerImg) {
        this.applyImageToTexture(
          tex,
          this.tallGrassFlowerImg,
          0,
          0,
          this.tallGrassFlowerImg.naturalWidth,
          this.tallGrassFlowerImg.naturalHeight
        );
      } else {
        const crop = LAMP_SHEET_CROPS[kind];
        if (crop && this.lampsSheetImg) {
          this.applyImageToTexture(tex, this.lampsSheetImg, crop.sx, crop.sy, crop.sw, crop.sh);
        }
      }
    }
    return tex;
  }

  getBattleIconDataUrl(kind: BattleIconKind): string {
    let url = this.battleIconUrls.get(kind);
    if (!url) {
      url = makeBattleIconCanvas(kind).toDataURL('image/png');
      this.battleIconUrls.set(kind, url);
    }
    return url;
  }

  dispose(): void {
    this.disposed = true;
    this.tileAtlas?.dispose();
    this.tileAtlas = null;
    this.grassTexture?.dispose();
    this.grassTexture = null;
    this.creatureCache.clear();
    this.silhouetteCache.clear();
    for (const t of this.charCache.values()) t.dispose();
    this.charCache.clear();
    this.charRequests.clear();
    for (const t of this.propCache.values()) t.dispose();
    this.propCache.clear();
    for (const t of this.roofCache.values()) t.dispose();
    this.roofCache.clear();
    this.roofImages.clear();
    for (const t of this.itemTextures.values()) t.dispose();
    this.itemTextures.clear();
    this.creatureUrls.clear();
    this.silhouetteUrls.clear();
    this.souldollPairs.clear();
    this.souldollLoading.clear();
    this.souldollAttempted.clear();
    this.souldollQueue.length = 0;
    this.creatureListeners.clear();
    this.itemIconUrls.clear();
    this.charUrls.clear();
    this.playerSpriteSheetImg = null;
    this.npcSpriteSheetImgs = [null, null];
    this.battleIconUrls.clear();
  }
}
