import Phaser from 'phaser';
import { TILE_SIZE } from '../config';

export type HighlightKind = 'free' | 'solid' | 'interactive' | 'harvest';

const COLORS: Record<HighlightKind, number> = {
  free: 0xffffff,
  solid: 0xf4ead2,
  interactive: 0xf4d35e,
  harvest: 0x9be37f,
};

/** Corner-bracket cursor on the tile the player is facing. Redraws only when its kind changes. */
export class TileHighlight {
  private readonly gfx: Phaser.GameObjects.Graphics;
  private kind: HighlightKind | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.gfx = scene.add.graphics().setDepth(1);
  }

  /** Show the cursor on a tile, or hide it when `tile` is null (off the map). */
  update(tile: { tx: number; ty: number } | null, kind: HighlightKind, time: number): void {
    this.gfx.setVisible(tile !== null);
    if (!tile) return;
    if (kind !== this.kind) {
      this.kind = kind;
      this.draw(kind);
    }
    this.gfx.setPosition(tile.tx * TILE_SIZE + TILE_SIZE / 2, tile.ty * TILE_SIZE + TILE_SIZE / 2);
    const base = kind === 'solid' ? 0.4 : 1;
    this.gfx.setAlpha(base * (0.78 + 0.22 * Math.sin(time / 170)));
  }

  /** Brief pop so every press feels acknowledged. */
  pulse(): void {
    this.scene.tweens.killTweensOf(this.gfx);
    this.gfx.setScale(1.3);
    this.scene.tweens.add({ targets: this.gfx, scale: 1, duration: 150, ease: 'Back.easeOut' });
  }

  /** Brackets read well on any ground color and never hide the tile. */
  private draw(kind: HighlightKind): void {
    const g = this.gfx;
    const h = TILE_SIZE / 2;
    const len = 4;
    g.clear();
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      const cx = sx * (h - 1);
      const cy = sy * (h - 1);
      const corner = () =>
        g
          .beginPath()
          .moveTo(cx - sx * len, cy)
          .lineTo(cx, cy)
          .lineTo(cx, cy - sy * len)
          .strokePath();
      g.lineStyle(3, 0x14101f, 0.55); // dark underlay keeps it visible on light tiles
      corner();
      g.lineStyle(1, COLORS[kind], 1);
      corner();
    }
  }
}
