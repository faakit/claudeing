import Phaser from 'phaser';
import { JOYSTICK, THUMB_ZONE_Y } from '../config';
import { dominantDirection } from '../systems/direction';
import type { Direction } from '../state/GameState';
import type { InputHub } from './InputHub';
import { CH } from '../ui/theme';

const FADE_MS = 120;

/** Floating stick: appears under the thumb anywhere in the lower part of the screen (the thumb zone). */
export class VirtualJoystick {
  private pointerId: number | null = null;
  private origin = new Phaser.Math.Vector2();
  private current: Direction | null = null;
  private readonly gfx: Phaser.GameObjects.Graphics;
  private readonly thumb: Phaser.GameObjects.Graphics;
  private shown = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hub: InputHub,
  ) {
    const { radius } = JOYSTICK;
    this.gfx = scene.add.graphics().setDepth(100).setAlpha(0);
    this.gfx.fillStyle(CH.ink, 0.28).fillCircle(0, 0, radius + 6);
    this.gfx.lineStyle(2, CH.cream, 0.55).strokeCircle(0, 0, radius + 6);
    for (const a of [0, 90, 180, 270]) {
      const rad = Phaser.Math.DegToRad(a);
      this.gfx
        .fillStyle(CH.cream, 0.5)
        .fillCircle(Math.cos(rad) * (radius - 4), Math.sin(rad) * (radius - 4), 1.5);
    }
    this.thumb = scene.add.graphics().setDepth(101).setAlpha(0);
    this.thumb.fillStyle(CH.cream, 0.8).fillCircle(0, 0, 11);
    this.thumb.lineStyle(2, CH.ink, 0.5).strokeCircle(0, 0, 11);

    const input = scene.input;
    input.on('pointerdown', this.onDown, this);
    input.on('pointermove', this.onMove, this);
    input.on('pointerup', this.onUp, this);
    input.on('gameout', this.release, this);
  }

  /** The whole lower part of the screen is a joystick: a thumb never has to find a fixed spot. */
  private inZone(y: number): boolean {
    return y >= THUMB_ZONE_Y;
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== null || !this.inZone(p.y)) return;
    if (this.scene.input.hitTestPointer(p).length > 0) return; // pointer belongs to a button
    this.pointerId = p.id;
    this.origin.set(p.x, p.y);
    this.current = null;
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const { radius, deadzone, axisBias } = JOYSTICK;
    let dx = p.x - this.origin.x;
    let dy = p.y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > radius) {
      // Dragging past the rim drags the whole stick along, so recentering is never needed.
      this.origin.x += (dx / len) * (len - radius);
      this.origin.y += (dy / len) * (len - radius);
      dx = p.x - this.origin.x;
      dy = p.y - this.origin.y;
    }
    this.current = dominantDirection(dx, dy, deadzone, axisBias, this.current);
    this.hub.setStick(this.current);
    // Only reveal the stick once it is actually being used, so quick taps stay clean.
    if (!this.shown && len >= deadzone) this.fade(true);
    this.gfx.setPosition(this.origin.x, this.origin.y);
    this.thumb.setPosition(this.origin.x + dx, this.origin.y + dy);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id === this.pointerId) this.release();
  }

  private release(): void {
    this.pointerId = null;
    this.current = null;
    this.hub.setStick(null);
    this.fade(false);
  }

  private fade(show: boolean): void {
    this.shown = show;
    this.scene.tweens.add({
      targets: [this.gfx, this.thumb],
      alpha: show ? 1 : 0,
      duration: FADE_MS,
    });
  }
}
