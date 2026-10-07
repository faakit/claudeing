import Phaser from 'phaser';
import { inputHub } from '../input/InputHub';
import { audio } from '../platform/audio';
import { lifecycle } from '../platform/lifecycle';
import { runtime } from '../state/runtime';

/**
 * What the game does when the app leaves/returns to the foreground, on every platform:
 * freeze the world and clock, drop held input (a key-up may never arrive), silence audio,
 * and on return resync timing so a long absence is never one giant frame.
 * (Saving is wired separately in persistence.wireAutosave.)
 */
export function wireLifecycle(game: Phaser.Game): void {
  lifecycle.on('pause', () => {
    runtime.suspended = true;
    inputHub.clearHeld();
    audio.suspend();
  });
  lifecycle.on('resume', () => {
    runtime.suspended = false;
    audio.resume();
    game.loop.resetDelta();
  });
}
