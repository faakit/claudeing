import { describe, expect, it } from 'vitest';
import { ActionGate } from '../src/input/actionGate';

/**
 * The world's Action loop as WorldScene runs it: the lock counts down by each frame's delta, and Action acts when
 * held, unlocked and the gate allows; every act locks for 200 ms. Each frame lists its length, whether Action is
 * held during it, which press is held (a new id per press), and whether the system reports that key as held
 * (auto-repeat).
 */
function run(frames: { ms: number; held: boolean; press: number; repeats?: boolean }[]): number {
  const gate = new ActionGate();
  let lock = 0;
  let acts = 0;
  for (const f of frames) {
    lock = Math.max(0, lock - f.ms);
    if (f.held && lock <= 0 && gate.may(f.press, f.repeats ?? false)) {
      gate.acted(f.press);
      acts++;
      lock = 200;
    }
  }
  return acts;
}

const frames = (ms: number, n: number, held: boolean, press = 1, repeats = false) =>
  Array.from({ length: n }, () => ({ ms, held, press, repeats }));

describe('one act per short Action press', () => {
  it('a short key press acts once, even when slow frames outlast the 200 ms lock while it is still seen held', () => {
    expect(run([...frames(16, 1, true), ...frames(250, 3, true), ...frames(16, 10, false)])).toBe(
      1,
    );
  });

  it('a touch tap on Action (a 70 ms pulse) never acts twice, whatever the frames', () => {
    expect(run([...frames(16, 1, true), ...frames(400, 2, true), ...frames(16, 5, false)])).toBe(1);
  });

  it('each new press acts once (two taps, after the lock: two acts)', () => {
    expect(
      run([
        ...frames(16, 4, true, 1),
        ...frames(16, 12, false, 1),
        ...frames(16, 4, true, 2),
        ...frames(16, 4, false, 2),
      ]),
    ).toBe(2);
  });

  it('a key the system reports as held repeats about every lock', () => {
    // held one second at 60 Hz; the auto-repeat begins after half a second
    const held = [...frames(1000 / 60, 30, true), ...frames(1000 / 60, 30, true, 1, true)];
    expect(run(held)).toBeGreaterThanOrEqual(3);
  });
});
