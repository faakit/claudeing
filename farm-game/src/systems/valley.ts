import { mapsData, valley, type MapLookRow, type ValleyWhen } from '../data';
import type { GameState } from '../state/GameState';
import { absoluteDay } from './time';

/**
 * The Dry Year's valley state (docs/WORLD-PLAN.md): how each map looks for it, and the first green. Pure rules, no
 * Phaser. Everything is a lifetime stat, so none of it needs a save change:
 *
 * - `valley.farmGreen` 1 once the farm has turned green (the morning after 5 goods shipped, day 5 at the earliest);
 * - `valley.greenSeen` 1 once the first-green moment has played (stepping out onto the green farm);
 * - `place.<id>` 0 untouched, 1 asked, 2 funded, 3 restored (the places arrive with M3);
 * - `valley.on` 1 on every save made since the valley existed (old saves get their defaults once, in `sanitize`).
 */
export const FARM_GREEN = 'valley.farmGreen';
export const GREEN_SEEN = 'valley.greenSeen';
export const VALLEY_ON = 'valley.on';
export const placeStat = (id: string): string => `place.${id}`;

/** Does a valley condition hold? No condition always holds. */
export function valleyHolds(state: GameState, when: ValleyWhen | undefined): boolean {
  if (!when) return true;
  const key = when.place !== undefined ? placeStat(when.place) : (when.stat ?? '');
  const v = state.stats[key] ?? 0;
  return (when.min === undefined || v >= when.min) && (when.max === undefined || v <= when.max);
}

export interface MapLook {
  /** The map file to load (a variant file once M2's variants exist). */
  file: string;
  /** A palette swap of the tileset, or null for the normal one. */
  palette: 'dry' | null;
}

/** The row of `valley.json` `maps.<map>` in force: the first whose `when` holds (the last row is the default). */
function lookRow(state: GameState, mapId: string): MapLookRow | undefined {
  return (valley.maps[mapId] ?? []).find((r) => valleyHolds(state, r.when));
}

/** How a map looks today: which file and which palette. Maps with no rows look as they always have. */
export function mapLook(state: GameState, mapId: string): MapLook {
  const row = lookRow(state, mapId);
  const base = mapsData.maps[mapId]?.file ?? '';
  return {
    file: row?.variant ? base.replace(/\.tmj$/, `@${row.variant}.tmj`) : base,
    palette: row?.palette ?? null,
  };
}

/** Outdoor maps on the dry palette today. While any is, the season's dry tileset stays resident. */
export function dryMaps(state: GameState): string[] {
  return Object.entries(mapsData.maps)
    .filter(([id, m]) => m.outdoor && mapLook(state, id).palette === 'dry')
    .map(([id]) => id);
}

/**
 * The night check for the first green (call before the calendar moves on): with `min` of `stat` reached on the
 * night of day `minDay` or later, the farm wakes green tomorrow. Fires once; true on the night it fires.
 */
export function checkFarmGreen(state: GameState): boolean {
  const rule = valley.farmGreen;
  if ((state.stats[FARM_GREEN] ?? 0) >= 1) return false;
  if ((state.stats[rule.stat] ?? 0) < rule.min || absoluteDay(state) < rule.minDay) return false;
  state.stats[FARM_GREEN] = 1;
  return true;
}

/** The first-green moment plays once, the first time the farmer stands on the green farm. True that once. */
export function takeFirstGreenMoment(state: GameState): boolean {
  if ((state.stats[FARM_GREEN] ?? 0) < 1 || state.stats[GREEN_SEEN]) return false;
  state.stats[GREEN_SEEN] = 1;
  return true;
}

/**
 * Defaults for a save from before the valley (no `valley.on`): a farm that has already shipped `min` goods is
 * green (nobody returns to a dry farm they had already greened) and plays no moment. Saves made since keep their
 * own stats. Mutates and returns `stats` (called from `sanitize`).
 */
export function valleyDefaults(stats: Record<string, number>): Record<string, number> {
  if (stats[VALLEY_ON]) return stats;
  stats[VALLEY_ON] = 1;
  if ((stats[valley.farmGreen.stat] ?? 0) >= valley.farmGreen.min) {
    stats[FARM_GREEN] = Math.max(1, stats[FARM_GREEN] ?? 0);
    stats[GREEN_SEEN] = 1;
  }
  return stats;
}

/** Rosa's title-screen letter is kept in the mailbox (already read) from the morning of `keepDay`. */
export const ROSA_LETTER_STAT = 'mail.rosa_letter';
export function rosaLetterDue(state: GameState): boolean {
  return !state.stats[ROSA_LETTER_STAT] && absoluteDay(state) >= valley.letter.keepDay;
}
