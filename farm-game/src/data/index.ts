import raw from './maps.json';
import type { Direction } from '../state/GameState';

export interface MapDef {
  scene: string;
  file: string;
}
export interface MapsData {
  start: { map: string; tx: number; ty: number; facing: Direction };
  maps: Record<string, MapDef>;
}

const DIRS = ['up', 'down', 'left', 'right'];

function validateMaps(data: unknown): MapsData {
  const d = data as MapsData;
  const fail = (msg: string): never => {
    throw new Error(`maps.json: ${msg}`);
  };
  if (!d?.maps || Object.keys(d.maps).length === 0) fail('missing "maps"');
  for (const [id, def] of Object.entries(d.maps)) {
    if (!def.scene || !def.file) fail(`map "${id}" needs "scene" and "file"`);
  }
  const s = d.start;
  if (!s || !d.maps[s.map]) fail(`"start.map" must name an existing map`);
  if (!Number.isInteger(s.tx) || !Number.isInteger(s.ty)) fail('"start" needs integer tx/ty');
  if (!DIRS.includes(s.facing)) fail(`"start.facing" must be one of ${DIRS.join(', ')}`);
  return d;
}

export const mapsData: MapsData = validateMaps(raw);
