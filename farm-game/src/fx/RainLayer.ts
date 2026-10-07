import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';

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
        .rectangle(Math.random() * GAME_WIDTH, Math.random() * GAME_HEIGHT, 1, 5, 0xd6e6fa)
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
      if (d.y > GAME_HEIGHT) {
        d.y = -6;
        d.x = Math.random() * (GAME_WIDTH + 60);
      }
      if (d.x < -4) d.x = GAME_WIDTH + 4;
      d.setAlpha(0.8 * this.intensity * (0.6 + (i % 5) * 0.1));
    });
  }
}
