import Phaser from 'phaser';
import { WORLD_VIEW } from '../config';
import { haptic } from '../platform/haptics';
import { PressTrack, worldRelease } from './gesture';
import type { InputHub } from './InputHub';
import type { VirtualJoystick } from './VirtualJoystick';

/** A still touch on the world shows what a tap would do after this long (shorter taps commit at once). */
export const PREVIEW_MS = 100;
/** A still touch this long on a tile Action can work arms painting a row (owner decision 3). */
export const PAINT_ARM_MS = 250;

interface Touch {
  track: PressTrack;
  /** Scene time at touch-down. */
  at: number;
  /** Started inside the world view (not the dock, not the HUD). */
  world: boolean;
  previewed: boolean;
  /** Paint was offered at the arm delay (accepted or not, only once). */
  armTried: boolean;
  painting: boolean;
}

/**
 * Every touch that does not start on a button. On the world: a still touch is a tap (preview after 100 ms,
 * commit on release); held still 250 ms on a tile Action can work, it arms painting a row (a tick and a marker
 * pop), and from then on it paints instead of steering; a touch that reaches the 9 px deadzone before that is
 * the floating stick (VirtualJoystick) and is never a tap or a paint. Touches that start in the dock never
 * reach the world. A still touch's outcome never depends on its length, except for the paint arm.
 */
export class WorldTouch {
  private touches = new Map<number, Touch>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hub: InputHub,
    private readonly joystick: VirtualJoystick,
    private readonly onAnyTouch: () => void,
    private readonly paintEnabled: () => boolean,
  ) {
    const input = scene.input;
    input.on('pointerdown', this.down, this);
    input.on('pointermove', this.move, this);
    input.on('pointerup', this.up, this);
  }

  private inWorld(y: number): boolean {
    return y >= WORLD_VIEW.y && y < WORLD_VIEW.y + WORLD_VIEW.h;
  }

  private down(p: Phaser.Input.Pointer): void {
    this.onAnyTouch();
    if (this.scene.input.hitTestPointer(p).length > 0) return; // started on a button or a sheet
    this.touches.set(p.id, {
      track: new PressTrack(p.x, p.y, this.scene.time.now),
      at: this.scene.time.now,
      world: this.inWorld(p.y),
      previewed: false,
      armTried: false,
      painting: false,
    });
  }

  private move(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    if (!t) return;
    if (t.painting) {
      this.hub.emit('paintMove', { x: p.x, y: p.y });
      return;
    }
    t.track.move(p.x, p.y);
    if (t.previewed && (!t.track.still || this.joystick.wasEngaged(p.id))) {
      t.previewed = false;
      this.hub.emit('tapCancel', undefined);
    }
  }

  private up(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    this.touches.delete(p.id);
    if (!t) return;
    if (t.painting) {
      this.hub.emit('paintEnd', { x: p.x, y: p.y, onDock: !this.inWorld(p.y) });
      return;
    }
    t.track.move(p.x, p.y);
    const tap = worldRelease(t.track, this.joystick.wasEngaged(p.id)) === 'tap';
    // The tile is read where the finger landed, not where a rolling pad lifted.
    if (tap && t.world) this.hub.emit('tap', { x: t.track.x0, y: t.track.y0 });
    else if (t.previewed) this.hub.emit('tapCancel', undefined);
  }

  /** Each frame: previews after 100 ms still, and the paint arm at 250 ms. */
  update(): void {
    const now = this.scene.time.now;
    for (const [id, t] of this.touches) {
      if (!t.world || t.painting || !t.track.still) continue;
      const held = now - t.at;
      if (!t.previewed && held >= PREVIEW_MS) {
        t.previewed = true;
        this.hub.emit('tapPreview', { x: t.track.x0, y: t.track.y0 });
      }
      if (!t.armTried && held >= PAINT_ARM_MS && this.paintEnabled()) {
        t.armTried = true;
        let accepted = false;
        this.hub.emit('paintArm', {
          x: t.track.x0,
          y: t.track.y0,
          accept: () => (accepted = true),
        });
        if (accepted) {
          t.painting = true;
          this.joystick.drop(id);
          haptic('tick'); // the arm is felt (and seen: the world pops the marker)
        }
      }
    }
  }

  /** Drop every touch (sheets opened, scene changes). */
  clear(): void {
    this.touches.clear();
  }
}
