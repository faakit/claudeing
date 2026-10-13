import { describe, expect, it } from 'vitest';
import { stickSteer } from '../src/input/gesture';
import type { Direction } from '../src/state/GameState';

const R = 24;
const BIAS = 1.6;

/** Feed finger offsets from the anchor (one per move) and return the direction after each. */
function run(points: [number, number][]): (Direction | null)[] {
  let cur: Direction | null = null;
  return points.map(([x, y]) => (cur = stickSteer(x, y, R, BIAS, cur).dir));
}

describe('floating stick: the anchor stays where the thumb landed (QA "travar o joystick")', () => {
  it('a push past the rim, then easing back, keeps walking the same way', () => {
    const push = Array.from({ length: 10 }, (_, i) => [0, -4 * (i + 1)] as [number, number]); // to 40 px up
    const ease = Array.from({ length: 12 }, (_, i) => [0, -40 + 2 * (i + 1)] as [number, number]); // back to 16
    expect(new Set(run([...push, ...ease]).slice(2))).toEqual(new Set(['up']));
  });

  it('a long drag that slides most of the way back still steers that way, never the reverse', () => {
    const out = run([
      [-20, 0],
      [-60, 0],
      [-40, 2],
      [-26, 4],
      [-8, 4],
    ]);
    expect(out).toEqual(['left', 'left', 'left', 'left', 'left']);
  });

  it('only coming back near the landing point stops, and crossing it reverses', () => {
    expect(
      run([
        [30, 0],
        [3, 1],
        [-12, 0],
      ]),
    ).toEqual(['right', null, 'left']);
  });

  it('a sideways roll of 2 mm while holding keeps the axis', () => {
    const roll = Array.from(
      { length: 24 },
      (_, i) => [22, 11 * Math.sin(i / 3)] as [number, number],
    );
    expect(new Set(run(roll))).toEqual(new Set(['right']));
  });

  it('the knob is held inside the rim, and a half push is the slow speed', () => {
    const far = stickSteer(0, 60, R, BIAS, null);
    expect(Math.hypot(far.knobX, far.knobY)).toBeCloseTo(R);
    expect(far.slow).toBe(false);
    expect(stickSteer(10, 0, R, BIAS, null).slow).toBe(true);
  });
});
