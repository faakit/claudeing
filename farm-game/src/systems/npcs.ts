import { npcs } from '../data';
import type { NpcDef } from '../data';
import type { GameState } from '../state/GameState';
import { openingMaps, siteVisit, stageWhenHolds } from './valley';

export interface NpcSpot {
  map: string;
  tx: number;
  ty: number;
}

/** Where a villager is at a given minute of the day, or null while they are at home (out of reach). */
export function npcLocation(
  id: string,
  minutes: number,
  state?: Pick<GameState, 'stats' | 'time'>,
): NpcSpot | null {
  const def = npcs[id] as NpcDef | undefined;
  if (!def) return null;
  // the morning a place opens, the one who lost it waits at its site (systems/valley.ts)
  const visit = state ? siteVisit(state, id, minutes) : null;
  if (visit) return visit;
  if (!def.schedule) return { map: def.map, tx: def.tx, ty: def.ty };
  // the last row begun by now whose `when` holds (Finn's afternoon at the dock once the river is back)
  const stats = state?.stats ?? {};
  let spot = def.schedule[0];
  for (const w of def.schedule)
    if (w.from <= minutes && (!w.when || stageWhenHolds({ stats }, w.when))) spot = w;
  if (!spot || spot.map === 'away') return null;
  return { map: spot.map, tx: spot.tx, ty: spot.ty };
}

/** Does any villager stand on this tile at some point of the day? (Nothing may be built there.) */
export function villagerSpot(map: string, tx: number, ty: number): boolean {
  return Object.values(npcs).some((def) =>
    (def.schedule ?? [{ from: 0, map: def.map, tx: def.tx, ty: def.ty }]).some(
      (w) => w.map === map && w.tx === tx && w.ty === ty,
    ),
  );
}

/** Maps a villager ever visits (so a scene knows whether to draw them at all). */
export const npcMaps = (id: string): string[] => {
  const def = npcs[id];
  if (!def) return [];
  // where they wait on the opening mornings of the places they open (beside the site, or the place's `opening.at`)
  const sites = openingMaps(id);
  const own = def.schedule ? def.schedule.map((w) => w.map) : [def.map];
  return [...new Set([...own, ...sites].filter((m) => m !== 'away'))];
};
