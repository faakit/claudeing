import { describe, expect, it } from 'vitest';
import { game, goals, items, shops, tips } from '../src/data';
import { fitText, measureText } from '../src/ui/fontMetrics';
import { TAB_LABELS } from '../src/ui/panels/tabLabels';
import { shopFacts } from '../src/ui/panels/shopFacts';
import { formatClock } from '../src/systems/time';
import { HUD_H, DOCK_Y, GAME_HEIGHT, GAME_WIDTH, WORLD_VIEW } from '../src/config';

/** Text boxes in the 200px portrait UI. If a string does not fit, these tests say which one. */
describe('portrait layout', () => {
  it('screen zones add up to the whole canvas', () => {
    expect(WORLD_VIEW.y).toBe(HUD_H);
    expect(WORLD_VIEW.y + WORLD_VIEW.h).toBe(DOCK_Y);
    expect(DOCK_Y).toBeLessThan(GAME_HEIGHT);
    expect(GAME_HEIGHT / GAME_WIDTH).toBe(2);
  });

  it('the world view shows at least 12 tiles across and 12 down', () => {
    expect(WORLD_VIEW.w / 16).toBeGreaterThanOrEqual(12);
    expect(WORLD_VIEW.h / 16).toBeGreaterThanOrEqual(12);
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
  it('every tab label fits its button with room to spare', () => {
    const labels = Object.entries(TAB_LABELS);
    const w = Math.floor((GAME_WIDTH - 8) / labels.length) - 2;
    for (const [id, label] of labels) expect(measureText(label), id).toBeLessThanOrEqual(w - 4);
  });
});
