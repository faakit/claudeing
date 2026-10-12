/**
 * Drift timber in the town river (the Weir's verb, docs/MILESTONES.md M7, WORLD-PLAN 3.3). Pure, no Phaser.
 *
 * Each morning with the river back, 1-2 logs arrive (one in winter), about one in three long, each in one of the
 * three lanes (`valley.json` `weir.drift.lanes`) picked by a day hash and never the lane of the log before it. At most
 * `maxWaiting` wait; more are not sent (nothing is lost by a day away: the waiting ones stay). Only the queue is
 * saved, in stats (`drift.0`..`drift.<max-1>`: 0 empty, else 1 + lane index x 2 + long); positions are not saved, so
 * a log enters at its lane's north edge whenever the town is built, and a save made while towing brings it back
 * there. A landed log leaves the queue and gives its timber (1 short, 3 long: systems/towing TIMBER).
 */
import { valley, type DriftDef } from '../data';
import type { GameState, Season } from '../state/GameState';
import { addItem, roomFor } from './inventory';
import { absoluteDay } from './time';
import { TIMBER, type TowWorld } from './towing';
import { riverBack } from './valley';

export const TIMBER_ITEM = 'timber';
export const HOOK_ITEM = 'timber_hook';
/** The lane of the last log that arrived (1 + its index; 0 none yet). */
export const LAST_LANE = 'drift.lastLane';
const slotKey = (i: number): string => `drift.${i}`;

export const driftDef = (): DriftDef | null => valley.weir?.drift ?? null;
export const laneIds = (): string[] => Object.keys(driftDef()?.lanes ?? {});

/** A small integer hash of a day and an index (deterministic, so a scenario and a test see the same lanes). */
export function dayHash(day: number, k: number): number {
  let h = (Math.imul(day + 1, 0x9e3779b1) ^ Math.imul(k + 7, 0x85ebca6b)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  return h >>> 0;
}

/** Logs that arrive on this absolute day in this season. */
export function arrivalsOn(day: number, season: Season): number {
  const d = driftDef();
  if (!d) return 0;
  if (season === 'winter') return d.winterPerDay;
  const [lo, hi] = d.perDay;
  return lo + (dayHash(day, 99) % (hi - lo + 1));
}

/** The lane (an index) of log `k` arriving on `day`: by the day hash, never `prev` (the lane before it). */
export function pickLane(day: number, k: number, prev: number | null): number {
  const n = laneIds().length;
  if (n === 0) return 0;
  if (prev === null || prev < 0 || prev >= n) return dayHash(day, k) % n;
  // one of the other lanes
  return (prev + 1 + (dayHash(day, k) % (n - 1))) % n;
}

/** Is log `k` of `day` long? About one in `longOneIn`. */
export const isLong = (day: number, k: number): boolean =>
  dayHash(day, k + 50) % (driftDef()?.longOneIn ?? 3) === 0;

export interface DriftLog {
  /** Its place in the queue (stat `drift.<slot>`). */
  slot: number;
  lane: string;
  long: boolean;
}

const decode = (slot: number, code: number): DriftLog | null => {
  const ids = laneIds();
  const lane = ids[Math.floor((code - 1) / 2)];
  return lane ? { slot, lane, long: (code - 1) % 2 === 1 } : null;
};

/** The logs waiting in the river, oldest first. */
export function waitingLogs(state: Pick<GameState, 'stats'>): DriftLog[] {
  const d = driftDef();
  if (!d) return [];
  const out: DriftLog[] = [];
  for (let i = 0; i < d.maxWaiting; i++) {
    const code = state.stats[slotKey(i)] ?? 0;
    const log = code > 0 ? decode(i, code) : null;
    if (log) out.push(log);
  }
  return out;
}

/** Drift speed today, px/s (half in winter: ice rims the banks). */
export function driftSpeed(state: Pick<GameState, 'time'>): number {
  const d = driftDef();
  if (!d) return 0;
  return state.time.season === 'winter' ? d.winterSpeed : d.speed;
}

/**
 * The morning's drift: with the river back, today's logs join the queue (up to `maxWaiting`; the rest are not sent).
 * Each takes a lane other than the log before it. Returns the logs added.
 */
export function spawnDrift(state: GameState): DriftLog[] {
  const d = driftDef();
  if (!d || !riverBack(state)) return [];
  const day = absoluteDay(state);
  const ids = laneIds();
  const added: DriftLog[] = [];
  const n = arrivalsOn(day, state.time.season);
  for (let k = 0; k < n; k++) {
    let free = -1;
    for (let i = 0; i < d.maxWaiting && free < 0; i++)
      if (!(state.stats[slotKey(i)] ?? 0)) free = i;
    if (free < 0) break; // the river already holds as many as wait
    const last = state.stats[LAST_LANE] ?? 0;
    const lane = pickLane(day, k, last > 0 ? last - 1 : null);
    const long = isLong(day, k);
    state.stats[slotKey(free)] = 1 + lane * 2 + (long ? 1 : 0);
    state.stats[LAST_LANE] = lane + 1;
    added.push({ slot: free, lane: ids[lane]!, long });
  }
  return added;
}

export type LandRefusal = 'none' | 'bag';

/**
 * A log landed at the slip: its timber goes in the bag and it leaves the queue. Refused (nothing changes) when the
 * slot holds no log or the bag has no room for all of its timber.
 */
export function landLog(
  state: GameState,
  slot: number,
): { ok: true; timber: number; log: DriftLog } | { ok: false; reason: LandRefusal } {
  const code = state.stats[slotKey(slot)] ?? 0;
  const log = code > 0 ? decode(slot, code) : null;
  if (!log) return { ok: false, reason: 'none' };
  const timber = log.long ? TIMBER.long : TIMBER.short;
  if (roomFor(state, TIMBER_ITEM, timber) < timber) return { ok: false, reason: 'bag' };
  addItem(state, TIMBER_ITEM, timber);
  delete state.stats[slotKey(slot)];
  state.stats['towed'] = (state.stats['towed'] ?? 0) + 1;
  state.stats['timberLanded'] = (state.stats['timberLanded'] ?? 0) + timber;
  return { ok: true, timber, log };
}

/** Sanitize: drop queue entries that name no lane (a lane renamed or removed). Mutates and returns `stats`. */
export function driftDefaults(stats: Record<string, number>): Record<string, number> {
  const d = driftDef();
  if (!d) return stats;
  const max = laneIds().length * 2;
  for (let i = 0; i < d.maxWaiting; i++) {
    const c = stats[slotKey(i)];
    if (c !== undefined && !(Number.isInteger(c) && c >= 1 && c <= max)) delete stats[slotKey(i)];
  }
  // slots past the cap (a cap lowered) are dropped too
  for (const k of Object.keys(stats))
    if (/^drift\.\d+$/.test(k) && Number(k.slice(6)) >= d.maxWaiting) delete stats[k];
  return stats;
}

// ---- the river, as the towing rules see it (pure; src/game/weirTow.ts builds the scene's course from these) ----

const TILE_PX = 16;
const inRect = ([x, y, w, h]: readonly number[], tx: number, ty: number): boolean =>
  tx >= x! && tx < x! + w! && ty >= y! && ty < y! + h!;

/** Tile coords (the log's centre; .5 for half a tile) to world px. */
export const lanePx = ([x, y]: readonly [number, number]): [number, number] => [
  x * TILE_PX + TILE_PX / 2,
  y * TILE_PX + TILE_PX / 2,
];

/** The river's water a log may float on (the river minus the mill wheel and the Heron), and its snags. */
export function riverWorld(d: DriftDef): TowWorld {
  const snags = new Set(d.snags.map(([x, y]) => `${x},${y}`));
  return {
    water: (tx, ty) => inRect(d.river, tx, ty) && !d.blocks.some((b) => inRect(b, tx, ty)),
    snag: (tx, ty) => snags.has(`${tx},${ty}`),
  };
}

/** A lane's waypoints for a short or a long log, in world px (where it enters first). */
export function lanePath(d: DriftDef, lane: string, long: boolean): [number, number][] {
  const l = d.lanes[lane];
  return l ? (long ? l.long : l.path).map(lanePx) : [];
}

/**
 * Where a lane's log comes to rest (world px): caught on its rock for a lane that `waits` there (the middle lane on the
 * first spur), else at the end of its path.
 */
export function laneRest(
  d: DriftDef,
  lane: string,
  long: boolean,
): { x: number; y: number } | null {
  const l = d.lanes[lane];
  if (!l) return null;
  if (l.snag && l.waits) {
    const hy = long ? 15 : 7; // half a log's length along a north-south lane (systems/towing halfExtents)
    return { x: l.snag[0] * TILE_PX + TILE_PX / 2, y: l.snag[1] * TILE_PX - hy - 1 };
  }
  const p = lanePath(d, lane, long);
  const last = p[p.length - 1];
  return last ? { x: last[0], y: last[1] } : null;
}
