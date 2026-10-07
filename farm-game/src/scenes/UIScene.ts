import Phaser from 'phaser';
import {
  EVT_INTERACT_TARGET,
  GAME_HEIGHT,
  GAME_WIDTH,
  TAP_MAX_MOVE,
  TAP_MAX_MS,
  UI_LAYOUT,
} from '../config';
import { inputHub } from '../input/InputHub';
import { KeyboardInput } from '../input/KeyboardInput';
import { TouchButton } from '../input/TouchButton';
import { VirtualJoystick } from '../input/VirtualJoystick';

const CREAM = 0xf4ead2;
const INK = 0x14101f;

/** Hoe silhouette: the placeholder for "use equipped tool" until real tool icons arrive. */
function drawActionIcon(g: Phaser.GameObjects.Graphics): void {
  g.lineStyle(4, INK, 0.6).lineBetween(-8, 9, 7, -6);
  g.lineStyle(2, CREAM, 1).lineBetween(-8, 9, 7, -6);
  g.fillStyle(INK, 0.6).fillRect(2, -11, 10, 7);
  g.fillStyle(CREAM, 1).fillRect(3, -10, 8, 5);
}

function drawHandIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillCircle(0, 0, 10);
  g.fillStyle(CREAM, 1).fillCircle(0, 0, 8);
  g.fillStyle(INK, 0.9);
  for (const x of [-4, 0, 4]) g.fillCircle(x, 0, 1.4);
}

function drawBedIcon(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(INK, 0.6).fillRect(-11, -6, 22, 14);
  g.fillStyle(CREAM, 1).fillRect(-10, -1, 20, 8);
  g.fillStyle(0x4a7fc1, 1).fillRect(-4, -1, 14, 8);
  g.fillStyle(CREAM, 1).fillRect(-9, -5, 6, 5);
  g.fillStyle(INK, 0.6).fillRect(-11, 4, 2, 6).fillRect(9, 4, 2, 6);
}

const INTERACT_ICONS: Record<string, (g: Phaser.GameObjects.Graphics) => void> = {
  bed: drawBedIcon,
};

/** HUD overlay: touch controls now, clock/hotbar/menus in later milestones. */
export class UIScene extends Phaser.Scene {
  private interactButton!: TouchButton;
  private interactIcon!: Phaser.GameObjects.Graphics;
  private taps = new Map<number, { x: number; y: number; t: number }>();

  constructor() {
    super('UI');
  }

  create(): void {
    this.input.addPointer(3); // mouse + joystick thumb + both buttons
    new KeyboardInput(this, inputHub);
    new VirtualJoystick(this, inputHub);

    const { margin, actionRadius, interactRadius } = UI_LAYOUT;
    const ax = GAME_WIDTH - margin - actionRadius;
    const ay = GAME_HEIGHT - margin - actionRadius;
    new TouchButton(this, ax, ay, actionRadius, drawActionIcon, () =>
      inputHub.emit('action', undefined),
    );
    this.interactButton = new TouchButton(
      this,
      ax - actionRadius - interactRadius - 6,
      ay + 8,
      interactRadius,
      () => undefined,
      () => inputHub.emit('interact', undefined),
    );
    this.interactIcon = this.add.graphics().setDepth(91);
    this.interactIcon.setPosition(this.interactButton.view.x, this.interactButton.view.y);
    this.interactButton.view.setAlpha(0).setScale(0.8);
    this.interactButton.setEnabled(false);
    this.interactIcon.setAlpha(0);

    this.setInteractTarget(null);
    this.game.events.on(EVT_INTERACT_TARGET, this.setInteractTarget, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
      this.game.events.off(EVT_INTERACT_TARGET, this.setInteractTarget, this),
    );

    this.setupTaps();
  }

  private setInteractTarget(type: string | null): void {
    this.interactButton.setEnabled(type !== null);
    if (type !== null) {
      this.interactIcon.clear();
      (INTERACT_ICONS[type] ?? drawHandIcon)(this.interactIcon);
    }
    this.tweens.add({
      targets: this.interactIcon,
      alpha: type !== null ? 1 : 0,
      duration: 140,
    });
  }

  /** A short, nearly stationary touch on the world counts as a tap (not a joystick drag). */
  private setupTaps(): void {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.input.hitTestPointer(p).length > 0) return; // started on a button
      this.taps.set(p.id, { x: p.x, y: p.y, t: p.downTime });
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const down = this.taps.get(p.id);
      this.taps.delete(p.id);
      if (!down) return;
      const quick = p.upTime - down.t <= TAP_MAX_MS;
      const still = Math.hypot(p.x - down.x, p.y - down.y) <= TAP_MAX_MOVE;
      if (quick && still) inputHub.emit('tap', { x: p.x, y: p.y });
    });
  }
}
