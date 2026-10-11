import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
  CONTROLS_H,
  CONTROLS_Y,
  GAME_HEIGHT,
  GAME_WIDTH,
  WORLD_CLEAR,
  WORLD_VIEW,
} from '../src/config';
import { game } from '../src/data';
import { PixelCamera } from '../src/fx/PixelCamera';
import { displayFit } from '../src/platform/displayFit';
import {
  dockLayout,
  HOTBAR,
  HOTBAR_HIT_Y,
  HOTBAR_Y,
  hotbarSlotX,
  PLATE_LIP,
} from '../src/ui/layout';

/** CSS px per game px at a phone's fitted scale (safe areas as in the bench profiles). */
const cssPer = (w: number, h: number, dpr: number) => displayFit(w, h, dpr).devScale / dpr;
const I13 = cssPer(390, 844 - 47 - 34, 3);
const SE = cssPer(375, 667 - 20, 2);

describe('floating controls (DECISIONS.md "Floating controls")', () => {
  for (const left of [false, true]) {
    const hand = left ? 'left' : 'right';
    const L = dockLayout(left);
    const spots = [L.action, L.interact, L.menu];

    it(`${hand}: every round control floats in the bottom band, its plate inside the canvas`, () => {
      for (const s of spots) {
        expect(s.y - s.r, s.id).toBeGreaterThanOrEqual(CONTROLS_Y);
        expect(s.x - s.r, s.id).toBeGreaterThanOrEqual(0);
        expect(s.x + s.r, s.id).toBeLessThanOrEqual(GAME_WIDTH);
      }
    });

    it(`${hand}: no touch circle reaches the hotbar's touch row, and no plate touches a slot`, () => {
      for (const s of spots) {
        expect(s.y + s.hit, s.id).toBeLessThanOrEqual(HOTBAR_HIT_Y);
        // the plate and its lip stay 2 px clear of the selected slot's risen face
        expect(s.y + s.r + PLATE_LIP, s.id).toBeLessThanOrEqual(HOTBAR_Y - 2 - 2);
      }
    });

    it(`${hand}: the stick's home is open world, on no control and above the hotbar`, () => {
      for (const s of spots)
        expect(Math.hypot(L.stickHome.x - s.x, L.stickHome.y - s.y), s.id).toBeGreaterThan(s.hit);
      expect(L.stickHome.y).toBeLessThan(HOTBAR_HIT_Y);
    });

    it(`${hand}: round controls clear the touch floors on the SE (38 CSS px) and iPhone 13 (43)`, () => {
      for (const s of spots) {
        expect(2 * s.hit * SE, s.id).toBeGreaterThanOrEqual(38);
        expect(2 * s.hit * I13, s.id).toBeGreaterThanOrEqual(43);
      }
    });
  }

  it('the hotbar is a slim centred row hugging the bottom edge, the world showing between its faces', () => {
    const n = game.hotbarSlots;
    const x0 = hotbarSlotX(0, n);
    const x1 = hotbarSlotX(n - 1, n) + HOTBAR.slot;
    expect(x0).toBeGreaterThanOrEqual(4);
    expect(GAME_WIDTH - x1).toBeGreaterThanOrEqual(4);
    expect(Math.abs(x0 - (GAME_WIDTH - x1))).toBeLessThanOrEqual(1);
    expect(HOTBAR_Y + HOTBAR.slot + PLATE_LIP + HOTBAR.bottom).toBe(GAME_HEIGHT);
    // the whole row, touch zones included, is at most 28 px tall (the old dock band was 112)
    expect(GAME_HEIGHT - HOTBAR_HIT_Y).toBeLessThanOrEqual(28);
    expect(HOTBAR.pitch - HOTBAR.slot).toBeGreaterThanOrEqual(2);
  });

  it('hotbar zones meet each other and the touch floors: 43 CSS px on the iPhone 13, 38 on the SE', () => {
    const w = HOTBAR.pitch; // each zone is the whole pitch wide, so neighbours meet with no gap
    const h = GAME_HEIGHT - HOTBAR_HIT_Y;
    expect(w * I13).toBeGreaterThanOrEqual(43);
    expect(h * I13).toBeGreaterThanOrEqual(43);
    expect(w * SE).toBeGreaterThanOrEqual(38);
    expect(h * SE).toBeGreaterThanOrEqual(38);
  });
});

/** Just enough of a Phaser camera for PixelCamera. */
function fakeCam(height: number) {
  const cam = {
    width: GAME_WIDTH,
    height,
    scrollX: 0,
    scrollY: 0,
    bounds: { x: 0, y: 0, w: 0, h: 0 },
    setBounds(x: number, y: number, w: number, h: number): void {
      cam.bounds = { x, y, w, h };
    },
    setScroll(x: number, y: number): void {
      cam.scrollX = x;
      cam.scrollY = y;
    },
  };
  return cam;
}
const asCam = (c: ReturnType<typeof fakeCam>) => c as unknown as Phaser.Cameras.Scene2D.Camera;

describe('the camera behind the floating controls', () => {
  const BODY = 8;
  const MAPS = [
    { id: 'farm', w: 480, h: 704 },
    { id: 'house', w: 160, h: 144 },
    { id: 'mine', w: 320, h: 480 },
    { id: 'tall-narrow', w: 160, h: 260 },
  ];

  it('the view reaches the bottom edge and the follow keeps the farmer above the controls', () => {
    expect(WORLD_VIEW.h - CONTROLS_H).toBe(WORLD_CLEAR.h);
  });

  for (const m of MAPS)
    it(`${m.id}: every scroll is exactly the old dock-bound view's (tile taps land on the same tiles)`, () => {
      const now = fakeCam(WORLD_VIEW.h);
      const old = fakeCam(WORLD_CLEAR.h);
      const a = new PixelCamera(asCam(now), BODY, CONTROLS_H);
      const b = new PixelCamera(asCam(old), BODY, 0);
      a.setMap(m.w, m.h);
      b.setMap(m.w, m.h);
      for (let px = 0; px <= m.w; px += 8)
        for (let py = 0; py <= m.h; py += 8) {
          a.snap(px, py);
          b.snap(px, py);
          expect([now.scrollX, now.scrollY], `${px},${py}`).toEqual([old.scrollX, old.scrollY]);
        }
      // Phaser's own clamp allows the same range for the taller view
      expect(now.bounds.y).toBe(old.bounds.y);
      expect(now.bounds.h - now.height).toBe(old.bounds.h - old.height);
    });

  it("on a map's last row the farmer still stands above the controls (the void shows behind them)", () => {
    const cam = fakeCam(WORLD_VIEW.h);
    const pc = new PixelCamera(asCam(cam), BODY, CONTROLS_H);
    pc.setMap(480, 704);
    pc.snap(240, 704 - 2); // feet on the bottom row
    const feetOnScreen = WORLD_VIEW.y + (704 - 2) - cam.scrollY;
    expect(feetOnScreen).toBeLessThan(CONTROLS_Y);
  });

  it('a small room sits centred in the part of the view above the controls', () => {
    const cam = fakeCam(WORLD_VIEW.h);
    const pc = new PixelCamera(asCam(cam), BODY, CONTROLS_H);
    pc.setMap(160, 144);
    pc.snap(80, 72);
    const top = WORLD_VIEW.y - cam.scrollY;
    const centre = top + 144 / 2;
    expect(Math.abs(centre - (WORLD_CLEAR.y + WORLD_CLEAR.h / 2))).toBeLessThanOrEqual(1);
    expect(top + 144).toBeLessThanOrEqual(CONTROLS_Y);
  });
});
