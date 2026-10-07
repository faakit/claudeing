import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

/** Minimum comfortable touch target, in CSS pixels (Apple HIG / Material guideline). */
export const MIN_TOUCH_CSS = 44;

/** How many CSS pixels one logical (480x270) pixel currently covers on screen. */
export function cssPerLogical(scene: Phaser.Scene): number {
  const w = scene.scale.displaySize.width;
  return w > 0 ? w / GAME_WIDTH : 1;
}

/**
 * Hit-area size in logical px for a control drawn `size` px wide: grown so it is at least 44 CSS
 * px on the current screen, but never beyond `max` (so it cannot swallow its neighbours).
 */
export function hitSize(scene: Phaser.Scene, size: number, max = Infinity): number {
  const want = MIN_TOUCH_CSS / cssPerLogical(scene);
  return Math.min(Math.max(size, want), max);
}
