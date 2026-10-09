/**
 * Paint a row (Hay Day style), pure: a long-press arms painting on a tile Action can work, then every tile the
 * finger enters joins the queue (4-connected, at most 12, only tiles with something to do). Dragging back onto
 * the previous tile takes the last one off. On release the farmer works the tiles in the order painted.
 */
import type { TileCoord } from './world';

export const PAINT_MAX = 12;

const same = (a: TileCoord, b: TileCoord) => a.tx === b.tx && a.ty === b.ty;

/**
 * Add the tile under the finger to a painted queue (returns a new array). A diagonal or skipped jump is filled
 * with the straight 4-way tiles between (x first, then y); filling stops at the first tile with nothing to do.
 * Stepping back onto the second-to-last tile un-queues the last; any other tile already queued is ignored.
 * Returns the queue and how many tiles were added (for one tick per tile).
 */
export function paintStep(
  queue: readonly TileCoord[],
  tile: TileCoord,
  eligible: (t: TileCoord) => boolean,
  max = PAINT_MAX,
): { queue: TileCoord[]; added: number; removed: number } {
  const q = [...queue];
  const last = q[q.length - 1];
  if (!last || same(last, tile)) return { queue: q, added: 0, removed: 0 };
  const prev = q[q.length - 2];
  if (prev && same(prev, tile)) {
    q.pop();
    return { queue: q, added: 0, removed: 1 };
  }
  let added = 0;
  let cur = last;
  while (!same(cur, tile) && q.length < max) {
    const dx = Math.sign(tile.tx - cur.tx);
    const dy = Math.sign(tile.ty - cur.ty);
    const next = dx !== 0 ? { tx: cur.tx + dx, ty: cur.ty } : { tx: cur.tx, ty: cur.ty + dy };
    if (q.some((t) => same(t, next))) {
      cur = next; // pass over a tile already queued without adding it again
      continue;
    }
    if (!eligible(next)) break;
    q.push(next);
    added++;
    cur = next;
  }
  return { queue: q, added, removed: 0 };
}

/** How a paint ends: work the queue, or cancel (lifted on the dock, or looped back to where it started). */
export function paintRelease(
  queue: readonly TileCoord[],
  liftedOn: TileCoord | null,
  onDock: boolean,
): 'work' | 'cancel' {
  if (onDock || queue.length === 0) return 'cancel';
  const first = queue[0]!;
  if (queue.length > 1 && liftedOn && same(liftedOn, first)) return 'cancel';
  return 'work';
}

/** A painted queue being worked, tile by tile (runtime only, dropped on save or map change). */
export interface WorkQueue {
  tiles: TileCoord[];
  /** Next tile to work. */
  i: number;
  done: number;
  skipped: number;
  /** Extra uses on the current tile so far (a tile is worked until it is done for today). */
  tileUses: number;
}

export const createWork = (tiles: TileCoord[]): WorkQueue => ({
  tiles,
  i: 0,
  done: 0,
  skipped: 0,
  tileUses: 0,
});

/**
 * The next tile to work: skips tiles that no longer have anything to do (`canWork` false) and reports why the
 * queue stops, if it must (out of energy, water or seeds: `blocker` returns a message).
 */
export function nextWork(
  w: WorkQueue,
  canWork: (t: TileCoord) => boolean,
  blocker: () => string | null,
): { tile: TileCoord } | { stop: string | null } {
  const why = blocker();
  if (why) return { stop: why };
  while (w.i < w.tiles.length) {
    const t = w.tiles[w.i]!;
    if (canWork(t)) return { tile: t };
    w.skipped++;
    w.i++;
  }
  return { stop: null };
}
