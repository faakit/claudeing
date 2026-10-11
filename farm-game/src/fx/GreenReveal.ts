import Phaser from 'phaser';
import { MAP_ART_LAYERS } from '../art/mapLayers';
import { TILE_SIZE } from '../config';

/** How long the straw takes to give way to green, outward from the farmer (critic, M1 review 2). */
export const REVEAL_MS = 1200;
/** Width of the dithered edge (game px) and the size of its checker cells. */
const BAND = 6;
const CELL = 2;

/**
 * Overlay depths: just above every green ground and art layer (all at or below 0.1), below the soil (0.5) and every
 * object, so the dry copy covers the map's own look and nothing that stands on it. Crowns and lamps above 5000.
 */
const DEPTH: Record<string, number> = {
  ground: 0.2,
  detail: 0.22,
  shade: 0.23,
  props: 0.26,
  roof: 0.3,
  overhead: 5000.5,
  lamps: 5000.5,
};

/**
 * The first green (systems/valley.ts takeFirstGreenMoment): the map drawn once more with the dry tileset on top of
 * the green one, then cut away in a circle that grows from the farmer with a dithered edge, so the farm turns from
 * straw to green around them. Calm mode crossfades instead. Pure visuals: the overlay goes when it is done.
 */
export class GreenReveal {
  private readonly map: Phaser.Tilemaps.Tilemap;
  private readonly layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private readonly shape: Phaser.GameObjects.Graphics;
  private readonly mask: Phaser.Display.Masks.GeometryMask;
  private t = 0;
  private started = false;
  done = false;

  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  constructor(
    scene: Phaser.Scene,
    mapKey: string,
    dryKey: string,
    private readonly from: { x: number; y: number },
    private readonly calm: boolean,
  ) {
    this.camera = scene.cameras.main;
    this.map = scene.make.tilemap({ key: mapKey });
    const ts = this.map.addTilesetImage('placeholder', dryKey, TILE_SIZE, TILE_SIZE, 0, 0);
    this.shape = scene.make.graphics({}, false);
    this.mask = this.shape.createGeometryMask();
    this.mask.setInvertAlpha(true); // the dry copy shows everywhere the circle is not
    if (!ts) {
      this.done = true;
      return;
    }
    for (const name of ['ground', ...MAP_ART_LAYERS.map((l) => l.name)]) {
      if (this.map.getLayerIndex(name) === null) continue;
      const layer = this.map.createLayer(name, ts);
      if (!layer) continue;
      layer.setDepth(DEPTH[name] ?? 0.25);
      if (!calm) layer.setMask(this.mask);
      this.layers.push(layer);
    }
  }

  /** Start once the scene's door wipe has opened (the first frames show the straw). */
  start(): void {
    this.started = true;
  }

  /** The longest distance from the farmer to a corner of the view: the circle is done past it. */
  private reach(): number {
    const v = this.camera.worldView;
    const { x, y } = this.from;
    const dx = Math.max(Math.abs(v.x - x), Math.abs(v.right - x));
    const dy = Math.max(Math.abs(v.y - y), Math.abs(v.bottom - y));
    return Math.hypot(dx, dy) + 8;
  }

  update(dt: number): void {
    if (this.done || !this.started) return;
    this.t = Math.min(REVEAL_MS, this.t + dt);
    const k = this.t / REVEAL_MS;
    if (this.calm) {
      for (const l of this.layers) l.setAlpha(1 - k);
    } else {
      // eased both ways: the green wells up around the farmer, spreads, and settles at the edges of the view
      const e = (1 - Math.cos(Math.PI * k)) / 2;
      const r = e * (this.reach() + BAND);
      this.draw(r);
    }
    if (this.t >= REVEAL_MS) this.destroy();
  }

  /** The cut: a solid disc of radius r - BAND, and a checker of small cells in the band out to r. */
  private draw(r: number): void {
    const g = this.shape;
    const { x, y } = this.from;
    g.clear();
    g.fillStyle(0xffffff, 1);
    const inner = Math.max(0, r - BAND);
    if (inner > 0) g.fillCircle(x, y, inner);
    if (r <= 0) return;
    // per row, only the cells of the annulus (the band), so a frame costs about the band's length in cells
    for (let cy = Math.floor((y - r) / CELL) * CELL; cy < y + r; cy += CELL) {
      const dy = Math.abs(cy + CELL / 2 - y);
      if (dy > r) continue;
      const outer = Math.sqrt(r * r - dy * dy);
      const hole = dy < inner ? Math.sqrt(inner * inner - dy * dy) : 0;
      for (const [a, b] of [
        [x - outer, x - hole],
        [x + hole, x + outer],
      ] as const)
        for (let cx = Math.floor(a / CELL) * CELL; cx < b; cx += CELL) {
          const d = Math.hypot(cx + CELL / 2 - x, cy + CELL / 2 - y);
          if (d < inner || d > r) continue;
          // the outer half of the band keeps every other cell, the inner half three in four
          const odd = ((cx / CELL) ^ (cy / CELL)) & 1;
          if (odd || (d < inner + BAND / 2 && (cy / CELL) & 1)) g.fillRect(cx, cy, CELL, CELL);
        }
    }
  }

  /** The overlay layers right now (the e2e frame strip checks they come and go). */
  get live(): number {
    return this.layers.length;
  }

  destroy(): void {
    if (this.done && this.layers.length === 0) return;
    this.done = true;
    for (const l of this.layers) {
      l.clearMask();
      l.destroy();
    }
    this.layers.length = 0;
    this.map.destroy();
    this.mask.destroy();
    this.shape.destroy();
  }
}
