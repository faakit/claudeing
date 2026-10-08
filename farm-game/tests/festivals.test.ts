import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { festivals } from '../src/data';
import { runDayPipeline } from '../src/systems/dayHooks';
import {
  accepts,
  enterFestival,
  festivalToday,
  hasEntered,
  placeFor,
  rivalScores,
} from '../src/systems/festivals';
import { addItem, countItem } from '../src/systems/inventory';
import { newState } from './helpers';

const onFestivalDay = (id: string) => {
  const s = newState();
  const f = festivals[id]!;
  s.time.season = f.season;
  s.time.day = f.day;
  return s;
};

describe('festivals', () => {
  it('happen on their date only', () => {
    const s = newState();
    expect(festivalToday(s)).toBeNull();
    const f = onFestivalDay('harvest_fair');
    expect(festivalToday(f)?.id).toBe('harvest_fair');
    f.time.day += 1;
    expect(festivalToday(f)).toBeNull();
  });

  it('accept the right kinds of goods', () => {
    const fair = festivals['harvest_fair']!;
    expect(accepts(fair, { item: 'parsnip' })).toBe(true);
    expect(accepts(fair, { item: 'carp' })).toBe(false);
    expect(accepts(festivals['fishing_derby']!, { item: 'carp' })).toBe(true);
    expect(accepts(festivals['flower_show']!, { item: 'daffodil' })).toBe(true);
    expect(accepts(festivals['flower_show']!, { item: 'wild_leek' })).toBe(false);
    expect(accepts(festivals['winter_feast']!, { item: 'jam', of: 'tomato' })).toBe(true);
    expect(accepts(festivals['winter_feast']!, { item: 'egg' })).toBe(true);
  });

  it('rank an entry against three rivals: better goods, better place', () => {
    const s = onFestivalDay('harvest_fair');
    const def = festivals['harvest_fair']!;
    const [low, mid, high] = rivalScores(s, def);
    expect(placeFor(s, def, (high ?? 0) + 1)).toBe(1);
    expect(placeFor(s, def, (mid ?? 0) + 1)).toBe(2);
    expect(placeFor(s, def, (low ?? 0) + 1)).toBe(3);
    expect(placeFor(s, def, 1)).toBe(4);
  });

  it('pay a prize, take the item, and allow one entry per festival', () => {
    const s = onFestivalDay('harvest_fair');
    addItem(s, { item: 'pumpkin', q: 2 }, 2);
    const money = s.money;
    const res = enterFestival(s, { item: 'pumpkin', q: 2 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.place).toBe(1);
      expect(s.money).toBe(money + res.gold);
    }
    expect(countItem(s, 'pumpkin')).toBe(1);
    expect(hasEntered(s, 'harvest_fair')).toBe(true);
    expect(enterFestival(s, { item: 'pumpkin', q: 2 })).toEqual({ ok: false, reason: 'entered' });
    expect(s.stats['festivals']).toBe(1);
    expect(s.stats['festivalWins']).toBe(1);
  });

  it('a weak entry still earns the consolation prize', () => {
    const s = onFestivalDay('harvest_fair');
    addItem(s, 'parsnip', 1);
    const res = enterFestival(s, { item: 'parsnip' });
    expect(res).toMatchObject({ ok: true, place: 4, gold: festivals['harvest_fair']!.consolation });
  });

  it('refuse the wrong item, a missing item and a day with no festival, changing nothing', () => {
    const s = onFestivalDay('harvest_fair');
    addItem(s, 'carp', 1);
    expect(enterFestival(s, { item: 'carp' })).toEqual({ ok: false, reason: 'invalid' });
    expect(enterFestival(s, { item: 'parsnip' })).toEqual({ ok: false, reason: 'invalid' });
    expect(countItem(s, 'carp')).toBe(1);
    expect(enterFestival(newState(), { item: 'parsnip' })).toEqual({
      ok: false,
      reason: 'no_festival',
    });
  });

  it('rivals get tougher every year and the prize grows with them', () => {
    const y1 = onFestivalDay('fishing_derby');
    const y3 = onFestivalDay('fishing_derby');
    y3.time.year = 3;
    const def = festivals['fishing_derby']!;
    expect(rivalScores(y3, def)[2]!).toBeGreaterThan(rivalScores(y1, def)[2]!);
    addItem(y3, { item: 'catfish', q: 2 }, 1);
    const res = enterFestival(y3, { item: 'catfish', q: 2 });
    if (res.ok && res.place === 1) expect(res.gold).toBe(Math.round(def.prizes[0] * 1.5));
  });

  it('are announced in the morning notes', () => {
    const s = onFestivalDay('flower_show');
    s.time.day -= 1;
    const notes: string[] = [];
    runDayPipeline(s, {
      passedOut: false,
      weedCandidates: [],
      forageSpots: {},
      notes,
      scratch: {},
      summary: {
        endedDay: s.time.day,
        endedSeason: s.time.season,
        shipped: [],
        total: 0,
        withered: 0,
        passedOut: false,
        weather: 'sunny',
        yearEnd: false,
        notes: [],
      },
    });
    expect(notes.some((n) => n.includes('Flower Show'))).toBe(true);
  });
});
