import { describe, expect, it } from 'vitest';
import { StickSteer } from '../src/input/gesture';
import type { Direction } from '../src/state/GameState';

const R = 24;
const BIAS = 1.6;
type Pt = [number, number];

/** Points along `fn(f)` for f in (0, 1], `n` of them (a finger's moves). */
const seg = (n: number, fn: (f: number) => Pt): Pt[] =>
  Array.from({ length: n }, (_, i) => fn((i + 1) / n));

/** Feed one touch's moves (offsets from where it landed); the direction after each. */
function run(points: Pt[]): (Direction | null)[] {
  const s = new StickSteer(R, BIAS);
  return points.map(([x, y]) => s.move(x, y).dir);
}

/** Finger travel (px) from the start of `intent` until the stick first says `want`; null if it never does. */
function travelTo(setup: Pt[], intent: Pt[], want: Direction): number | null {
  const dirs = run([...setup, ...intent]);
  const i = dirs.slice(setup.length).findIndex((d) => d === want);
  if (i < 0) return null;
  const a = setup[setup.length - 1]!;
  const b = intent[i]!;
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Every move after the stick first says `want` keeps saying it. */
const steady = (points: Pt[], want: Direction): boolean => {
  const dirs = run(points);
  return dirs.slice(dirs.indexOf(want)).every((d) => d === want) && dirs.includes(want);
};

describe('floating stick: easing back never stops the walk (QA "travar o joystick")', () => {
  it('a push past the rim, then easing back 24 px, keeps walking the same way', () => {
    expect(
      steady([...seg(10, (f) => [0, -40 * f]), ...seg(12, (f) => [0, -40 + 24 * f])], 'up'),
    ).toBe(true);
    expect(
      steady([...seg(15, (f) => [-60 * f, 0]), ...seg(12, (f) => [-60 + 24 * f, 4 * f])], 'left'),
    ).toBe(true);
  });

  it('a sideways roll of 2 mm and a thumb arc while holding keep the axis', () => {
    expect(
      steady(
        [...seg(6, (f) => [22 * f, 0]), ...seg(48, (f) => [22, 11 * Math.sin(f * Math.PI * 4)])],
        'right',
      ),
    ).toBe(true);
    expect(
      steady([...seg(8, (f) => [0, 28 * f]), ...seg(40, (f) => [16 * f, 28 - 6 * f])], 'down'),
    ).toBe(true);
  });

  it('only coming back near the landing point after a light push stops, and crossing it reverses', () => {
    expect(
      run([
        [20, 0],
        [3, 1],
        [-12, 0],
      ]),
    ).toEqual(['right', null, 'left']);
  });
});

describe('floating stick: turning does not depend on push depth (critic review C2-1)', () => {
  // the critic's bars, from the base game's numbers: a 90-degree turn within about 32 px of slide, a reverse within 35
  it('after a 50 px push, a sideways slide turns within 32 px', () => {
    const d = travelTo(
      seg(12, (f) => [0, -50 * f]),
      seg(60, (f) => [-60 * f, -50]),
      'left',
    );
    expect(d).not.toBeNull();
    expect(d!).toBeLessThanOrEqual(32);
  });

  it('after a 22 px push, the same slide turns as soon (within 32 px)', () => {
    const d = travelTo(
      seg(8, (f) => [0, -22 * f]),
      seg(45, (f) => [-45 * f, -22]),
      'left',
    );
    expect(d!).toBeLessThanOrEqual(32);
  });

  it('an arc from right round to down turns within 32 px', () => {
    const d = travelTo(
      seg(10, (f) => [35 * f, 0]),
      seg(50, (f) => [35 - 20 * f, 45 * f]),
      'down',
    );
    expect(d!).toBeLessThanOrEqual(32);
  });

  it('after a 40 px push, coming back reverses within 35 px', () => {
    const d = travelTo(
      seg(10, (f) => [0, -40 * f]),
      seg(70, (f) => [0, -40 + 70 * f]),
      'down',
    );
    expect(d!).toBeLessThanOrEqual(35);
  });

  it('after a firm push, a reverse goes straight over without stopping on the way', () => {
    const dirs = run([...seg(10, (f) => [0, -40 * f]), ...seg(70, (f) => [0, -40 + 70 * f])]);
    const i = dirs.indexOf('up');
    expect(dirs.slice(i).every((d) => d === 'up' || d === 'down')).toBe(true);
    expect(dirs.at(-1)).toBe('down');
  });

  it('a turned walk is steady on its new axis though the old push is still held', () => {
    const pts = [
      ...seg(12, (f) => [0, -50 * f]),
      ...seg(40, (f) => [-40 * f, -50]),
      ...seg(30, () => [-40, -50]),
    ];
    const dirs = run(pts);
    expect(dirs.slice(dirs.indexOf('left'))).toEqual(
      dirs.slice(dirs.indexOf('left')).map(() => 'left'),
    );
  });

  it('the knob is held inside the rim, and a half push is the slow speed', () => {
    const s = new StickSteer(R, BIAS);
    const far = s.move(0, 60);
    expect(Math.hypot(far.knobX, far.knobY)).toBeCloseTo(R);
    expect(far.slow).toBe(false);
    expect(new StickSteer(R, BIAS).move(10, 0).slow).toBe(true);
  });
});
