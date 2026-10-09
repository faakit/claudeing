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

/** Hold Action still this long to arm painting a row (coordinator ruling 2026-10-09). */
export const PAINT_ARM_MS = 300;
/** After arming, the drag picks a direction once it is this far from where the finger was. */
export const PAINT_DEADZONE = 8;
/**
 * Drag distance per extra tile of the painted line. Small, because Action sits 40 px from the screen edge on its
 * thumb's side: a drag that way still reaches 4 tiles before the finger leaves the screen.
 */
export const PAINT_STEP_PX = 10;
/** Longest painted line. */
export const PAINT_MAX_TILES = 12;
/** Direction hysteresis while painting: the other axis must be this many times stronger to switch lines. */
export const PAINT_BIAS = 1.6;

export type ActionEvent =
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'ring' }
  | { type: 'arm' }
  | { type: 'paint'; dir: 'up' | 'down' | 'left' | 'right' | null; tiles: number }
  | { type: 'tap' }
  | { type: 'commit'; dir: 'up' | 'down' | 'left' | 'right'; tiles: number }
  | { type: 'cancel' };

/**
 * One press on the Action button, pure (owner ruling 2026-10-09). The gestures stay apart:
 *
 * - **tap:** lifted before the paint arm, never having moved 9 px in any direction: act once;
 * - **swipe:** a mostly vertical 14 px step changes tool (each further step changes again);
 * - **flick:** a clearly sideways 14 px move opens the tool ring; nothing is ever used;
 * - **paint:** held still 300 ms arms painting (a tick); the drag direction then picks a straight line
 *   from the farmer (4 ways, hysteresis 1.6 so a wobble never switches line) and its length the number of
 *   tiles (one per 14 px); lifting commits, lifting near the start cancels.
 *
 * Anything else (a touch that wandered 9 px or more and did none of these) does nothing on release.
 */
export class ActionPress {
  private phase: 'press' | 'swiping' | 'armed' | 'ring' = 'press';
  private maxTravel = 0;
  private anchorY = 0;
  private armAt = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  private dir: 'up' | 'down' | 'left' | 'right' | null = null;
  private tiles = 0;

  constructor(private readonly t0: number) {}

  get armed(): boolean {
    return this.phase === 'armed';
  }

  move(dx: number, dy: number): ActionEvent[] {
    this.last = { x: dx, y: dy };
    this.maxTravel = Math.max(this.maxTravel, Math.hypot(dx, dy));
    if (this.phase === 'ring') return [];
    if (this.phase === 'armed') return this.paintMove(dx, dy);
    const out: ActionEvent[] = [];
    const ady = dy - this.anchorY;
    if (Math.abs(ady) >= GESTURE.swipeStep && Math.abs(ady) > Math.abs(dx)) {
      this.phase = 'swiping';
      this.anchorY = dy;
      out.push({ type: 'step', dir: ady < 0 ? 1 : -1 });
    } else if (
      this.phase === 'press' &&
      Math.abs(dx) >= GESTURE.swipeStep &&
      Math.abs(dx) > Math.abs(dy) * GESTURE.dominance
    ) {
      this.phase = 'ring';
      out.push({ type: 'ring' });
    }
    return out;
  }

  /** Each frame: the paint arm. */
  update(t: number): ActionEvent[] {
    if (this.phase !== 'press' || this.maxTravel >= GESTURE.stickDeadzone) return [];
    if (t - this.t0 < PAINT_ARM_MS) return [];
    this.phase = 'armed';
    this.armAt = { ...this.last };
    return [{ type: 'arm' }];
  }

  up(): ActionEvent[] {
    if (this.phase === 'armed') {
      return this.dir && this.tiles > 0
        ? [{ type: 'commit', dir: this.dir, tiles: this.tiles }]
        : [{ type: 'cancel' }];
    }
    if (this.phase === 'press' && this.maxTravel < GESTURE.stickDeadzone) return [{ type: 'tap' }];
    return [];
  }

  private paintMove(dx: number, dy: number): ActionEvent[] {
    const px = dx - this.armAt.x;
    const py = dy - this.armAt.y;
    const d = Math.hypot(px, py);
    let dir = this.dir;
    if (d < PAINT_DEADZONE) dir = null;
    else {
      const ax = Math.abs(px);
      const ay = Math.abs(py);
      const horizontal =
        dir === null
          ? ax >= ay
          : dir === 'left' || dir === 'right'
            ? !(ay > ax * PAINT_BIAS)
            : ax > ay * PAINT_BIAS;
      dir = horizontal ? (px < 0 ? 'left' : 'right') : py < 0 ? 'up' : 'down';
    }
    // tiles: along the chosen direction only, one at the deadzone and one more per step
    const along =
      dir === null ? 0 : dir === 'left' ? -px : dir === 'right' ? px : dir === 'up' ? -py : py;
    const tiles =
      dir === null || along < PAINT_DEADZONE
        ? 0
        : Math.min(PAINT_MAX_TILES, 1 + Math.floor((along - PAINT_DEADZONE) / PAINT_STEP_PX));
    if (dir === this.dir && tiles === this.tiles) return [];
    this.dir = dir;
    this.tiles = tiles;
    return [{ type: 'paint', dir: tiles > 0 ? dir : null, tiles }];
  }
}
