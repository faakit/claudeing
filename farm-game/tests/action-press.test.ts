import { describe, expect, it } from 'vitest';
import { ActionPress, PAINT_ARM_MS, type ActionEvent } from '../src/input/gesture';

/** Replay a press: [time, dx, dy] moves, frames every 16 ms, lift at `upAt`. Returns every event. */
function play(moves: [number, number, number][], upAt: number): ActionEvent[] {
  const p = new ActionPress(0);
  const out: ActionEvent[] = [];
  let mi = 0;
  for (let t = 0; t <= upAt; t += 4) {
    while (mi < moves.length && moves[mi]![0] <= t) {
      out.push(...p.move(moves[mi]![1], moves[mi]![2]));
      mi++;
    }
    if (t % 16 === 0) out.push(...p.update(t));
  }
  out.push(...p.up());
  return out;
}
const types = (e: ActionEvent[]) => e.map((x) => x.type);

describe('Action press: tap, swipe, flick, paint stay apart', () => {
  it('a still tap of 50-280 ms acts once', () => {
    for (const ms of [50, 120, 200, 280])
      expect(types(play([[20, 2, 1]], ms)), `${ms}`).toEqual(['tap']);
  });

  it('a touch that wandered 9 px (any direction) and did nothing else never acts', () => {
    expect(types(play([[40, 9, 0]], 150))).toEqual([]);
    expect(types(play([[40, 6, 7]], 150))).toEqual([]);
  });

  it('a vertical swipe changes tool and never acts or arms', () => {
    const e = play(
      [
        [30, 0, -6],
        [60, 0, -15],
        [400, 0, -16],
      ],
      600,
    );
    expect(types(e)).toEqual(['step']);
  });

  it('a sideways flick opens the ring and never acts, at any speed from 60 to 200 ms', () => {
    for (const ms of [60, 120, 200]) {
      const moves: [number, number, number][] = [];
      for (let t = 0; t <= ms; t += 20) moves.push([t, -(20 * t) / ms, 1]);
      const e = play(moves, ms + 400);
      expect(types(e), `${ms}`).toEqual(['ring']);
    }
  });

  it('held still 300 ms arms painting; a drag sets the line; lifting commits it', () => {
    const e = play(
      [
        [PAINT_ARM_MS + 40, 6, 0],
        [PAINT_ARM_MS + 80, 12, 1],
        [PAINT_ARM_MS + 120, 26, 2],
        [PAINT_ARM_MS + 160, 40, 3],
      ],
      PAINT_ARM_MS + 300,
    );
    expect(types(e)).toEqual(['arm', 'paint', 'paint', 'paint', 'commit']);
    expect(e.at(-1)).toEqual({ type: 'commit', dir: 'right', tiles: 4 }); // 8 px for the first, +10 px each
  });

  it('a 2-3 mm wobble across a horizontal line never switches it', () => {
    const e = play(
      [
        [PAINT_ARM_MS + 40, 20, 0],
        [PAINT_ARM_MS + 80, 30, 9],
        [PAINT_ARM_MS + 120, 34, -9],
        [PAINT_ARM_MS + 160, 40, 6],
      ],
      PAINT_ARM_MS + 300,
    );
    const paints = e.filter((x) => x.type === 'paint') as { dir: string | null }[];
    expect(paints.every((x) => x.dir === 'right')).toBe(true);
  });

  it('dragged back to the start, or never far enough, it cancels with no action', () => {
    expect(
      types(
        play(
          [
            [PAINT_ARM_MS + 40, 30, 0],
            [PAINT_ARM_MS + 100, 3, 0],
          ],
          PAINT_ARM_MS + 200,
        ),
      ).at(-1),
    ).toBe('cancel');
    expect(types(play([], PAINT_ARM_MS + 200))).toEqual(['arm', 'cancel']);
  });
});
