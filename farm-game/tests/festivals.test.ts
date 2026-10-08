import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { festivals } from '../src/data';
import { runDayPipeline } from '../src/systems/dayHooks';
import {
  accepts,
  basketKinds,
  basketScore,
  derbyBest,
  derbyCatches,
  derbyHint,
  goodOf,
  kindOf,
  varietyBonus,
  enterBasket,
  enterFestival,
  festivalToday,
  finishDerby,
  recordCatch,
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
    const s = onFestivalDay('flower_show');
    addItem(s, { item: 'daffodil', q: 2 }, 2);
    addItem(s, { item: 'tulip', q: 2 }, 1);
    const money = s.money;
    const res = enterBasket(s, [
      { item: 'daffodil', q: 2 },
      { item: 'tulip', q: 2 },
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.place).toBe(1);
      expect(s.money).toBe(money + res.gold);
    }
    expect(countItem(s, 'daffodil')).toBe(1);
    expect(hasEntered(s, 'flower_show')).toBe(true);
    expect(enterFestival(s, { item: 'daffodil', q: 2 })).toEqual({ ok: false, reason: 'entered' });
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
    for (const fish of ['salmon', 'catfish', 'trout']) recordCatch(y3, { item: fish, q: 2 });
    const res = finishDerby(y3);
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

describe('festival minigames', () => {
  it('a basket takes up to three different goods and rewards variety', () => {
    const s = onFestivalDay('harvest_fair');
    const fair = festivals['harvest_fair']!;
    const same = basketScore(fair, [{ item: 'pumpkin' }, { item: 'yam' }]);
    const mixed = basketScore(fair, [{ item: 'pumpkin' }, { item: 'apple' }]);
    expect(mixed / (330 + 65)).toBeCloseTo(1.15, 2); // veg + fruit
    expect(same).toBe(330 + 65);
    addItem(s, { item: 'pumpkin', q: 2 }, 1);
    addItem(s, { item: 'apple', q: 2 }, 1);
    addItem(s, 'yam', 1);
    addItem(s, 'corn', 1);
    // too many, duplicates and missing goods are refused, changing nothing
    const four = [
      { item: 'pumpkin', q: 2 },
      { item: 'apple', q: 2 },
      { item: 'yam' },
      { item: 'corn' },
    ];
    expect(enterBasket(s, four)).toEqual({ ok: false, reason: 'invalid' });
    expect(enterBasket(s, [{ item: 'yam' }, { item: 'yam' }])).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(enterBasket(s, [{ item: 'melon' }])).toEqual({ ok: false, reason: 'invalid' });
    expect(countItem(s, 'yam')).toBe(1);
    const res = enterBasket(s, four.slice(0, 3));
    expect(res).toMatchObject({ ok: true });
    expect(countItem(s, 'pumpkin') + countItem(s, 'apple') + countItem(s, 'yam')).toBe(0);
    expect(countItem(s, 'corn')).toBe(1);
  });

  it('three qualities of one crop are one good, not a basket (critique 5, F2)', () => {
    const s = onFestivalDay('harvest_fair');
    for (const q of [0, 1, 2]) addItem(s, { item: 'pumpkin', q }, 1);
    const three = [{ item: 'pumpkin' }, { item: 'pumpkin', q: 1 }, { item: 'pumpkin', q: 2 }];
    expect(enterBasket(s, three)).toEqual({ ok: false, reason: 'invalid' });
    expect(countItem(s, 'pumpkin')).toBe(3);
    // Jams of different fruit are different goods (and one kind).
    const feast = festivals['winter_feast']!;
    const jams = [
      { item: 'jam', of: 'melon' },
      { item: 'jam', of: 'tomato' },
    ];
    expect(goodOf(jams[0]!)).not.toBe(goodOf(jams[1]!));
    expect(varietyBonus(feast, jams)).toBe(0);
  });

  it('variety is real: three kinds score 30% more at the Fair and the Feast', () => {
    const fair = festivals['harvest_fair']!;
    expect(kindOf(fair, { item: 'pumpkin', q: 2 })).toBe('Veg');
    expect(kindOf(fair, { item: 'cranberry' })).toBe('Fruit');
    expect(kindOf(fair, { item: 'blackberry' })).toBe('Wild'); // forage first, though it is a fruit
    expect(accepts(fair, { item: 'mushroom' })).toBe(true);
    const fairBasket = [{ item: 'pumpkin' }, { item: 'cranberry' }, { item: 'blackberry' }];
    expect(basketKinds(fair, fairBasket)).toEqual(['Veg', 'Fruit', 'Wild']);
    expect(varietyBonus(fair, fairBasket)).toBeCloseTo(0.3);
    const feast = festivals['winter_feast']!;
    const mixed = [{ item: 'wine', of: 'melon' }, { item: 'jam', of: 'tomato' }, { item: 'egg' }];
    expect(basketKinds(feast, mixed)).toEqual(['Wine', 'Jam', 'Animal']);
    expect(basketKinds(feast, [{ item: 'egg' }, { item: 'milk' }])).toEqual(['Animal']);
    // A single gold wine no longer wins the Feast on its own; a varied basket with it does.
    const s = onFestivalDay('winter_feast');
    const alone = basketScore(feast, [{ item: 'wine', of: 'melon', q: 2 }]);
    expect(placeFor(s, feast, alone)).toBeGreaterThan(1);
    expect(
      placeFor(s, feast, basketScore(feast, [{ ...mixed[0]!, q: 2 }, ...mixed.slice(1)])),
    ).toBe(1);
    // A modest varied basket (tomato jam, kale pickles, an egg) still reaches the podium.
    const modest = [
      { item: 'jam', of: 'tomato' },
      { item: 'pickles', of: 'kale' },
      { item: 'egg' },
    ];
    expect(placeFor(s, feast, basketScore(feast, modest))).toBeLessThanOrEqual(3);
  });

  it('the derby keeps the best three catches of the day and the fish stay in the bag', () => {
    const s = onFestivalDay('fishing_derby');
    expect(finishDerby(s)).toEqual({ ok: false, reason: 'invalid' }); // nothing caught yet
    for (const f of ['carp', 'trout', 'salmon', 'carp']) recordCatch(s, { item: f });
    expect(derbyCatches(s)).toEqual([100, 55, 25]);
    expect(recordCatch(s, { item: 'carp' })).toBe(false); // not better than the third
    expect(recordCatch(s, { item: 'catfish' })).toBe(true);
    expect(derbyCatches(s)).toEqual([100, 80, 55]);
    const res = finishDerby(s);
    expect(res).toMatchObject({ ok: true, score: 235 });
    expect(recordCatch(s, { item: 'salmon' })).toBe(false); // handed in
    expect(enterFestival(s, { item: 'salmon' })).toEqual({ ok: false, reason: 'entered' });
  });

  it('the derby page knows which fish each catch was', () => {
    const s = onFestivalDay('fishing_derby');
    recordCatch(s, { item: 'catfish', q: 1 });
    recordCatch(s, { item: 'carp' });
    expect(derbyBest(s).map((c) => c.ref)).toEqual([{ item: 'catfish', q: 1 }, { item: 'carp' }]);
  });

  it('the farm pond can reach the podium, and the stocked river can win (critique 5, F4)', async () => {
    const { fishFor } = await import('../src/systems/fishing');
    const s = onFestivalDay('fishing_derby');
    const def = festivals['fishing_derby']!;
    s.weather = 'sunny';
    // Three plain bluegill from the pond take third place.
    expect(placeFor(s, def, 3 * 35)).toBe(3);
    // Catfish bite in town on derby day whatever the weather, and three silver ones win.
    expect(fishFor(s, 'town').map((f) => f.item)).toContain('catfish');
    expect(fishFor(s, 'farm').map((f) => f.item)).not.toContain('catfish');
    expect(placeFor(s, def, 3 * 100)).toBe(1);
    const other = newState();
    other.time.season = 'summer';
    other.weather = 'sunny';
    expect(fishFor(other, 'town').map((f) => f.item)).not.toContain('catfish');
    expect(derbyHint(def)).toContain('Catfish');
  });

  it('catching a fish on derby day counts it', async () => {
    const { resolveCatch } = await import('../src/systems/fishing');
    const s = onFestivalDay('fishing_derby');
    resolveCatch(s, 'trout', { caught: true, perfect: false });
    expect(derbyCatches(s)[0]).toBeGreaterThanOrEqual(55);
    const other = newState();
    resolveCatch(other, 'trout', { caught: true, perfect: false });
    expect(derbyCatches(other)).toEqual([]);
  });
});

describe('festival text', () => {
  it('every blurb fits one line of the sheet', async () => {
    const { measureText } = await import('../src/ui/fontMetrics');
    for (const f of Object.values(festivals))
      expect(measureText(f.blurb), f.name).toBeLessThanOrEqual(184);
    // The widest basket line and derby row the sheet can show.
    expect(measureText('Basket 3/3  12,345 +30%  no podium')).toBeLessThanOrEqual(184);
    expect(measureText('3. Silver Catfish 1,000 points')).toBeLessThanOrEqual(184);
    expect(measureText('Sure? Tap to hand in')).toBeLessThanOrEqual(176);
  });
});

describe('the Flower Show arrangement (handover goal 6)', () => {
  it('takes up to three different flowers; a mixed pair beats a single bloom', () => {
    const s = onFestivalDay('flower_show');
    const def = festivals['flower_show']!;
    expect(accepts(def, { item: 'tulip' })).toBe(true);
    expect(accepts(def, { item: 'parsnip' })).toBe(false);
    const single = basketScore(def, [{ item: 'tulip', q: 2 }]);
    const pair = basketScore(def, [{ item: 'tulip' }, { item: 'daffodil' }]);
    expect(pair).toBeGreaterThan(single);
    // A plain pair reaches the podium, a gold pair wins, one daffodil alone does not place.
    expect(placeFor(s, def, pair)).toBeLessThanOrEqual(3);
    expect(
      placeFor(
        s,
        def,
        basketScore(def, [
          { item: 'tulip', q: 2 },
          { item: 'daffodil', q: 2 },
        ]),
      ),
    ).toBe(1);
    expect(placeFor(s, def, basketScore(def, [{ item: 'daffodil' }]))).toBe(4);
  });

  it('tulips are a spring crop you can buy before the show', async () => {
    const { stockFor } = await import('../src/systems/economy');
    const { crops } = await import('../src/data');
    expect(stockFor('town_general_store', 'spring')).toContain('tulip_seed');
    const grow = crops['tulip']!.stageDays.reduce((a, b) => a + b, 0);
    expect(grow).toBeLessThan(festivals['flower_show']!.day - 1);
  });
});
