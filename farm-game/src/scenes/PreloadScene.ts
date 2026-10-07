import Phaser from 'phaser';
import { generateGameArt } from '../art/gameArt';
import { generateFont } from '../ui/font';
import { generatePlaceholderTextures, PLAYER_TEXTURE, playerWalkFrames } from '../art/placeholders';
import { WALK_FPS } from '../config';
import { mapsData } from '../data';
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
    generateFont(this);
    generatePlaceholderTextures(this);
    generateGameArt(this);
    for (const dir of DIRECTIONS) {
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: playerWalkFrames(dir).map((frame) => ({ key: PLAYER_TEXTURE, frame })),
        frameRate: WALK_FPS,
        repeat: -1,
      });
    }
    this.scene.start('Title');
  }
}
