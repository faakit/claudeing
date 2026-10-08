import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { hiveOf } from '../src/mechanics/beeHouse';
import { interactWith, placeObject, statusOf } from '../src/systems/placeables';
import { craftBlock } from '../src/systems/crafting';
import { addItem, countItem } from '../src/systems/inventory';
import { orderCandidates } from '../src/systems/orders';
import { collectJar, loadJar, preserveOf, tickJar } from '../src/systems/preserves';
import { addXp } from '../src/systems/skills';
import { runDayPipeline } from '../src/systems/dayHooks';
import { newState } from './helpers';

const ctx = (s: ReturnType<typeof newState>) => ({
  passedOut: false,
  weedCandidates: [],
  forageSpots: {},
  notes: [] as string[],
  scratch: {},
  summary: {
    endedDay: s.time.day,
    endedSeason: s.time.season,
    shipped: [],
    total: 0,
    withered: 0,
    passedOut: false,
    weather: 'sunny' as const,
    yearEnd: false,
    notes: [],
  },
});

describe('keg', () => {
  it('only takes fruit, makes wine, and takes longer than a jar', () => {
    const s = newState();
    const keg = placeObject(s, 'farm', 4, 4, 'keg');
    expect(preserveOf({ item: 'parsnip' }, 'keg')).toBeNull(); // veg: no
    expect(preserveOf({ item: 'tomato', q: 1 }, 'keg')).toEqual({
      item: 'wine',
      of: 'tomato',
      q: 1,
    });
    addItem(s, 'parsnip', 1);
    addItem(s, 'tomato', 1);
    expect(loadJar(s, keg, { item: 'parsnip' })).toBe('invalid');
    expect(loadJar(s, keg, { item: 'tomato' })).toBe('ok');
    for (let i = 0; i < 4; i++) tickJar(keg);
    expect(collectJar(s, keg)).toBe('waiting');
    tickJar(keg);
    expect(collectJar(s, keg)).toMatchObject({ item: 'wine', of: 'tomato' });
    expect(countItem(s, 'wine')).toBe(1);
  });
  it('is a recipe with a skill gate, and reports its status to the renderer', () => {
    const s = newState();
    expect(craftBlock(s, 'keg')).toBe('locked');
    addXp(s, 'farming', 300);
    expect(craftBlock(s, 'keg')).toBe('no_items');
    const keg = placeObject(s, 'farm', 4, 4, 'keg');
    expect(statusOf(keg)).toBe('idle');
    addItem(s, 'tomato', 1);
    loadJar(s, keg, { item: 'tomato' });
    expect(statusOf(keg)).toBe('busy');
    for (let i = 0; i < 5; i++) tickJar(keg);
    expect(statusOf(keg)).toBe('ready');
  });
  it('wine becomes an order candidate once a keg is unlocked and placed', () => {
    const s = newState();
    s.time.season = 'summer';
    expect(orderCandidates(s).some((r) => r.item === 'wine')).toBe(false);
    addXp(s, 'farming', 300);
    expect(orderCandidates(s).some((r) => r.item === 'wine')).toBe(false); // a recipe is not a keg
    placeObject(s, 'farm', 3, 3, 'keg');
    expect(orderCandidates(s).some((r) => r.item === 'wine')).toBe(true);
  });
});

describe('bee house', () => {
  it('makes honey every few mornings with no input, up to its cap', () => {
    const s = newState();
    const hive = placeObject(s, 'farm', 4, 4, 'bee_house');
    for (let i = 0; i < 3; i++) runDayPipeline(s, ctx(s));
    expect(hiveOf(hive).ready).toBe(0);
    runDayPipeline(s, ctx(s));
    expect(hiveOf(hive).ready).toBe(1);
    expect(statusOf(hive)).toBe('ready');
    for (let i = 0; i < 40; i++) runDayPipeline(s, ctx(s));
    expect(hiveOf(hive).ready).toBe(3);
  });
  it('collects honey with Interact and tells you when to come back', () => {
    const s = newState();
    const hive = placeObject(s, 'farm', 4, 4, 'bee_house');
    expect(interactWith(s, hive)).toMatchObject({
      kind: 'message',
      text: expect.stringContaining('Honey in'),
    });
    for (let i = 0; i < 4; i++) runDayPipeline(s, ctx(s));
    interactWith(s, hive);
    expect(countItem(s, 'honey')).toBe(1);
    expect(hiveOf(hive).ready).toBe(0);
  });
  it('repairs malformed hive data', () => {
    const s = newState();
    const hive = placeObject(s, 'farm', 4, 4, 'bee_house');
    hive.data['hive'] = { timer: 'x', ready: 9999 };
    expect(hiveOf(hive, 3)).toEqual({ timer: 0, ready: 3 });
  });
});
