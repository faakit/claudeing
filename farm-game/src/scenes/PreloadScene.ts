import Phaser from 'phaser';
import { generatePlaceholderTextures, PLAYER_TEXTURE, playerWalkFrames } from '../art/placeholders';
import { WALK_FPS } from '../config';
import { mapsData } from '../data';
import { getState } from '../state/store';
import { DIRECTIONS } from '../systems/direction';

export const mapCacheKey = (mapId: string) => `map_${mapId}`;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    for (const [id, def] of Object.entries(mapsData.maps)) {
      this.load.tilemapTiledJSON(mapCacheKey(id), def.file);
    }
  }

  create(): void {
    generatePlaceholderTextures(this);
    for (const dir of DIRECTIONS) {
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: playerWalkFrames(dir).map((frame) => ({ key: PLAYER_TEXTURE, frame })),
        frameRate: WALK_FPS,
        repeat: -1,
      });
    }
    const start = mapsData.maps[getState().player.map];
    if (!start) throw new Error(`Start map "${getState().player.map}" is not defined`);
    this.scene.start(start.scene);
    this.scene.launch('UI');
  }
}
