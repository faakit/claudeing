import type Phaser from 'phaser';

/**
 * The see-through hole (art critic, review 9): where a crown, an eave or a tall placed object stands in front of
 * the player or their target, it is cut away in a pixel-art way instead of turning translucent. Fully clear inside
 * about 11 px of the player's body and 10 px of the target tile's centre, with a 2 px checker rim; outside it
 * everything stays opaque, so the player and the target marker are never tinted by foliage.
 *
 * One inverted geometry mask, shared by the overhead layer and any tall sprite that needs it; it is applied only
 * while something actually covers the player, so it costs nothing elsewhere.
 */
export const HOLE = { body: 11, target: 10, rim: 2 } as const;

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** The hole's circles: two along the player's body (feet at px, py) and one on the target tile. Pure. */
export function holeCircles(px: number, py: number, target?: { tx: number; ty: number }): Circle[] {
  const out: Circle[] = [
    { x: Math.round(px), y: Math.round(py) - 6, r: HOLE.body },
    { x: Math.round(px), y: Math.round(py) - 18, r: HOLE.body },
  ];
  if (target) out.push({ x: target.tx * 16 + 8, y: target.ty * 16 + 8, r: HOLE.target });
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
 * rim. Pure, for tests.
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

export class SeeThrough {
  private readonly g: Phaser.GameObjects.Graphics;
  readonly mask: Phaser.Display.Masks.GeometryMask;
  private key = '';

  constructor(scene: Phaser.Scene) {
    this.g = scene.make.graphics({}, false);
    this.mask = this.g.createGeometryMask();
    this.mask.setInvertAlpha(true);
  }

  /** Redraw the hole around the player (feet at px, py) and their target tile. */
  update(px: number, py: number, target?: { tx: number; ty: number }): void {
    const key = `${Math.round(px)},${Math.round(py)},${target?.tx},${target?.ty}`;
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    this.g.fillStyle(0xffffff, 1);
    for (const [x, y, w] of holeRuns(holeCircles(px, py, target))) this.g.fillRect(x, y, w, 1);
  }

  destroy(): void {
    this.mask.destroy();
    this.g.destroy();
  }
}
