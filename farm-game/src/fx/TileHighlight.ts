import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { MARKER_COLORS, markerActs, type MarkerKind } from '../ui/targetMarker';

/**
 * Target marker on the tile Action would use. "Will act" is 2 px corner brackets in the action's colour;
 * "nothing to do" is four dim corner dots, so yes and no differ in shape as well as colour. Redraws only
 * when its kind changes. Also draws the short ring that answers a world tap.
 */
export class TileHighlight {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly ring: Phaser.GameObjects.Graphics;
  private kind: MarkerKind | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(1);
    this.ring = scene.add.graphics().setDepth(1).setVisible(false);
  }

  /** Show the marker on a tile, or hide it when `tile` is null (off the map). */
  update(tile: { tx: number; ty: number } | null, kind: MarkerKind, time: number): void {
    this.gfx.setVisible(tile !== null);
    if (!tile) return;
    if (kind !== this.kind) {
      this.kind = kind;
      this.draw(kind);
    }
    this.gfx.setPosition(tile.tx * TILE_SIZE + TILE_SIZE / 2, tile.ty * TILE_SIZE + TILE_SIZE / 2);
    const base = markerActs(kind) ? 1 : 0.7;
    this.gfx.setAlpha(base * (0.8 + 0.2 * Math.sin(time / 170)));
  }

  /** The kind currently drawn (for tests and the debug hook). */
  get shown(): MarkerKind | null {
    return this.gfx.visible ? this.kind : null;
  }

  /** Brief pop so every press feels acknowledged. */
  pulse(): void {
    this.scene.tweens.killTweensOf(this.gfx);
    this.gfx.setScale(1.3);
    this.scene.tweens.add({ targets: this.gfx, scale: 1, duration: 150, ease: 'Back.easeOut' });
  }

  /**
   * A small fading ring on a tapped tile: the visible answer to a tap that has nothing to do, so no
   * touch on the world is ever silent. `ok` rings use the action colour, refusals the dim one.
   */
  ping(tx: number, ty: number, ok = false): void {
    const r = this.ring;
    this.scene.tweens.killTweensOf(r);
    r.clear();
    r.lineStyle(3, 0x14101f, 0.5).strokeCircle(0, 0, 6);
    r.lineStyle(1, ok ? MARKER_COLORS.work : MARKER_COLORS.none, 1).strokeCircle(0, 0, 6);
    r.setPosition(tx * TILE_SIZE + TILE_SIZE / 2, ty * TILE_SIZE + TILE_SIZE / 2)
      .setVisible(true)
      .setAlpha(1)
      .setScale(0.6);
    this.scene.tweens.add({
      targets: r,
      scale: 1.3,
      alpha: 0,
      duration: 380,
      ease: 'Sine.easeOut',
      onComplete: () => r.setVisible(false),
    });
  }

  private draw(kind: MarkerKind): void {
    const g = this.gfx;
    const h = TILE_SIZE / 2;
    const color = MARKER_COLORS[kind];
    g.clear();
    const corners = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const;
    if (!markerActs(kind)) {
      // Nothing to do: four small dots at the corners (a dashed look), no brackets.
      for (const [sx, sy] of corners) {
        const cx = sx > 0 ? h - 3 : -h + 1;
        const cy = sy > 0 ? h - 3 : -h + 1;
        g.fillStyle(0x14101f, 0.5).fillRect(cx - 1, cy - 1, 4, 4);
        g.fillStyle(color, 0.9).fillRect(cx, cy, 2, 2);
      }
      return;
    }
    const len = 5;
    for (const [sx, sy] of corners) {
      const cx = sx * (h - 1);
      const cy = sy * (h - 1);
      const corner = () =>
        g
          .beginPath()
          .moveTo(cx - sx * len, cy)
          .lineTo(cx, cy)
          .lineTo(cx, cy - sy * len)
          .strokePath();
      g.lineStyle(4, 0x14101f, 0.55); // dark underlay keeps it visible on light tiles
      corner();
      g.lineStyle(2, color, 1);
      corner();
    }
  }
}
