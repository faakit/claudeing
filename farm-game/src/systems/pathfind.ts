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

/**
 * A new tap while walking (owner bug: "it kinda flicks; it should just smoothly continue going"): the walk used to be
 * re-planned from the tile under the farmer's feet, which for the first half of every step is the tile he just
 * left, so the new route began by walking back to its centre (a few frames facing backwards) and then turned again.
 * A re-plan now starts from where the farmer really is: on a tile centre, that tile; between two centres, the one
 * ahead (where he is already heading) or the one behind, whichever makes the shorter walk from his exact position,
 * the one ahead winning ties and anything within `REPLAN_AHEAD_BIAS_PX`. He only turns back when the new target
 * really is behind him.
 */
export const REPLAN_AHEAD_BIAS_PX = 4;

export interface RouteStart {
  tile: TileCoord;
  /** Pixels from the farmer's position to this tile's centre. */
  dist: number;
}

/**
 * Where a re-planned walk may start, best first: the tile whose centre the farmer stands on, or, between two
 * centres, the open tile ahead along `axis`/`sign` (the way he walks), then the open tile behind. Pure.
 */
export function routeStarts(
  pos: { x: number; y: number },
  walking: { axis: 'x' | 'y' | null; sign: number },
  grid: CollisionGrid,
  hb: { h: number } = { h: 6 },
): RouteStart[] {
  const ts = grid.tileSize;
  // continuous tile coordinates of the farmer's feet, where whole numbers are tile centres
  const fx = (pos.x - ts / 2) / ts;
  const fy = (pos.y - ts / 2 - hb.h / 2) / ts;
  const offX = Math.abs(fx - Math.round(fx)) * ts;
  const offY = Math.abs(fy - Math.round(fy)) * ts;
  const near = (v: number) => v < 0.01;
  const here = { tx: Math.round(fx), ty: Math.round(fy) };
  if (near(offX) && near(offY)) return [{ tile: here, dist: 0 }];
  // the axis he is between centres on: the one he walks along, else the larger offset
  const axis: 'x' | 'y' =
    walking.axis && !near(walking.axis === 'x' ? offX : offY)
      ? walking.axis
      : offX >= offY
        ? 'x'
        : 'y';
  const along = axis === 'x' ? fx : fy;
  const cross = axis === 'x' ? offY : offX;
  const lo = Math.floor(along);
  const hi = lo + 1;
  const sign =
    walking.axis === axis && walking.sign !== 0 ? walking.sign : along - lo >= 0.5 ? 1 : -1;
  const out: RouteStart[] = [];
  for (const c of sign > 0 ? [hi, lo] : [lo, hi]) {
    const tile = axis === 'x' ? { tx: c, ty: here.ty } : { tx: here.tx, ty: c };
    if (isTileBlocked(grid, tile.tx, tile.ty)) continue;
    out.push({ tile, dist: Math.abs(along - c) * ts + cross });
  }
  if (!out.length) out.push({ tile: here, dist: offX + offY });
  return out;
}

/**
 * Plan a walk from each start (`plan` returns a path that begins at the start it was given, or null) and keep the
 * shortest from the farmer's exact position: the distance to the start plus the path's steps. Starts after the
 * first pay `REPLAN_AHEAD_BIAS_PX`, so the walk keeps going the way it was unless turning back is clearly shorter.
 * Pure.
 */
export function replanFrom<T extends { path: TileCoord[] }>(
  starts: readonly RouteStart[],
  plan: (from: TileCoord) => T | null,
  tileSize: number,
): T | null {
  let best: T | null = null;
  let bestCost = Infinity;
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!;
    const r = plan(s.tile);
    if (!r) continue;
    const cost = s.dist + (r.path.length - 1) * tileSize + (i > 0 ? REPLAN_AHEAD_BIAS_PX : 0);
    if (cost < bestCost) {
      best = r;
      bestCost = cost;
    }
  }
  return best;
}
