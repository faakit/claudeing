import { describe, expect, it } from 'vitest';
import { game, goals, items, shops, tips } from '../src/data';
import { fitText, measureText } from '../src/ui/fontMetrics';
import { TAB_IDS, tabLabel } from '../src/ui/panels/tabLabels';
import { LOCALES, setLocale } from '../src/i18n';
import { menuTabGrid } from '../src/ui/layout';
import { shopFacts } from '../src/ui/panels/shopFacts';
import { formatClock } from '../src/systems/time';
import { CONTROLS_Y, GAME_HEIGHT, GAME_WIDTH, HUD_H, WORLD_CLEAR, WORLD_VIEW } from '../src/config';

/** Text boxes in the 200px portrait UI. If a string does not fit, these tests say which one. */
describe('portrait layout', () => {
  it('screen zones add up to the whole canvas: the world runs from under the HUD to the bottom edge', () => {
    expect(WORLD_VIEW.y).toBe(HUD_H);
    expect(WORLD_VIEW.y + WORLD_VIEW.h).toBe(GAME_HEIGHT); // no dock band: the controls float over the world
    expect(WORLD_CLEAR.y).toBe(HUD_H);
    expect(WORLD_CLEAR.y + WORLD_CLEAR.h).toBe(CONTROLS_Y);
    expect(CONTROLS_Y).toBeLessThan(GAME_HEIGHT);
    expect(GAME_HEIGHT / GAME_WIDTH).toBe(2);
  });

  it('the world view shows at least 12 tiles across and 12 down above the controls (20 down in all)', () => {
    expect(WORLD_VIEW.w / 16).toBeGreaterThanOrEqual(12);
    expect(WORLD_CLEAR.h / 16).toBeGreaterThanOrEqual(12);
    expect(WORLD_VIEW.h / 16).toBeGreaterThanOrEqual(20);
  });

  it('every goal fits on the one-line goal tracker', () => {
    for (const g of goals) {
      expect(measureText(g.text), `"${g.text}" is ${measureText(g.text)}px`).toBeLessThanOrEqual(
        182,
      );
    }
  });

  it('every goal hint and tip fits two lines of the 184px sheet text', () => {
    for (const g of goals)
      expect(measureText(`Hint: ${g.hint}`), g.id).toBeLessThanOrEqual(184 * 2 - 24);
    for (const t of tips) expect(measureText(t.text), t.id).toBeLessThanOrEqual(186 * 3 - 30);
  });

  it('the clock fits its 2x box at every minute of the day', () => {
    for (let m = game.dayStartMinutes; m <= game.dayEndMinutes; m += 10) {
      expect(measureText(formatClock(m), 2), formatClock(m)).toBeLessThanOrEqual(92);
    }
  });

  it('the date line fits above the clock', () => {
    for (const season of ['Spring', 'Summer', 'Fall', 'Winter']) {
      expect(measureText(`${season} 28  Y99`)).toBeLessThanOrEqual(92);
    }
  });

  it('item names fit a shop/bin row after fitText truncation, and short ones are untouched', () => {
    for (const it of Object.values(items)) {
      expect(measureText(fitText(it.name, 100))).toBeLessThanOrEqual(100);
    }
    expect(fitText('Corn', 100)).toBe('Corn');
    expect(fitText('A very very long item name indeed', 60).endsWith('..')).toBe(true);
  });

  it('shop upgrade labels fit their sub-line', () => {
    for (const shop of Object.values(shops)) {
      for (const up of shop.upgrades)
        for (const lv of up.levels) expect(measureText(lv.label)).toBeLessThanOrEqual(110);
    }
  });

  it('measureText is monotonic and scales linearly', () => {
    expect(measureText('abc')).toBeLessThan(measureText('abcd'));
    expect(measureText('Hello', 2)).toBe(measureText('Hello') * 2);
    expect(measureText('')).toBe(0);
  });
});

describe('shop rows never truncate', () => {
  it('every stock line fits the 110px sub-line, even owning 99 and late in the season', () => {
    const all = Object.values(shops).flatMap((s) => s.stock.map((e) => e.item));
    for (const id of all)
      for (const day of [1, 27])
        expect(measureText(shopFacts(id, 99, day)), `${id} day ${day}`).toBeLessThanOrEqual(110);
  });
});

describe('menu tabs', () => {
  it('every tab label fits its button with room to spare (inside the 4 px frame, 6 px either side)', () => {
    const { tabs } = menuTabGrid(TAB_IDS.length, false);
    for (const locale of LOCALES) {
      setLocale(locale);
      TAB_IDS.forEach((id, i) =>
        expect(measureText(tabLabel(id)), `${locale} ${id}`).toBeLessThanOrEqual(
          tabs[i]!.w - 8 - 12,
        ),
      );
    }
    setLocale('en');
  });
  it('tabs and Close share two rows; Close sits on the thumb side and mirrors for the left hand', () => {
    const right = menuTabGrid(6, false, GAME_WIDTH, [0, 30]);
    const left = menuTabGrid(6, true, GAME_WIDTH, [0, 30]);
    expect(right.tabs.filter((t) => t.y === 0)).toHaveLength(4);
    expect(right.tabs.filter((t) => t.y === 30)).toHaveLength(2);
    expect(right.close.y).toBe(30);
    expect(right.close.x + right.close.w).toBeGreaterThan(GAME_WIDTH - 4); // right edge
    expect(left.close.x).toBeLessThan(4); // left edge
    for (const t of right.tabs) expect(t.w).toBeGreaterThanOrEqual(46);
    // nothing overlaps, everything inside the sheet
    const all = [...right.tabs, right.close];
    for (const a of all) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.x + a.w).toBeLessThanOrEqual(GAME_WIDTH);
      for (const b of all)
        if (a !== b && a.y === b.y) expect(a.x + a.w <= b.x || b.x + b.w <= a.x).toBe(true);
    }
  });
  it('more tabs from a mechanic still fit two rows with Close', () => {
    const g = menuTabGrid(8, false);
    expect(g.tabs).toHaveLength(8);
    expect(g.close.w).toBeGreaterThanOrEqual(g.tabs[0]!.w);
  });
});

describe('fitRow', () => {
  it('abbreviates before cutting, and still fits', async () => {
    const { fitRow, measureText } = await import('../src/ui/fontMetrics');
    const out = fitRow('Makes Gold Melon Wine (have 14)', 120);
    expect(measureText(out)).toBeLessThanOrEqual(120);
    expect(out).toContain('x14');
    expect(fitRow('Short', 120)).toBe('Short');
  });
});
