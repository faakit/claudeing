import Phaser from 'phaser';
import { generateGameArt } from '../art/gameArt';
import { generateFont } from '../ui/font';
import { generatePlaceholderTextures, PLAYER_TEXTURE, playerWalkFrames } from '../art/placeholders';
import { WALK_FPS } from '../config';
import { npcs } from '../data';
import { applyArt, queueArtLoads } from '../art/atlasLoader';
import { NPC_IDLE_SEQUENCE, npcFrame, npcTexture, PLAYER_WALK_FRAMES } from '../art/manifest';
import { DIRECTIONS } from '../systems/direction';
import { allMapLooks, type MapLook } from '../systems/valley';

/**
 * Tilemap cache key of a map file: `map_<id>` for a map's own file (its final stage, or its only look),
 * `map_<id>@<variant>` for an earlier stage's file (systems/valley.ts).
 */
export const mapCacheKey = (mapId: string, variant: string | null = null) =>
  variant ? `map_${mapId}@${variant}` : `map_${mapId}`;
/** The cache key of one stage's file. */
export const lookCacheKey = (look: MapLook): string =>
  mapCacheKey(look.map, look.final ? null : look.variant);

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('Preload');
  }

  preload(): void {
    queueArtLoads(this);
    // every stage of every map is loaded up front (each 9-90 KB), so a stage change never fetches at a door
    for (const look of allMapLooks()) this.load.tilemapTiledJSON(lookCacheKey(look), look.file);
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
