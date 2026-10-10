/** Pure geometry for the coach marks (tested without Phaser). */

/**
 * Where the straight way from `from` to `to` leaves the box (the last point inside it); `from` is clamped into
 * the box first. Pure, so a test can check the arrow never sits on the farmer's own tile.
 */
export function edgePoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
  box: { x0: number; x1: number; y0: number; y1: number },
): { x: number; y: number } {
  const fx = Math.max(box.x0, Math.min(box.x1, from.x));
  const fy = Math.max(box.y0, Math.min(box.y1, from.y));
  const dx = to.x - fx;
  const dy = to.y - fy;
  let t = 1;
  if (dx > 0) t = Math.min(t, (box.x1 - fx) / dx);
  if (dx < 0) t = Math.min(t, (box.x0 - fx) / dx);
  if (dy > 0) t = Math.min(t, (box.y1 - fy) / dy);
  if (dy < 0) t = Math.min(t, (box.y0 - fy) / dy);
  t = Math.max(0, t);
  return { x: Math.round(fx + dx * t), y: Math.round(fy + dy * t) };
}
