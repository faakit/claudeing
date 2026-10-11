import { describe, expect, it } from 'vitest';
import { cellWidths, displayFit, unevenCells } from '../src/platform/displayFit';

/** The bench's phones (scripts/thumb-lib.mjs): CSS viewport, safe areas, device pixel ratio. */
const PHONES = [
  { id: 'i13', w: 390, h: 844 - 47 - 34, dpr: 3 },
  { id: 'pixel7', w: 412, h: 915 - 24, dpr: 2.625 },
  { id: 'se', w: 375, h: 667 - 20, dpr: 2 },
  { id: 'promax', w: 430, h: 932 - 59 - 34, dpr: 3 },
  { id: 'fold', w: 280, h: 653, dpr: 3 },
];

describe('whole-pixel canvas scale (DECISIONS.md "Whole-pixel canvas scale")', () => {
  it('counts uneven columns', () => {
    expect(unevenCells(cellWidths(200, 5))).toBe(0);
    expect(unevenCells(cellWidths(200, 5.72))).toBeGreaterThan(40);
  });
  it('scales by whole device pixels when that gives up <= 10%, else keeps the fit', () => {
    const got = Object.fromEntries(PHONES.map((p) => [p.id, displayFit(p.w, p.h, p.dpr)]));
    expect(got['i13']!.mode).toBe('fit'); // 5 px would give up 12.6%
    // 3 px would take the SE's hotbar slots from 38.8 to 36 CSS px, under the 38 px bar
    expect(got['se']!.mode).toBe('fit');
    for (const id of ['pixel7', 'promax', 'fold']) {
      expect(got[id]!.mode).toBe('integer');
      expect(got[id]!.uneven).toBe(0);
      expect(got[id]!.loss).toBeLessThanOrEqual(0.1);
    }
    expect(got['pixel7']!.devScale).toBe(5);
    expect(got['promax']!.devScale).toBe(6);
    expect(got['fold']!.devScale).toBe(4);
  });
  it('centres on the device-pixel grid, inside the box', () => {
    for (const p of PHONES) {
      const f = displayFit(p.w, p.h, p.dpr);
      for (const v of [f.cssLeft, f.cssTop, f.cssW, f.cssH])
        expect(Math.abs(v * p.dpr - Math.round(v * p.dpr))).toBeLessThan(1e-6);
      expect(f.cssLeft + f.cssW).toBeLessThanOrEqual(p.w + 1e-6);
      expect(f.cssTop + f.cssH).toBeLessThanOrEqual(p.h + 1e-6);
      expect(Math.abs(f.cssTop - (p.h - f.cssTop - f.cssH))).toBeLessThanOrEqual(1); // split top and bottom
    }
  });
  it('never scales below one device pixel per game pixel', () => {
    const f = displayFit(150, 300, 1);
    expect(f.mode).toBe('fit');
    expect(f.cssW).toBeLessThanOrEqual(150);
  });
});
