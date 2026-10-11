/**
 * Channels (the Old Spring's verb, docs/WORLD-PLAN.md 3.1): narrow ditches dug off the farm creek. Each morning the
 * water runs breadth-first from the channels beside the creek through 4-connected channel tiles, up to `flow` tiles
 * (24; 64 once the weir raises the water table), and waters the tilled soil beside every channel it reached.
 * Channels past the flow stay dry. Pure: the map is passed in as predicates, so tests need no Phaser.
 *
 * State: a channel is a soil tile with `channel: true` (no crop, never watered itself).
 */
import type { GameState, SoilTile } from '../state/GameState';
import { t } from '../i18n';

export type Tile = readonly [number, number];
const N4: Tile[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const key = (x: number, y: number): string => `${x},${y}`;
const parse = (k: string): [number, number] => k.split(',').map(Number) as [number, number];

export const isChannel = (t: SoilTile | undefined): boolean => !!t?.channel;

/** Channel tiles, as "x,y" keys. */
export function channelKeys(state: GameState): string[] {
  return Object.entries(state.farm.tiles)
    .filter(([, t]) => t.channel)
    .map(([k]) => k);
}

/**
 * The channels the water reaches this morning, in the order it reaches them: a breadth-first walk from every channel
 * 4-adjacent to the creek (`isSource`), through 4-connected channels, stopping after `flow` tiles. Ties (two tiles
 * the same distance from the creek) go in reading order, so the walk is the same every morning.
 */
export function flowReach(
  state: GameState,
  isSource: (x: number, y: number) => boolean,
  flow: number,
): string[] {
  const chan = new Set(channelKeys(state));
  const starts = [...chan]
    .filter((k) => {
      const [x, y] = parse(k);
      return N4.some(([dx, dy]) => isSource(x + dx, y + dy));
    })
    .sort(readingOrder);
  const seen = new Set<string>();
  const out: string[] = [];
  let frontier = starts;
  for (const k of starts) seen.add(k);
  while (frontier.length > 0 && out.length < flow) {
    const next: string[] = [];
    for (const k of frontier) {
      if (out.length >= flow) break;
      out.push(k);
      const [x, y] = parse(k);
      for (const [dx, dy] of N4) {
        const n = key(x + dx, y + dy);
        if (chan.has(n) && !seen.has(n)) {
          seen.add(n);
          next.push(n);
        }
      }
    }
    frontier = next.sort(readingOrder);
  }
  return out;
}

function readingOrder(a: string, b: string): number {
  const [ax, ay] = parse(a);
  const [bx, by] = parse(b);
  return ay - by || ax - bx;
}

/**
 * The tilled tiles a morning's channels water: soil (not channels) 4-adjacent to a reached channel, at most
 * `2 x flow` of them (the balance bound: a channel field never beats sprinklers per tile; WORLD-PLAN 9.2).
 */
export function wateredByChannels(
  state: GameState,
  reach: readonly string[],
  flow: number,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of reach) {
    const [x, y] = parse(k);
    for (const [dx, dy] of N4) {
      const n = key(x + dx, y + dy);
      const t = state.farm.tiles[n];
      if (!t || t.channel || seen.has(n)) continue;
      seen.add(n);
      out.push(n);
      if (out.length >= flow * 2) return out;
    }
  }
  return out;
}

/** The morning's watering (the `pre-growth` day hook): returns how many tiles the channels watered. */
export function waterFromChannels(
  state: GameState,
  isSource: (x: number, y: number) => boolean,
  flow: number,
): number {
  const reach = flowReach(state, isSource, flow);
  const wet = wateredByChannels(state, reach, flow);
  for (const k of wet) state.farm.tiles[k]!.watered = true;
  return wet.length;
}

/** Why a channel cannot be dug here (a line in the current language). */
export type DigRefusal = string;

/**
 * Can a channel be dug on this tile? Only on open farm ground (the caller checks walkability, ownership and fixed
 * spots), not in a delta rect, not on soil, and next to the creek or an existing channel.
 */
export function canDig(
  state: GameState,
  x: number,
  y: number,
  isSource: (x: number, y: number) => boolean,
  inDelta: (x: number, y: number) => boolean,
): DigRefusal | null {
  if (inDelta(x, y)) return t('channels.creekBed');
  if (state.farm.tiles[key(x, y)]) return t('farm.somethingHere');
  const wet = N4.some(
    ([dx, dy]) => isSource(x + dx, y + dy) || isChannel(state.farm.tiles[key(x + dx, y + dy)]),
  );
  return wet ? null : t('channels.startAtWater');
}

/** Dig a channel (after `canDig`). */
export function digChannel(state: GameState, x: number, y: number): void {
  state.farm.tiles[key(x, y)] = { watered: false, crop: null, channel: true };
}

/** Fill a channel back in (the tile becomes plain ground). True if there was one. */
export function fillChannel(state: GameState, x: number, y: number): boolean {
  if (!isChannel(state.farm.tiles[key(x, y)])) return false;
  delete state.farm.tiles[key(x, y)];
  return true;
}
