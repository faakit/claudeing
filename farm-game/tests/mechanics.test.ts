import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { performAction } from '../src/systems/actions';
import { craft, craftBlock } from '../src/systems/crafting';
import { runDayPipeline } from '../src/systems/dayHooks';
import {
  biteDelay,
  newReel,
  outcomeOf,
  pickFish,
  resolveCatch,
  stepReel,
} from '../src/systems/fishing';
import { addItem, countItem } from '../src/systems/inventory';
import { keyOf } from '../src/systems/itemRef';
import { deliverOrder, ensureOrders, generateOrders, haveFor } from '../src/systems/orders';
import { collectJar, jarReady, loadJar, preserveOf, tickJar } from '../src/systems/preserves';
import { placeObject } from '../src/systems/placeables';
import { addXp } from '../src/systems/skills';
import { absoluteDay } from '../src/systems/time';
import { equip, newState, pond } from './helpers';

describe('crafting', () => {
  it('is locked until the skill level, then pays gold and ingredients', () => {
    const s = newState();
    addItem(s, 'fiber', 30);
    s.money = 500;
    expect(craftBlock(s, 'sprinkler')).toBe('locked');
    addXp(s, 'farming', 100);
    expect(craftBlock(s, 'sprinkler')).toBeNull();
    expect(craft(s, 'sprinkler')).toBe('ok');
    expect(countItem(s, 'sprinkler')).toBe(1);
    expect(countItem(s, 'fiber')).toBe(18);
    expect(s.money).toBe(380);
  });
  it('refuses without ingredients or gold and changes nothing', () => {
    const s = newState();
    expect(craft(s, 'fertilizer')).toBe('no_items');
    addItem(s, 'fiber', 12);
    s.money = 10;
    addXp(s, 'farming', 100);
    expect(craft(s, 'sprinkler')).toBe('no_gold');
    expect(countItem(s, 'fiber')).toBe(12);
  });
});

describe('preserve jar', () => {
  it('turns fruit into jam and veg into pickles, keeping quality and origin', () => {
    expect(preserveOf({ item: 'tomato', q: 2 })).toEqual({ item: 'jam', of: 'tomato', q: 2 });
    expect(preserveOf({ item: 'parsnip' })).toEqual({ item: 'pickles', of: 'parsnip' });
    expect(preserveOf({ item: 'fiber' })).toBeNull();
    expect(preserveOf({ item: 'jam', of: 'tomato' })).toBeNull();
  });
  it('works over days and gives the good back once', () => {
    const s = newState();
    addItem(s, 'tomato', 2);
    const jar = placeObject(s, 'farm', 4, 4, 'preserve_jar');
    expect(loadJar(s, jar, { item: 'tomato' })).toBe('ok');
    expect(loadJar(s, jar, { item: 'tomato' })).toBe('busy');
    expect(countItem(s, 'tomato')).toBe(1);
    expect(collectJar(s, jar)).toBe('waiting');
    for (let i = 0; i < 3; i++) tickJar(jar);
    expect(jarReady(jar)).toBe(true);
    expect(collectJar(s, jar)).toMatchObject({ item: 'jam', of: 'tomato' });
    expect(collectJar(s, jar)).toBe('empty');
    expect(countItem(s, 'jam')).toBe(1);
  });
  it('advances in the morning day hooks', () => {
    const s = newState();
    addItem(s, 'tomato', 1);
    const jar = placeObject(s, 'farm', 4, 4, 'preserve_jar');
    loadJar(s, jar, { item: 'tomato' });
    const ctx = {
      passedOut: false,
      weedCandidates: [],
      forageSpots: {},
      notes: [],
      scratch: {},
      summary: s.lastSummary as never,
    };
    runDayPipeline(s, {
      ...ctx,
      summary: {
        endedDay: 1,
        endedSeason: 'spring',
        shipped: [],
        total: 0,
        withered: 0,
        passedOut: false,
        weather: 'sunny',
        yearEnd: false,
        notes: [],
      },
    });
    expect(jar.data['jar']).toMatchObject({ days: 2 });
  });
});

describe('orders', () => {
  it('generates distinct, profitable requests for the season', () => {
    const s = newState();
    const list = generateOrders(s);
    expect(list).toHaveLength(3);
    expect(new Set(list.map((o) => o.item)).size).toBe(3);
    for (const o of list) {
      expect(o.qty).toBeGreaterThanOrEqual(1);
      expect(o.reward).toBeGreaterThan(0);
    }
  });
  it('ensureOrders refreshes once per day', () => {
    const s = newState();
    ensureOrders(s);
    const first = s.orders.list.map((o) => o.id);
    ensureOrders(s);
    expect(s.orders.list.map((o) => o.id)).toEqual(first);
    expect(s.orders.day).toBe(absoluteDay(s));
  });
  it('delivering takes goods, pays, and rewards better quality', () => {
    const s = newState();
    s.orders = {
      day: absoluteDay(s),
      list: [{ id: 1, item: keyOf({ item: 'parsnip' }), qty: 2, reward: 100, xp: 10, done: false }],
    };
    const order = s.orders.list[0]!;
    expect(deliverOrder(s, 1)).toBe('missing');
    addItem(s, { item: 'parsnip', q: 2 }, 1);
    addItem(s, 'parsnip', 1);
    expect(haveFor(s, order)).toBe(2);
    const money = s.money;
    expect(deliverOrder(s, 1)).toBe('ok');
    expect(s.money - money).toBeGreaterThan(100); // the gold one adds a bonus
    expect(countItem(s, 'parsnip')).toBe(0);
    expect(deliverOrder(s, 1)).toBe('done');
  });
});

describe('fishing', () => {
  it('only offers fish that match the map and season', () => {
    const s = newState();
    for (let i = 0; i < 40; i++) {
      const f = pickFish(s, 'woods');
      expect(f?.maps).toContain('woods');
      expect(f?.seasons).toContain('spring');
    }
    expect(pickFish(s, 'house')).toBeNull();
  });
  it('casting needs water and starts the mini-game', () => {
    const s = newState();
    equip(s, 'fishing_rod');
    expect(performAction(s, { ...pond(5, 5), map: 'woods' }).ok).toBe(true);
  });
  it('bait speeds up the bite', () => {
    expect(biteDelay(0.5, true)).toBeLessThan(biteDelay(0.5, false));
  });
  it('a held bar chasing the fish wins; ignoring it loses', () => {
    const rnd = () => 0.5;
    const win = newReel(0.5, 0.2);
    for (let i = 0; i < 2000 && !win.result; i++)
      stepReel(win, 0.016, win.bar + win.size / 2 < win.fish, rnd);
    expect(win.result).toBe('caught');
    const lose = newReel(0.2, 0.9);
    lose.fish = 0.95;
    lose.target = 0.95;
    for (let i = 0; i < 4000 && !lose.result; i++) stepReel(lose, 0.016, false, () => 0.99);
    expect(lose.result).toBe('lost');
    expect(outcomeOf(lose).caught).toBe(false);
  });
  it('resolving a catch yields the fish and XP; a miss yields nothing', () => {
    const s = newState();
    expect(resolveCatch(s, 'carp', { caught: false, perfect: false }).ok).toBe(false);
    expect(countItem(s, 'carp')).toBe(0);
    expect(resolveCatch(s, 'carp', { caught: true, perfect: true }).ok).toBe(true);
    expect(countItem(s, 'carp')).toBe(1);
    expect(s.skills['fishing']).toBeGreaterThan(0);
    expect(s.stats['perfectCatch']).toBe(1);
  });
});
