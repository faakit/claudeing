import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { getState } from '../state/store';
import { Label } from '../ui/font';

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

/** Pooled particles, floating numbers and tool swings. Purely cosmetic. */
export class Effects {
  private pool: Phaser.GameObjects.Image[] = [];

  constructor(private readonly scene: Phaser.Scene) {}

  private grab(): Phaser.GameObjects.Image {
    const p = this.pool.pop() ?? this.scene.add.image(0, 0, PX_TEXTURE);
    return p.setVisible(true).setActive(true).setAlpha(1).setScale(1).setDepth(9000);
  }

  private burst(x: number, y: number, b: Burst): void {
    const colors = Array.isArray(b.color) ? b.color : [b.color];
    for (let i = 0; i < b.count; i++) {
      const p = this.grab();
      const a = -Math.PI / 2 + (Math.random() - 0.5) * (b.spread ?? Math.PI * 2);
      const v = b.speed * (0.5 + Math.random() * 0.7);
      const life = b.life * (0.7 + Math.random() * 0.6);
      const size = (b.size ?? 1) * (0.7 + Math.random() * 0.8);
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
        scale: size * 0.3,
        duration: life,
        ease: 'Quad.easeOut',
        onComplete: () => {
          p.setVisible(false).setActive(false);
          this.pool.push(p);
        },
      });
    }
  }

  dust(x: number, y: number): void {
    this.burst(x, y, {
      count: 9,
      color: [0x8a6a43, 0xa88858, 0x6b4a2b],
      speed: 34,
      life: 420,
      up: 4,
      spread: Math.PI * 1.2,
      size: 1.2,
    });
  }
  splash(x: number, y: number): void {
    this.burst(x, y, {
      count: 11,
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
    this.burst(x, y, {
      count: 14,
      color: [color, 0xffffff, 0xf4d35e],
      speed: 44,
      life: 560,
      gravity: 20,
      up: 8,
      spread: Math.PI * 1.6,
      size: 1.2,
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
    const label = new Label(this.scene, x, y, text, { color, align: 'center' }).setDepth(9500);
    this.scene.tweens.add({
      targets: label,
      y: y - 16,
      alpha: 0,
      duration: 950,
      ease: 'Sine.easeOut',
      delay: 120,
      onComplete: () => label.destroy(),
    });
  }

  /** An item icon hops up from a point and fades, like it was just picked up. */
  itemPop(x: number, y: number, iconKey: string): void {
    const img = this.scene.add.image(x, y, iconKey).setDepth(9400).setScale(0.5);
    this.scene.tweens.add({
      targets: img,
      y: y - 18,
      scale: 1,
      duration: 260,
      ease: 'Back.easeOut',
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

  /** A tool icon swings in an arc in front of the player. */
  swing(x: number, y: number, iconKey: string, dir: 'up' | 'down' | 'left' | 'right'): void {
    const side = dir === 'left' ? -1 : 1;
    const img = this.scene.add
      .image(x + (dir === 'left' || dir === 'right' ? side * 8 : 0), y - 12, iconKey)
      .setDepth(9300)
      .setOrigin(0.15, 0.9);
    const start = dir === 'up' ? -50 : dir === 'down' ? -20 : -70 * side;
    const end = dir === 'up' ? 40 : dir === 'down' ? 80 : 50 * side;
    img.setAngle(start).setFlipX(dir === 'left');
    if (dir === 'down') img.y += 8;
    if (dir === 'up') img.y -= 6;
    this.scene.tweens.add({ targets: img, angle: end, duration: 150, ease: 'Cubic.easeIn' });
    this.scene.tweens.add({
      targets: img,
      alpha: 0,
      duration: 90,
      delay: 130,
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
