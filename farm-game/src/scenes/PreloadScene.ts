import Phaser from 'phaser';
import { generateGameArt } from '../art/gameArt';
import { generateFont } from '../ui/font';
import { generatePlaceholderTextures, PLAYER_TEXTURE, playerWalkFrames } from '../art/placeholders';
import { WALK_FPS } from '../config';
import { mapsData, npcs } from '../data';
import { applyArt, queueArtLoads } from '../art/atlasLoader';
import { npcFrame, npcTexture } from '../art/manifest';
import { DIRECTIONS } from '../systems/direction';

export const mapCacheKey = (mapId: string) => `map_${mapId}`;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    queueArtLoads(this);
    for (const [id, def] of Object.entries(mapsData.maps)) {
      this.load.tilemapTiledJSON(mapCacheKey(id), def.file);
    }
  }

  create(): void {
    generateFont(this);
    generatePlaceholderTextures(this);
    generateGameArt(this);
    applyArt(this);
    for (const dir of DIRECTIONS) {
      this.anims.create({
        key: `player_walk_${dir}`,
        frames: playerWalkFrames(dir).map((frame) => ({ key: PLAYER_TEXTURE, frame })),
        frameRate: WALK_FPS,
        repeat: -1,
      });
    }
    for (const id of Object.keys(npcs))
      for (const dir of DIRECTIONS)
        this.anims.create({
          key: `${npcTexture(id)}_idle_${dir}`,
          frames: [0, 1].map((i) => ({ key: npcTexture(id), frame: npcFrame(id, dir, i) })),
          frameRate: 2,
          repeat: -1,
        });
    this.scene.start('Title');
  }
}
