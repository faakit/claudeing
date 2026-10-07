import Phaser from 'phaser';
import { MAP_KEYS, PLACEHOLDER_TILES, TILESET_KEY, TILE_SIZE } from '../config';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    this.load.tilemapTiledJSON(MAP_KEYS.farm, 'assets/maps/farm.tmj');
  }

  create(): void {
    this.generatePlaceholderTileset();
    this.scene.start('Farm');
  }

  /** M0 placeholder art: one flat-colored square per tile, with a subtle border. */
  private generatePlaceholderTileset(): void {
    const tex = this.textures.createCanvas(
      TILESET_KEY,
      TILE_SIZE * PLACEHOLDER_TILES.length,
      TILE_SIZE,
    );
    if (!tex) throw new Error(`Could not create texture ${TILESET_KEY}`);
    const ctx = tex.getContext();
    PLACEHOLDER_TILES.forEach((tile, i) => {
      ctx.fillStyle = tile.color;
      ctx.fillRect(i * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(i * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE, 1);
      ctx.fillRect(i * TILE_SIZE + TILE_SIZE - 1, 0, 1, TILE_SIZE);
    });
    tex.refresh();
  }
}
