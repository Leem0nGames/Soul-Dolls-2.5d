import type { AnimationRole, SpeciesAnimationEntry } from '../data/animations.ts';
import {
  getFollowerPetSpriteUrl,
  getWildSoulSpriteUrl,
  hasFollowerPetSprite,
  hasWildSoulSprite,
} from '../data/soulForms.ts';
import type { SpeciesDef } from './types.ts';

export type StudioDestination = 'catalog' | 'create' | 'inspect';
export type CatalogViewMode = 'front' | 'back' | 'wild';
export type GrimoireFilter = 'all' | 'animated' | 'wild' | 'pending';
export type BgMode = 'checker' | 'dark' | 'sand' | 'grey';
export type ChromaMode = 'green' | 'grey' | 'white' | 'black' | 'none';
export type StudioSourceKind = 'video' | 'image';
export type StudioCreationMode = AnimationRole | 'soul_dual';

export interface PixelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

export interface DualSoulRegions {
  splitY: number;
  soulBox: PixelBox | null;
  followerBox: PixelBox | null;
}

export interface GrimoireEntryItem {
  id: number;
  spec?: SpeciesDef;
  name: string;
  anims: SpeciesAnimationEntry[];
  hasAnim: boolean;
  hasWildSoul: boolean;
  hasFollowerPet: boolean;
  wildSoulUrl: string | null;
  followerPetUrl: string | null;
}

export interface TrimSamplingPlan {
  start: number;
  end: number;
  timestamps: number[];
  totalFrames: number;
  rows: number;
}

export interface ExportMetaInput {
  speciesId: number;
  speciesName: string;
  role: AnimationRole;
  cols: number;
  rows: number;
  totalFrames: number;
  impactFrame: number;
  cellW: number;
  cellH: number;
  facing: 'left' | 'right';
  sourceKind: StudioSourceKind;
}

export function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

export function stepBounded(current: number, delta: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(current + delta)));
}

export function buildOutputFileName(speciesId: number, role: AnimationRole): string {
  return `${role}_${pad2(speciesId)}.webp`;
}

export function computeTrimSamplingPlan(params: {
  start: number;
  end: number;
  fps: number;
  cols: number;
  duration: number;
  maxFrames?: number;
}): TrimSamplingPlan {
  const safeDuration = Math.max(0.2, params.duration);
  const clampedStart = Math.max(0, Math.min(params.start, safeDuration - 0.1));
  const clampedEnd = Math.max(clampedStart + 0.1, Math.min(params.end, safeDuration));
  const safeFps = Math.max(1, Math.min(30, params.fps));
  const maxFrames = Math.max(1, params.maxFrames ?? 40);
  const step = 1 / safeFps;

  const timestamps: number[] = [];
  for (let t = clampedStart; t <= clampedEnd + 0.0001; t += step) {
    timestamps.push(Number(Math.min(safeDuration - 0.01, t).toFixed(4)));
    if (timestamps.length >= maxFrames) break;
  }

  const safeCols = Math.max(1, Math.floor(params.cols));
  const totalFrames = Math.max(1, timestamps.length);
  const rows = Math.max(1, Math.ceil(totalFrames / safeCols));

  return {
    start: clampedStart,
    end: clampedEnd,
    timestamps,
    totalFrames,
    rows,
  };
}

export function buildTsSnippet(meta: ExportMetaInput): string {
  const fileName = buildOutputFileName(meta.speciesId, meta.role);
  return `{
  speciesId: ${meta.speciesId},
  role: '${meta.role}',
  label: 'SoulDoll #${pad2(meta.speciesId)} — ${meta.speciesName} (${meta.cols}×${meta.rows})',
  spec: {
    path: '/assets/attacks/${fileName}',
    cols: ${meta.cols},
    rows: ${meta.rows},
    totalFrames: ${meta.totalFrames},
    impactFrame: ${meta.impactFrame},
    aspectRatio: ${meta.cellW} / ${meta.cellH},
    facing: '${meta.facing}',
  },
}`;
}

export function buildAgentPromptSummary(meta: ExportMetaInput): string {
  const fileName = buildOutputFileName(meta.speciesId, meta.role);
  const roleLabel = meta.role === 'physical_attack' ? 'ataque físico' : 'ataque especial';
  const sourceLabel = meta.sourceKind === 'video' ? 'video convertido' : 'spritesheet';
  return `Registra este ${sourceLabel} (${fileName}) como ${roleLabel} de SoulDoll #${pad2(meta.speciesId)} (${meta.speciesName}): ${meta.cols} columnas × ${meta.rows} filas, ${meta.totalFrames} frames, impactFrame ${meta.impactFrame}, aspectRatio ${meta.cellW}/${meta.cellH}, facing '${meta.facing}'.`;
}

export function buildDualSoulFileNames(speciesId: number): {
  soulFile: string;
  followerFile: string;
} {
  const num = pad2(speciesId);
  return {
    soulFile: `${num}.webp`,
    followerFile: `${num}.webp`,
  };
}

export function buildDualSoulAgentPrompt(params: {
  speciesId: number;
  speciesName: string;
  followerW: number;
  followerH: number;
}): string {
  const num = pad2(params.speciesId);
  return `Registra SoulDoll #${num} (${params.speciesName}): alma salvaje sin cuerpo en /public/assets/souls/${num}.webp (512x512) y reserva mascota pixel art en /public/assets/followers/${num}.webp (${params.followerW}x${params.followerH}).`;
}

export function buildDualSoulTsSnippet(speciesId: number): string {
  const num = pad2(speciesId);
  return `{
  speciesId: ${speciesId},
  wildSoulPath: '/assets/souls/${num}.webp',
  followerPetPath: '/assets/followers/${num}.webp',
}`;
}

function findAlphaBoundsInRows(
  data: Uint8ClampedArray,
  width: number,
  yStart: number,
  yEnd: number,
  alphaMin = 20
): PixelBox | null {
  let x0 = width;
  let y0 = yEnd;
  let x1 = -1;
  let y1 = -1;
  for (let y = yStart; y <= yEnd; y++) {
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (data[(rowOffset + x) * 4 + 3] > alphaMin) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < x0 || y1 < y0) return null;
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

export function detectDualSoulRegions(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  splitPercentOverride?: number
): DualSoulRegions {
  if (width <= 0 || height <= 1) {
    return { splitY: 0, soulBox: null, followerBox: null };
  }

  let splitY: number;
  if (splitPercentOverride !== undefined) {
    const clampedPct = Math.max(0.2, Math.min(0.85, splitPercentOverride));
    splitY = Math.max(1, Math.min(height - 2, Math.round(height * clampedPct)));
  } else {
    // Auto-detect widest transparent vertical band between top and bottom sprites
    const rawSegs: Array<{ y0: number; y1: number }> = [];
    let inSeg = false;
    let segStart = 0;
    for (let y = 0; y < height; y++) {
      let count = 0;
      const rowOffset = y * width;
      for (let x = 0; x < width; x++) {
        if (data[(rowOffset + x) * 4 + 3] > 24) count++;
      }
      if (count > 2 && !inSeg) {
        inSeg = true;
        segStart = y;
      } else if (count <= 2 && inSeg) {
        if (y - segStart >= 12) rawSegs.push({ y0: segStart, y1: y - 1 });
        inSeg = false;
      }
    }
    if (inSeg && height - segStart >= 12) {
      rawSegs.push({ y0: segStart, y1: height - 1 });
    }
    const merged: Array<{ y0: number; y1: number }> = [];
    for (const seg of rawSegs) {
      const prev = merged[merged.length - 1];
      if (prev && seg.y0 - prev.y1 < 18) {
        prev.y1 = seg.y1;
      } else {
        merged.push({ ...seg });
      }
    }
    if (merged.length >= 2) {
      const topEnd = merged[0].y1;
      const botStart = merged[merged.length - 1].y0;
      splitY = Math.round((topEnd + botStart) * 0.5);
    } else {
      splitY = Math.round(height * 0.6);
    }
  }

  const soulBox = findAlphaBoundsInRows(data, width, 0, Math.max(0, splitY - 1));
  const followerBox = findAlphaBoundsInRows(data, width, Math.min(height - 1, splitY), height - 1);
  return { splitY, soulBox, followerBox };
}

export function filterGrimoireSpecies(params: {
  maxId: number;
  query: string;
  filter: GrimoireFilter;
  speciesMap: Record<number, SpeciesDef>;
  registry: readonly SpeciesAnimationEntry[];
}): GrimoireEntryItem[] {
  const q = params.query.trim().toLowerCase().replace(/^#/, '');
  const qNum = Number(q);
  const items: GrimoireEntryItem[] = [];

  for (let id = 1; id <= params.maxId; id++) {
    const spec = params.speciesMap[id];
    const name = spec?.name ?? `Hoja Extra #${pad2(id)}`;
    const anims = params.registry.filter((a) => a.speciesId === id);
    const hasAnim = anims.length > 0;
    const hasWildSoul = hasWildSoulSprite(id);
    const hasFollowerPet = hasFollowerPetSprite(id);
    const wildSoulUrl = getWildSoulSpriteUrl(id);
    const followerPetUrl = getFollowerPetSpriteUrl(id);

    if (params.filter === 'animated' && !hasAnim) continue;
    if (params.filter === 'wild' && !hasWildSoul && !hasFollowerPet) continue;
    if (params.filter === 'pending' && hasAnim && hasWildSoul) continue;

    if (q) {
      const hasLeadingZero = q.length >= 2 && q.startsWith('0');
      const matchesNum =
        !hasLeadingZero && !Number.isNaN(qNum) && q !== '' && String(id).includes(String(qNum));
      const matchesPad = pad2(id).includes(q);
      const matchesName = name.toLowerCase().includes(q);
      if (!matchesNum && !matchesPad && !matchesName) continue;
    }

    items.push({
      id,
      spec,
      name,
      anims,
      hasAnim,
      hasWildSoul,
      hasFollowerPet,
      wildSoulUrl,
      followerPetUrl,
    });
  }

  return items;
}

export function applyChromaKeyRgba(
  data: Uint8ClampedArray,
  mode: ChromaMode,
  tolerance: number,
  despillStrength: number
): void {
  if (mode === 'none') return;
  const spillFactor = Math.max(0, Math.min(1, despillStrength / 100));

  if (mode === 'green') {
    const minGreenDelta = Math.max(12, 95 - tolerance);
    const edgeBand = Math.max(12, tolerance * 0.45);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const maxRB = Math.max(r, b);
      const greenExcess = g - maxRB;

      if (greenExcess > minGreenDelta && g > 70) {
        if (greenExcess > minGreenDelta + edgeBand) {
          data[i + 3] = 0;
        } else {
          const t = 1 - (greenExcess - minGreenDelta) / edgeBand;
          data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, t)));
        }
      }

      if (data[i + 3] > 0 && spillFactor > 0 && g > maxRB) {
        data[i + 1] = Math.round(maxRB + (g - maxRB) * (1 - spillFactor));
      }
    }
    return;
  }

  const targetRgb: [number, number, number] =
    mode === 'white' ? [255, 255, 255] : mode === 'black' ? [0, 0, 0] : [180, 180, 180];
  const [tr, tg, tb] = targetRgb;
  const hardDist = Math.max(5, tolerance * 0.25);
  const softDist = hardDist + Math.max(12, tolerance * 0.5);
  const maxSpread = mode === 'grey' ? 8 : 14;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.hypot(r - tr, g - tg, b - tb);
    const spread = Math.max(Math.abs(r - tr), Math.abs(g - tg), Math.abs(b - tb));

    if (dist <= hardDist && spread <= maxSpread) {
      data[i + 3] = 0;
    } else if (dist <= softDist) {
      const t = (dist - hardDist) / (softDist - hardDist);
      const alpha = t * t * (3 - 2 * t);
      if (alpha <= 0.05) {
        data[i + 3] = 0;
      } else {
        const inv = 1 - alpha;
        data[i] = Math.max(0, Math.min(255, Math.round((r - inv * tr) / alpha)));
        data[i + 1] = Math.max(0, Math.min(255, Math.round((g - inv * tg) / alpha)));
        data[i + 2] = Math.max(0, Math.min(255, Math.round((b - inv * tb) / alpha)));
        data[i + 3] = Math.round(data[i + 3] * alpha);
      }
    }
  }
}
