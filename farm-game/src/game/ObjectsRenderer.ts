import Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import { items, placeables, plots } from '../data';
import { Label } from '../ui/font';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { houseOf, speciesOf } from '../systems/animals';
import { spriteOf, statusOf } from '../systems/placeables';
import { hasArt } from '../art/registry';
import { animalIdleKey } from '../art/manifest';
import { landmarksOn } from '../systems/projects';
import { ownsPlot, signVisible } from '../systems/plots';
import { unreadCount } from '../systems/mail';
import { mail } from '../data';
import { ensureTexture } from './fallbackTexture';

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
  private landmarks = new Map<string, Phaser.GameObjects.Image>();
  private mailbox: Phaser.GameObjects.Image | null = null;
  private mailMark: Phaser.GameObjects.Image | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly mapId: string,
  ) {}

  sync(state: GameState, animate: boolean): void {
    this.syncForage(state, animate);
    this.syncPlaced(state, animate);
    this.syncNodes(state);
    this.syncLandmarks(state);
    this.syncMailbox(state);
    if (this.mapId === 'farm') this.syncPlots(state);
  }

  /** The mailbox, with a bouncing marker while a letter or gift waits. */
  syncMailbox(state: GameState): void {
    const box = mail.mailbox;
    if (box.map !== this.mapId) return;
    const x = box.tx * TILE_SIZE + TILE_SIZE / 2;
    const y = (box.ty + 1) * TILE_SIZE;
    this.mailbox ??= this.scene.add
      .image(x, y, ensureTexture(this.scene, box.sprite, box.color, 'post'))
      .setOrigin(0.5, 1)
      .setDepth(10 + y - 3);
    const waiting = unreadCount(state) > 0;
    if (waiting && !this.mailMark) {
      this.mailMark = this.scene.add
        .image(x, y - 17, 'ui_star')
        .setTint(0xf4d35e)
        .setDepth(10 + y);
      if (!calm())
        this.scene.tweens.add({
          targets: this.mailMark,
          y: y - 20,
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
    } else if (!waiting && this.mailMark) {
      this.scene.tweens.killTweensOf(this.mailMark);
      this.mailMark.destroy();
      this.mailMark = null;
    }
  }

  /**
   * Buildings from finished town projects and trophies at home: one solid tile each, drawn like any placed
   * object. A growing one (the statue) is swapped when its level's sprite changes.
   */
  private syncLandmarks(state: GameState): void {
    for (const l of landmarksOn(state, this.mapId)) {
      const shown = this.landmarks.get(l.id);
      if (shown?.getData('sprite') === l.sprite) continue;
      shown?.destroy();
      const y = (l.ty + 1) * TILE_SIZE;
      const shape = l.kind === 'trophy' ? 'trophy' : l.level ? 'statue' : 'house';
      const sprite = this.scene.add
        .image(
          l.tx * TILE_SIZE + TILE_SIZE / 2,
          y,
          ensureTexture(this.scene, l.sprite, l.color, shape, l.level),
        )
        .setOrigin(0.5, 1)
        .setDepth(10 + y - 3)
        .setData('sprite', l.sprite);
      this.landmarks.set(l.id, sprite);
    }
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
    const sig = Object.keys(plots)
      .map((id) => (ownsPlot(state, id) ? '1' : signVisible(state, id) ? 's' : '0'))
      .join('');
    if (sig === this.plotSig) return;
    this.plotSig = sig;
    this.plotParts.forEach((p) => p.destroy());
    this.plotParts = [];
    for (const [id, p] of Object.entries(plots)) {
      if (p.project) {
        // A plot that comes with a town project: a marked site until it is built, then glass.
        const [x, y, w, h] = p.rect;
        const built = ownsPlot(state, id);
        const area = this.scene.add
          .rectangle(
            x * TILE_SIZE,
            y * TILE_SIZE,
            w * TILE_SIZE,
            h * TILE_SIZE,
            built ? 0xbfe6ff : 0x14101f,
            built ? 0.16 : 0.3,
          )
          .setOrigin(0)
          .setStrokeStyle(1, built ? 0xdff4ff : 0xf4ead2, built ? 0.8 : 0.4)
          .setDepth(0.55);
        this.plotParts.push(area);
        if (!built)
          this.plotParts.push(
            new Label(
              this.scene,
              (x + w / 2) * TILE_SIZE,
              (y + h / 2) * TILE_SIZE - 4,
              `${p.name} site`,
              {
                align: 'center',
                color: 0xf4ead2,
              },
            ).setDepth(1),
          );
        continue;
      }
      if (ownsPlot(state, id) || !p.sign) continue;
      // Land you do not own is always dimmed; its sign and price go up once it is within reach.
      const [x, y, w, h] = p.rect;
      const area = this.scene.add
        .rectangle(x * TILE_SIZE, y * TILE_SIZE, w * TILE_SIZE, h * TILE_SIZE, 0x14101f, 0.34)
        .setOrigin(0)
        .setStrokeStyle(1, 0xf4ead2, 0.45)
        .setDepth(0.55);
      this.plotParts.push(area);
      if (!signVisible(state, id)) continue;
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
      this.plotParts.push(sign, price);
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
      // A soft golden ring under it pulses, so goods read as "pick me" from across a field.
      const ring = this.scene.add
        .ellipse(x, y + 4, 14, 6)
        .setStrokeStyle(1, 0xf4d35e, 0.9)
        .setDepth(0.71);
      if (!calm())
        this.scene.tweens.add({
          targets: ring,
          scaleX: 1.35,
          scaleY: 1.35,
          alpha: { from: 0.9, to: 0.15 },
          duration: 1100,
          repeat: -1,
          delay: (tx * 97 + ty * 53) % 1100,
        });
      const twinkle = this.scene.add
        .image(x + 4, y - 5, 'ui_star')
        .setScale(0.8)
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
      this.forage.set(key, { sprite, extra: [shadow, ring, twinkle], sig: item });
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
      // Flat things (a stone path) lie on the ground: under the player, never over them.
      const flat = def.params['flat'] === true;
      const sprite = this.scene.add
        .image(x, y, spriteOf(obj))
        .setOrigin(0.5, 1)
        .setDepth(flat ? 0.6 : 10 + y - 3);
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
          // Real art is drawn at its own small size; the 16 px placeholder is shrunk.
          const art = hasArt(species.sprite);
          const critter = this.scene.add
            .image(home, y + 6, species.sprite)
            .setOrigin(0.5, 1)
            .setScale(art ? 1 : 0.62)
            .setDepth(10 + y + 4);
          const idle2 = animalIdleKey(species.sprite);
          if (!calm() && hasArt(idle2))
            this.scene.tweens.add({
              targets: critter,
              alpha: 1,
              duration: 700 + i * 130,
              repeat: -1,
              onRepeat: () => {
                if (critter.active)
                  critter.setTexture(critter.texture.key === idle2 ? species.sprite : idle2);
              },
            });
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
      this.scene.tweens.killTweensOf(shown.sprite);
      shown.sprite.destroy();
      // Kill looping tweens first: a resident's idle tween would otherwise touch a destroyed image.
      shown.extra.forEach((e) => {
        this.scene.tweens.killTweensOf(e);
        e.destroy();
      });
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
    this.landmarks.forEach((l) => l.destroy());
    this.landmarks.clear();
    this.mailbox?.destroy();
    this.mailbox = null;
    if (this.mailMark) this.scene.tweens.killTweensOf(this.mailMark);
    this.mailMark?.destroy();
    this.mailMark = null;
  }
}
