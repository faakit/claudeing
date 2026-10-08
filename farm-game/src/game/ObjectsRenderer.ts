import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { items, placeables, plots } from '../data';
import { Label } from '../ui/font';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { houseOf, speciesOf } from '../systems/animals';
import { spriteOf, statusOf } from '../systems/placeables';

const calm = (): boolean => getState().settings.reduceMotion;

interface Shown {
  sprite: Phaser.GameObjects.Image;
  extra: Phaser.GameObjects.GameObject[];
  sig: string;
}

/**
 * Draws what lies on the ground of one map: forageables and placed machines. Reads state, never
 * edits it. Call `sync` after `forageChanged` / `placedChanged` / `farmChanged`.
 */
export class ObjectsRenderer {
  private forage = new Map<string, Shown>();
  private placed = new Map<number, Shown>();
  private nodeSprites = new Map<string, { sprite: Phaser.GameObjects.Image; id: string }>();
  private plotSig = '';
  private plotParts: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapId: string,
  ) {}

  sync(state: GameState, animate: boolean): void {
    this.syncForage(state, animate);
    this.syncPlaced(state, animate);
    this.syncNodes(state);
    if (this.mapId === 'farm') this.syncPlots(state);
  }

  /** Ore nodes: solid rocks with veins. They stay until broken. */
  private syncNodes(state: GameState): void {
    const here = state.nodes[this.mapId] ?? {};
    for (const [key, id] of Object.entries(here)) {
      const shown = this.nodeSprites.get(key);
      if (shown?.id === id) continue;
      shown?.sprite.destroy();
      const [tx, ty] = key.split(',').map(Number) as [number, number];
      const sprite = this.scene.add
        .image(tx * TILE_SIZE + TILE_SIZE / 2, (ty + 1) * TILE_SIZE, `node_${id}`)
        .setOrigin(0.5, 1)
        .setDepth(10 + (ty + 1) * TILE_SIZE - 3);
      this.nodeSprites.set(key, { sprite, id });
    }
    for (const [key, shown] of this.nodeSprites) {
      if (here[key]) continue;
      shown.sprite.destroy();
      this.nodeSprites.delete(key);
    }
  }

  /** Land you have not bought yet is dimmed and fenced with a "for sale" sign showing its price. */
  private syncPlots(state: GameState): void {
    const sig = state.plots.join(',');
    if (sig === this.plotSig) return;
    this.plotSig = sig;
    this.plotParts.forEach((p) => p.destroy());
    this.plotParts = [];
    for (const [id, p] of Object.entries(plots)) {
      if (state.plots.includes(id) || !p.sign) continue;
      const [x, y, w, h] = p.rect;
      const area = this.scene.add
        .rectangle(x * TILE_SIZE, y * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE, 0x14101f, 0.34)
        .setOrigin(0)
        .setStrokeStyle(1, 0xf4ead2, 0.45)
        .setDepth(0.55);
      const [sx, sy] = p.sign;
      const sign = this.scene.add
        .image(sx * TILE_SIZE + TILE_SIZE / 2, (sy + 1) * TILE_SIZE, 'obj_sign')
        .setOrigin(0.5, 1)
        .setDepth(10 + (sy + 1) * TILE_SIZE);
      const price = new Label(
        this.scene,
        sx * TILE_SIZE + TILE_SIZE / 2,
        sy * TILE_SIZE - 7,
        `${p.price}g`,
        { align: 'center', color: 0xf4d35e },
      ).setDepth(9000);
      this.plotParts.push(area, sign, price);
    }
  }

  private syncForage(state: GameState, animate: boolean): void {
    const here = state.forage[this.mapId] ?? {};
    for (const [key, item] of Object.entries(here)) {
      const shown = this.forage.get(key);
      if (shown?.sig === item) continue;
      shown?.sprite.destroy();
      shown?.extra.forEach((e) => e.destroy());
      const [tx, ty] = key.split(',').map(Number) as [number, number];
      const x = tx * TILE_SIZE + TILE_SIZE / 2;
      const y = ty * TILE_SIZE + TILE_SIZE / 2;
      const shadow = this.scene.add.ellipse(x, y + 5, 9, 3, 0x14101f, 0.3).setDepth(0.7);
      const sprite = this.scene.add
        .image(x, y, items[item]?.icon ?? 'ui_coin')
        .setScale(0.8)
        .setDepth(0.8 + ty * 0.001);
      // A gentle bob + a twinkle makes goods easy to spot from across a field.
      if (!calm())
        this.scene.tweens.add({
          targets: sprite,
          y: y - 1.5,
          duration: 900 + ((tx * 7 + ty * 13) % 5) * 90,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      const twinkle = this.scene.add
        .image(x + 4, y - 5, 'ui_star')
        .setScale(0.6)
        .setDepth(0.9);
      twinkle.setTint(0xfff1b0);
      if (calm()) twinkle.setAlpha(0.8);
      else
        this.scene.tweens.add({
          targets: twinkle,
          alpha: { from: 0, to: 1 },
          duration: 700,
          yoyo: true,
          repeat: -1,
          delay: (tx * 131 + ty * 71) % 900,
        });
      if (animate) {
        sprite.setScale(0.3);
        this.scene.tweens.add({ targets: sprite, scale: 0.8, duration: 260, ease: 'Back.easeOut' });
      }
      this.forage.set(key, { sprite, extra: [shadow, twinkle], sig: item });
    }
    for (const [key, shown] of this.forage) {
      if (here[key]) continue;
      this.scene.tweens.killTweensOf(shown.sprite);
      shown.extra.forEach((e) => {
        this.scene.tweens.killTweensOf(e);
        e.destroy();
      });
      shown.sprite.destroy();
      this.forage.delete(key);
    }
  }

  private syncPlaced(state: GameState, animate: boolean): void {
    const list = state.placed[this.mapId] ?? [];
    const live = new Set<number>();
    for (const obj of list) {
      live.add(obj.id);
      const def = placeables[obj.type];
      if (!def) continue;
      const house = def.behavior === 'animalHouse' ? houseOf(obj) : null;
      const sig = house
        ? `house${house.n}${house.ready > 0 ? 'r' : ''}${house.fed ? 'f' : ''}`
        : `${statusOf(obj)}:${spriteOf(obj)}`;
      const shown = this.placed.get(obj.id);
      if (shown?.sig === sig) continue;
      shown?.sprite.destroy();
      shown?.extra.forEach((e) => {
        this.scene.tweens.killTweensOf(e);
        e.destroy();
      });
      const x = obj.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = (obj.ty + 1) * TILE_SIZE;
      const sprite = this.scene.add
        .image(x, y, spriteOf(obj))
        .setOrigin(0.5, 1)
        .setDepth(10 + y - 3);
      const extra: Phaser.GameObjects.GameObject[] = [];
      if (sig.startsWith('busy') && def.behavior === 'jar') sprite.setTint(0xd9d9d9);
      if (sig.startsWith('ready')) {
        const mark = this.scene.add
          .image(x, y - 17, 'ui_star')
          .setTint(0xf4d35e)
          .setDepth(10 + y);
        this.scene.tweens.add({ targets: mark, y: y - 20, duration: 500, yoyo: true, repeat: -1 });
        extra.push(mark);
      }
      const species = house ? speciesOf(obj) : undefined;
      if (house && species) {
        // Residents mill about in front of the house; a bubble shows when goods are waiting.
        for (let i = 0; i < house.n; i++) {
          const home = x - 10 + i * 10;
          const critter = this.scene.add
            .image(home, y + 6, species.sprite)
            .setOrigin(0.5, 1)
            .setScale(0.62)
            .setDepth(10 + y + 4);
          if (!calm())
            this.scene.tweens.add({
              targets: critter,
              x: home + (i % 2 ? -6 : 6),
              duration: 1400 + i * 350,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut',
              onYoyo: () => critter.setFlipX(!critter.flipX),
              delay: i * 400,
            });
          extra.push(critter);
        }
        if (house.ready > 0) {
          const bubble = this.scene.add
            .image(x, y - 19, items[species.product]?.icon ?? 'ui_star')
            .setScale(0.8)
            .setDepth(10 + y + 8);
          if (!calm())
            this.scene.tweens.add({
              targets: bubble,
              y: y - 22,
              duration: 520,
              yoyo: true,
              repeat: -1,
            });
          extra.push(bubble);
        }
      }
      if (animate && !shown) {
        sprite.setScale(0.5);
        this.scene.tweens.add({ targets: sprite, scale: 1, duration: 240, ease: 'Back.easeOut' });
      }
      this.placed.set(obj.id, { sprite, extra, sig });
    }
    for (const [id, shown] of this.placed) {
      if (live.has(id)) continue;
      shown.sprite.destroy();
      shown.extra.forEach((e) => e.destroy());
      this.placed.delete(id);
    }
  }

  destroy(): void {
    for (const s of [...this.forage.values(), ...this.placed.values()]) {
      this.scene.tweens.killTweensOf(s.sprite);
      s.sprite.destroy();
      s.extra.forEach((e) => {
        this.scene.tweens.killTweensOf(e);
        e.destroy();
      });
    }
    this.forage.clear();
    this.placed.clear();
    this.plotParts.forEach((p) => p.destroy());
    this.plotParts = [];
    this.nodeSprites.forEach((n) => n.sprite.destroy());
    this.nodeSprites.clear();
  }
}
