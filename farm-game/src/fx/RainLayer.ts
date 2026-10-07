import Phaser from 'phaser';
import { WORLD_VIEW } from '../config';

const DROPS = 90;

/** Screen-space rain streaks. Cosmetic only; fades in and out with `setIntensity`. */
export class RainLayer {
  private readonly drops: Phaser.GameObjects.Rectangle[] = [];
  private readonly speeds: number[] = [];
  private intensity = 0;
  private target = 0;

  constructor(scene: Phaser.Scene, depth: number) {
    for (let i = 0; i < DROPS; i++) {
      const d = scene.add
        .rectangle(
          WORLD_VIEW.x + Math.random() * WORLD_VIEW.w,
          WORLD_VIEW.y + Math.random() * WORLD_VIEW.h,
          1,
          5,
          0xd6e6fa,
        )
        .setOrigin(0)
        .setDepth(depth)
        .setAlpha(0)
        .setVisible(false);
      d.setAngle(12);
      this.drops.push(d);
      this.speeds.push(180 + Math.random() * 120);
    }
  }

  setIntensity(v: number): void {
    this.target = v;
  }

  update(dtMs: number): void {
    this.intensity += (this.target - this.intensity) * Math.min(1, dtMs / 500);
    if (Math.abs(this.target - this.intensity) < 0.01) this.intensity = this.target;
    const active = this.intensity > 0;
    const dt = dtMs / 1000;
    this.drops.forEach((d, i) => {
      d.setVisible(active);
      if (!active) return;
      d.y += this.speeds[i]! * dt;
      d.x -= this.speeds[i]! * dt * 0.22;
      if (d.y > WORLD_VIEW.y + WORLD_VIEW.h) {
        d.y = WORLD_VIEW.y - 6;
        d.x = WORLD_VIEW.x + Math.random() * (WORLD_VIEW.w + 40);
      }
      if (d.x < WORLD_VIEW.x - 4) d.x = WORLD_VIEW.x + WORLD_VIEW.w + 4;
      d.setAlpha(0.8 * this.intensity * (0.6 + (i % 5) * 0.1));
    });
  }
}
