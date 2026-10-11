import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { ATLAS_FILES } from '../art/manifest';
import { getState } from '../state/store';
import { Label } from '../ui/font';
import { popSize } from './feel';

/** Calm mode (reduced motion): no particles, hops or swings; things appear and fade in place. */
const calm = (): boolean => getState().settings.reduceMotion;

interface Burst {
  count: number;
  color: number | number[];
  speed: number;
  life: number;
  gravity?: number;
  size?: number;
  up?: number;
  spread?: number;
}

/**
 * Pooled particles, floating numbers and tool swings. Purely cosmetic. Everything moves and sizes in whole pixels
 * (particles are 1 or 2 px squares, icons squash by whole pixels, swings turn in quarter turns), and Calm mode
 * drops the motion.
 */
export class Effects {
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  private grab(): Phaser.GameObjects.Image {
    const p = this.pool.pop() ?? this.scene.add.image(0, 0, PX_TEXTURE);
    return p.setVisible(true).setActive(true).setAlpha(1).setScale(1).setDepth(9000);
  }

  private burst(x: number, y: number, b: Burst): void {
    if (calm()) return;
    const colors = Array.isArray(b.color) ? b.color : [b.color];
    for (let i = 0; i < b.count; i++) {
      const p = this.grab();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (b.spread ?? Math.PI * 2);
      const v = b.speed * (0.5 + Math.random() * 0.7);
      const life = b.life * (0.7 + Math.random() * 0.6);
      // A particle is a 1 or 2 px square that steps down to 1 px as it fades (never a fractional size).
      const size = Math.max(1, Math.round((b.size ?? 1) * (0.7 + Math.random() * 0.8)));
      p.setPosition(x, y)
        .setTint(colors[i % colors.length]!)
        .setScale(size);
      const g = b.gravity ?? 40;
      const dx = Math.cos(a) * v * (life / 1000);
      const dy = Math.sin(a) * v * (life / 1000) - (b.up ?? 0) + (g * (life / 1000) ** 2) / 2;
      this.scene.tweens.add({
        targets: p,
        x: x + dx,
        y: y + dy,
        alpha: 0,
        duration: life,
        ease: 'Quad.easeOut',
        onUpdate: (tw) => {
          if (size > 1 && tw.progress > 0.5) p.setScale(1);
        },
        onComplete: () => {
          p.setVisible(false).setActive(false);
          this.pool.push(p);
        },
      });
    }
  }

  /**
   * A short hand-drawn flipbook (fx_<name>_0..3 in the ui atlas: sparkle, dust, splash), played once in steps.
   * Returns false when the art is missing, so the caller keeps its pixel burst.
   */
  private flipbook(x: number, y: number, name: string, fps = 14, depth = 9000): boolean {
    const atlas = ATLAS_FILES.ui.key;
    if (!this.scene.textures.exists(atlas) || !this.scene.textures.get(atlas).has(`fx_${name}_0`))
      return false;
    const img = this.scene.add.image(Math.round(x), Math.round(y), atlas, `fx_${name}_0`);
    img.setDepth(depth).setOrigin(0.5, 1);
    let f = 0;
    this.scene.time.addEvent({
      delay: 1000 / fps,
      repeat: 3,
      callback: () => {
        f += 1;
        if (f > 3) img.destroy();
        else img.setFrame(`fx_${name}_${f}`);
      },
    });
    return true;
  }

  dust(x: number, y: number): void {
    const drawn = this.flipbook(x, y + 6, 'dust');
    this.burst(x, y, {
      count: drawn ? 4 : 9,
      color: [0x8a6a43, 0xa88858, 0x6b4a2b],
      speed: 34,
      life: 420,
      up: 4,
      spread: Math.PI * 1.2,
      size: 1.2,
    });
  }
  splash(x: number, y: number): void {
    const drawn = this.flipbook(x, y + 6, 'splash');
    this.burst(x, y, {
      count: drawn ? 5 : 11,
      color: [0x6fa3e0, 0xb8d8f8, 0x3b78c4],
      speed: 30,
      life: 460,
      gravity: 120,
      up: 6,
      spread: Math.PI * 0.9,
    });
  }
  leaves(x: number, y: number): void {
    this.burst(x, y, {
      count: 8,
      color: [0x7fc96b, 0x5fae4e, 0xc9e87a],
      speed: 28,
      life: 520,
      gravity: 60,
      up: 6,
      spread: Math.PI,
    });
  }
  sparkle(x: number, y: number, color: number): void {
    const drawn = this.flipbook(x, y + 5, 'sparkle', 16, 9100);
    this.burst(x, y, {
      count: drawn ? 8 : 14,
      color: [color, 0xffffff, 0xf4d35e],
      speed: 44,
      life: 560,
      gravity: 20,
      up: 8,
      spread: Math.PI * 1.6,
      size: 1.2,
    });
  }
  /** A friendship heart gained: pink and red sparks rising over the player. */
  hearts(x: number, y: number): void {
    this.burst(x, y, {
      count: 16,
      color: [0xe0574a, 0xf2a6c0, 0xff8aa0],
      speed: 26,
      life: 900,
      gravity: -20,
      up: 10,
      spread: Math.PI * 1.4,
      size: 1.6,
    });
  }

  /** A skill level-up: a gold ring of sparks around the player. */
  celebrate(x: number, y: number): void {
    this.burst(x, y, {
      count: 22,
      color: [0xf4d35e, 0xfff1b0, 0xf2a65a],
      speed: 46,
      life: 800,
      gravity: 30,
      up: 6,
      spread: Math.PI * 2,
      size: 1.4,
    });
  }

  coins(x: number, y: number): void {
    this.burst(x, y, {
      count: 12,
      color: [0xf4d35e, 0xfff3b0, 0xd4a92e],
      speed: 60,
      life: 700,
      gravity: 160,
      up: 10,
      spread: Math.PI * 0.8,
      size: 1.4,
    });
  }
  poof(x: number, y: number): void {
    this.burst(x, y, {
      count: 10,
      color: [0xf4ead2, 0xb9ae98],
      speed: 22,
      life: 380,
      gravity: -10,
      spread: Math.PI * 2,
    });
  }

  /** Rising, fading number or word above a point. */
  floatText(x: number, y: number, text: string, color = 0xf4ead2): void {
    const label = new Label(this.scene, Math.round(x), Math.round(y), text, {
      color,
      align: 'center',
    }).setDepth(9500);
    const still = calm();
    this.scene.tweens.add({
      targets: label,
      y: still ? y : y - 16,
      alpha: 0,
      duration: 950,
      ease: 'Sine.easeOut',
      delay: still ? 500 : 120,
      onUpdate: () => label.setY(Math.round(label.y)),
      onComplete: () => label.destroy(),
    });
  }

  /**
   * An item icon hops up from a point and fades, like it was just picked up. Its size steps from half to full
   * (never an in-between scale that drops pixel rows) and it moves on whole pixels (review 8).
   */
  itemPop(x: number, y: number, iconKey: string): void {
    const img = this.scene.add.image(Math.round(x), Math.round(y), iconKey).setDepth(9400);
    if (calm()) {
      // Calm: the item shows where it was gathered and fades, no hop.
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: 300,
        delay: 450,
        onComplete: () => img.destroy(),
      });
      return;
    }
    const drawn =
      this.scene.textures.exists(`${iconKey}_pop_0`) &&
      this.scene.textures.exists(`${iconKey}_pop_1`);
    if (drawn) {
      // The art's pop frames (round 4): stretch as it leaves, squash at the top of the hop, then the icon. They
      // share the icon's bottom line, so the image is anchored at its bottom.
      img
        .setOrigin(0.5, 1)
        .setY(img.y + 8)
        .setTexture(`${iconKey}_pop_0`);
      this.scene.time.delayedCall(60, () => img.active && img.setTexture(`${iconKey}_pop_1`));
      this.scene.time.delayedCall(120, () => img.active && img.setTexture(iconKey));
      y += 8;
    } else {
      // Squash on the launch, stretch on the way up, then its true size: whole-pixel display sizes.
      const w = img.width;
      const h = img.height;
      const born = this.scene.time.now;
      const squash = () => {
        if (!img.active) return;
        const s = popSize(this.scene.time.now - born, w, h);
        img.setDisplaySize(s.w, s.h);
        if (s.w !== w || s.h !== h) this.scene.time.delayedCall(16, squash);
      };
      squash();
    }
    this.scene.tweens.add({
      targets: img,
      y: y - 18,
      duration: 260,
      ease: 'Back.easeOut',
      onUpdate: () => img.setY(Math.round(img.y)),
    });
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      y: y - 28,
      duration: 260,
      delay: 380,
      onComplete: () => img.destroy(),
    });
  }

  /**
   * A tool icon swings in front of the player in three held steps, turning only in quarter turns (pixel-exact):
   * raised behind (the wind-up, 50 ms), down on the tile (the impact, 100 ms), then a 1 px settle as it fades.
   * Calm mode shows the impact step alone.
   */
  swing(x: number, y: number, iconKey: string, dir: 'up' | 'down' | 'left' | 'right'): void {
    const side = dir === 'left' ? -1 : 1;
    const flank = dir === 'left' || dir === 'right';
    const img = this.scene.add
      .image(0, 0, iconKey)
      .setDepth(9300)
      .setFlipX(dir === 'left');
    // [dx, dy, angle] for the wind-up and the impact, by facing.
    const steps: [number, number, number][] = flank
      ? [
          [side * 2, -22, -90 * side],
          [side * 10, -10, 0],
        ]
      : dir === 'down'
        ? [
            [6, -22, -90],
            [2, -6, 0],
          ]
        : [
            [-6, -18, 90],
            [2, -26, 0],
          ];
    const put = ([dx, dy, a]: [number, number, number]) =>
      img.active && img.setPosition(Math.round(x + dx), Math.round(y + dy)).setAngle(a);
    if (calm()) put(steps[1]!);
    else {
      put(steps[0]!);
      this.scene.time.delayedCall(50, () => put(steps[1]!));
    }
    this.scene.time.delayedCall(150, () => img.active && img.setY(img.y + 1));
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      duration: 90,
      delay: 170,
      onComplete: () => img.destroy(),
    });
  }

  /** Quick horizontal shake to say "no". */
  shake(
    target: Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject,
    amount = 2,
  ): void {
    if (getState().settings.reduceMotion) return;
    const x0 = target.x;
    this.scene.tweens.add({
      targets: target,
      x: { from: x0 - amount, to: x0 + amount },
      duration: 40,
      yoyo: true,
      repeat: 2,
      onComplete: () => (target.x = x0),
    });
  }
}
