import type Phaser from 'phaser';
import { CAMERA_LERP } from '../config';
import { createFollowAxis, nudgeOffset, softClamp, stepFollowAxis, type FollowAxis } from './feel';

/** Px of map edge over which the camera slows to a stop instead of hitting the bound. */
const EDGE_KNEE = 16;

/**
 * The world camera's follow, pixel-locked (see `stepFollowAxis` in fx/feel.ts): the camera sits on the player's
 * own drawn pixel minus a smoothed whole-pixel lag, so walking never shimmers the player against the world, the
 * camera eases in after a stop, and it slows into the map edges. Replaces Phaser's lerp follow, whose floored
 * scroll stalled up to 8 px short when walking right or down and hopped the player 1 px back and forth.
 */
export class PixelCamera {
  private readonly ax: FollowAxis = createFollowAxis();
  private readonly ay: FollowAxis = createFollowAxis();
  private bounds = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private nudge: { dx: number; dy: number; px: number; at: number; ms: number } | null = null;

  constructor(
    private readonly cam: Phaser.Cameras.Scene2D.Camera,
    /** Aim this far above the feet (the body, not the feet). */
    private readonly bodyOffset: number,
  ) {}

  /** The scroll range: a map smaller than the view stays centred. */
  setMap(mapW: number, mapH: number): void {
    const w = this.cam.width;
    const h = this.cam.height;
    const left = Math.round(-Math.max(0, w - mapW) / 2);
    const top = Math.round(-Math.max(0, h - mapH) / 2);
    this.bounds = {
      x0: left,
      y0: top,
      x1: left + Math.max(0, mapW - w),
      y1: top + Math.max(0, mapH - h),
    };
    // Phaser's own bounds match, on whole pixels, so its clamp never moves the camera off a pixel.
    const b = this.bounds;
    this.cam.setBounds(b.x0, b.y0, b.x1 - b.x0 + w, b.y1 - b.y0 + h);
  }

  /** Cut straight to the player (a new map, a teleport). */
  snap(px: number, py: number): void {
    this.ax.last = null;
    this.ay.last = null;
    this.update(px, py, 0, 0);
  }

  /** A short whole-pixel push of the view that springs back (a big moment). */
  push(dx: number, dy: number, px: number, now: number, ms = 140): void {
    this.nudge = { dx, dy, px, at: now, ms };
  }

  /** Let go of the camera (debug probes move it by hand). */
  paused = false;

  /** Each frame, after the player moved. */
  update(px: number, py: number, dtMs: number, now: number): void {
    if (this.paused) return;
    const fx = Math.floor(px);
    const fy = Math.floor(py);
    const lx = stepFollowAxis(this.ax, px, dtMs, CAMERA_LERP);
    const ly = stepFollowAxis(this.ay, py, dtMs, CAMERA_LERP);
    let sx = softClamp(fx - lx - this.cam.width / 2, this.bounds.x0, this.bounds.x1, EDGE_KNEE);
    let sy = softClamp(
      fy - this.bodyOffset - ly - this.cam.height / 2,
      this.bounds.y0,
      this.bounds.y1,
      EDGE_KNEE,
    );
    const n = this.nudge;
    if (n) {
      const t = now - n.at;
      if (t >= n.ms || t < 0) this.nudge = null;
      else {
        const o = nudgeOffset(t, n.px, n.ms);
        const b = this.bounds;
        sx = Math.max(b.x0, Math.min(b.x1, sx + Math.round(o * n.dx)));
        sy = Math.max(b.y0, Math.min(b.y1, sy + Math.round(o * n.dy)));
      }
    }
    this.cam.setScroll(sx, sy);
  }

  /** The lag the camera shows right now (px), for probes. */
  get lag(): { x: number; y: number } {
    return { x: this.ax.shown, y: this.ay.shown };
  }
}
