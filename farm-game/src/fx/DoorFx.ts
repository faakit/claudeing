import type Phaser from 'phaser';
import { TILE_SIZE } from '../config';
import type { FrameRef } from './playerFrames';

/** Door frame timing (art-feel-frames.md suggests 60 ms): opening 50 ms a frame, closing 70 ms a frame. */
export const DOOR_OPEN_STEP_MS = 50;
export const DOOR_CLOSE_STEP_MS = 70;

/**
 * A door that opens as the farmer steps through and closes behind him on the other side. Uses the drawn frames
 * (`obj_door_open_0..3`: closed, ajar, half, open; 16 x 32 over the facade door's two tiles) when they exist; until then a placeholder doorway in the outline ink grows and shrinks
 * by whole pixels over the door tile. Purely visual, drawn under the farmer.
 */
export class DoorFx {
  private readonly img: Phaser.GameObjects.Image | null = null;
  private readonly gfx: Phaser.GameObjects.Graphics | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly tx: number,
    private readonly ty: number,
    private readonly frames: FrameRef[] | null,
  ) {
    const x = tx * TILE_SIZE + TILE_SIZE / 2;
    const y = (ty + 1) * TILE_SIZE;
    // Just under the farmer standing on or in front of the door, over the map's door tile.
    const depth = 9 + ty * TILE_SIZE;
    if (frames) {
      this.img = scene.add
        .image(x, y, frames[0]!.texture, frames[0]!.frame)
        .setOrigin(0.5, 1)
        .setDepth(depth);
    } else this.gfx = scene.add.graphics().setDepth(depth);
  }

  /** 0 = closed, 1 = ajar, 2 = half, 3 = open (the art's obj_door_open_0..3). */
  show(step: number): void {
    if (this.img && this.frames) {
      const f = this.frames[step]!;
      this.img.setTexture(f.texture, f.frame).setFlipX(f.flipX);
      return;
    }
    const g = this.gfx!;
    g.clear();
    if (step === 0) return;
    const x = this.tx * TILE_SIZE;
    const y = this.ty * TILE_SIZE;
    const w = [0, 3, 6, 10][step]!; // the leaf swings in from the hinge side (left)
    g.fillStyle(0x2a1a24, 1).fillRect(x + 3, y + 2, w, TILE_SIZE - 2);
  }

  /** Open: closed (on the step), then ajar, half and open 50 ms apart; held until the wipe covers it. */
  open(): void {
    this.show(0);
    for (let i = 1; i <= 3; i++)
      this.scene.time.delayedCall(DOOR_OPEN_STEP_MS * i, () => this.show(i));
  }

  /** Close behind the farmer: open, then half, ajar and closed 70 ms apart, then gone. */
  closeAfter(delayMs: number): void {
    this.show(3);
    for (let i = 1; i <= 3; i++)
      this.scene.time.delayedCall(delayMs + DOOR_CLOSE_STEP_MS * (i - 1), () => this.show(3 - i));
    this.scene.time.delayedCall(delayMs + DOOR_CLOSE_STEP_MS * 3, () => this.destroy());
  }

  destroy(): void {
    this.img?.destroy();
    this.gfx?.destroy();
  }
}
