import { CORNER_ASSIST_PX, MAX_FRAME_MS, PLAYER_HITBOX, PLAYER_SPEED } from '../config';
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
