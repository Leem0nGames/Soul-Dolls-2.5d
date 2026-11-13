import { createRng, type Rng } from '../core/Rng.ts';
import { ALL_CONTAINER_IDS, getBodyContainer, SHARDS_PER_CONTAINER } from '../data/containers.ts';
import { getItem } from '../data/items.ts';
import { getMove } from '../data/moves.ts';
import type { SaveData } from './types.ts';
import { addBodyPartShard } from './BodyParts.ts';
import { addItem } from './Inventory.ts';

export type ArGachaReward =
  | {
      kind: 'item';
      itemId: string;
      name: string;
      quantity: number;
      description: string;
    }
  | {
      kind: 'body_part';
      containerId: string;
      containerName: string;
      shardsAdded: number;
      currentShards: number;
      assembledCount: number;
    }
  | {
      kind: 'power';
      moveId: string;
      moveName: string;
      description: string;
    };

const GACHA_ITEM_POOL: Array<{ itemId: string; qty: number }> = [
  { itemId: 'supercapsula', qty: 2 },
  { itemId: 'ultracapsula', qty: 1 },
  { itemId: 'baya_alba', qty: 1 },
  { itemId: 'baya_pura', qty: 2 },
  { itemId: 'gema_poder', qty: 1 },
  { itemId: 'hiperpocion', qty: 2 },
  { itemId: 'revivir', qty: 1 },
  { itemId: 'piedra_aurora', qty: 1 },
];

const GACHA_POWER_POOL: readonly string[] = [
  'llamarada',
  'hidrochorro',
  'gigadrenado',
  'rayo_orbital',
  'avalancha',
  'tifon_aurora',
  'canto_espectral',
  'corte_critico',
  'joya_prismatica',
  'llama_vital',
  'pulso_abismo',
  'tormenta_floral',
];

function hashQrSeed(code: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h || 1337;
}

export function rollArGacha(
  qrPayload: string,
  save: SaveData,
  fallbackRng: Rng
): ArGachaReward {
  const trimmed = qrPayload.trim();
  const rng = trimmed
    ? createRng((hashQrSeed(trimmed) ^ ((save.stats.steps + Date.now()) >>> 0)) >>> 0)
    : fallbackRng;

  const roll = rng.next();

  // 42% Parte de Cuerpo Contenedor (5 del mismo = cuerpo completo)
  if (roll < 0.42) {
    const pool = ALL_CONTAINER_IDS.filter((id) => id !== 'cuerpo_aprendiz');
    const containerId = pool[rng.int(0, pool.length - 1)] ?? 'cuerpo_maga';
    const def = getBodyContainer(containerId);
    const shardsAdded = rng.chance(25) ? 2 : 1;
    const res = addBodyPartShard(save, containerId, shardsAdded);
    return {
      kind: 'body_part',
      containerId,
      containerName: def.name,
      shardsAdded,
      currentShards: res.currentShards,
      assembledCount: res.assembledCount,
    };
  }

  // 28% Poder / Técnica de Ki para enseñar a una SoulDoll
  if (roll < 0.7) {
    const moveId = GACHA_POWER_POOL[rng.int(0, GACHA_POWER_POOL.length - 1)];
    const move = getMove(moveId);
    return {
      kind: 'power',
      moveId: move.id,
      moveName: move.name,
      description: `Poder ${move.type.toUpperCase()} (${move.power || 'Estado'} pot.) · ${move.description}`,
    };
  }

  // 30% Objeto / Soulpot / Cristal de Maná
  const picked = GACHA_ITEM_POOL[rng.int(0, GACHA_ITEM_POOL.length - 1)];
  const item = getItem(picked.itemId);
  addItem(save.bag, item.id, picked.qty);
  return {
    kind: 'item',
    itemId: item.id,
    name: item.name,
    quantity: picked.qty,
    description: item.description,
  };
}

export { SHARDS_PER_CONTAINER };
