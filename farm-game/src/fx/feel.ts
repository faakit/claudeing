/**
 * Pure timing and easing for game feel: the pixel-locked camera follow, the walk cycle driven by distance, the
 * screen wipe's dither levels, number tickers, nudges and squash steps. No Phaser here, so every rule is unit
 * tested (tests/feel.test.ts). Anything that moves pixel art moves it in whole pixels.
 */

/** Frames of 60 Hz in `dtMs` (the unit the per-frame rates below were tuned in). */
const FRAME_60 = 1000 / 60;

/**
 * A per-frame smoothing rate (tuned at 60 Hz) for a frame of `dtMs`, so smoothing takes the same real time at
 * 30, 60, 120 or 144 Hz. `rate` 0.12 closes 12% of the gap per 60 Hz frame.
 */
export function frameRate(rate: number, dtMs: number): number {
  if (rate >= 1) return 1;
  if (rate <= 0 || dtMs <= 0) return 0;
  return 1 - Math.pow(1 - rate, dtMs / FRAME_60);
}

/**
 * One axis of the pixel-locked camera follow.
 *
 * The usual "lerp the camera toward the player" makes the player shimmer: the player's pixel and the camera's
 * pixel round at different moments, so the player hops 1 px back and forth on screen while walking (Phaser also
 * floors the lerped scroll each frame, which stalls the lerp up to 8 px short in one direction). Here the camera
 * is the player's own pixel minus a smoothed lag, and only the lag is eased: while walking steadily the lag is
 * constant, so the player stays on one screen pixel and the world scrolls in exactly the player's pixel steps.
 * When the player stops, the lag eases to zero one whole pixel at a time. A hysteresis band keeps frame-time
 * noise from flipping the shown lag between two pixels.
 */
export interface FollowAxis {
  /** Smoothed distance the camera trails the player (px, float). */
  lag: number;
  /** The whole-pixel lag the camera shows. */
  shown: number;
  /** The player's position last frame (float), or null before the first frame. */
  last: number | null;
}

export const createFollowAxis = (): FollowAxis => ({ lag: 0, shown: 0, last: null });

/** A jump this large in one frame is a teleport (a door, a respawn): the camera cuts instead of easing. */
export const FOLLOW_CUT_PX = 48;
/** The lag's catch-up rate (per 60 Hz frame) while the followed point stands still. */
export const FOLLOW_STILL_RATE = 0.2;
/** How far the smoothed lag may drift from the shown pixel before the shown pixel moves. */
export const FOLLOW_HYSTERESIS = 0.75;

/** Advance one axis by a frame; returns the whole-pixel lag to subtract from the player's pixel. */
export function stepFollowAxis(a: FollowAxis, pos: number, dtMs: number, rate: number): number {
  if (a.last === null || Math.abs(pos - a.last) > FOLLOW_CUT_PX) {
    a.lag = 0;
    a.shown = 0;
    a.last = pos;
    return 0;
  }
  const moved = pos !== a.last;
  a.lag += pos - a.last;
  a.last = pos;
  // Standing still, the camera catches up faster (and without the hysteresis, a pixel a frame at most), so it
  // finishes centring in about a fifth of a second instead of creeping the last pixels for half a second.
  a.lag *= 1 - frameRate(moved ? rate : FOLLOW_STILL_RATE, Math.min(dtMs, 50));
  if (moved) {
    if (Math.abs(a.lag - a.shown) > FOLLOW_HYSTERESIS) a.shown = Math.round(a.lag) || 0; // never -0
  } else {
    const want = Math.round(a.lag) || 0;
    if (want !== a.shown) a.shown += Math.sign(want - a.shown);
  }
  return a.shown;
}

/**
 * Clamp a camera scroll to [min, max] with a soft knee: within `knee` px of an edge the camera slows to a stop
 * instead of hitting the bound at full speed. Never returns a value outside the bounds. Rounded to whole pixels.
 */
export function softClamp(v: number, min: number, max: number, knee = 16): number {
  if (max <= min) return Math.round(min);
  const k = Math.min(knee, (max - min) / 2);
  if (k <= 0) return Math.round(Math.max(min, Math.min(max, v)));
  let out = v;
  if (v - min < k) out = min + k * Math.exp((v - min - k) / k);
  else if (max - v < k) out = max - k * Math.exp((max - v - k) / k);
  return Math.max(min, Math.min(max, Math.round(out)));
}

/**
 * The walk cycle by distance walked, not by clock, so the feet never slide: one frame per `pxPerFrame` px.
 * Returns the frame index for `dist` px walked in this cycle.
 */
export const walkFrame = (dist: number, frames: number, pxPerFrame: number): number =>
  ((Math.floor(dist / pxPerFrame) % frames) + frames) % frames;

/** Px walked per walk frame: an 8-frame cycle steps every 4 px, the 4-frame fallback every 8 px. */
export const walkPxPerFrame = (frames: number): number => (frames >= 8 ? 4 : 8);

/**
 * Walk cycle rate (art critic, round 4): 16 fps for the 8-frame cycle at walking speed (64 px/s), scaled with the
 * speed actually walked and held between 10 and 20 fps (8 fps, 5-10, for the 4-frame fallback). Fully planted
 * feet would need about 37 fps, too busy for a cozy walk; this keeps the slide small at every speed.
 */
export function walkFps(pxPerSec: number, frames: number, walkSpeed = 64): number {
  const base = frames >= 8 ? 16 : 8;
  return Math.max(base * 0.625, Math.min(base * 1.25, (base * pxPerSec) / walkSpeed));
}

/** The frames a foot plants on (footstep sounds): 0 and 4 of eight, 1 and 3 of four. */
export const isContactFrame = (frame: number, frames: number): boolean =>
  frames >= 8 ? frame % 4 === 0 : frame % 2 === 1;

/** Idle breathing: after `BREATH_AFTER_MS` still, hold frame 0 for 1100 ms and frame 1 for 700 ms. */
export const BREATH_AFTER_MS = 1500;
export const BREATH_IN_MS = 1100;
export const BREATH_OUT_MS = 700;
export function breathFrame(stillMs: number): 0 | 1 {
  if (stillMs < BREATH_AFTER_MS) return 0;
  const t = (stillMs - BREATH_AFTER_MS) % (BREATH_IN_MS + BREATH_OUT_MS);
  return t < BREATH_IN_MS ? 0 : 1;
}

/** Levels of the 4x4 ordered-dither wipe: 0 = clear, 16 = fully covered. */
export const DITHER_LEVELS = 16;
/** The 4x4 Bayer matrix: a cell is covered at level L when its value is below L. */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

/** Is cell (x, y) of the 4x4 pattern covered at `level`? */
export const ditherCovered = (x: number, y: number, level: number): boolean =>
  BAYER4[(y & 3) * 4 + (x & 3)]! < level;

/** Ease-in-out on 0..1 (smoothstep): the wipe starts and ends gently. */
export const smoothstep = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

/** The dither level for a wipe `t` (0..1) through its run. */
export const wipeLevel = (t: number): number => Math.round(smoothstep(t) * DITHER_LEVELS);

/** Map-change timing: the wipe closes, holds while the next map is built, then opens. */
export const WIPE_CLOSE_MS = 130;
export const WIPE_OPEN_MS = 140;
/** Frames the wipe stays closed after the new map's first frame, so its build hitch is never seen. */
export const WIPE_HOLD_FRAMES = 1;
/** The longest frame step the wipe takes, so a hitch cannot make it skip (ms). */
export const WIPE_MAX_STEP_MS = 1000 / 30;

/**
 * A number shown on screen ticks toward its real value instead of jumping: fast for big changes, at least one
 * unit per frame, never overshooting. Frame-rate independent.
 */
export function tickToward(shown: number, target: number, dtMs: number, rate = 0.18): number {
  if (shown === target) return target;
  const diff = target - shown;
  const step = Math.max(1, Math.round(Math.abs(diff) * frameRate(rate, dtMs)));
  return Math.abs(diff) <= step ? target : shown + Math.sign(diff) * step;
}

/** The same for a bar's fill ratio (0..1), in whole pixels of a bar `px` long. */
export function tickBar(shownPx: number, targetPx: number, dtMs: number): number {
  return tickToward(Math.round(shownPx), Math.round(targetPx), dtMs, 0.25);
}

/**
 * A screen nudge: a whole-pixel offset that springs back. `t` ms since it started; returns the offset in px
 * along the nudge's direction (amplitude `px`, gone after `ms`).
 */
export function nudgeOffset(t: number, px: number, ms = 140): number {
  if (t < 0 || t >= ms) return 0;
  const k = t / ms;
  return Math.round(px * (1 - k) * Math.cos(k * Math.PI * 1.5));
}

/** Hit-stop: frames of held time on an impact (a harvest), as ms. Two 60 Hz frames. */
export const HIT_STOP_MS = 34;
