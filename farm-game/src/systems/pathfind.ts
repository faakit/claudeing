/**
 * Tap-to-move pathfinding, pure (no Phaser): breadth-first search on the collision grid, 4-way like the
 * player walks. Breadth-first is exact for a uniform grid and cheap here: the biggest map is a few thousand
 * tiles, well under a millisecond.
 */
import type { Direction } from '../state/GameState';
import { isTileBlocked, type CollisionGrid } from './movement';
import { adjacentDirection, type TileCoord } from './world';

export interface PathOptions {
  /** Tiles that may only be the destination, never walked through (doors). */
  avoid?: (tx: number, ty: number) => boolean;
  /** Give up after visiting this many tiles. */
  maxNodes?: number;
}

const STEPS: readonly [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * Shortest 4-way path from `from` to the nearest of `goals` (inclusive of both ends), or null when none is
 * reachable. Goal tiles must be open; `from` may be anything (the player can stand half in a doorway).
 */
export function findPath(
  grid: CollisionGrid,
  from: TileCoord,
  goals: readonly TileCoord[],
  opts: PathOptions = {},
): TileCoord[] | null {
  const w = grid.width;
  const key = (tx: number, ty: number) => ty * w + tx;
  const goalSet = new Set(
    goals.filter((g) => !isTileBlocked(grid, g.tx, g.ty)).map((g) => key(g.tx, g.ty)),
  );
  if (goalSet.size === 0) return null;
  const prev = new Map<number, number>([[key(from.tx, from.ty), -1]]);
  const queue: number[] = [key(from.tx, from.ty)];
  const max = opts.maxNodes ?? 20000;
  let found = -1;
  for (let head = 0; head < queue.length && head < max; head++) {
    const k = queue[head]!;
    if (goalSet.has(k)) {
      found = k;
      break;
    }
    const tx = k % w;
    const ty = (k - tx) / w;
    for (const [dx, dy] of STEPS) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (isTileBlocked(grid, nx, ny)) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      if (opts.avoid?.(nx, ny) && !goalSet.has(nk)) continue;
      prev.set(nk, k);
      queue.push(nk);
    }
  }
  if (found < 0) return null;
  const path: TileCoord[] = [];
  for (let k = found; k !== -1; k = prev.get(k)!) path.push({ tx: k % w, ty: Math.floor(k / w) });
  return path.reverse();
}

/** The 4 tiles from which the player can face `target`. */
export const standTiles = (target: TileCoord): TileCoord[] =>
  STEPS.map(([dx, dy]) => ({ tx: target.tx - dx, ty: target.ty - dy }));

/**
 * A walk that ends next to `target`, facing it: the shortest path to any open neighbour. Null when the
 * target cannot be reached from any side.
 */
export function pathToFace(
  grid: CollisionGrid,
  from: TileCoord,
  target: TileCoord,
  opts: PathOptions = {},
): { path: TileCoord[]; face: Direction } | null {
  const path = findPath(grid, from, standTiles(target), opts);
  if (!path) return null;
  const stand = path[path.length - 1]!;
  return { path, face: adjacentDirection(stand, target)! };
}

/**
 * A walk that ends next to any tile of a multi-tile target (a bed, a counter), facing it: the shortest path to
 * an open neighbour of any of its tiles. Returns the tile faced too. Null when no side can be reached.
 */
export function pathToFaceAny(
  grid: CollisionGrid,
  from: TileCoord,
  targets: readonly TileCoord[],
  opts: PathOptions = {},
): { path: TileCoord[]; face: Direction; target: TileCoord } | null {
  const inTarget = (t: TileCoord) => targets.some((g) => g.tx === t.tx && g.ty === t.ty);
  const stands = targets.flatMap(standTiles).filter((t) => !inTarget(t));
  const path = findPath(grid, from, stands, opts);
  if (!path) return null;
  const stand = path[path.length - 1]!;
  // face the target tile next to where the walk ends (the first, in the targets' order)
  const target = targets.find((g) => adjacentDirection(stand, g) !== null)!;
  return { path, face: adjacentDirection(stand, target)!, target };
}
