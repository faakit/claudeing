import type Phaser from 'phaser';
import { getState } from '../state/store';
import { popSize } from './feel';

/**
 * Something new appears (a crop stage, a placed machine, a forage find): it squashes and stretches by whole
 * pixels (fx/feel popSize), never through a fractional scale. Sprites drawn at a reduced base scale and flat
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
  const w = img.frame.width;
  const h = img.frame.height;
  const born = scene.time.now;
  const step = () => {
    if (!img.active) return;
    const s = popSize(scene.time.now - born, w, h);
    img.setDisplaySize(s.w, s.h);
    if (s.w !== w || s.h !== h) scene.time.delayedCall(16, step);
  };
  step();
}
