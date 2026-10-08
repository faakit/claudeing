import { mining, nodes } from '../data';
import type { NodeDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { tileKey } from './farming';
import { addItem, roomFor } from './inventory';
import { random } from './rng';
import { levelOf, perk } from './skills';

export const nodeAt = (state: GameState, map: string, tx: number, ty: number): string | undefined =>
  state.nodes[map]?.[tileKey(tx, ty)];

export const nodeCount = (state: GameState, map: string): number =>
  Object.keys(state.nodes[map] ?? {}).length;

/** Tiles blocked by ore nodes on a map (the world scene adds them to its collision grid). */
export function nodeTiles(state: GameState, map: string): [number, number][] {
  return Object.keys(state.nodes[map] ?? {}).map(
    (k) => k.split(',').map(Number) as [number, number],
  );
}

/** Node kinds that can spawn at the player's mining level. */
export function spawnable(state: GameState): [string, NodeDef][] {
  const lvl = levelOf(state, 'mining');
  return Object.entries(nodes).filter(([, n]) => (n.minLevel ?? 1) <= lvl);
}

function pickWeighted<T>(state: GameState, list: { w: number; v: T }[]): T | null {
  const total = list.reduce((n, e) => n + e.w, 0);
  if (total <= 0) return null;
  let r = random(state) * total;
  for (const e of list) {
    r -= e.w;
    if (r < 0) return e.v;
  }
  return list[list.length - 1]?.v ?? null;
}

/** Morning: new ore appears in the mine's open floor, up to a cap; existing nodes stay until broken. */
export function spawnNodes(
  state: GameState,
  spots: Readonly<Record<string, readonly [number, number][]>>,
): Record<string, number> {
  const out: Record<string, number> = {};
  const kinds = spawnable(state).map(([id, n]) => ({ w: n.weight, v: id }));
  for (const map of mining.maps) {
    const here = (state.nodes[map] ??= {});
    const free = (spots[map] ?? []).filter(([x, y]) => !here[tileKey(x, y)]);
    let n = 0;
    for (
      let i = 0;
      i < mining.perDay && free.length > 0 && Object.keys(here).length < mining.cap;
      i++
    ) {
      const kind = pickWeighted(state, kinds);
      if (!kind) break;
      const [x, y] = free.splice(Math.floor(random(state) * free.length), 1)[0] as [number, number];
      here[tileKey(x, y)] = kind;
      n += 1;
    }
    if (Object.keys(here).length === 0) delete state.nodes[map];
    out[map] = n;
    if (n > 0) gameEvents.emit('nodesChanged', { map });
  }
  return out;
}

export type MineResult =
  | { ok: true; node: string; item: string; qty: number; xp: number }
  | { ok: false; reason: 'none' | 'full' };

/** Break the node on a tile and take what it drops; a mining perk can double the haul. */
export function mineNode(state: GameState, map: string, tx: number, ty: number): MineResult {
  const key = tileKey(tx, ty);
  const id = state.nodes[map]?.[key];
  const def = id ? nodes[id] : undefined;
  if (!id || !def) return { ok: false, reason: 'none' };
  const drop = pickWeighted(
    state,
    def.drops.map((d) => ({ w: d.weight, v: d })),
  );
  if (!drop) return { ok: false, reason: 'none' };
  const [lo, hi] = drop.qty;
  let qty = lo + Math.floor(random(state) * (hi - lo + 1));
  if (random(state) < perk(state, 'mineDouble')) qty *= 2;
  if (roomFor(state, drop.item, qty) < qty) {
    qty = roomFor(state, drop.item, qty);
    if (qty < 1) return { ok: false, reason: 'full' };
  }
  addItem(state, drop.item, qty);
  delete state.nodes[map]![key];
  if (Object.keys(state.nodes[map]!).length === 0) delete state.nodes[map];
  gameEvents.emit('nodesChanged', { map });
  return { ok: true, node: id, item: drop.item, qty, xp: def.xp };
}
