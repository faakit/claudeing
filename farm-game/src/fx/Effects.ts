import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { ATLAS_FILES } from '../art/manifest';
import { getState } from '../state/store';
import { Label } from '../ui/font';
import { bannerShowing } from './hudBand';

/** World-view px from its top that the HUD's goal and level banner covers (it sits at HUD_H + 8..22). */
const BANNER_BAND_PX = 30;

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

/** The name of a floatText label: it rises on its own tween, so WorldScene never lifts it clear of a plate. */
export const RISING_LABEL = 'rising';

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
  private flipbook(
    x: number,
    y: number,
    name: string,
    fps: number | readonly number[] = 14,
    depth = 9000,
    origin: [number, number] = [0.5, 1],
  ): boolean {
    const atlas = ATLAS_FILES.ui.key;
    if (!this.scene.textures.exists(atlas) || !this.scene.textures.get(atlas).has(`fx_${name}_0`))
      return false;
    // Frame times: one rate for all, or per frame (the art's splash: 70, 70, 90, 90 ms).
    const times = typeof fps === 'number' ? [1, 2, 3, 4].map(() => 1000 / fps) : fps;
    const img = this.scene.add.image(Math.round(x), Math.round(y), atlas, `fx_${name}_0`);
    img.setDepth(depth).setOrigin(origin[0], origin[1]);
    let at = 0;
    times.forEach((ms, f) => {
      at += ms;
      this.scene.time.delayedCall(at, () => {
        if (!img.active) return;
        const next = `fx_${name}_${f + 1}`;
        if (f + 1 < times.length && this.scene.textures.get(atlas).has(next)) img.setFrame(next);
        else img.destroy();
      });
    });
    return true;
  }

  /** Rings on water where a line lands (art round 4, `fx_ripple_0..2`, 120 ms each); nothing until drawn. */
  ripple(x: number, y: number): void {
    if (calm()) return;
    this.flipbook(x, y, 'ripple', [120, 120, 120], 8900, [0.5, 0.5]);
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
    const drawn = this.flipbook(x, y + 6, 'splash', [70, 70, 90, 90]);
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

  /** Rising, fading number or word above a point (named `RISING_LABEL`). */
  floatText(x: number, y: number, text: string, color = 0xf4ead2): void {
    // While a goal or level banner shows at the top of the world view, a line that would rise into it goes below
    // the farmer instead (coordinator, onboarding finding: "+1 Wild Leek" drew over "GOAL COMPLETE").
    const cam = this.scene.cameras.main;
    if (bannerShowing() && y - 16 - cam.scrollY < BANNER_BAND_PX) y += 44;
    const label = new Label(this.scene, Math.round(x), Math.round(y), text, {
      color,
      align: 'center',
    })
      .setDepth(9500)
      .setName(RISING_LABEL); // world text kept clear of the controls leaves it to its own tween
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
   * An item just gathered: it leaves the tile and arcs up to rest above the farmer's head (`head`, so it never
   * covers his face), holds a moment, then fades as it rises 4 px. Moves on whole pixels; the art's pop frames
   * (stretch, squash, then the icon) play as it leaves when they exist. Without a head point (a machine's goods)
   * it hops up from where it came out. Calm: the icon simply shows above the head for 300 ms and fades.
   */
  itemPop(x: number, y: number, iconKey: string, head?: { x: number; y: number }): void {
    const end = head ?? { x, y: y - 18 };
    const drawn =
      this.scene.textures.exists(`${iconKey}_pop_0`) &&
      this.scene.textures.exists(`${iconKey}_pop_1`);
    // Positions below are of the icon's bottom line (the pop frames share it), so the anchor is the bottom.
    const img = this.scene.add
      .image(Math.round(x), Math.round(y + 8), iconKey)
      .setOrigin(0.5, 1)
      .setDepth(9400);
    const fade = (delay: number) =>
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        y: Math.round(end.y + 8) - 4,
        duration: 240,
        delay,
        onUpdate: () => img.setY(Math.round(img.y)),
        onComplete: () => img.destroy(),
      });
    if (calm()) {
      img.setPosition(Math.round(end.x), Math.round(end.y + 8));
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        duration: 200,
        delay: 300,
        onComplete: () => img.destroy(),
      });
      return;
    }
    if (drawn) {
      img.setTexture(`${iconKey}_pop_0`);
      this.scene.time.delayedCall(60, () => img.active && img.setTexture(`${iconKey}_pop_1`));
      this.scene.time.delayedCall(120, () => img.active && img.setTexture(iconKey));
    }
    // In flight it passes just behind the farmer (drawn under his sprite), so it never covers his face; it comes
    // to the front once it rests above his head. (The farmer's depth is 10 + feet y; head.y is feet - 42.)
    if (head) img.setDepth(10 + head.y + 42 - 0.5);
    const from = { x: img.x, y: img.y };
    const arc = { t: 0 };
    this.scene.tweens.add({
      targets: arc,
      t: 1,
      duration: 280,
      ease: 'Cubic.easeOut',
      onUpdate: () => {
        // Up beside the farmer first (never across his face), then in over his head to rest; whole pixels.
        // Without a head point it is a plain hop up from where it came out.
        if (!head) {
          img.setPosition(Math.round(from.x), Math.round(from.y + (end.y + 8 - from.y) * arc.t));
          return;
        }
        const side = x >= end.x ? 1 : -1;
        const t1 = Math.min(1, arc.t / 0.6);
        const t2 = Math.max(0, (arc.t - 0.6) / 0.4);
        const besideX = end.x + side * 18;
        img.setPosition(
          Math.round(from.x + (besideX - from.x) * t1 + (end.x - besideX) * t2),
          Math.round(from.y + (end.y + 8 - from.y) * t1),
        );
      },
      onComplete: () => {
        img.setDepth(9400);
        fade(220);
      },
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
  shake(target: { x: number }, amount = 2): void {
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
