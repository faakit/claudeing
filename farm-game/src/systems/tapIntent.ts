/**
 * What a tap on the world means, pure (no Phaser). Owner rulings (review 2):
 *
 * 1. **Interact** with the thing on the tapped tile, or whose sprite the tap lands on (a villager's head, a
 *    machine drawn taller than its tile). No magnets: a tap on a walkable tile next to the bin walks there.
 * 2. **Act** only where the act is obvious and harmless: harvest, pick up, water a dry crop, clear weeds,
 *    mine a node, refill the can, cast the rod you hold. Never till or plant: those take Action or a painted
 *    row, so a tap on grass or empty soil just walks.
 * 3. **Walk** onto the tapped tile when it is open; a door tile walks through the door.
 *
 * A tap on solid art (round 3, guided-start findings) belongs to what that art is drawn for: a building's wall
 * or roof leads to its door, the top of a tall prop to the bin or bed below it. Multi-tile things (a bed, a
 * counter) are reached from any side (`pathToFaceAny`).
 */
import type { TileCoord } from './world';

/** Plan kinds a tap may run on the tapped tile. Anything else (till, plant, place...) needs Action or paint. */
export const TAP_ACTS: ReadonlySet<string> = new Set([
  'harvest',
  'forage',
  'pickup',
  'water',
  'clear',
  'mine',
  'refill',
  'cast',
]);

export interface TapWorld {
  tileSize: number;
  inMap(t: TileCoord): boolean;
  /** Solid for walking (walls, objects, villagers, machines). */
  blocked(t: TileCoord): boolean;
  /** Interact target type on a tile, if any. */
  interactable(t: TileCoord): string | null;
  /** The interact target whose drawn sprite covers this world point, if any (tall sprites overhang a tile). */
  spriteTarget?(x: number, y: number): { tile: TileCoord; type: string } | null;
  /** The plan kind Action would run on this tile (as the auto tool chooses), if any. */
  actKind(t: TileCoord): string | null;
  /** A door (walking onto it goes through). */
  door?(t: TileCoord): boolean;
}

export type TapIntent =
  | { kind: 'interact'; target: TileCoord; type: string; snapped: boolean }
  | { kind: 'act'; target: TileCoord; plan: string }
  | { kind: 'walk'; target: TileCoord; door?: boolean }
  | { kind: 'none'; target: TileCoord };

/** What a tap at world point (x, y) means. */
export function tapIntent(w: TapWorld, x: number, y: number): TapIntent {
  const ts = w.tileSize;
  const tapped = { tx: Math.floor(x / ts), ty: Math.floor(y / ts) };
  if (!w.inMap(tapped)) return { kind: 'none', target: tapped };
  const type = w.interactable(tapped);
  if (type) return { kind: 'interact', target: tapped, type, snapped: false };
  const sprite = w.spriteTarget?.(x, y);
  if (sprite) return { kind: 'interact', target: sprite.tile, type: sprite.type, snapped: true };
  if (w.door?.(tapped)) return { kind: 'walk', target: tapped, door: true };
  const act = w.actKind(tapped);
  if (act && TAP_ACTS.has(act)) return { kind: 'act', target: tapped, plan: act };
  if (!w.blocked(tapped)) return { kind: 'walk', target: tapped };
  return solidOwner(w, tapped) ?? { kind: 'none', target: tapped };
}

/** How far a tall drawing reaches above what it belongs to, and how far along a facade its door may be. */
const ART_UP = 6;
const FACADE_SIDE = 4;

/**
 * A tap on a solid tile with nothing of its own: the thing that art is drawn for. Straight down through the
 * solid run (a building, a tall prop): an interactable or a door at its foot; else along the run's bottom row
 * (a facade) to a door in it, or to an interactable or door just below it.
 */
function solidOwner(w: TapWorld, t: TileCoord): TapIntent | null {
  const hit = (c: TileCoord): TapIntent | null => {
    if (!w.inMap(c)) return null;
    const type = w.interactable(c);
    if (type) return { kind: 'interact', target: c, type, snapped: true };
    if (w.door?.(c)) return { kind: 'walk', target: c, door: true };
    return null;
  };
  let y = t.ty;
  for (let k = 0; k < ART_UP; k++) {
    const below = { tx: t.tx, ty: y + 1 };
    if (!w.inMap(below)) return null;
    const owner = hit(below);
    if (owner) return owner;
    if (!w.blocked(below)) break; // the foot of the solid run
    y++;
    if (k === ART_UP - 1) return null;
  }
  // along the bottom row of the run, both ways, while it stays solid
  for (const dx of [-1, 1]) {
    for (let k = 1; k <= FACADE_SIDE; k++) {
      const c = { tx: t.tx + dx * k, ty: y };
      if (!w.inMap(c)) break;
      const owner = hit(c) ?? (w.blocked(c) ? hit({ tx: c.tx, ty: y + 1 }) : null);
      if (owner) return owner;
      if (!w.blocked(c)) break;
    }
  }
  return null;
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
