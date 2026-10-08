/**
 * Pure touch-gesture rules (no Phaser), shared by the dock buttons and the world touch handler so every
 * threshold is defined once and unit tested. Distances are logical px (1 px is ~0.25 to 0.38 mm on the
 * phones we target); times are ms.
 */

export const GESTURE = {
  /**
   * One threshold for "still" and "stick": a touch whose travel stays under this is still (a tap, a press, a
   * long-press); the moment it reaches it, the floating stick engages. No touch is ever both, or neither.
   */
  stickDeadzone: 9,
  /** Vertical travel on Action per tool step. */
  swipeStep: 14,
  /** A sideways flick must be this many times more horizontal than vertical. */
  dominance: 1.5,
} as const;

/** Tracks one pointer from touch-down: how far it has strayed at most, and whether it ever moved. */
export class PressTrack {
  maxTravel = 0;
  constructor(
    readonly x0: number,
    readonly y0: number,
    readonly t0: number,
  ) {}

  move(x: number, y: number): number {
    const d = Math.hypot(x - this.x0, y - this.y0);
    if (d > this.maxTravel) this.maxTravel = d;
    return d;
  }

  /** Still for the whole touch: never reached the stick's deadzone. */
  get still(): boolean {
    return this.maxTravel < GESTURE.stickDeadzone;
  }
}

/**
 * What a world touch was when it lifts. A still touch is a tap however long it lasted (a slow 300 ms
 * tap must do what a quick one does); a touch that engaged the stick is never a tap.
 */
export function worldRelease(track: PressTrack, stickEngaged: boolean): 'tap' | 'none' {
  return !stickEngaged && track.still ? 'tap' : 'none';
}

export type ActionDrag = 'none' | 'swipeUp' | 'swipeDown' | 'flick';

/**
 * Classify the travel on the Action button since its anchor (the touch-down point, or the point of the
 * last tool step). A step needs a full `swipeStep` of mostly vertical travel; clearly horizontal travel
 * past a step is a sideways flick (the tool ring, later). A rolling pad never gets that far.
 */
export function actionDrag(dx: number, dy: number): ActionDrag {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (ay >= GESTURE.swipeStep && ay > ax) return dy < 0 ? 'swipeUp' : 'swipeDown';
  if (ax >= GESTURE.swipeStep && ax > ay * GESTURE.dominance) return 'flick';
  return 'none';
}

/** Hold on Action before it starts working, so a swipe never swings the old tool. */
export const HOLD_ACTION_MS = 110;
/** A finger counts as settled once it has not moved 0.5 px vertically for this long. */
export const HOLD_SETTLE_MS = 60;
/** Vertical travel below this never delays a hold (a firm press wobbles a pixel or two). */
export const HOLD_JITTER = 1.5;

/**
 * May a held Action press start working now? After the hold delay, yes, unless the finger has strayed
 * vertically and is still moving: that is a swipe on its way to a tool step. A rolling pad settles, and
 * then the hold starts, wherever it settled (short of a full step, which would have changed tool).
 */
export function holdMayStart(
  sinceDownMs: number,
  dy: number,
  msSinceVerticalMove: number,
  framesSinceVerticalMove = Infinity,
): boolean {
  if (sinceDownMs < HOLD_ACTION_MS) return false;
  // Settled = no vertical change for 60 ms AND across at least 2 rendered frames, so one long frame (a GC
  // pause holding the touch events back) never reads as a still finger mid-swipe.
  const settled = msSinceVerticalMove >= HOLD_SETTLE_MS && framesSinceVerticalMove >= 2;
  return Math.abs(dy) < HOLD_JITTER || settled;
}
