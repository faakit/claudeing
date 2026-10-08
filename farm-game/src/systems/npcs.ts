import { npcs } from '../data';
import type { NpcDef } from '../data';

export interface NpcSpot {
  map: string;
  tx: number;
  ty: number;
}

/** Where a villager is at a given minute of the day, or null while they are at home (out of reach). */
export function npcLocation(id: string, minutes: number): NpcSpot | null {
  const def = npcs[id] as NpcDef | undefined;
  if (!def) return null;
  if (!def.schedule) return { map: def.map, tx: def.tx, ty: def.ty };
  let spot = def.schedule[0];
  for (const w of def.schedule) if (w.from <= minutes) spot = w;
  if (!spot || spot.map === 'away') return null;
  return { map: spot.map, tx: spot.tx, ty: spot.ty };
}

/** Maps a villager ever visits (so a scene knows whether to draw them at all). */
export const npcMaps = (id: string): string[] => {
  const def = npcs[id];
  if (!def) return [];
  if (!def.schedule) return [def.map];
  return [...new Set(def.schedule.map((w) => w.map).filter((m) => m !== 'away'))];
};
