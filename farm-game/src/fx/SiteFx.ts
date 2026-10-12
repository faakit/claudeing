/**
 * A restoration work day's beat (systems/valley.ts work days; critic review 6, item 2), one tap at the site:
 *
 * - **pickaxe:** three swings about 560 ms apart; each hit chips grey stone off the heap's face (1-2 px chips that arc
 *   out, rest and fade like the channel's clods), puffs dust and shudders the heap a pixel; on the third hit the top
 *   stone breaks loose and rolls down beside the heap while the site's lower sprite shows (`looseAt`). About 2.6 s.
 * - **spade:** two cuts; the channel's soil clods fly to both banks, the cut stands a pixel proud and settles, then
 *   the pool's water runs into it with a foam line on its front (the channel's 220 ms ease-out) and drops jump when
 *   it is full. About 1.8 s.
 *
 * Images only (the shared 2 px pixel texture, tinted), so the batch holds. Calm (reduce motion) keeps the swings,
 * the stone and the water, and drops the chips, the shudder and the drops.
 */
import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { TILE_SIZE } from '../config';
import { audio } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { Effects } from './Effects';
import { clodAt, clods, fillRect, type Clod } from './channelRun';

type Dir = 'up' | 'down' | 'left' | 'right';

/** The pickaxe day: swing times (ms from the tap), the strike after each swing's start, the stone's roll. */
export const PICK = {
  swings: [0, 560, 1120],
  strike: 140,
  roll: 700,
  fade: 300,
  rest: 400,
} as const;
/** When the top stone breaks loose (the third strike): the site's lower sprite shows from here. */
export const PICK_LOOSE_MS = PICK.swings[2] + PICK.strike;
/** The spade day: two cuts, then the water runs in. */
export const SPADE = { swings: [0, 560], strike: 140, fillAt: 860, fill: 220, settle: 70 } as const;
/** The whole beat (the world moves again after it). */
export const SITE_BEAT = { pickaxe: 2600, channel: 1800 } as const;

/** Stone chips (palette: stone, light stone, and ink, so they read on straw and on the stones). */
const CHIP_COLORS = [0x7a7684, 0xaeb0b4, 0x2a1a24] as const;
const SOIL = 0x4c2c1c;
const WATER = 0x3c74b4;
const WATER_LIT = 0x72aadc;
const FOAM = 0xd6ecf0;
const CHIP_REST_MS = 380;
const CHIP_FADE_MS = 140;

export class SiteFx {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly fx: Effects,
    private readonly calm: () => boolean,
  ) {}

  private live(): boolean {
    return this.scene.sys.isActive();
  }

  private px(color: number, depth: number): Phaser.GameObjects.Image {
    return this.scene.add.image(0, 0, PX_TEXTURE).setOrigin(0, 0).setTint(color).setDepth(depth);
  }

  /** A rect of one colour as one tinted image (whole pixels). */
  private rect(color: number, x: number, y: number, w: number, h: number, depth: number) {
    return this.px(color, depth)
      .setPosition(Math.round(x), Math.round(y))
      .setScale(w / 2, h / 2);
  }

  /** Fly 1-2 px pieces on clod arcs from (cx, cy); they rest where they land, then fade in two steps. */
  private throwBits(cx: number, cy: number, bits: Clod[], depth: number): void {
    for (const c of bits) {
      const img = this.px(c.color, depth).setScale(c.size / 2);
      img.setPosition(cx + c.x0, cy + c.y0);
      const s = { t: 0 };
      this.scene.tweens.add({
        targets: s,
        t: c.ms + CHIP_REST_MS + CHIP_FADE_MS,
        duration: c.ms + CHIP_REST_MS + CHIP_FADE_MS,
        onUpdate: () => {
          const at = clodAt(c, s.t);
          if (at) return void img.setPosition(cx + at.x, cy + at.y);
          const since = s.t - c.ms;
          img.setPosition(cx + c.x1, cy + c.y1 - (since < 60 ? 1 : 0));
          img.setAlpha(
            since > CHIP_REST_MS + CHIP_FADE_MS / 2 ? 0.35 : since > CHIP_REST_MS ? 0.7 : 1,
          );
        },
        onComplete: () => img.destroy(),
      });
    }
  }

  /**
   * The pickaxe day at a rockfall whose middle top is (heapX, heapY) (world px; the heap covers two tiles below it).
   * `heap` is the site's sprite (shuddered on each hit), if drawn.
   */
  pickaxe(
    at: { x: number; y: number; facing: Dir },
    heapX: number,
    heapY: number,
    heap: Phaser.GameObjects.Image | null,
  ): void {
    const calm = this.calm();
    // chips fly back toward the farmer's side of the heap, up and out
    const toward = Math.sign(at.x - heapX) || -1;
    PICK.swings.forEach((t0, k) =>
      this.scene.time.delayedCall(t0, () => {
        if (!this.live()) return;
        this.fx.swing(at.x, at.y, 'item_pickaxe', at.facing);
        this.scene.time.delayedCall(PICK.strike, () => {
          if (!this.live()) return;
          const hx = heapX + toward * 6;
          const hy = heapY + 10 - k * 2;
          this.fx.dust(hx, hy);
          audio.play(k === 2 ? 'till' : 'swing');
          haptic(k === 2 ? 'medium' : 'tick');
          if (calm) return;
          this.throwBits(hx, hy, chips(toward, k), 10 + heapY + 40);
          if (heap) {
            const x0 = heap.x;
            heap.x = x0 + toward * -1; // the heap gives a pixel under the blow
            this.scene.time.delayedCall(60, () => heap.active && (heap.x = x0));
          }
        });
      }),
    );
    // the third strike: the top stone breaks loose and rolls down beside the heap
    this.scene.time.delayedCall(PICK_LOOSE_MS, () => {
      if (!this.live()) return;
      const depth = 10 + heapY + 36;
      const parts = [
        this.rect(0x241a2a, -6, -5, 12, 10, depth),
        this.rect(0xaeb0b4, -5, -4, 10, 8, depth),
        this.rect(0x8a8694, -5, 1, 10, 3, depth),
      ];
      const stone = this.scene.add.container(heapX, heapY - 2, parts).setDepth(depth);
      const away = -toward; // it rolls off the far side from the farmer, never onto him
      this.scene.tweens.add({
        targets: stone,
        x: heapX + away * 26,
        y: heapY + 30,
        duration: PICK.roll,
        ease: 'Bounce.easeOut',
        onUpdate: () => stone.setPosition(Math.round(stone.x), Math.round(stone.y)),
        onComplete: () => {
          if (!this.live()) return;
          audio.play('till');
          this.fx.dust(stone.x, stone.y + 4);
          this.scene.tweens.add({
            targets: stone,
            alpha: 0,
            delay: PICK.rest,
            duration: PICK.fade,
            onComplete: () => stone.destroy(),
          });
        },
      });
    });
  }

  /**
   * The spade day: the first channel tile cut beside the pool. The cut is the tile (cx, cy) (world px of its top
   * left), running east-west; the water comes in from the pool's side (`from`: 'e' or 'w').
   */
  spade(at: { x: number; y: number; facing: Dir }, cx: number, cy: number, from: 'e' | 'w'): void {
    const calm = this.calm();
    const depth = 0.45;
    let cut: Phaser.GameObjects.Image | null = null;
    SPADE.swings.forEach((t0, k) =>
      this.scene.time.delayedCall(t0, () => {
        if (!this.live()) return;
        this.fx.swing(at.x, at.y, 'item_spade', at.facing);
        this.scene.time.delayedCall(SPADE.strike, () => {
          if (!this.live()) return;
          audio.play('dig');
          haptic('tick');
          // the dug strip (8 px of the tile, the channel's water band), a pixel proud for a moment on the first cut
          if (!cut) {
            cut = this.rect(SOIL, cx, cy + 3, TILE_SIZE, 8, depth);
            this.scene.time.delayedCall(SPADE.settle, () => cut?.active && cut.setY(cy + 4));
          }
          if (calm) return;
          // an east-west cut throws its soil north and south, onto both banks
          this.throwBits(
            cx + TILE_SIZE / 2 + (k ? 3 : -3),
            cy + 8,
            clods('left', Math.random),
            9000,
          );
        });
      }),
    );
    // the pool's water runs into the cut from its side, a foam line on the front
    this.scene.time.delayedCall(SPADE.fillAt, () => {
      if (!this.live()) return;
      audio.play('water');
      const water = this.rect(WATER, cx, cy + 5, 0, 6, depth + 0.001);
      const lit = this.rect(WATER_LIT, cx, cy + 5, 0, 1, depth + 0.002);
      const foam = this.rect(FOAM, cx, cy + 5, 1, 6, depth + 0.003);
      const s = { u: 0 };
      this.scene.tweens.add({
        targets: s,
        u: 1,
        duration: SPADE.fill,
        onUpdate: () => {
          // the channel's fill: an eased front from the entry side (channelRun fillRect), within the 6 px band
          const r = fillRect(from, s.u, TILE_SIZE, true);
          const w = Math.max(0, r.w);
          const x = cx + r.x;
          water.setPosition(x, cy + 5).setScale(w / 2, 3);
          lit.setPosition(x, cy + 5).setScale(w / 2, 0.5);
          const front = from === 'e' ? x : x + w - 1;
          foam.setPosition(front, cy + 5).setVisible(w > 0 && w < TILE_SIZE);
        },
        onComplete: () => {
          foam.destroy();
          if (!this.live()) return;
          if (!calm) this.fx.splash(cx + TILE_SIZE / 2, cy + 6);
          haptic('tick');
          this.scene.time.delayedCall(SITE_BEAT.channel - SPADE.fillAt - SPADE.fill + 400, () => {
            for (const img of [water, lit, cut]) img?.destroy();
          });
        },
      });
    });
  }
}

/** One strike's chips off the heap's face: 4 to 6 pieces, up and out toward `toward` (-1 west, 1 east). */
export function chips(toward: number, strike: number, rnd: () => number = Math.random): Clod[] {
  const n = 4 + Math.min(2, strike);
  const out: Clod[] = [];
  for (let i = 0; i < n; i++) {
    const out1 = Math.round(8 + rnd() * 9) * toward;
    out.push({
      x0: 0,
      y0: 0,
      x1: out1,
      y1: Math.round(3 + rnd() * 6),
      h: Math.round(9 + rnd() * 7),
      ms: Math.round(220 + rnd() * 120),
      size: rnd() < 0.7 ? 2 : 1,
      color: CHIP_COLORS[i % CHIP_COLORS.length]!,
    });
  }
  return out;
}
