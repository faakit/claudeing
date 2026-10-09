import { describe, expect, it } from 'vitest';
import { createWork, nextWork, PAINT_MAX, paintRelease, paintStep } from '../src/systems/workQueue';
import type { TileCoord } from '../src/systems/world';

const t = (tx: number, ty: number): TileCoord => ({ tx, ty });
const all = () => true;

/** Paint along a list of finger tiles. */
function paint(tiles: TileCoord[], eligible: (t: TileCoord) => boolean = all) {
  let q = [tiles[0]!];
  let added = 0;
  for (const x of tiles.slice(1)) {
    const r = paintStep(q, x, eligible);
    q = r.queue;
    added += r.added;
  }
  return { q, added };
}

describe('painting a row', () => {
  it('queues each tile the finger enters, in order, once', () => {
    const { q, added } = paint([t(1, 1), t(2, 1), t(3, 1), t(3, 1), t(3, 2)]);
    expect(q).toEqual([t(1, 1), t(2, 1), t(3, 1), t(3, 2)]);
    expect(added).toBe(3);
  });

  it('fills a jump with the straight 4-way tiles between', () => {
    const { q } = paint([t(1, 1), t(4, 1)]);
    expect(q).toEqual([t(1, 1), t(2, 1), t(3, 1), t(4, 1)]);
    const d = paint([t(1, 1), t(2, 2)]).q; // diagonal: x first, then y
    expect(d).toEqual([t(1, 1), t(2, 1), t(2, 2)]);
  });

  it('stepping back onto the previous tile takes the last one off', () => {
    const { q } = paint([t(1, 1), t(2, 1), t(3, 1), t(2, 1)]);
    expect(q).toEqual([t(1, 1), t(2, 1)]);
  });

  it('skips tiles with nothing to do and stops filling at them', () => {
    const wall = (x: TileCoord) => !(x.tx === 3 && x.ty === 1);
    expect(paint([t(1, 1), t(5, 1)], wall).q).toEqual([t(1, 1), t(2, 1)]);
  });

  it('holds at most 12 tiles', () => {
    const { q } = paint([t(0, 0), t(30, 0)]);
    expect(q).toHaveLength(PAINT_MAX);
  });

  it('a serpentine over a 3x3 plot queues all 9 tiles', () => {
    const path = [
      t(9, 18),
      t(10, 18),
      t(11, 18),
      t(11, 19),
      t(10, 19),
      t(9, 19),
      t(9, 20),
      t(10, 20),
      t(11, 20),
    ];
    expect(paint(path).q).toHaveLength(9);
  });
});

describe('releasing a paint', () => {
  it('works the queue, but lifting on the dock or back on the start after a loop cancels', () => {
    const q = [t(1, 1), t(2, 1), t(2, 2), t(1, 2)];
    expect(paintRelease(q, t(1, 2), false)).toBe('work');
    expect(paintRelease(q, t(1, 2), true)).toBe('cancel');
    expect(paintRelease(q, t(1, 1), false)).toBe('cancel');
    // a long-press without a drag works its one tile
    expect(paintRelease([t(1, 1)], t(1, 1), false)).toBe('work');
  });
});

describe('working the queue', () => {
  it('skips tiles with nothing left to do and stops when blocked', () => {
    const w = createWork([t(1, 1), t(2, 1), t(3, 1)]);
    const busy = (x: TileCoord) => x.tx !== 2;
    expect(nextWork(w, busy, () => null)).toEqual({ tile: t(1, 1) });
    w.i++;
    expect(nextWork(w, busy, () => null)).toEqual({ tile: t(3, 1) });
    expect(w.skipped).toBe(1);
    expect(nextWork(w, busy, () => 'Too tired! Go to bed.')).toEqual({
      stop: 'Too tired! Go to bed.',
    });
    w.i = 3;
    expect(nextWork(w, busy, () => null)).toEqual({ stop: null });
  });
});
