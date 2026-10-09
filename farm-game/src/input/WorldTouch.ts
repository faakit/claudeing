import Phaser from 'phaser';
import { WORLD_VIEW } from '../config';
import { PressTrack, worldRelease } from './gesture';
import type { InputHub } from './InputHub';
import type { VirtualJoystick } from './VirtualJoystick';

/** A still touch on the world shows what a tap would do after this long (shorter taps commit at once). */
export const PREVIEW_MS = 100;

interface Touch {
  track: PressTrack;
  /** Scene time at touch-down. */
  at: number;
  /** Started inside the world view (not the dock, not the HUD). */
  world: boolean;
  previewed: boolean;
}

/**
 * Every touch that does not start on a button (ruling 2026-10-09: world touches never paint or till by
 * duration). On the world, a still touch is a tap however long it lasts (preview after 100 ms, commit on
 * release, read where the finger landed); a touch that reaches the 9 px deadzone is the floating stick
 * (VirtualJoystick) and is never a tap. Touches that start in the dock never reach the world.
 */
export class WorldTouch {
  private touches = new Map<number, Touch>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly hub: InputHub,
    private readonly joystick: VirtualJoystick,
    private readonly onAnyTouch: () => void,
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
    });
  }

  private move(p: Phaser.Input.Pointer): void {
    const t = this.touches.get(p.id);
    if (!t) return;
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
    t.track.move(p.x, p.y);
    const tap = worldRelease(t.track, this.joystick.wasEngaged(p.id)) === 'tap';
    // The tile is read where the finger landed, not where a rolling pad lifted.
    if (tap && t.world) this.hub.emit('tap', { x: t.track.x0, y: t.track.y0 });
    else if (t.previewed) this.hub.emit('tapCancel', undefined);
  }

  /** Each frame: a still world touch shows its preview after 100 ms. */
  update(): void {
    const now = this.scene.time.now;
    for (const t of this.touches.values()) {
      if (t.previewed || !t.world || !t.track.still || now - t.at < PREVIEW_MS) continue;
      t.previewed = true;
      this.hub.emit('tapPreview', { x: t.track.x0, y: t.track.y0 });
    }
  }

  /** Drop every touch (sheets opened, scene changes). */
  clear(): void {
    this.touches.clear();
  }
}
