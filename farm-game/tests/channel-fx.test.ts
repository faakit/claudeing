import { describe, expect, it } from 'vitest';
import {
  clodAt,
  clods,
  fillRect,
  RUN_MAX_MS,
  RUN_STEP_MS,
  runLength,
  runStart,
  runStepMs,
  runSeen,
  runSteps,
  seenCount,
  wetBeside,
} from '../src/fx/channelRun';

// The creek is the column x = 26 in these tests.
const creek = (x: number): boolean => x === 26;
const isSource = (x: number): boolean => creek(x);

/** A seeded 0..1 source. */
function rng(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

describe('the water run down a channel', () => {
  it('walks from the creek outward, each tile entered from upstream', () => {
    const reach = ['25,10', '24,10', '23,10', '23,11'];
    const steps = runSteps(reach, isSource);
    expect(steps.map((s) => [s.key, s.depth, s.from])).toEqual([
      ['25,10', 0, 'e'],
      ['24,10', 1, 'e'],
      ['23,10', 2, 'e'],
      ['23,11', 3, 'n'],
    ]);
  });

  it('walks only the reached tiles (the flow already stopped)', () => {
    expect(runSteps(['25,10', '24,10'], isSource).map((s) => s.key)).toEqual(['25,10', '24,10']);
    expect(runSteps(['24,10'], isSource)).toEqual([]); // not beside the creek, nothing upstream
  });

  it('runs as one front: a tile starts as the one upstream fills, never later than the cap', () => {
    expect(runStepMs(6)).toBe(RUN_STEP_MS);
    const long = runStepMs(63); // the weir's flow of 64 in one line
    expect(long).toBeLessThan(RUN_STEP_MS);
    expect((63 + 1) * long).toBeLessThanOrEqual(RUN_MAX_MS);
    const steps = runSteps(['25,10', '24,10', '23,10'], isSource);
    const step = runStepMs(2);
    expect(steps.map((s) => runStart(s, step))).toEqual([0, step, 2 * step]);
    expect(runLength(steps)).toBe(3 * step);
    expect(runLength([])).toBe(0);
  });

  it('fills a tile from the side the water enters, in whole pixels, with a foam edge until full', () => {
    expect(fillRect('e', 0)).toMatchObject({ w: 0, edge: null });
    const half = fillRect('e', 0.5, 16, false);
    expect(half).toMatchObject({ x: 8, y: 0, w: 8, h: 16, edge: { x: 8, w: 1, h: 16 } });
    expect(fillRect('n', 0.5, 16, false)).toMatchObject({ x: 0, y: 0, h: 8, edge: { y: 7, h: 1 } });
    expect(fillRect('w', 1)).toMatchObject({ x: 0, w: 16, edge: null });
    expect(fillRect('s', 2)).toMatchObject({ y: 0, h: 16, edge: null }); // clamped
    for (const p of [0.1, 0.33, 0.77]) {
      const r = fillRect('w', p);
      expect(Number.isInteger(r.w)).toBe(true);
    }
    // a cut eases out (ahead of linear early on); the morning front is linear
    expect(fillRect('w', 0.25).w).toBeGreaterThan(fillRect('w', 0.25, 16, false).w);
  });

  it('darkens each watered soil tile beside the first channel tile the water reaches', () => {
    const steps = runSteps(['25,10', '24,10', '23,10'], isSource);
    const beside = wetBeside(steps, ['25,11', '24,9', '24,11', '23,11', '22,10', '1,1']);
    expect(beside.get('25,10')).toEqual(['25,11']);
    expect(beside.get('24,10')?.sort()).toEqual(['24,11', '24,9']);
    expect(beside.get('23,10')?.sort()).toEqual(['22,10', '23,11']);
    expect([...beside.values()].flat()).not.toContain('1,1');
  });
});

describe('when the morning run may start (feel critic C1-1)', () => {
  // a channel from the creek at x 26 west along row 10, x 19-25
  const steps = runSteps(['25,10', '24,10', '23,10', '22,10', '21,10', '20,10', '19,10'], isSource);
  const view = (x: number) => ({ x, y: 100, width: 200, height: 200 });
  it('waits while only its downstream end peeks in at the edge', () => {
    // the view's right edge at 332 (inset 316): x 19 peeks in but is not wholly inside
    expect(seenCount(steps, view(132))).toBe(0);
    expect(runSeen(steps, view(132))).toBe(false);
  });
  it('starts once its entry and the next two tiles are inside the inset view', () => {
    expect(runSeen(steps, view(250))).toBe(true); // inset 266..434: x 17..26 inside
  });
  it('or once half of it is inside', () => {
    // inset 228..396: x 15-23, so 19-23 (5 of 7) are in but the entry (25) is not
    expect(runSeen(steps, view(212))).toBe(true);
    expect(seenCount(steps, view(212))).toBe(5);
  });
});

describe('the soil off the spade', () => {
  it('lands on both banks beside a westward cut, never forward or back along it', () => {
    for (const dir of ['left', 'right'] as const) {
      const cs = clods(dir, rng(3));
      expect(cs.length).toBeGreaterThanOrEqual(5);
      for (const c of cs) {
        expect(Math.abs(c.y1)).toBeGreaterThanOrEqual(8); // on the bank, off the cut
        expect(Math.abs(c.x1)).toBeLessThanOrEqual(7); // beside the cut, not over the next tile
      }
      // more to the spade's throwing side
      const north = cs.filter((c) => c.y1 < 0).length;
      expect(north === cs.length - north).toBe(false);
      expect(north > 0 && north < cs.length).toBe(true);
    }
  });

  it('lands left and right of a north-south cut', () => {
    const cs = clods('down', rng(5));
    expect(cs.length).toBeGreaterThan(0);
    for (const c of cs) {
      expect(Math.abs(c.x1)).toBeGreaterThanOrEqual(8);
      expect(Math.abs(c.y1)).toBeLessThanOrEqual(7);
    }
  });

  it('flies a whole-pixel arc above its line and is done when it lands', () => {
    const [c] = clods('left', rng(11));
    const mid = clodAt(c!, c!.ms / 2)!;
    expect(Number.isInteger(mid.x) && Number.isInteger(mid.y)).toBe(true);
    const line = c!.y0 + (c!.y1 - c!.y0) / 2;
    expect(mid.y).toBeLessThan(line); // up in the air
    expect(clodAt(c!, 0)).toEqual({ x: c!.x0, y: c!.y0 });
    expect(clodAt(c!, c!.ms)).toBeNull();
    for (const k of clods('right', rng(2))) expect([1, 2]).toContain(k.size);
  });
});
