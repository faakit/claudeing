import Phaser from 'phaser';
import { PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import { TILE_SIZE } from '../config';
import { npcs } from '../data';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { canChat } from '../systems/friendship';
import { npcLocation, npcMaps } from '../systems/npcs';
import { Label } from '../ui/font';
import { C } from '../ui/theme';

interface Shown {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  marker: Label;
  /** Where they stand on this map right now (null: elsewhere or at home). */
  at: { tx: number; ty: number } | null;
}

const px = (tx: number): number => tx * TILE_SIZE + TILE_SIZE / 2;
const feet = (ty: number): number => ty * TILE_SIZE + TILE_SIZE - 2;

/**
 * Draws the villagers who spend time on one map. They follow a daily schedule (see `npcLocation`), stand still
 * where they are, and block the tile they stand on. `sync` returns true when someone arrived or left.
 */
export class NpcRenderer {
  private shown = new Map<string, Shown>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapId: string,
  ) {
    for (const [id, def] of Object.entries(npcs)) {
      if (!npcMaps(id).includes(mapId)) continue;
      const shadow = scene.add.image(0, 0, SHADOW_TEXTURE).setVisible(false);
      const sprite = scene.add
        .sprite(0, 0, PLAYER_TEXTURE, playerIdleFrame(def.facing))
        .setOrigin(0.5, 1)
        .setTint(parseInt(def.tint.slice(1), 16))
        .setVisible(false);
      const calm = getState().settings.reduceMotion;
      if (!calm)
        scene.tweens.add({
          targets: sprite,
          scaleY: 1.03,
          duration: 900 + (id.length % 3) * 150,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      // A bobbing "!" says there is something new to hear today.
      const marker = new Label(scene, 0, 0, '!', { align: 'center', color: C.gold })
        .setDepth(9000)
        .setVisible(false);
      this.shown.set(id, { sprite, shadow, marker, at: null });
    }
  }

  /** Move villagers to where the schedule puts them now, and refresh the "!" markers. */
  sync(state: GameState, playerTile?: { tx: number; ty: number }): boolean {
    let moved = false;
    for (const [id, s] of this.shown) {
      const spot = npcLocation(id, state.time.minutes);
      const here = spot && spot.map === this.mapId ? spot : null;
      const blocked = here && playerTile && playerTile.tx === here.tx && playerTile.ty === here.ty;
      if (blocked) continue; // never step onto the player; try again next minute
      const changed =
        (here?.tx ?? -1) !== (s.at?.tx ?? -1) || (here?.ty ?? -1) !== (s.at?.ty ?? -1);
      if (changed) {
        moved = true;
        s.at = here ? { tx: here.tx, ty: here.ty } : null;
        if (here) {
          const x = px(here.tx);
          const y = feet(here.ty);
          s.sprite.setPosition(x, y).setDepth(10 + y);
          s.shadow.setPosition(x, y - 2).setDepth(9 + y);
          s.marker.setPosition(x, y - 36);
          this.scene.tweens.killTweensOf(s.marker);
          if (!getState().settings.reduceMotion)
            this.scene.tweens.add({
              targets: s.marker,
              y: y - 39,
              duration: 450,
              yoyo: true,
              repeat: -1,
            });
          s.sprite.setAlpha(0);
          this.scene.tweens.add({ targets: s.sprite, alpha: 1, duration: 300 });
        }
      }
      s.sprite.setVisible(!!here);
      s.shadow.setVisible(!!here);
      s.marker.setVisible(!!here && canChat(state, id));
    }
    return moved;
  }

  /** Tiles the villagers occupy right now (for the collision grid). */
  tiles(): [number, number][] {
    return [...this.shown.values()].filter((s) => s.at).map((s) => [s.at!.tx, s.at!.ty]);
  }

  /** Which villager stands on a tile right now, if any. */
  at(tx: number, ty: number): string | null {
    for (const [id, s] of this.shown) if (s.at && s.at.tx === tx && s.at.ty === ty) return id;
    return null;
  }

  /** Turn a villager toward the player who is talking to them. */
  faceToward(id: string, px0: number, py0: number): void {
    const s = this.shown.get(id);
    if (!s?.at) return;
    const dx = px0 - px(s.at.tx);
    const dy = py0 - (s.at.ty * TILE_SIZE + TILE_SIZE / 2);
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    s.sprite.setFrame(playerIdleFrame(dir));
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      this.scene.tweens.killTweensOf(s.sprite);
      this.scene.tweens.killTweensOf(s.marker);
      s.sprite.destroy();
      s.shadow.destroy();
      s.marker.destroy();
    }
    this.shown.clear();
  }
}
