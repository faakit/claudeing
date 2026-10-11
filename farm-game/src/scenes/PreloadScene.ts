import Phaser from 'phaser';
import { generateGameArt } from '../art/gameArt';
import { generateFont } from '../ui/font';
import { generatePlaceholderTextures, PLAYER_TEXTURE, playerWalkFrames } from '../art/placeholders';
import { WALK_FPS } from '../config';
import { mapsData, npcs } from '../data';
import { applyArt, queueArtLoads } from '../art/atlasLoader';
import { NPC_IDLE_SEQUENCE, npcFrame, npcTexture, PLAYER_WALK_FRAMES } from '../art/manifest';
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
        // art round 4: 8 frames per cycle, so twice the rate keeps the old cycle time (the feel agent tunes it)
        frameRate: (WALK_FPS * PLAYER_WALK_FRAMES) / 4,
        repeat: -1,
      });
    }
    for (const id of Object.keys(npcs))
      for (const dir of DIRECTIONS)
        this.anims.create({
          key: `${npcTexture(id)}_idle_${dir}`,
          // art round 4: rest (long hold), breathe, blink, the villager's own beat; ms per frame (the feel
          // agent may retune). Reduced motion never plays it (NpcRenderer holds frame 0).
          frames: NPC_IDLE_SEQUENCE.map(([i, duration]) => ({
            key: npcTexture(id),
            frame: npcFrame(id, dir, i),
            duration,
          })),
          frameRate: 2,
          repeat: -1,
        });
    this.scene.start('Title');
  }
}
