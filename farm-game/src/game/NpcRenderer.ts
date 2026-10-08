import Phaser from 'phaser';
import { PLAYER_TEXTURE, playerIdleFrame, SHADOW_TEXTURE } from '../art/placeholders';
import { TILE_SIZE } from '../config';
import { npcs } from '../data';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { canChat } from '../systems/friendship';
import { Label } from '../ui/font';
import { C } from '../ui/theme';

interface Shown {
  sprite: Phaser.GameObjects.Sprite;
  marker: Label;
  parts: Phaser.GameObjects.GameObject[];
}

/** Draws the villagers who live on one map. They stand still and block the tile they stand on. */
export class NpcRenderer {
  private shown = new Map<string, Shown>();

  constructor(
    private readonly scene: Phaser.Scene,
    mapId: string,
  ) {
    for (const [id, def] of Object.entries(npcs)) {
      if (def.map !== mapId) continue;
      const x = def.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = def.ty * TILE_SIZE + TILE_SIZE - 2;
      const shadow = scene.add.image(x, y - 2, SHADOW_TEXTURE).setDepth(9 + y);
      const sprite = scene.add
        .sprite(x, y, PLAYER_TEXTURE, playerIdleFrame(def.facing))
        .setOrigin(0.5, 1)
        .setTint(parseInt(def.tint.slice(1), 16))
        .setDepth(10 + y);
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
      const marker = new Label(scene, x, y - 36, '!', { align: 'center', color: C.gold }).setDepth(
        9000,
      );
      if (!calm)
        scene.tweens.add({ targets: marker, y: y - 39, duration: 450, yoyo: true, repeat: -1 });
      this.shown.set(id, { sprite, marker, parts: [shadow] });
    }
  }

  /** Update the "!" markers from state. */
  sync(state: GameState): void {
    for (const [id, s] of this.shown) s.marker.setVisible(canChat(state, id));
  }

  /** Tiles the villagers occupy (for the collision grid). */
  tiles(): [number, number][] {
    return [...this.shown.keys()].map((id) => [npcs[id]!.tx, npcs[id]!.ty]);
  }

  /** Which villager stands on a tile, if any. */
  at(tx: number, ty: number): string | null {
    for (const id of this.shown.keys()) if (npcs[id]!.tx === tx && npcs[id]!.ty === ty) return id;
    return null;
  }

  /** Turn a villager toward the player who is talking to them. */
  faceToward(id: string, px: number, py: number): void {
    const s = this.shown.get(id);
    const def = npcs[id];
    if (!s || !def) return;
    const dx = px - (def.tx * TILE_SIZE + TILE_SIZE / 2);
    const dy = py - (def.ty * TILE_SIZE + TILE_SIZE / 2);
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    s.sprite.setFrame(playerIdleFrame(dir));
  }

  destroy(): void {
    for (const s of this.shown.values()) {
      this.scene.tweens.killTweensOf(s.sprite);
      this.scene.tweens.killTweensOf(s.marker);
      s.sprite.destroy();
      s.marker.destroy();
      s.parts.forEach((p) => p.destroy());
    }
    this.shown.clear();
  }
}
