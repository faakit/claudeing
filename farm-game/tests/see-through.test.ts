import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import {
  COVER,
  HOLE,
  HOLE_EASE_MS,
  NO_HOLE,
  behindBox,
  bodyCover,
  boxCoversTile,
  easeOpen,
  holeCircles,
  holeRadius,
  holeRuns,
  wantHole,
  type HoleWant,
  type Opaque,
} from '../src/fx/SeeThrough';

/**
 * A lone tree as the map generator bakes it (scripts/map-art.mjs): its trunk on tile (7, 5), its crown a disc of
 * radius 22 px centred above the trunk. Only the crown's tiles north of the trunk row are overhead (drawn over
 * the player); the rest of it is drawn under the player, so it is not in this layer.
 */
const TRUNK = { tx: 7, ty: 5 };
const crown = { cx: TRUNK.tx * 16 + 8, cy: TRUNK.ty * 16 - 14, r: 22 };
const lone: Opaque = (x, y) => {
  if (Math.floor(y / 16) >= TRUNK.ty) return false;
  const dx = x + 0.5 - crown.cx;
  const dy = y + 0.5 - crown.cy;
  return dx * dx + dy * dy <= crown.r * crown.r;
};
/** The same crown with a ragged, dithered edge (every other pixel in its outer 3 px). */
const ragged: Opaque = (x, y) => {
  if (Math.floor(y / 16) >= TRUNK.ty) return false;
  const d = Math.hypot(x + 0.5 - crown.cx, y + 0.5 - crown.cy);
  return d <= crown.r - 3 || (d <= crown.r && (x + y) % 2 === 0);
};

const feet = (tx: number, ty: number) => ({ px: tx * 16 + 8, py: ty * 16 + 11 });

describe('see-through hole: when it opens (owner bug 1)', () => {
  it("counts only the farmer's own tile row: a canopy ending at the row above lets an open hole close", () => {
    // a solid canopy over row 4 and above; the farmer steps south out from under it to row 5
    const canopy: Opaque = (_x, y) => Math.floor(y / 16) <= 4;
    const { px, py } = feet(7, 5);
    expect(bodyCover(px, py, canopy)).toBe(0);
    expect(wantHole({ body: true, target: false }, px, py, undefined, canopy, false).body).toBe(
      false,
    );
  });

  it('opens when the farmer stands behind the trunk, under the crown', () => {
    const { px, py } = feet(TRUNK.tx, TRUNK.ty - 1);
    expect(bodyCover(px, py, lone)).toBeGreaterThanOrEqual(COVER.body.on);
    expect(wantHole(NO_HOLE, px, py, undefined, lone, false).body).toBe(true);
  });

  it('stays shut beside the trunk, even with the crown over the hair', () => {
    for (const tx of [TRUNK.tx - 1, TRUNK.tx + 1]) {
      const { px, py } = feet(tx, TRUNK.ty);
      // the crown does reach over the head here: it is beside, not behind
      let overHead = 0;
      for (let y = py - 28; y < py - 12; y++)
        for (let x = px - 5; x < px + 5; x++) if (lone(x, y)) overHead++;
      expect(overHead).toBeGreaterThan(0);
      expect(wantHole(NO_HOLE, px, py, undefined, lone, false)).toEqual(NO_HOLE);
    }
  });

  it('stays shut in front of the tree and far from it', () => {
    for (const [tx, ty] of [
      [TRUNK.tx, TRUNK.ty + 1],
      [TRUNK.tx + 3, TRUNK.ty - 1],
      [TRUNK.tx - 3, TRUNK.ty - 2],
    ] as const) {
      const { px, py } = feet(tx, ty);
      expect(wantHole(NO_HOLE, px, py, undefined, lone, false).body, `${tx},${ty}`).toBe(false);
    }
  });

  it('switches once in and once out when walking behind the crown, pixel by pixel, even on a ragged edge', () => {
    for (const art of [lone, ragged]) {
      let want: HoleWant = NO_HOLE;
      let flips = 0;
      const y = feet(0, TRUNK.ty - 1).py;
      for (let x = (TRUNK.tx + 4) * 16; x >= (TRUNK.tx - 4) * 16; x--) {
        const next = wantHole(want, x, y, undefined, art, false);
        if (next.body !== want.body) flips++;
        want = next;
      }
      expect(flips).toBe(2);
    }
  });

  it('does not flicker when the farmer wobbles a pixel at the crown edge', () => {
    // find the first pixel where it opens walking west, then wobble around it
    const y = feet(0, TRUNK.ty - 1).py;
    let want: HoleWant = NO_HOLE;
    let x = (TRUNK.tx + 4) * 16;
    while (!want.body) want = wantHole(want, --x, y, undefined, ragged, false);
    let flips = 0;
    for (let i = 0; i < 20; i++) {
      const next = wantHole(want, x + (i % 2 ? 1 : -1), y, undefined, ragged, false);
      if (next.body !== want.body) flips++;
      want = next;
    }
    expect(flips).toBe(0);
  });

  it('cuts the target tile only when the farmer is behind the crown or stands still facing it', () => {
    const target = { tx: TRUNK.tx, ty: TRUNK.ty - 1 };
    // beside the trunk, facing up into the crown, walking past: nothing
    const side = feet(TRUNK.tx + 1, TRUNK.ty - 0);
    expect(wantHole(NO_HOLE, side.px, side.py, target, lone, false)).toEqual(NO_HOLE);
    // standing still there: the target opens (to show the marker), the body does not
    expect(wantHole(NO_HOLE, side.px, side.py, target, lone, true)).toEqual({
      body: false,
      target: true,
    });
    // a target off the crown never opens
    expect(wantHole(NO_HOLE, side.px, side.py, { tx: 12, ty: 9 }, lone, true).target).toBe(false);
  });
});

describe('see-through hole: the crown keeps its mass (integration review, coordinator ruling)', () => {
  /** A crown of radius r over the trunk at TRUNK, overhead only north of the trunk row (as `lone`). */
  const disc =
    (r: number): Opaque =>
    (x, y) =>
      Math.floor(y / 16) < TRUNK.ty && Math.hypot(x + 0.5 - crown.cx, y + 0.5 - crown.cy) <= r;
  const sameTree = (t: { tx: number; ty: number }) =>
    Math.abs(t.tx - TRUNK.tx) <= 1 && t.ty < TRUNK.ty && t.ty >= TRUNK.ty - 3;
  /** Share of the crown's opaque pixels still drawn with the hole fully open. */
  const kept = (art: Opaque, circles: ReturnType<typeof holeCircles>) => {
    const on = new Set<string>();
    for (const [x, y, w] of holeRuns(circles)) for (let i = 0; i < w; i++) on.add(`${x + i},${y}`);
    let all = 0;
    let cut = 0;
    for (let y = 0; y < TRUNK.ty * 16; y++)
      for (let x = 0; x < 16 * 16; x++)
        if (art(x, y)) {
          all++;
          if (on.has(`${x},${y}`)) cut++;
        }
    return 1 - cut / all;
  };

  it('behind a crown, a target under the same crown is not cut; one under another crown still is', () => {
    const { px, py } = feet(TRUNK.tx, TRUNK.ty - 1);
    const west = { tx: TRUNK.tx - 1, ty: TRUNK.ty - 1 };
    expect(wantHole(NO_HOLE, px, py, west, lone, true, sameTree)).toEqual({
      body: true,
      target: false,
    });
    expect(wantHole(NO_HOLE, px, py, west, lone, true, () => false)).toEqual({
      body: true,
      target: true,
    });
    // beside the trunk (not behind), standing still facing into the crown: the target still opens
    const side = feet(TRUNK.tx + 1, TRUNK.ty);
    expect(
      wantHole(NO_HOLE, side.px, side.py, { tx: TRUNK.tx, ty: TRUNK.ty - 1 }, lone, true, sameTree),
    ).toEqual({ body: false, target: true });
  });

  it('keeps at least 60% of a lone crown, 30 px across (walk-behind-tree) or 44 px, around the farmer', () => {
    for (const tx of [TRUNK.tx - 1, TRUNK.tx, TRUNK.tx + 1]) {
      const { px, py } = feet(tx, TRUNK.ty - 1);
      for (const r of [15, 22]) {
        const art = disc(r);
        const want = wantHole(
          NO_HOLE,
          px,
          py,
          { tx: tx - 1, ty: TRUNK.ty - 1 },
          art,
          true,
          sameTree,
        );
        // walking past its edge: nothing is cut; straight behind the trunk it always opens (so this checks)
        if (!want.body) {
          expect(tx, `crown r ${r}`).not.toBe(TRUNK.tx);
          continue;
        }
        const circles = holeCircles(
          px,
          py,
          want.target ? { tx: tx - 1, ty: TRUNK.ty - 1 } : undefined,
        );
        expect(kept(art, circles), `crown r ${r}, farmer at ${tx}`).toBeGreaterThanOrEqual(0.6);
      }
    }
  });
});

describe('see-through hole: how it opens', () => {
  it('eases open over about 150 ms and back, a whole pixel of radius at a time, without a pop', () => {
    const frame = 1000 / 60;
    let open = 0;
    const radii: number[] = [];
    for (let t = 0; t < HOLE_EASE_MS + 2 * frame; t += frame) {
      open = easeOpen(open, true, frame);
      radii.push(holeRadius(HOLE.body, open));
    }
    expect(radii[0]).toBeLessThanOrEqual(1);
    expect(radii.at(-1)).toBe(HOLE.body);
    // fully open within 150 ms (+ one frame), never shrinking while opening, never more than 3 px a frame
    expect(radii.findIndex((r) => r === HOLE.body) * frame).toBeLessThanOrEqual(
      HOLE_EASE_MS + frame,
    );
    for (let i = 1; i < radii.length; i++) {
      expect(radii[i]!).toBeGreaterThanOrEqual(radii[i - 1]!);
      expect(radii[i]! - radii[i - 1]!).toBeLessThanOrEqual(3);
    }
    const closing: number[] = [];
    for (let t = 0; t < HOLE_EASE_MS + 2 * frame; t += frame) {
      open = easeOpen(open, false, frame);
      closing.push(holeRadius(HOLE.body, open));
    }
    expect(closing.at(-1)).toBe(0);
    for (let i = 1; i < closing.length; i++)
      expect(closing[i]!).toBeLessThanOrEqual(closing[i - 1]!);
  });

  it('a long frame cannot overshoot, and a closed hole has no circles', () => {
    expect(easeOpen(0, true, 1000)).toBe(1);
    expect(easeOpen(1, false, 1000)).toBe(0);
    expect(holeCircles(100, 200, { tx: 6, ty: 13 }, { body: 0, target: 0 })).toEqual([]);
  });

  it('keeps the checker rim and nothing translucent at every size on the way', () => {
    for (const open of [0.3, 0.5, 0.8]) {
      const circles = holeCircles(100, 200, undefined, { body: open, target: 0 });
      const r = circles[0]!.r;
      expect(r).toBeGreaterThan(0);
      expect(r).toBeLessThan(HOLE.body);
      const on = new Set<string>();
      for (const [x, y, w] of holeRuns(circles))
        for (let i = 0; i < w; i++) on.add(`${x + i},${y}`);
      expect(on.has('100,194')).toBe(true);
      // nothing beyond the rim of the eased circle
      expect(on.has(`${100 + r + HOLE.rim + 2},194`)).toBe(false);
    }
  });

  it('cuts under half of a lone crown when fully open, a fifth less than the old 11 px hole', () => {
    const { px, py } = feet(TRUNK.tx, TRUNK.ty - 1);
    const cutBy = (circles: ReturnType<typeof holeCircles>) => {
      const on = new Set<string>();
      for (const [x, y, w] of holeRuns(circles))
        for (let i = 0; i < w; i++) on.add(`${x + i},${y}`);
      let crownPx = 0;
      let cut = 0;
      for (let y = 0; y < TRUNK.ty * 16; y++)
        for (let x = 0; x < 16 * 16; x++)
          if (lone(x, y)) {
            crownPx++;
            if (on.has(`${x},${y}`)) cut++;
          }
      return { cut, crownPx };
    };
    const now = cutBy(holeCircles(px, py));
    const before = cutBy([
      { x: px, y: py - 6, r: 11 },
      { x: px, y: py - 18, r: 11 },
    ]);
    expect(now.cut / now.crownPx).toBeLessThan(0.45);
    expect(now.cut).toBeLessThan(before.cut * 0.8);
  });
});

describe('see-through hole: tall placed sprites', () => {
  // a grown fruit tree: 32 x 40, its base on tile (14, 20)
  const box = { x: 14 * 16 + 8, bottom: 21 * 16, half: 16, top: 21 * 16 - 40 };

  it('counts behind, never beside the base or in front', () => {
    expect(behindBox(box, 14 * 16 + 8, 19 * 16 + 11)).toBe(true);
    expect(behindBox(box, 15 * 16 + 8, 20 * 16 + 11)).toBe(false);
    expect(behindBox(box, 13 * 16 + 8, 20 * 16 + 11)).toBe(false);
    expect(behindBox(box, 14 * 16 + 8, 21 * 16 + 11)).toBe(false);
  });

  it('covers a target tile north of the base only', () => {
    expect(boxCoversTile(box, { tx: 14, ty: 19 })).toBe(true);
    expect(boxCoversTile(box, { tx: 14, ty: 20 })).toBe(false);
    expect(boxCoversTile(box, { tx: 16, ty: 19 })).toBe(false);
  });
});
