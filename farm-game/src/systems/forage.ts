import { forage, items } from '../data';
import type { GameState, Season } from '../state/GameState';
import { gameEvents } from './events';
import { tileKey } from './farming';
import { addItem, roomFor } from './inventory';
import { rollQuality } from './quality';
import { random } from './rng';
import { perk } from './skills';
import { objectsOn } from './placeables';

/** Forageables that can appear on `map` in `season`, with their weights. */
export function forageTable(map: string, season: Season): { item: string; weight: number }[] {
  return forage.table
    .filter((e) => e.seasons.includes(season) && (!e.maps || e.maps.includes(map)))
    .map((e) => ({ item: e.item, weight: e.weight }));
}

function pickWeighted(state: GameState, table: { item: string; weight: number }[]): string | null {
  const total = table.reduce((n, e) => n + e.weight, 0);
  if (total <= 0) return null;
  let r = random(state) * total;
  for (const e of table) {
    r -= e.weight;
    if (r < 0) return e.item;
  }
  return table[table.length - 1]?.item ?? null;
}

export const forageAt = (
  state: GameState,
  map: string,
  tx: number,
  ty: number,
): string | undefined => state.forage[map]?.[tileKey(tx, ty)];

export const forageCount = (state: GameState, map: string): number =>
  Object.keys(state.forage[map] ?? {}).length;

/**
 * Scatter today's forageables over each map's forage zones. Spots that are taken (tilled soil, weeds,
 * placed objects, other forage) are skipped; each map is capped so ignored goods don't pile up forever.
 * Returns how many appeared, per map.
 */
export function spawnForage(
  state: GameState,
  spots: Readonly<Record<string, readonly [number, number][]>>,
): Record<string, number> {
  const spawned: Record<string, number> = {};
  for (const [map, perDay] of Object.entries(forage.perDay)) {
    const table = forageTable(map, state.time.season);
    const here = (state.forage[map] ??= {});
    const cap = forage.cap[map] ?? perDay * 3;
    const busy = new Set(objectsOn(state, map).map((o) => tileKey(o.tx, o.ty)));
    const free = (spots[map] ?? []).filter(([x, y]) => {
      const k = tileKey(x, y);
      if (here[k] || busy.has(k)) return false;
      return !(map === 'farm' && (state.farm.tiles[k] || state.farm.weeds[k]));
    });
    let n = 0;
    for (let i = 0; i < perDay && free.length > 0 && Object.keys(here).length < cap; i++) {
      const item = pickWeighted(state, table);
      if (!item) break;
      const [x, y] = free.splice(Math.floor(random(state) * free.length), 1)[0] as [number, number];
      here[tileKey(x, y)] = item;
      n += 1;
    }
    if (Object.keys(here).length === 0) delete state.forage[map];
    spawned[map] = n;
    if (n > 0) gameEvents.emit('forageChanged', { map });
  }
  return spawned;
}

/** Everything wilts when the season turns. */
export function clearForage(state: GameState): void {
  state.forage = {};
  for (const map of Object.keys(forage.perDay)) gameEvents.emit('forageChanged', { map });
}

export type CollectResult =
  { ok: true; item: string; qty: number; q: number } | { ok: false; reason: 'none' | 'full' };

/** Pick up the forageable at a tile. A foraging perk can double it; quality can roll up. */
export function collectForage(
  state: GameState,
  map: string,
  tx: number,
  ty: number,
): CollectResult {
  const key = tileKey(tx, ty);
  const item = state.forage[map]?.[key];
  if (!item) return { ok: false, reason: 'none' };
  if (roomFor(state, item, 1) < 1) return { ok: false, reason: 'full' };
  const qty = random(state) < perk(state, 'forageDouble') && roomFor(state, item, 2) >= 2 ? 2 : 1;
  const q = rollQuality(state, 0, 'forageQuality');
  addItem(state, q > 0 ? { item, q } : item, qty);
  delete state.forage[map]![key];
  if (Object.keys(state.forage[map]!).length === 0) delete state.forage[map];
  gameEvents.emit('forageChanged', { map });
  return { ok: true, item, qty, q };
}

export const forageValue = (item: string): number => items[item]?.sellPrice ?? 0;
