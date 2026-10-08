/**
 * What a tap on the world means, pure (no Phaser). Tiles are 4 to 6 mm on the glass, under the ~9 mm a thumb
 * needs, so the rules are built so a miss is cheap:
 *
 * 1. **Interact** with the thing on the tapped tile (villager, bin, shop, board, mailbox, machine, sign, bed).
 * 2. **Act** on the tapped tile when Action can do something there (auto tool: harvest, water, plant, till...).
 * 3. **Walk** onto the tapped tile when it is open.
 *
 * **Snap:** interact targets are magnets. A tap that would only walk, or lands on something solid, and falls
 * within `SNAP_MM` of an interact target's tile goes to that target. A tap that would act stays an act (so
 * tilling around a sprinkler never opens it), and acts never snap: a miss next to a crop walks, it never works
 * a different tile than the one under the finger. Opening a sheet is always safe; selling and gifting still
 * happen only in the sheet.
 */
import type { TileCoord } from './world';

/** How far beyond its tile edge an interact target still catches a tap, in mm on the glass (default). */
export const SNAP_MM = 3;
/** The same in logical px on a typical phone (1.9 CSS px per logical px), for tests and fallbacks. */
export const SNAP_PX = 10;

export interface TapWorld {
  tileSize: number;
  /** Magnet reach in logical px on this screen (SNAP_MM converted); defaults to SNAP_PX. */
  snapPx?: number;
  inMap(t: TileCoord): boolean;
  /** Solid for walking (walls, objects, villagers, machines). */
  blocked(t: TileCoord): boolean;
  /** Interact target type on a tile, if any. */
  interactable(t: TileCoord): string | null;
  /** The plan kind Action would run on this tile (as the auto tool chooses), if any. */
  actKind(t: TileCoord): string | null;
}

export type TapIntent =
  | { kind: 'interact'; target: TileCoord; type: string; snapped: boolean }
  | { kind: 'act'; target: TileCoord; plan: string }
  | { kind: 'walk'; target: TileCoord }
  | { kind: 'none'; target: TileCoord };

/** Distance from a point to a tile's square (0 inside). */
function distToTile(x: number, y: number, t: TileCoord, ts: number): number {
  const cx = Math.max(t.tx * ts, Math.min(x, t.tx * ts + ts));
  const cy = Math.max(t.ty * ts, Math.min(y, t.ty * ts + ts));
  return Math.hypot(x - cx, y - cy);
}

/** The interact target nearest to the point within SNAP_PX of its tile (8 neighbours of the tapped tile). */
function magnet(
  w: TapWorld,
  x: number,
  y: number,
  tapped: TileCoord,
): { tile: TileCoord; type: string } | null {
  let best: { tile: TileCoord; type: string; d: number } | null = null;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const t = { tx: tapped.tx + dx, ty: tapped.ty + dy };
      if (!w.inMap(t)) continue;
      const type = w.interactable(t);
      if (!type) continue;
      const d = distToTile(x, y, t, w.tileSize);
      if (d <= (w.snapPx ?? SNAP_PX) && (!best || d < best.d)) best = { tile: t, type, d };
    }
  return best ? { tile: best.tile, type: best.type } : null;
}

/** What a tap at world point (x, y) means. */
export function tapIntent(w: TapWorld, x: number, y: number): TapIntent {
  const ts = w.tileSize;
  const tapped = { tx: Math.floor(x / ts), ty: Math.floor(y / ts) };
  if (!w.inMap(tapped)) return { kind: 'none', target: tapped };
  const type = w.interactable(tapped);
  if (type) return { kind: 'interact', target: tapped, type, snapped: false };
  const act = w.actKind(tapped);
  if (act) return { kind: 'act', target: tapped, plan: act };
  const m = magnet(w, x, y, tapped);
  if (m) return { kind: 'interact', target: m.tile, type: m.type, snapped: true };
  if (!w.blocked(tapped)) return { kind: 'walk', target: tapped };
  return { kind: 'none', target: tapped };
}

/**
 * Where a thumb meant to touch, from where it landed. Thumbs land a little below the intended point and toward
 * the thumb base (the side of the holding hand); touch systems correct for it. We undo about 1 mm of it
 * diagonally, half of what the controls benchmark models (1.5 mm), so a straight-on tap is barely moved.
 * The size of a mm comes from the CSS reference pixel (about 6.3 CSS px per mm on phones).
 */
export const TOUCH_COMPENSATION_MM = 0.7;
export const CSS_PX_PER_MM = 6.3;

export function compensateTouch(
  x: number,
  y: number,
  leftHanded: boolean,
  cssPerLogical: number,
): { x: number; y: number } {
  const d = (TOUCH_COMPENSATION_MM * CSS_PX_PER_MM) / Math.max(0.1, cssPerLogical);
  return { x: x + (leftHanded ? d : -d), y: y - d };
}
