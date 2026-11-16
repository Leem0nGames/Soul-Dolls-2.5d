import type { MapDef } from '../../domain/types.ts';
import { MAP_ARENA_CUMBRE } from './arenaCumbre.ts';
import { MAP_CUEVA_ECO } from './cuevaEco.ts';
import { HOUSE_INTERIOR_MAPS } from './houseInteriors.ts';
import { MAP_PUEBLO_BRUMA } from './puebloBruma.ts';
import { MAP_RUTA_1 } from './ruta1.ts';
import { MAP_RUTA_2 } from './ruta2.ts';
import { MAP_VILLA_ORIGEN } from './villaOrigen.ts';

export const MAPS: Record<string, MapDef> = {
  villa_origen: MAP_VILLA_ORIGEN,
  ruta_1: MAP_RUTA_1,
  pueblo_bruma: MAP_PUEBLO_BRUMA,
  ruta_2: MAP_RUTA_2,
  cueva_eco: MAP_CUEVA_ECO,
  arena_cumbre: MAP_ARENA_CUMBRE,
  ...HOUSE_INTERIOR_MAPS,
};

export function getMap(id: string): MapDef {
  const m = MAPS[id];
  if (!m) throw new Error(`Unknown map: ${id}`);
  return m;
}
