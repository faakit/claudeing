/** Frame timing and GL draw calls of the running game, for the dev menu's graph and `__farm.dev.frameStats()`. */
import Phaser from 'phaser';
import type { FrameStats } from './api';

const N = 60;

export class FrameMeter {
  /** ms between frames, newest last. */
  readonly gaps: number[] = [];
  /** ms of game JS per frame (PRE_STEP to POST_RENDER), newest last. */
  readonly js: number[] = [];
  draws = 0;
  private drawsNow = 0;
  private t0 = 0;
  private last = 0;
  private stamps: number[] = [];

  constructor(game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.PRE_STEP, () => {
      this.t0 = performance.now();
      this.drawsNow = 0;
    });
    game.events.on(Phaser.Core.Events.POST_RENDER, () => {
      const now = performance.now();
      push(this.js, now - this.t0);
      if (this.last) push(this.gaps, now - this.last);
      this.last = now;
      this.stamps.push(now);
      while (this.stamps.length && now - this.stamps[0]! > 1000) this.stamps.shift();
      this.draws = this.drawsNow;
    });
    // Count draw calls on this game's own GL context (not the prototype: other canvases are not ours).
    const gl = (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer | undefined)?.gl as
      (WebGLRenderingContext & Record<string, unknown>) | undefined;
    if (gl)
      for (const fn of [
        'drawElements',
        'drawArrays',
        'drawElementsInstanced',
        'drawArraysInstanced',
      ]) {
        const orig = gl[fn] as ((...a: unknown[]) => unknown) | undefined;
        if (typeof orig !== 'function') continue;
        gl[fn] = (...a: unknown[]) => {
          this.drawsNow++;
          return orig.apply(gl, a);
        };
      }
  }

  stats(): FrameStats {
    const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const r = (v: number) => Math.round(v * 100) / 100;
    return {
      fps: this.stamps.length,
      frameMs: r(mean(this.gaps)),
      jsMs: r(mean(this.js)),
      draws: this.draws,
    };
  }
}

function push(xs: number[], v: number): void {
  xs.push(v);
  if (xs.length > N) xs.shift();
}
