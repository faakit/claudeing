import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, MAP_KEYS, TILESET_KEY, TILE_SIZE } from '../config';

export class FarmScene extends Phaser.Scene {
  constructor() {
    super('Farm');
  }

  create(): void {
    const map = this.make.tilemap({ key: MAP_KEYS.farm });
    const tileset = map.addTilesetImage('placeholder', TILESET_KEY, TILE_SIZE, TILE_SIZE, 0, 0);
    if (!tileset) throw new Error('Tileset "placeholder" missing from farm map');
    map.createLayer('ground', tileset);

    // M0 only: static camera, centered on the map. Movement arrives in M1.
    const cam = this.cameras.main;
    cam.setZoom(Math.min(1, GAME_WIDTH / map.widthInPixels, GAME_HEIGHT / map.heightInPixels));
    cam.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);
  }
}
