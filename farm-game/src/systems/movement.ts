import {
  CORNER_ASSIST_PX,
  MAX_FRAME_MS,
  PLAYER_HITBOX,
  PLAYER_SPEED,
  SETTLE_BACK_PX,
  SETTLE_SPEED,
  TURN_HOLD_MS,
} from '../config';
import type { Direction, PlayerState } from '../state/GameState';
import { DIR_VECTORS } from './direction';

export interface Hitbox {
  halfW: number;
  h: number;
}

export interface CollisionGrid {
  width: number;
  height: number;
  tileSize: number;
  /** 1 = blocked, row-major. */
  blocked: Uint8Array;
}

const EPS = 1e-4;

export function createGrid(
  width: number,
  height: number,
  tileSize: number,
  tileData: readonly number[],
): CollisionGrid {
  if (tileData.length !== width * height) {
    throw new Error(`Collision data has ${tileData.length} tiles, expected ${width * height}`);
  }
  return { width, height, tileSize, blocked: Uint8Array.from(tileData, (t) => (t > 0 ? 1 : 0)) };
}

/** Anything outside the map counts as solid. */
export function isTileBlocked(grid: CollisionGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return grid.blocked[ty * grid.width + tx] === 1;
}

/** Box spans [x-halfW, x+halfW) horizontally and [y-h, y) vertically (y = feet). */
export function boxBlocked(grid: CollisionGrid, x: number, y: number, hb: Hitbox): boolean {
  const ts = grid.tileSize;
  const x0 = Math.floor((x - hb.halfW) / ts);
  const x1 = Math.floor((x + hb.halfW - EPS) / ts);
  const y0 = Math.floor((y - hb.h) / ts);
  const y1 = Math.floor((y - EPS) / ts);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (isTileBlocked(grid, tx, ty)) return true;
    }
  }
  return false;
}

interface AxisResult {
  x: number;
  y: number;
  hit: boolean;
}

/** Move along one axis; on contact, snap flush against the blocking tile edge. */
function moveAxis(
  grid: CollisionGrid,
  hb: Hitbox,
  x: number,
  y: number,
  axis: 'x' | 'y',
  delta: number,
): AxisResult {
  const nx = axis === 'x' ? x + delta : x;
  const ny = axis === 'y' ? y + delta : y;
  if (!boxBlocked(grid, nx, ny, hb)) return { x: nx, y: ny, hit: false };
  const ts = grid.tileSize;
  if (axis === 'x') {
    const sx =
      delta > 0
        ? Math.floor((nx + hb.halfW - EPS) / ts) * ts - hb.halfW
        : (Math.floor((nx - hb.halfW) / ts) + 1) * ts + hb.halfW;
    return { x: sx, y, hit: true };
  }
  const sy =
    delta > 0 ? Math.floor((ny - EPS) / ts) * ts : (Math.floor((ny - hb.h) / ts) + 1) * ts + hb.h;
  return { x, y: sy, hit: true };
}

/**
 * When blocked by only a sliver of a corner, nudge sideways so the player slides
 * into doorways instead of snagging. Returns the perpendicular shift to apply (0 = none).
 */
function cornerNudge(
  grid: CollisionGrid,
  hb: Hitbox,
  x: number,
  y: number,
  axis: 'x' | 'y',
  delta: number,
): number {
  for (let o = 1; o <= CORNER_ASSIST_PX; o++) {
    for (const sign of [-1, 1]) {
      const px = axis === 'x' ? x : x + sign * o;
      const py = axis === 'x' ? y + sign * o : y;
      const fx = axis === 'x' ? px + delta : px;
      const fy = axis === 'x' ? py : py + delta;
      if (!boxBlocked(grid, px, py, hb) && !boxBlocked(grid, fx, fy, hb)) {
        return sign * Math.min(o, Math.abs(delta));
      }
    }
  }
  return 0;
}

/**
 * Advance the player one frame. Mutates `player` (the one place movement edits state)
 * and returns whether the player actually moved, which drives the walk animation.
 */
export function stepPlayer(
  player: PlayerState,
  dir: Direction | null,
  dtMs: number,
  grid: CollisionGrid,
  hb: Hitbox = PLAYER_HITBOX,
): { moving: boolean } {
  if (!dir) return { moving: false };
  player.facing = dir;
  const dist = (PLAYER_SPEED * Math.min(dtMs, MAX_FRAME_MS)) / 1000;
  const v = DIR_VECTORS[dir];
  const axis = v.x !== 0 ? 'x' : 'y';
  const delta = (v.x !== 0 ? v.x : v.y) * dist;

  const before = { x: player.x, y: player.y };
  const r = moveAxis(grid, hb, player.x, player.y, axis, delta);
  player.x = r.x;
  player.y = r.y;

  if (r.hit) {
    const nudge = cornerNudge(grid, hb, player.x, player.y, axis, delta);
    if (nudge !== 0) {
      if (axis === 'x') player.y += nudge;
      else player.x += nudge;
    }
  }
  return { moving: player.x !== before.x || player.y !== before.y };
}

/** Turn the player in place (used when tapping an adjacent tile). */
export function faceDirection(player: PlayerState, dir: Direction): void {
  player.facing = dir;
}

/**
 * Grid feel on top of free movement (runtime only, never saved). Stopping on a 4 to 6 mm tile with a thumb
 * is a timing game, so two rules make "stand here, face that" deterministic:
 *
 * - **Turn in place:** from a standstill, a push in a new direction turns at once and only starts walking
 *   after `TURN_HOLD_MS` of continued push, so a flick turns without moving. Pushing the way you already
 *   face walks at once, and changing direction while walking adds no delay.
 * - **Settle on release:** when the push ends, glide along the walking axis to a tile centre: back to the
 *   last centre passed if that was less than `SETTLE_BACK_PX` ago (people let go when the sprite looks
 *   centred, plus their reaction time), otherwise on to the next one. Never into a blocked tile.
 */
export interface MoveState {
  /** Walked last frame. */
  moving: boolean;
  /** A push from standstill toward `turnDir`, held for `turnMs` so far. */
  turnDir: Direction | null;
  turnMs: number;
  /** The axis walked last (where to settle). */
  axis: 'x' | 'y' | null;
  /** Sign of the last walk along `axis`. */
  sign: number;
  /** The glide in progress: a target coordinate on `axis`. */
  settle: number | null;
}

export const createMoveState = (): MoveState => ({
  moving: false,
  turnDir: null,
  turnMs: 0,
  axis: null,
  sign: 0,
  settle: null,
});

/** Tile-centre coordinates along an axis (feet y sits `h/2` below the box centre). */
const centreOffset = (axis: 'x' | 'y', hb: Hitbox, ts: number) =>
  axis === 'x' ? ts / 2 : ts / 2 + hb.h / 2;

/** Where a release at `pos` (moving `sign` along `axis`) settles: a tile centre, or null if already there. */
export function settleTarget(
  pos: number,
  axis: 'x' | 'y',
  sign: number,
  grid: CollisionGrid,
  other: number,
  hb: Hitbox = PLAYER_HITBOX,
): number | null {
  const ts = grid.tileSize;
  const off = centreOffset(axis, hb, ts);
  const rel = (pos - off) / ts;
  if (Math.abs(rel - Math.round(rel)) * ts < 0.01) return null; // on a centre already
  const back = (sign >= 0 ? Math.floor(rel) : Math.ceil(rel)) * ts + off;
  const fwd = back + (sign >= 0 ? ts : -ts);
  const past = Math.abs(pos - back);
  const open = (c: number) =>
    !boxBlocked(grid, axis === 'x' ? c : other, axis === 'x' ? other : c, hb);
  const first = past < SETTLE_BACK_PX ? back : fwd;
  const second = first === back ? fwd : back;
  if (open(first)) return first;
  return open(second) ? second : null;
}

/**
 * Advance the player one frame with turn-in-place and settle-on-release. Mutates `player` and `ms`;
 * returns whether the player moved (walk animation).
 */
export function stepMove(
  player: PlayerState,
  ms: MoveState,
  dir: Direction | null,
  dtMs: number,
  grid: CollisionGrid,
  hb: Hitbox = PLAYER_HITBOX,
): { moving: boolean } {
  const dt = Math.min(dtMs, MAX_FRAME_MS);
  if (dir) {
    // From a standstill, a new direction turns first and walks only if the push is held.
    if (!ms.moving && dir !== player.facing && ms.turnDir !== dir) {
      ms.turnDir = dir;
      ms.turnMs = 0;
      player.facing = dir;
    }
    if (ms.turnDir === dir && !ms.moving) {
      ms.turnMs += dt;
      if (ms.turnMs < TURN_HOLD_MS) return { moving: glide(player, ms, dt, grid, hb) };
    }
    ms.turnDir = null;
    ms.settle = null;
    const v = DIR_VECTORS[dir];
    ms.axis = v.x !== 0 ? 'x' : 'y';
    ms.sign = v.x !== 0 ? v.x : v.y;
    const r = stepPlayer(player, dir, dt, grid, hb);
    ms.moving = r.moving;
    // Pushing into a wall from standstill still counts as walking (no turn delay next frame).
    if (!r.moving) ms.moving = true;
    return r;
  }
  // Released: settle once onto a tile centre along the axis walked.
  ms.turnDir = null;
  if (ms.moving && ms.axis) {
    const pos = ms.axis === 'x' ? player.x : player.y;
    const other = ms.axis === 'x' ? player.y : player.x;
    ms.settle = settleTarget(pos, ms.axis, ms.sign, grid, other, hb);
  }
  ms.moving = false;
  return { moving: glide(player, ms, dt, grid, hb) };
}

/** Move toward the settle target at `SETTLE_SPEED`; true while gliding. */
function glide(
  player: PlayerState,
  ms: MoveState,
  dt: number,
  grid: CollisionGrid,
  hb: Hitbox,
): boolean {
  if (ms.settle === null || !ms.axis) return false;
  const pos = ms.axis === 'x' ? player.x : player.y;
  const left = ms.settle - pos;
  const step = (SETTLE_SPEED * dt) / 1000;
  const delta = Math.abs(left) <= step ? left : Math.sign(left) * step;
  const r = moveAxis(grid, hb, player.x, player.y, ms.axis, delta);
  player.x = r.x;
  player.y = r.y;
  if (r.hit || Math.abs(left) <= step) ms.settle = null;
  return delta !== 0 && !r.hit;
}
