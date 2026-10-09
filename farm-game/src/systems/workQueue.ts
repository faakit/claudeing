/**
 * Working a painted row, pure. The row is a straight line drawn from the Action button (see ActionPress in
 * input/gesture.ts): the farmer walks to each tile in order and works it until it is done for today (on grass:
 * till, plant, water), skipping tiles with nothing left and stopping when out of energy.
 */
import type { TileCoord } from './world';

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
