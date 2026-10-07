import Phaser from 'phaser';
import type { Direction } from '../state/GameState';
import type { InputHub } from './InputHub';

const KEY_DIRECTIONS: Record<string, Direction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

/** WASD / arrows to move, Space = action, E = interact. */
export class KeyboardInput {
  constructor(scene: Phaser.Scene, hub: InputHub) {
    const kb = scene.input.keyboard;
    if (!kb) return;
    kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT,TAB');
    kb.on('keydown', (e: KeyboardEvent) => {
      const dir = KEY_DIRECTIONS[e.code];
      if (dir) hub.pressKey(dir);
      if (e.repeat) return;
      if (e.code === 'Space') hub.actionHeld = true;
      if (e.code === 'KeyE') hub.emit('interact', undefined);
      if (e.code === 'Escape' || e.code === 'KeyM') hub.emit('menu', undefined);
      if (e.code === 'Tab') hub.emit('cycle', e.shiftKey ? -1 : 1);
      const digit = /^Digit([1-8])$/.exec(e.code);
      if (digit) hub.emit('slot', Number(digit[1]) - 1);
    });
    kb.on('keyup', (e: KeyboardEvent) => {
      const dir = KEY_DIRECTIONS[e.code];
      if (dir) hub.releaseKey(dir);
      if (e.code === 'Space') hub.actionHeld = false;
    });
    // A keyup is never delivered if focus leaves the page, so release everything.
    scene.game.events.on(Phaser.Core.Events.BLUR, () => hub.clearHeld());
  }
}
