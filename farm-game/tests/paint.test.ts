import { describe, expect, it } from 'vitest';
import { createWork, nextWork } from '../src/systems/workQueue';
import type { TileCoord } from '../src/systems/world';

const t = (tx: number, ty: number): TileCoord => ({ tx, ty });

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
