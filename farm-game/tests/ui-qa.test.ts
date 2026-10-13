import { describe, expect, it } from 'vitest';
import {
  BODY_GLYPHS,
  bodyRows,
  COIN,
  COIN_ROWS,
  FACE,
  GLYPHS,
  hasGlyph,
  measureText,
  parseGlyph,
  stretchRows,
  TALL_GLYPHS,
} from '../src/ui/fontMetrics';
import { bagGeom, bagSlotAt, LIFT_PX, movedToLift, slotXY } from '../src/ui/bagGrid';
import { fmtGold, setLocale } from '../src/i18n';

/** The columns a glyph's rows use (min and max set bit, bit 4 = leftmost). */
function cols(rows: number[]): [number, number] {
  let min = 5;
  let max = -1;
  for (const r of rows)
    for (let c = 0; c < 5; c++)
      if (r & (1 << (4 - c))) {
        min = Math.min(min, c);
        max = Math.max(max, c);
      }
  return [min, max];
}

describe('type scale: the body face (QA "Aumentar a letra")', () => {
  it('draws every character the small face draws, as wide and in the same columns', () => {
    for (const [ch, spec] of [...Object.entries(GLYPHS), ...Object.entries(TALL_GLYPHS)]) {
      const small = parseGlyph(ch, spec);
      const body = bodyRows(ch);
      const [min, max] = cols(body);
      if (small.width === 0) continue;
      expect([min, max], ch).toEqual([small.min, small.min + small.width - 1]);
    }
  });

  it('has 9-row capitals and a 7-row x-height (11 rows with descenders, 13 for accented capitals)', () => {
    expect(FACE.body).toEqual({ size: 11, line: 13, cap: 9 });
    expect(bodyRows('H')).toHaveLength(11);
    expect(bodyRows('g')).toHaveLength(11);
    expect(bodyRows('É')).toHaveLength(13);
    // H: stems on all 9 cap rows, the bar once (no row of the bar is doubled)
    expect(
      bodyRows('H')
        .slice(0, 9)
        .every((r) => (r & 0x11) === 0x11),
    ).toBe(true);
    expect(bodyRows('H').filter((r) => r === 0x1f)).toHaveLength(1);
    // o: nothing above the x-height (rows 0-1), 7 rows of letter
    expect(bodyRows('o').slice(0, 2)).toEqual([0, 0]);
    expect(
      bodyRows('o')
        .slice(2, 9)
        .every((r) => r !== 0),
    ).toBe(true);
  });

  it('doubles only rows equal to a neighbour where it can (no bar grows thicker)', () => {
    // E: the three bars stay one row each
    expect(
      stretchRows([0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f]).filter((r) => r === 0x1e),
    ).toHaveLength(1);
    for (const ch of Object.keys(BODY_GLYPHS))
      expect(bodyRows(ch).length, ch).toBeGreaterThanOrEqual(9);
  });
});

describe('the gold coin glyph (QA "ícone de ouro")', () => {
  it('is a font character, so fmtGold puts it everywhere gold is written', () => {
    expect(hasGlyph(COIN)).toBe(true);
    setLocale('en');
    expect(fmtGold(1234)).toBe(`1,234${COIN}`);
    setLocale('pt-BR');
    expect(fmtGold(1234)).toBe(`1.234${COIN}`);
    setLocale('en');
  });

  it('is measured as wide as the body face draws it, and both faces fit their rows', () => {
    expect(measureText(COIN)).toBe(COIN_ROWS.body[0]!.length);
    expect(measureText(`12${COIN}`)).toBe(3 + 1 + 5 + 1 + 7); // "1" is 3 px wide
    expect(COIN_ROWS.body).toHaveLength(7); // the x-height of the body face
    expect(COIN_ROWS.small).toHaveLength(5); // the x-height of the small face
    for (const row of [...COIN_ROWS.body, ...COIN_ROWS.small]) expect(row).toMatch(/^[.KGLO]+$/);
  });
});

describe('bag drag and drop (QA "Drag n drop na bolsa")', () => {
  const g = bagGeom(40, 262);

  it('puts the grid right above the tabs, growing upward', () => {
    expect(g.y0).toBe(262 - 5 * 23 - 2);
    expect(slotXY(g, 0)).toEqual({ x: 8, y: g.y0 });
    expect(slotXY(g, 9)).toEqual({ x: 8 + 23, y: g.y0 + 23 });
  });

  it('finds the slot under a finger, seams and a near miss at the edge included', () => {
    expect(bagSlotAt(g, 8 + 11, g.y0 + 11)).toBe(0);
    expect(bagSlotAt(g, 8 + 22.5, g.y0 + 11)).toBe(0); // the 1 px seam belongs to the slot before it
    expect(bagSlotAt(g, 8 + 23, g.y0 + 11)).toBe(1);
    expect(bagSlotAt(g, 8 + 7 * 23 + 30, g.y0 + 4 * 23 + 30)).toBe(39); // just past the corner snaps to it
    expect(bagSlotAt(g, 100, g.y0 - 40)).toBeNull(); // above the grid: the text, not a slot
    expect(bagSlotAt(g, 100, 300)).toBeNull(); // the tabs
  });

  it('a partial last row has no slot past the bag', () => {
    const odd = bagGeom(36, 262);
    expect(bagSlotAt(odd, 8 + 6 * 23 + 5, odd.y0 + 4 * 23 + 5)).toBeNull();
    expect(bagSlotAt(odd, 8 + 3 * 23 + 5, odd.y0 + 4 * 23 + 5)).toBe(35);
  });

  it('lifts on a move past the jitter of a tap, not before', () => {
    expect(movedToLift(LIFT_PX, 0)).toBe(false);
    expect(movedToLift(3, 3)).toBe(false);
    expect(movedToLift(LIFT_PX + 1, 0)).toBe(true);
  });
});
