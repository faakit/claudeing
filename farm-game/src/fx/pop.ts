import type Phaser from 'phaser';
import { getState } from '../state/store';

/**
 * Something new appears (a crop stage, a placed machine, a forage find): it hops 1 px and settles, never through
 * a fractional scale (feel critic: a whole-pixel squash still doubled or dropped columns). Sprites drawn at a reduced base scale and flat
 * tiles fade up instead. Calm mode: no pop at all.
 */
export function popWhole(scene: Phaser.Scene, img: Phaser.GameObjects.Image): void {
  if (getState().settings.reduceMotion) return;
  const base = img.scaleX;
  if (img.originY !== 1 || base !== 1) {
    const a = img.alpha;
    img.setAlpha(a * 0.4);
    scene.tweens.add({ targets: img, alpha: a, duration: 140 });
    return;
  }
  // A 1 px hop and back (whole pixels; no squash that would double or drop columns).
  const y0 = img.y;
  img.setY(y0 - 1);
  scene.time.delayedCall(70, () => img.active && img.setY(y0));
}
