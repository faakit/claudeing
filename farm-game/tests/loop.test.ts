import { describe, expect, it } from 'vitest';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { buyItem, shipItem } from '../src/systems/economy';
import { currentGoal } from '../src/systems/goals';
import { countItem } from '../src/systems/inventory';
import { tickTime } from '../src/systems/time';
import { equip, grass, newState, pond } from './helpers';

const NO_WEEDS: [number, number][] = [];

/** The scripted full loop from the plan, run headlessly. */
describe('full loop', () => {
  it('plant, water, sleep, rollover, harvest, ship, payout, rebuy', () => {
    const s = newState();
    const plots = [5, 6, 7].map((x) => grass(x, 5));

    // Day 1: till, plant, water.
    for (const p of plots) expect(performAction(s, p).ok).toBe(true);
    equip(s, 'parsnip_seed');
    for (const p of plots) expect(performAction(s, p).ok).toBe(true);
    s.inventory.selected = 1;
    for (const p of plots) expect(performAction(s, p).ok).toBe(true);
    expect(s.energy).toBe(100 - 3 * 2 - 3 * 1);

    // Sleep 4 times, watering each day, until mature.
    for (let day = 0; day < 4; day++) {
      endDay(s, { passedOut: false, weedCandidates: NO_WEEDS });
      if (day === 3) break; // matured this morning: nothing left to water
      s.inventory.selected = 1;
      performAction(s, pond(9, 9));
      for (const p of plots) performAction(s, p);
    }
    expect(s.time.day).toBe(5);
    expect(s.energy).toBe(100); // fully rested after the 4th sleep

    // Harvest, ship, sleep, get paid.
    s.inventory.selected = 0;
    for (const p of plots) expect(performAction(s, p)).toMatchObject({ kind: 'harvest' });
    expect(countItem(s, 'parsnip')).toBe(3);
    expect(shipItem(s, 'parsnip', 3)).toBe(3);
    const before = s.money;
    const summary = endDay(s, { passedOut: false, weedCandidates: NO_WEEDS });
    expect(summary.total).toBe(105);
    expect(s.money).toBeGreaterThanOrEqual(before + 105);
    expect(summary.shipped).toEqual([{ item: 'parsnip', qty: 3, gold: 105 }]);

    // Buy more seeds with the proceeds.
    expect(buyItem(s, 'town_general_store', 'parsnip_seed', 5)).toBe('ok');
    expect(s.stats['bought']).toBe(5);
  });

  it('passing out at 02:00 restores only half energy and does not count as sleeping in bed', () => {
    const s = newState();
    s.energy = 3;
    s.time.minutes = 1559;
    expect(tickTime(s, 500).passOut).toBe(true);
    const sum = endDay(s, { passedOut: true, weedCandidates: NO_WEEDS });
    expect(sum.passedOut).toBe(true);
    expect(s.energy).toBe(50);
    expect(s.time).toMatchObject({ day: 2, minutes: 360 });
    expect(s.stats['daysSlept']).toBeUndefined();
  });

  it('sleeping in bed gives full energy and advances 28 days into summer', () => {
    const s = newState();
    for (let i = 0; i < 28; i++) {
      s.energy = 10;
      endDay(s, { passedOut: false, weedCandidates: NO_WEEDS });
      expect(s.energy).toBe(100);
    }
    expect(s.time).toMatchObject({ season: 'summer', day: 1 });
  });

  it('shipped goods are paid at rollover, not before, and the season change withers crops', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    equip(s, 'parsnip_seed');
    performAction(s, grass(5, 5));
    s.time.day = 28;
    const sum = endDay(s, { passedOut: false, weedCandidates: NO_WEEDS });
    expect(sum.withered).toBe(1);
    expect(s.time.season).toBe('summer');
  });

  it('flags the year-end results on Summer 28', () => {
    const s = newState();
    s.time.season = 'summer';
    s.time.day = 28;
    expect(endDay(s, { passedOut: false, weedCandidates: NO_WEEDS }).yearEnd).toBe(true);
  });

  it('goals advance and pay out as the player plays', () => {
    const s = newState();
    expect(currentGoal(s)?.id).toBe('till');
    for (let x = 0; x < 6; x++) performAction(s, grass(x, 5));
    expect(currentGoal(s)?.id).toBe('plant');
    expect(s.money).toBe(520);
  });
});
