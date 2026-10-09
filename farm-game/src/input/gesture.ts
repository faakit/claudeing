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
 * Drag distance per extra tile of the painted path (the first tile comes at PAINT_DEADZONE): about 5 mm on the
 * target phones (4.6 mm SE, 5.6 mm Pro Max). Round 3 raised it from 10 px: with corners, every corner and row
 * end is a place where the finger's own wobble decides a tile, and 3 mm bands were a coin flip under a 2 mm
 * wobble. The cost is reach: a drag toward the screen edge on the thumb's side (Action is 40 px from it) gets
 * 3 tiles, toward the middle 9.
 */
export const PAINT_STEP_PX = 16;
/** Longest painted path, in tiles (a 4 x 4 plot). */
export const PAINT_MAX_TILES = 16;
/** Direction hysteresis of the first leg: the other axis must be this many times stronger to switch lines. */
export const PAINT_BIAS = 1.6;
/**
 * A painted path turns a corner (owner decision, round 3) once the finger is this far off the current leg's
 * line (about 4.1-4.9 mm on the target phones, clear of a 3 mm wobble). The line is the finger's own trend
 * (a least-squares fit while it moved along), so a slow drift or a thumb's arc bends the line, not the path.
 * The new leg's first tile comes at this distance from the old line, one more per PAINT_STEP_PX.
 */
export const PAINT_TURN_PX = 14;
/**
 * Past this distance off the line the finger may be heading for a corner: where it runs from here on
 * (averaged) is where the corner goes, so a wobble there cannot add or drop a tile.
 */
export const PAINT_VEER_PX = 6;
/** Past this distance off the line the leg stops growing (the corner decides its length). */
export const PAINT_HOLD_PX = 10;
/** A corner needs the finger's last this-many px of travel to be mostly sideways to the line. */
export const PAINT_SIDE_WINDOW_PX = 6;
/** Back within this distance of the old line (and not veering), the newest leg is undone. */
export const PAINT_UNTURN_PX = 4;
/** Ridge prior on the line's slope (px^2): a few tiles of travel are needed before the line may tilt. */
const SLOPE_PRIOR = 20000;
/** The line may tilt at most this much (lateral px per px along). */
const SLOPE_MAX = 0.5;
/** The first leg locks its line (and may then turn) once it has this many tiles. */
export const PAINT_LOCK_TILES = 2;
/**
 * A press that rolled 9 px or more (and never became a swipe or a flick) still counts as a tap when it was a
 * press first: the finger stayed within half the deadzone for this long before it rolled. One that moved at
 * once was a swipe or flick cut short: it does nothing and says so (a "no" pulse and a tiny shake).
 */
export const ROLL_DWELL_MS = 100;

export type PaintDir = 'up' | 'down' | 'left' | 'right';

export type ActionEvent =
  | { type: 'step'; dir: 1 | -1 }
  | { type: 'ring' }
  | { type: 'arm' }
  /**
   * The painted path so far: `path` is one direction per tile, starting from the farmer; `dir` is the direction
   * of its last tile and `tiles` its length (null / 0 = armed, nothing chosen yet).
   */
  | { type: 'paint'; dir: PaintDir | null; tiles: number; path: PaintDir[] }
  | { type: 'tap' }
  | { type: 'commit'; dir: PaintDir; tiles: number; path: PaintDir[] }
  | { type: 'cancel' }
  /** A press that did nothing (a swipe or flick cut short): show and buzz a "no", never silently. */
  | { type: 'reject' };

const VEC: Record<PaintDir, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
/**
 * Lateral offsets are measured to the travel direction's clockwise side (screen y down): positive lateral of
 * a rightward leg is down, of a downward leg is left, and so on.
 */
const CW: Record<PaintDir, PaintDir> = { right: 'down', down: 'left', left: 'up', up: 'right' };
const CCW: Record<PaintDir, PaintDir> = { right: 'up', up: 'left', left: 'down', down: 'right' };

/** One straight leg of a painted path. */
interface Leg {
  dir: PaintDir;
  /** Where the leg's line starts, in arm-relative finger px. */
  ox: number;
  oy: number;
  /** Finger distance along the leg at which its first tile appears. */
  first: number;
  tiles: number;
  /**
   * The finger's line: weighted least-squares sums of (along, lateral) samples, each weighted by the progress
   * along the leg it made, so a wobble averages out and a corner (no progress along) never moves it.
   */
  fit: { w: number; a: number; l: number; aa: number; al: number };
  lastAlong: number;
  /** While veering off the line: where along it the finger runs (weighted by sideways travel). */
  veer: { sum: number; w: number; lastLat: number } | null;
}

/** The leg's line at `along`: its lateral there. */
function lineAt(leg: Leg, along: number): number {
  const f = leg.fit;
  const am = f.a / f.w;
  const lm = f.l / f.w;
  const sxx = f.aa - f.a * am;
  const sxy = f.al - f.a * lm;
  const slope = Math.max(-SLOPE_MAX, Math.min(SLOPE_MAX, sxy / (sxx + SLOPE_PRIOR)));
  return lm + slope * (along - am);
}

/**
 * One press on the Action button, pure (owner rulings 2026-10-09 and round 3). The gestures stay apart:
 *
 * - **tap:** lifted without a swipe, flick or paint drag, however long it was held: act once (holding never
 *   repeats). A press that rolled 9 px or more counts too if it was still for ROLL_DWELL_MS first;
 * - **swipe:** a mostly vertical 14 px step changes tool (each further step changes again);
 * - **flick:** a clearly sideways 14 px move opens the tool ring; nothing is ever used;
 * - **paint:** held still 300 ms arms painting (a tick); the drag then draws a path from the farmer: the
 *   first leg's direction (4 ways, hysteresis 1.6) and length (the first tile at 8 px, one more per 10 px);
 *   a clear sideways move of 14 px turns a corner into a new leg (serpentine). The path is contiguous, never
 *   revisits a tile and stops at 16 tiles; dragging back un-paints tile by tile, round corners too. Lifting
 *   commits; lifting back at the start cancels.
 *
 * Anything else (a swipe or flick cut short) does nothing on release and says so (`reject`).
 */
export class ActionPress {
  private phase: 'press' | 'swiping' | 'armed' | 'ring' = 'press';
  private maxTravel = 0;
  /** When the finger first strayed half the deadzone (null: never). */
  private strayAt: number | null = null;
  private anchorY = 0;
  private armAt = { x: 0, y: 0 };
  private last = { x: 0, y: 0 };
  /** The path's legs; the first leg exists once a direction is chosen. */
  private legs: Leg[] = [];
  /** The finger left the paint deadzone at some point (lifting back at the start then cancels). */
  private drew = false;
  /** Recent finger positions while painting (arm-relative). */
  private trail: { x: number; y: number }[] = [];
  private emitted = '|';

  constructor(private readonly t0: number) {}

  get armed(): boolean {
    return this.phase === 'armed';
  }

  /** The painted path so far: one direction per tile from the farmer. */
  get path(): PaintDir[] {
    return this.legs.flatMap((l) => Array<PaintDir>(l.tiles).fill(l.dir));
  }

  /** The finger moved to (dx, dy) from where it pressed, at time `t` (ms, same clock as the constructor). */
  move(dx: number, dy: number, t?: number): ActionEvent[] {
    this.last = { x: dx, y: dy };
    const d = Math.hypot(dx, dy);
    this.maxTravel = Math.max(this.maxTravel, d);
    if (this.strayAt === null && d >= GESTURE.stickDeadzone / 2) this.strayAt = t ?? this.t0;
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
      const path = this.path;
      if (path.length > 0)
        return [{ type: 'commit', dir: path[path.length - 1]!, tiles: path.length, path }];
      // Armed and lifted without a drag: a press, so it acts once (owner decision, round 3). A drag that went
      // out and came back to the start cancels.
      return this.drew ? [{ type: 'cancel' }] : [{ type: 'cancel' }, { type: 'tap' }];
    }
    if (this.phase !== 'press') return [];
    if (this.maxTravel < GESTURE.stickDeadzone) return [{ type: 'tap' }];
    // Rolled 9 px or more without becoming a swipe or a flick: a press that rolled acts once; a swipe or flick
    // cut short says no.
    const dwelt = this.strayAt !== null && this.strayAt - this.t0 >= ROLL_DWELL_MS;
    return this.maxTravel < GESTURE.swipeStep && dwelt ? [{ type: 'tap' }] : [{ type: 'reject' }];
  }

  /** The finger's displacement over its last `len` px of travel. */
  private recent(len: number): { x: number; y: number } {
    const h = this.trail;
    const end = h[h.length - 1]!;
    let s = 0;
    for (let k = h.length - 1; k > 0; k--) {
      s += Math.hypot(h[k]!.x - h[k - 1]!.x, h[k]!.y - h[k - 1]!.y);
      if (s >= len) return { x: end.x - h[k - 1]!.x, y: end.y - h[k - 1]!.y };
    }
    return { x: end.x - h[0]!.x, y: end.y - h[0]!.y };
  }

  private paintMove(dx: number, dy: number): ActionEvent[] {
    const px = dx - this.armAt.x;
    const py = dy - this.armAt.y;
    this.trail.push({ x: px, y: py });
    if (this.trail.length > 64) this.trail.shift();
    if (Math.hypot(px, py) >= PAINT_DEADZONE) this.drew = true;
    if (!this.locked()) this.firstLeg(px, py);
    if (this.legs.length) this.walkLegs(px, py);
    return this.emit();
  }

  private locked(): boolean {
    return this.legs.length > 1 || (this.legs[0]?.tiles ?? 0) >= PAINT_LOCK_TILES;
  }

  /** The first leg, until it locks: direction from the arm point with hysteresis, a straight line. */
  private firstLeg(px: number, py: number): void {
    let dir = this.legs[0]?.dir ?? null;
    if (Math.hypot(px, py) < PAINT_DEADZONE) dir = null;
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
    if (dir === null) this.legs = [];
    else if (this.legs[0]?.dir !== dir) this.legs = [newLeg(dir, 0, 0, PAINT_DEADZONE, px, py, 12)];
  }

  /** Grid cells on the path's first `legs` legs, relative to the farmer at 0,0 (which counts as taken). */
  private cells(legs: number): { seen: Set<string>; x: number; y: number; n: number } {
    const seen = new Set<string>(['0,0']);
    let x = 0;
    let y = 0;
    for (let i = 0; i < legs; i++) {
      const l = this.legs[i]!;
      for (let k = 0; k < l.tiles; k++) {
        x += VEC[l.dir].x;
        y += VEC[l.dir].y;
        seen.add(`${x},${y}`);
      }
    }
    return { seen, x, y, n: seen.size - 1 };
  }

  /** How many tiles leg `i` can have for a finger `along` it: its own count, never onto the path, capped. */
  private room(i: number, along: number): number {
    const leg = this.legs[i]!;
    const v = VEC[leg.dir];
    const want = along < leg.first ? 0 : 1 + Math.floor((along - leg.first) / PAINT_STEP_PX);
    const done = this.cells(i);
    // Back-and-forth legs stay inside the first leg's span (a serpentine fills a box): an overshoot at a row's
    // end can never paint past the plot.
    const v0 = VEC[this.legs[0]!.dir];
    const boxed = i > 0 && v.x * v0.y - v.y * v0.x === 0;
    const span = this.legs[0]!.tiles;
    let tiles = 0;
    while (tiles < want && done.n + tiles < PAINT_MAX_TILES) {
      const nx = done.x + v.x * (tiles + 1);
      const ny = done.y + v.y * (tiles + 1);
      if (done.seen.has(`${nx},${ny}`)) break;
      const along0 = nx * v0.x + ny * v0.y;
      if (boxed && (along0 < 1 || along0 > span)) break;
      tiles++;
    }
    return tiles;
  }

  /** Follow the finger with the newest leg: grow or shrink it, undo it round its corner, or turn a new one. */
  private walkLegs(px: number, py: number): void {
    for (let guard = 0; guard < 2 * PAINT_MAX_TILES; guard++) {
      const i = this.legs.length - 1;
      const leg = this.legs[i]!;
      const v = VEC[leg.dir];
      const along = (px - leg.ox) * v.x + (py - leg.oy) * v.y;
      const lat = (px - leg.ox) * -v.y + (py - leg.oy) * v.x;
      const ref = lineAt(leg, along);
      const off = lat - ref;
      const veering = Math.abs(off) >= PAINT_VEER_PX;
      // Back near the old line (and not heading for a new corner): undo this leg, carry on with the one before.
      if (i > 0 && along < PAINT_UNTURN_PX && !veering) {
        this.legs.pop();
        const prev = this.legs[i - 1]!;
        const pv = VEC[prev.dir];
        prev.lastAlong = (px - prev.ox) * pv.x + (py - prev.oy) * pv.y;
        prev.veer = null;
        continue;
      }
      // Is the finger heading sideways, away from the line (over its last few px of travel)?
      const recent = this.recent(PAINT_SIDE_WINDOW_PX);
      const ra = recent.x * v.x + recent.y * v.y;
      const rl = recent.x * -v.y + recent.y * v.x;
      const sideways = Math.abs(rl) >= Math.abs(ra) && rl * off > 0;
      // The line follows the finger as it makes progress along it near the line (a slow drift or a thumb's arc
      // tilts it), never in a corner.
      const w = along - leg.lastAlong;
      if (w > 0 && !veering) {
        const f = leg.fit;
        f.w += w;
        f.a += w * along;
        f.l += w * lat;
        f.aa += w * along * along;
        f.al += w * along * lat;
      }
      if (!veering) leg.veer = null;
      else {
        leg.veer ??= { sum: 0, w: 0, lastLat: lat };
        const w = Math.abs(lat - leg.veer.lastLat);
        leg.veer.sum += along * w;
        leg.veer.w += w;
        leg.veer.lastLat = lat;
      }
      leg.lastAlong = along;
      // Length: as far as the finger reaches; held while it is well off the line (the corner decides), unless
      // it is clearly following a thumb's arc along it.
      if (Math.abs(off) < PAINT_HOLD_PX) leg.tiles = this.room(i, along);
      // A corner: the leg is locked and has its tiles, the finger is a clear 14 px off its line, and it got
      // there moving sideways, not by wobbling or drifting along the line.
      if (!this.locked() || leg.tiles === 0 || Math.abs(off) < PAINT_TURN_PX || !sideways) return;
      // The corner sits where the finger ran while it veered off (a wobble there cannot add or drop a tile).
      const veer = leg.veer;
      const cornerAlong = veer && veer.w > 0 ? veer.sum / veer.w : along;
      const dir = off > 0 ? CW[leg.dir] : CCW[leg.dir];
      const before = leg.tiles;
      leg.tiles = Math.max(1, this.room(i, cornerAlong));
      const v0 = VEC[this.legs[0]!.dir];
      if (i >= 2 && v.x * v0.y - v.y * v0.x === 0) {
        // A row of a serpentine turning into the next U-turn: one tile short of the box edge means the edge.
        const edge = this.room(i, Infinity);
        if (edge - leg.tiles === 1) leg.tiles = edge;
      }
      if (
        i >= 1 &&
        VEC[dir].x === -VEC[this.legs[i - 1]!.dir].x &&
        VEC[dir].y === -VEC[this.legs[i - 1]!.dir].y
      )
        leg.tiles = 1; // a U-turn: the step between two rows of a serpentine is one tile
      const end = this.cells(i + 1);
      if (end.n >= PAINT_MAX_TILES || end.seen.has(`${end.x + VEC[dir].x},${end.y + VEC[dir].y}`)) {
        leg.tiles = before; // would revisit a tile, or the path is full: no corner
        return;
      }
      // The new leg's line starts at the corner, on the old line.
      const cref = lineAt(leg, cornerAlong);
      const cx = leg.ox + v.x * cornerAlong - v.y * cref;
      const cy = leg.oy + v.y * cornerAlong + v.x * cref;
      leg.veer = null;
      this.legs.push(newLeg(dir, cx, cy, PAINT_TURN_PX, px, py, 4));
    }
  }

  private emit(): ActionEvent[] {
    const path = this.path;
    const key = path.join(',') + '|';
    if (key === this.emitted) return [];
    this.emitted = key;
    return [{ type: 'paint', dir: path.at(-1) ?? null, tiles: path.length, path }];
  }
}

function newLeg(
  dir: PaintDir,
  ox: number,
  oy: number,
  first: number,
  px: number,
  py: number,
  weight: number,
): Leg {
  const v = VEC[dir];
  const along = (px - ox) * v.x + (py - oy) * v.y;
  return {
    dir,
    ox,
    oy,
    first,
    tiles: 0,
    fit: { w: weight, a: 0, l: 0, aa: 0, al: 0 }, // the line starts at its origin (lateral 0) with this weight
    lastAlong: along,
    veer: null,
  };
}

/** The tiles of a painted path from (tx, ty), one step per direction. */
export function pathTiles(
  from: { tx: number; ty: number },
  path: readonly PaintDir[],
): { tx: number; ty: number }[] {
  const out: { tx: number; ty: number }[] = [];
  let { tx, ty } = from;
  for (const d of path) {
    tx += VEC[d].x;
    ty += VEC[d].y;
    out.push({ tx, ty });
  }
  return out;
}
