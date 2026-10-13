/**
 * The bag's slot grid and its drag and drop (QA round: "Drag n drop na bolsa"). Pure, so tests can place slots and
 * resolve a drop without Phaser.
 *
 * A press on an item picks it up when it is held for `LIFT_MS` or moves more than `LIFT_PX` before that; a press
 * that does neither is a tap (it selects, as before). The item drops on the slot under the finger.
 */

/** Hold this long on an item to pick it up. */
export const LIFT_MS = 260;
/** Or move this far (logical px) while pressing on it. A tap's own jitter on a phone stays under it. */
export const LIFT_PX = 5;

export interface BagGeom {
  x0: number;
  y0: number;
  size: number;
  pitch: number;
  cols: number;
  count: number;
}

/** The grid sits at the bottom of the bag tab, right above the tabs, growing upward with a bigger bag. */
export function bagGeom(count: number, bottom: number): BagGeom {
  const pitch = 23;
  const cols = 8;
  const rows = Math.ceil(count / cols);
  return { x0: 8, y0: bottom - rows * pitch - 2, size: 22, pitch, cols, count };
}

/** Top-left of slot `i`. */
export function slotXY(g: BagGeom, i: number): { x: number; y: number } {
  return { x: g.x0 + (i % g.cols) * g.pitch, y: g.y0 + Math.floor(i / g.cols) * g.pitch };
}

/**
 * The slot under a point (sheet-local px), or null off the grid. Each slot owns its whole pitch, so a drop on the
 * 1 px seam between two faces still lands, and a finger a little outside the grid's edge snaps to its edge slot
 * (up to half a pitch).
 */
export function bagSlotAt(g: BagGeom, x: number, y: number): number | null {
  const rows = Math.ceil(g.count / g.cols);
  const half = g.pitch / 2;
  if (x < g.x0 - half || x > g.x0 + g.cols * g.pitch + half) return null;
  if (y < g.y0 - half || y > g.y0 + rows * g.pitch + half) return null;
  const col = Math.max(0, Math.min(g.cols - 1, Math.floor((x - g.x0) / g.pitch)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor((y - g.y0) / g.pitch)));
  const i = row * g.cols + col;
  return i < g.count ? i : null;
}

/** True once a press has moved far enough to lift what it holds. */
export const movedToLift = (dx: number, dy: number): boolean => Math.hypot(dx, dy) > LIFT_PX;
