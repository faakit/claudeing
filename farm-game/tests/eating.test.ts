import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items } from '../src/data';
import { maxEnergy } from '../src/systems/energy';
import {
  dishEnergy,
  dishesToday,
  dishText,
  eat,
  eatGain,
  FULL_DISHES,
  foodEnergy,
} from '../src/systems/food';
import { addItem } from '../src/systems/inventory';
import { measureText } from '../src/ui/fontMetrics';
import { newState } from './helpers';

const DISHES = Object.entries(items)
  .filter(([, d]) => d.type === 'food')
  .map(([id]) => id);

/** Eat one pie from an empty stomach: energy set low enough that the cap never cuts it. */
function eatPie(s: ReturnType<typeof newState>): number {
  s.energy = 0;
  const slot = s.inventory.slots.findIndex((x) => x?.item === 'pumpkin_pie');
  expect(eat(s, slot)).toBe('ok');
  return s.energy;
}

describe('eating: three dishes a day at full strength, then less (owner default, round 3)', () => {
  it('the 4th dish of a day gives half, the 5th and later a quarter; a new day starts afresh', () => {
    const s = newState();
    addItem(s, 'pumpkin_pie', 10);
    const pie = foodEnergy('pumpkin_pie');
    for (let i = 0; i < FULL_DISHES; i++) expect(eatPie(s)).toBe(pie);
    expect(eatPie(s)).toBe(Math.round(pie / 2));
    expect(eatPie(s)).toBe(Math.round(pie / 4));
    expect(eatPie(s)).toBe(Math.round(pie / 4));
    expect(dishesToday(s)).toBe(6);
    s.time.day += 1;
    expect(dishesToday(s)).toBe(0);
    expect(eatPie(s)).toBe(pie);
  });

  it("the dish's text and the Eat button say today's energy, and the text fits", () => {
    const s = newState();
    expect(dishText(s, 'pumpkin_pie')).toBe(items['pumpkin_pie']!.description);
    s.stats['ate.day'] = 1;
    s.stats['ate.today'] = FULL_DISHES;
    s.energy = 0;
    expect(dishText(s, 'pumpkin_pie')).toBe('The best of fall. Restores 40 now: dish 4 today.');
    expect(eatGain(s, 'pumpkin_pie')).toBe(40);
    s.stats['ate.today'] = 9;
    for (const id of DISHES) {
      expect(dishText(s, id), id).toMatch(/now: dish 10 today\.$/);
      expect(measureText(dishText(s, id)), id).toBeLessThanOrEqual(184 * 2);
    }
  });

  it('a late dish is still refused when most of it would be wasted', () => {
    const s = newState();
    s.stats['ate.day'] = 1;
    s.stats['ate.today'] = 5;
    addItem(s, 'pumpkin_pie', 1);
    s.energy = maxEnergy(s) - 5; // a quarter pie is 20: only 5 would count
    const slot = s.inventory.slots.findIndex((x) => x?.item === 'pumpkin_pie');
    expect(eat(s, slot)).toBe('full');
    s.energy = maxEnergy(s) - 15;
    expect(eat(s, slot)).toBe('ok');
  });

  it('balance: ten pies in one day give no more than five at full strength', () => {
    const pie = foodEnergy('pumpkin_pie');
    const s = newState();
    let total = 0;
    for (let i = 0; i < 10; i++) {
      total += dishEnergy(s, 'pumpkin_pie');
      s.stats['ate.day'] = 1;
      s.stats['ate.today'] = i + 1;
    }
    expect(total).toBeLessThanOrEqual(pie * 5);
  });
});
