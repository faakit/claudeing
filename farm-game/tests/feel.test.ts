import { describe, expect, it } from 'vitest';
import {
  BAYER4,
  breathFrame,
  BREATH_AFTER_MS,
  createFollowAxis,
  DITHER_LEVELS,
  ditherCovered,
  frameRate,
  isContactFrame,
  nudgeOffset,
  popSize,
  smoothstep,
  softClamp,
  stepFollowAxis,
  tickToward,
  walkFrame,
  walkFps,
  walkPxPerFrame,
  wipeLevel,
  WIPE_CLOSE_MS,
  WIPE_OPEN_MS,
} from '../src/fx/feel';

/** Walk `frames` frames at `speed` px/s and `hz`, returning the player's on-screen x each frame. */
function walkOnScreen(speed: number, hz: number, frames: number, jitter = 0) {
  const a = createFollowAxis();
  let x = 100.3;
  const out: number[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < frames; i++) {
    const dt = (1000 / hz) * (1 + jitter * rnd());
    x += (speed * dt) / 1000;
    const lag = stepFollowAxis(a, x, dt, 0.12);
    const scroll = Math.floor(x) - lag; // the camera on the player's pixel minus the lag
    out.push(Math.floor(x) - scroll);
  }
  return out;
}

const reversals = (xs: number[]) => {
  let rev = 0;
  let last = 0;
  for (let i = 1; i < xs.length; i++) {
    const d = Math.sign(xs[i]! - xs[i - 1]!);
    if (d !== 0) {
      if (last !== 0 && d !== last) rev++;
      last = d;
    }
  }
  return rev;
};

describe('frame-rate independent smoothing', () => {
  it('closes the same share of a gap in the same real time at any rate', () => {
    const at = (hz: number) => {
      let left = 1;
      for (let t = 0; t < 500; t += 1000 / hz) left *= 1 - frameRate(0.12, 1000 / hz);
      return left;
    };
    expect(at(30)).toBeCloseTo(at(60), 2);
    expect(at(144)).toBeCloseTo(at(60), 2);
  });
  it('is 0 for no time and 1 for a full rate', () => {
    expect(frameRate(0.12, 0)).toBe(0);
    expect(frameRate(1, 16)).toBe(1);
  });
});

describe('pixel-locked camera follow', () => {
  for (const hz of [30, 60, 144])
    it(`never hops the walking player back and forth on screen (${hz} Hz, jittery frames)`, () => {
      const xs = walkOnScreen(64, hz, hz * 3, 0.25);
      expect(reversals(xs)).toBe(0);
      // and it trails by a constant whole-pixel lag once walking steadily
      const tail = xs.slice(-hz);
      expect(new Set(tail).size).toBe(1);
    });
  it('trails by the same lag at 30, 60 and 144 Hz (within a pixel)', () => {
    const lag = (hz: number) => walkOnScreen(64, hz, hz * 3).at(-1)!;
    expect(Math.abs(lag(30) - lag(60))).toBeLessThanOrEqual(1);
    expect(Math.abs(lag(144) - lag(60))).toBeLessThanOrEqual(1);
  });
  it('eases back to centre after a stop, one pixel at a time, and rests exactly centred', () => {
    const a = createFollowAxis();
    let x = 50;
    for (let i = 0; i < 120; i++) stepFollowAxis(a, (x += 64 / 60), 1000 / 60, 0.12);
    const lags: number[] = [];
    for (let i = 0; i < 120; i++) lags.push(stepFollowAxis(a, x, 1000 / 60, 0.12));
    for (let i = 1; i < lags.length; i++) expect(lags[i - 1]! - lags[i]!).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < lags.length; i++) expect(lags[i - 1]! - lags[i]!).toBeLessThanOrEqual(1);
    expect(lags.at(-1)).toBe(0);
  });
  it('rests centred whichever way the player walked (the old follow stalled 8 px short one way)', () => {
    for (const v of [64, -64]) {
      const a = createFollowAxis();
      let x = 200;
      for (let i = 0; i < 90; i++) stepFollowAxis(a, (x += v / 60), 1000 / 60, 0.12);
      let lag = 99;
      for (let i = 0; i < 120; i++) lag = stepFollowAxis(a, x, 1000 / 60, 0.12);
      expect(lag).toBe(0);
    }
  });
  it('cuts on a teleport instead of sliding across the map', () => {
    const a = createFollowAxis();
    stepFollowAxis(a, 10, 16, 0.12);
    expect(stepFollowAxis(a, 400, 16, 0.12)).toBe(0);
  });
});

describe('soft map edges', () => {
  it('never leaves the bounds and is the identity away from them', () => {
    for (let v = -200; v <= 400; v += 3) {
      const out = softClamp(v, 0, 200, 16);
      expect(out).toBeGreaterThanOrEqual(0);
      expect(out).toBeLessThanOrEqual(200);
      expect(Number.isInteger(out)).toBe(true);
      if (v >= 16 && v <= 184) expect(out).toBe(v);
    }
  });
  it('slows into the edge: monotone, steps of at most one pixel per pixel walked', () => {
    let prev = softClamp(60, 0, 200);
    for (let v = 59; v >= -80; v--) {
      const out = softClamp(v, 0, 200);
      expect(prev - out).toBeGreaterThanOrEqual(0);
      expect(prev - out).toBeLessThanOrEqual(1);
      prev = out;
    }
    expect(prev).toBe(0);
  });
  it('keeps a map smaller than the view still', () => {
    expect(softClamp(37, -20, -20)).toBe(-20);
  });
});

describe('walk cycle by distance', () => {
  it('steps a frame per 4 px with eight frames and per 8 px with four', () => {
    expect(walkPxPerFrame(8)).toBe(4);
    expect(walkPxPerFrame(4)).toBe(8);
    expect(walkFrame(0, 4, 8)).toBe(0);
    expect(walkFrame(8, 4, 8)).toBe(1);
    expect(walkFrame(31.9, 4, 8)).toBe(3);
    expect(walkFrame(32, 4, 8)).toBe(0);
    expect(walkFrame(12, 8, 4)).toBe(3);
  });
  it('runs the 8-frame walk at 16 fps at walking speed, scaled with speed between 10 and 20 fps', () => {
    expect(walkFps(64, 8)).toBe(16);
    expect(walkFps(32, 8)).toBe(10); // half speed: held at the floor, not 8
    expect(walkFps(110, 8)).toBe(20); // the settle glide: held at the ceiling
    expect(walkFps(64, 4)).toBe(8); // the 4-frame fallback keeps its old cadence
    expect(walkFps(48, 8)).toBeCloseTo(12);
  });
  it('plants a foot about once per tile at walking speed', () => {
    let phase = 0;
    let last = -1;
    let steps = 0;
    for (let t = 0; t < 2000; t += 1000 / 60) {
      phase += (walkFps(64, 8) * (1000 / 60)) / 1000;
      const f = Math.floor(phase) % 8;
      if (f !== last && isContactFrame(f, 8)) steps++;
      last = f;
    }
    expect(Math.abs(steps - 8)).toBeLessThanOrEqual(1); // 128 px in 2 s = 8 tiles
  });
});

describe('idle breathing', () => {
  it('waits, then holds in and out', () => {
    expect(breathFrame(0)).toBe(0);
    expect(breathFrame(BREATH_AFTER_MS - 1)).toBe(0);
    expect(breathFrame(BREATH_AFTER_MS + 1200)).toBe(1);
    expect(breathFrame(BREATH_AFTER_MS + 1900)).toBe(0);
  });
});

describe('dither wipe', () => {
  it('uses every Bayer value once and covers cells in order', () => {
    expect([...BAYER4].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
    const covered = (level: number) => {
      let n = 0;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (ditherCovered(x, y, level)) n++;
      return n;
    };
    for (let l = 0; l <= DITHER_LEVELS; l++) expect(covered(l)).toBe(l);
  });
  it('runs from clear to covered, monotone, easing in and out', () => {
    expect(wipeLevel(0)).toBe(0);
    expect(wipeLevel(1)).toBe(DITHER_LEVELS);
    let prev = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(wipeLevel(t)).toBeGreaterThanOrEqual(prev);
      prev = wipeLevel(t);
    }
    expect(smoothstep(0.5)).toBeCloseTo(0.5);
  });
  it('a map change stays under 300 ms of wipe (plus two held frames)', () => {
    expect(WIPE_CLOSE_MS + WIPE_OPEN_MS + 2 * (1000 / 60)).toBeLessThan(320);
    expect(WIPE_CLOSE_MS + WIPE_OPEN_MS).toBeLessThan(300);
  });
});

describe('number tickers, nudges and pops', () => {
  it('ticks toward a value without overshoot, at least one unit a frame', () => {
    let v = 0;
    let frames = 0;
    while (v !== 500 && frames < 200) {
      const next = tickToward(v, 500, 1000 / 60);
      expect(next).toBeGreaterThan(v);
      expect(next).toBeLessThanOrEqual(500);
      v = next;
      frames++;
    }
    expect(v).toBe(500);
    expect(frames).toBeLessThan(60); // about half a second
    expect(tickToward(10, 9, 16)).toBe(9);
  });
  it('a nudge is whole pixels and springs back to zero', () => {
    for (let t = 0; t < 200; t += 5) expect(Number.isInteger(nudgeOffset(t, 2))).toBe(true);
    expect(nudgeOffset(0, 2)).toBe(2);
    expect(nudgeOffset(140, 2)).toBe(0);
    expect(nudgeOffset(-1, 2)).toBe(0);
  });
  it('squash and stretch change whole pixels and settle to the true size', () => {
    for (let t = 0; t < 200; t += 10) {
      const s = popSize(t, 16, 16);
      expect(Number.isInteger(s.w) && Number.isInteger(s.h)).toBe(true);
    }
    expect(popSize(20, 16, 16).h).toBeLessThan(16);
    expect(popSize(80, 16, 16).h).toBeGreaterThan(16);
    expect(popSize(200, 16, 16)).toEqual({ w: 16, h: 16 });
  });
});
