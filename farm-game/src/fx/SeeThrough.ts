import type Phaser from 'phaser';

/**
 * The see-through hole (art critic, review 9): where a crown, an eave or a tall placed object stands in front of
 * the player or their target, it is cut away in a pixel-art way instead of turning translucent. Fully clear inside
 * about 9 px of the player's body and 10 px of the target tile's centre, with a 2 px checker rim; outside it
 * everything stays opaque, so the player and the target marker are never tinted by foliage.
 *
 * One inverted geometry mask, shared by the overhead layer and any tall sprite that needs it; it is applied only
 * while something actually covers the player, so it costs nothing elsewhere.
 *
 * Owner bug (2026-10-11, "the tree faded and the character appeared fully, in a strange way"): the hole popped
 * in and out at full size, was cut whenever any overhead tile came within 13 px of the body (so passing beside a
 * crown, or standing just south of it, bit a disc out of it), and its 11 px radius erased most of a lone crown. Now:
 * - it opens only when the crown covers the player's lower body (`bodyCover`, the player's own tile row), which a
 *   crown does only when the player is behind its trunk; beside or in front, the crown may overlap the hair and
 *   nothing is cut (`wantHole`, with hysteresis so it cannot flicker on a crown's ragged edge);
 * - it grows from nothing and shrinks back in `HOLE_EASE_MS` (whole-pixel radii, the checker rim at every size);
 * - the body hole is a 5 px capsule over the head and torso (`HOLE_BODY_Y`), so a crown keeps most of its mass;
 * - the target tile is cut only when the crown covers its centre and the player is behind the crown or standing
 *   still facing it, never while walking past, and never while the player is behind that same crown (the target
 *   then sits under the crown he is already seen through: cutting it too erased a lone crown).
 */
export const HOLE = { body: 5, target: 10, rim: 2 } as const;

/**
 * Where the body hole's circles sit, in px above the feet: a capsule over the head and torso only (the sprite's
 * hair reaches 26 px up). Coordinator ruling after the integration review: the lone crown on walk-behind-tree is
 * about 30 px across, and the old two 9 px circles plus the target tile's circle took 29 px of it; a crown must
 * keep at least about 60% of itself around the farmer.
 */
export const HOLE_BODY_Y = [8, 14, 20] as const;

/** Time for the hole to open fully, or to close (ms). */
export const HOLE_EASE_MS = 150;

/**
 * Opaque overhead pixels (of the 10 x 12 below the player's shoulders, and of the target tile's centre 8 x 8) that
 * open the hole, and below which an open one closes.
 */
export const COVER = {
  body: { on: 36, off: 10 },
  target: { on: 24, off: 8 },
} as const;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** How open each part of the hole is, 0 (closed) to 1 (full size). */
export interface HoleOpen {
  body: number;
  target: number;
}

export interface HoleWant {
  body: boolean;
  target: boolean;
}

export const NO_HOLE: HoleWant = { body: false, target: false };

/** Is the overhead art opaque at this world pixel? */
export type Opaque = (x: number, y: number) => boolean;

/**
 * Opaque overhead pixels over the player's lower body: 10 px wide, the 12 rows above the feet (px, py). With feet at
 * tile row ty (py = ty * 16 + 11) that is the player's own tile row, where the generator puts a crown only when its
 * trunk stands further south: the player is behind the tree. Pure.
 */
export function bodyCover(px: number, py: number, opaque: Opaque): number {
  const x0 = Math.round(px) - 5;
  const y0 = Math.round(py) - 12;
  let n = 0;
  for (let y = y0; y < y0 + 12; y++) for (let x = x0; x < x0 + 10; x++) if (opaque(x, y)) n++;
  return n;
}

/** Opaque overhead pixels over the centre 8 x 8 of a tile (where the target marker reads). Pure. */
export function tileCover(t: { tx: number; ty: number }, opaque: Opaque): number {
  const x0 = t.tx * 16 + 4;
  const y0 = t.ty * 16 + 4;
  let n = 0;
  for (let y = y0; y < y0 + 8; y++) for (let x = x0; x < x0 + 8; x++) if (opaque(x, y)) n++;
  return n;
}

/**
 * Should the hole be open, given what it was last time (hysteresis) and how much the overhead art covers? The body
 * part opens when a crown covers the lower body; the target part when a crown covers the target's centre and the
 * player is behind it, standing still, or the target part was already open. Pure.
 */
export function wantHole(
  prev: HoleWant,
  px: number,
  py: number,
  target: { tx: number; ty: number } | undefined,
  opaque: Opaque,
  still: boolean,
  sameCrown: (t: { tx: number; ty: number }) => boolean = () => false,
): HoleWant {
  const body = bodyCover(px, py, opaque) >= (prev.body ? COVER.body.off : COVER.body.on);
  const covered =
    !!target && tileCover(target, opaque) >= (prev.target ? COVER.target.off : COVER.target.on);
  // behind a crown, a target under that same crown stays drawn (the body hole already shows the farmer)
  const shared = body && !!target && sameCrown(target);
  return { body, target: covered && !shared && (body || still || prev.target) };
}

/** One frame of the hole's ease toward open (want) or closed. Pure. */
export function easeOpen(open: number, want: boolean, dtMs: number): number {
  const step = Math.max(0, dtMs) / HOLE_EASE_MS;
  return Math.min(1, Math.max(0, open + (want ? step : -step)));
}

/** A circle's radius at an ease amount (smoothstep), in whole pixels; 0 means no circle. Pure. */
export function holeRadius(r: number, open: number): number {
  if (open <= 0) return 0;
  const k = Math.min(1, open);
  return Math.round(r * k * k * (3 - 2 * k));
}

/**
 * The hole's circles: a capsule over the player's head and torso (feet at px, py; `HOLE_BODY_Y`) and one on the
 * target tile, each at its ease amount (full size by default). Circles eased to nothing are left out. Pure.
 */
export function holeCircles(
  px: number,
  py: number,
  target?: { tx: number; ty: number },
  open: HoleOpen = { body: 1, target: 1 },
): Circle[] {
  const out: Circle[] = [];
  const rb = holeRadius(HOLE.body, open.body);
  if (rb > 0)
    for (const dy of HOLE_BODY_Y) out.push({ x: Math.round(px), y: Math.round(py) - dy, r: rb });
  const rt = holeRadius(HOLE.target, open.target);
  if (target && rt > 0) out.push({ x: target.tx * 16 + 8, y: target.ty * 16 + 8, r: rt });
  return out;
}

/** The tiles the hole's circles (and rims) touch. Pure. */
export function holeTiles(circles: Circle[]): [number, number][] {
  const out = new Map<string, [number, number]>();
  for (const c of circles) {
    const r = c.r + HOLE.rim;
    for (let y = Math.floor((c.y - r) / 16); y <= Math.floor((c.y + r) / 16); y++)
      for (let x = Math.floor((c.x - r) / 16); x <= Math.floor((c.x + r) / 16); x++)
        out.set(`${x},${y}`, [x, y]);
  }
  return [...out.values()];
}

/**
 * The hole as horizontal pixel runs [x, y, width]: every pixel inside a circle, plus a checker of pixels within the
 * rim. The checker is in world pixels, so it does not crawl as the player moves. Pure, for tests.
 */
export function holeRuns(circles: Circle[]): [number, number, number][] {
  if (!circles.length) return [];
  const pad = HOLE.rim + 1;
  const x0 = Math.min(...circles.map((c) => c.x - c.r)) - pad;
  const x1 = Math.max(...circles.map((c) => c.x + c.r)) + pad;
  const y0 = Math.min(...circles.map((c) => c.y - c.r)) - pad;
  const y1 = Math.max(...circles.map((c) => c.y + c.r)) + pad;
  const runs: [number, number, number][] = [];
  for (let y = y0; y <= y1; y++) {
    let start = -1;
    for (let x = x0; x <= x1 + 1; x++) {
      let on = false;
      if (x <= x1) {
        let d = Infinity;
        for (const c of circles) {
          const dx = x + 0.5 - c.x;
          const dy = y + 0.5 - c.y;
          d = Math.min(d, Math.sqrt(dx * dx + dy * dy) - c.r);
        }
        on = d <= 0 || (d <= HOLE.rim && (x + y) % 2 === 0);
      }
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        runs.push([start, y, x - start]);
        start = -1;
      }
    }
  }
  return runs;
}

/** A bottom-anchored sprite's box: centre x, bottom edge, half width, top edge (world px). */
export interface Box {
  x: number;
  bottom: number;
  half: number;
  top: number;
}

/**
 * Is the player (feet at px, py) behind a tall sprite? Behind means the sprite covers the lower body and the feet
 * are north of its base row: standing beside its base or in front of it never counts. Pure.
 */
export function behindBox(b: Box, px: number, py: number): boolean {
  return Math.abs(px - b.x) < b.half && py - 6 > b.top && py < b.bottom - 12;
}

/** Does a tall sprite cover the target tile's centre (north of its base row)? Pure. */
export function boxCoversTile(b: Box, t: { tx: number; ty: number }): boolean {
  const cx = t.tx * 16 + 8;
  const cy = t.ty * 16 + 8;
  return Math.abs(cx - b.x) < b.half && cy > b.top && cy < b.bottom - 16;
}

export class SeeThrough {
  private readonly g: Phaser.GameObjects.Graphics;
  readonly mask: Phaser.Display.Masks.GeometryMask;
  private key = '';
  private readonly open: HoleOpen = { body: 0, target: 0 };
  private target: { tx: number; ty: number } | undefined;
  /** The hole's pixel runs as last drawn (for the e2e that measures how much of a crown stays). */
  runs: [number, number, number][] = [];

  constructor(scene: Phaser.Scene) {
    this.g = scene.make.graphics({}, false);
    this.mask = this.g.createGeometryMask();
    this.mask.setInvertAlpha(true);
  }

  /** Whether any part of the hole is cut (open, opening or closing). */
  get isOpen(): boolean {
    return this.open.body > 0 || this.open.target > 0;
  }

  /**
   * Ease the hole toward what is wanted and redraw it around the player (feet at px, py) and their target tile.
   * While the target part closes it stays on the tile it was opened on.
   */
  update(
    px: number,
    py: number,
    target: { tx: number; ty: number } | undefined,
    want: HoleWant,
    dtMs: number,
  ): void {
    this.open.body = easeOpen(this.open.body, want.body, dtMs);
    this.open.target = easeOpen(this.open.target, want.target && !!target, dtMs);
    if (want.target && target) this.target = target;
    const t = this.open.target > 0 ? this.target : undefined;
    const rb = holeRadius(HOLE.body, this.open.body);
    const rt = holeRadius(HOLE.target, this.open.target);
    const key = `${Math.round(px)},${Math.round(py)},${t?.tx},${t?.ty},${rb},${rt}`;
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    this.g.fillStyle(0xffffff, 1);
    this.runs = holeRuns(holeCircles(px, py, t, this.open));
    for (const [x, y, w] of this.runs) this.g.fillRect(x, y, w, 1);
  }

  destroy(): void {
    this.mask.destroy();
    this.g.destroy();
  }
}
