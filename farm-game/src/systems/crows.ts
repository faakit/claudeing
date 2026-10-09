import { crops, game, items, placeables } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { parseKey } from './farming';
import { inGreenhouse } from './plots';
import { random } from './rng';
import { absoluteDay } from './time';
import { isWet } from './weather';

/** Is this farm tile watched by a scarecrow (within its `radius`, counted like a king's move)? */
export function guarded(state: GameState, tx: number, ty: number): boolean {
  return (state.placed['farm'] ?? []).some((o) => {
    const r = Number(placeables[o.type]?.params['radius'] ?? 0);
    return r > 0 && Math.max(Math.abs(o.tx - tx), Math.abs(o.ty - ty)) <= r;
  });
}

/** Farm tiles with a crop no scarecrow watches (never under glass). */
export function unguardedCrops(state: GameState): string[] {
  return Object.entries(state.farm.tiles)
    .filter(([key, soil]) => {
      if (!soil.crop) return false;
      const [tx, ty] = parseKey(key);
      return !inGreenhouse(state, tx, ty) && !guarded(state, tx, ty);
    })
    .map(([key]) => key);
}

/**
 * Morning crows (a small reason for a scarecrow): after the first week, on a dry morning, a field with
 * enough unwatched crops may lose one of them. Returns the crop eaten, if any.
 */
export function crowVisit(state: GameState): string | null {
  const cfg = game.crows;
  if (!cfg || absoluteDay(state) < cfg.startDay || isWet(state.weather)) return null;
  const open = unguardedCrops(state);
  if (open.length < cfg.minCrops || random(state) >= cfg.chance) return null;
  const key = open[Math.floor(random(state) * open.length)] as string;
  const soil = state.farm.tiles[key];
  const crop = soil?.crop ? crops[soil.crop.cropId] : undefined;
  if (!soil || !crop) return null;
  soil.crop = null;
  state.stats['crowsAte'] = (state.stats['crowsAte'] ?? 0) + 1;
  gameEvents.emit('farmChanged', undefined);
  return items[crop.harvestItem]?.name ?? crop.harvestItem;
}
