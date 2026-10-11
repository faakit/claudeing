import { describe, expect, it } from 'vitest';
import {
  ActionPress,
  PAINT_ARM_MS,
  PAINT_EDGE_HOLD_MS,
  PAINT_MAX_TILES,
} from '../src/input/gesture';
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

describe('paint edge hold (coordinator ruling, valley round 6)', () => {
  /** Arm, then draw `px` left (negative) or right along x; returns the press. */
  function armed(px: number): ActionPress {
    const p = new ActionPress(0);
    p.update(PAINT_ARM_MS + 1);
    p.move(Math.sign(px) * 4, 0, PAINT_ARM_MS + 10);
    p.move(px, 0, PAINT_ARM_MS + 40);
    return p;
  }
  const tiles = (p: ActionPress) => p.path.length;

  it('resting in the edge band the row points at grows it a tile per interval, up to the limit', () => {
    const p = armed(-30); // a left-handed westward drag: room for 2 tiles before the edge
    const start = tiles(p);
    expect(start).toBeGreaterThanOrEqual(1);
    let t = 1000;
    p.hold({ x: -1, y: 0 }, t); // reaches the band: the first extra tile one interval later
    for (let k = 1; k <= 5; k++) p.hold({ x: -1, y: 0 }, (t += PAINT_EDGE_HOLD_MS));
    expect(tiles(p)).toBe(start + 5);
    for (let k = 0; k < 40; k++) p.hold({ x: -1, y: 0 }, (t += PAINT_EDGE_HOLD_MS));
    expect(tiles(p)).toBe(PAINT_MAX_TILES);
    const end = p.up();
    expect(end[0]).toMatchObject({ type: 'commit', tiles: PAINT_MAX_TILES });
  });

  it('a drift into another edge never grows the row; leaving the band takes the growth back', () => {
    const p = armed(-30);
    const start = tiles(p);
    let t = 1000;
    for (let k = 0; k < 6; k++) p.hold({ x: 1, y: 1 }, (t += PAINT_EDGE_HOLD_MS)); // the wrong edges
    expect(tiles(p)).toBe(start);
    for (let k = 0; k < 6; k++) p.hold({ x: -1, y: 0 }, (t += PAINT_EDGE_HOLD_MS));
    expect(tiles(p)).toBeGreaterThan(start);
    p.hold({ x: 0, y: 0 }, (t += 16)); // the finger comes back from the edge
    expect(tiles(p)).toBe(start);
    // and dragging all the way back to the start still cancels
    p.move(0, 0, t + 100);
    expect(p.up()).toEqual([{ type: 'cancel' }]);
  });

  it('a right-handed eastward row and a downward row grow the same way', () => {
    const r = armed(30);
    let t = 1000;
    for (let k = 0; k < 9; k++) r.hold({ x: 1, y: 0 }, (t += PAINT_EDGE_HOLD_MS));
    expect(r.path.every((d) => d === 'right')).toBe(true);
    expect(tiles(r)).toBeGreaterThanOrEqual(9);
    const d = new ActionPress(0);
    d.update(PAINT_ARM_MS + 1);
    d.move(0, 4, PAINT_ARM_MS + 10);
    d.move(0, 30, PAINT_ARM_MS + 40);
    for (let k = 0; k < 9; k++) d.hold({ x: 0, y: 1 }, (t += PAINT_EDGE_HOLD_MS));
    expect(d.path.every((x) => x === 'down')).toBe(true);
    expect(d.path.length).toBeGreaterThanOrEqual(9);
  });
});
