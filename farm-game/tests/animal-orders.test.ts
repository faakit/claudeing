import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { specials } from '../src/data';
import { animalOrderCap, animalOutput, houseOf } from '../src/systems/animals';
import { keyOf } from '../src/systems/itemRef';
import { generateOrders, orderCandidates } from '../src/systems/orders';
import { placeObject } from '../src/systems/placeables';
import { specialCandidates } from '../src/systems/specials';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const house = (s: GameState, type: string, n: number, x = 3) => {
  const obj = placeObject(s, 'farm', x, 3, type);
  houseOf(obj).n = n;
  return obj;
};
const asked = (s: GameState) => orderCandidates(s).map(keyOf);

describe('animal goods on the board (handover goal 2)', () => {
  it('nothing is asked for before the farm makes it', () => {
    const s = newState();
    expect(asked(s)).not.toContain(keyOf({ item: 'egg' }));
    house(s, 'coop', 0); // an empty coop lays nothing
    expect(asked(s)).not.toContain(keyOf({ item: 'egg' }));
  });

  it('hens, cows, pigs and bees put their goods on the board', () => {
    const s = newState();
    house(s, 'coop', 3, 3);
    house(s, 'barn', 2, 5);
    house(s, 'sty', 2, 7);
    const hive = placeObject(s, 'farm', 9, 3, 'bee_house');
    // Pigs dig only on dry days (counted at 60%); honey only once a hive has some ready.
    expect(Object.fromEntries(animalOutput(s))).toEqual({ egg: 3, milk: 2, truffle: 1.2 });
    hive.data['hive'] = { timer: 0, ready: 1 };
    const out = animalOutput(s);
    expect(Object.fromEntries(out)).toEqual({ egg: 3, milk: 2, truffle: 1.2, honey: 0.25 });
    for (const item of ['egg', 'milk', 'truffle', 'honey'])
      expect(asked(s)).toContain(keyOf({ item }));
    s.time.season = 'winter'; // pigs dig nothing in winter
    expect(asked(s)).not.toContain(keyOf({ item: 'truffle' }));
  });

  it('a request never asks for more than about two days of what the farm makes', () => {
    expect(animalOrderCap(0.25)).toBe(1);
    expect(animalOrderCap(3)).toBe(6);
    for (let seed = 1; seed <= 40; seed++) {
      const s = newState();
      s.rng = seed;
      house(s, 'coop', 1);
      placeObject(s, 'farm', 9, 3, 'bee_house').data['hive'] = { timer: 0, ready: 1 };
      for (const o of generateOrders(s, 30)) {
        if (o.item.startsWith('egg|')) expect(o.qty).toBeLessThanOrEqual(2);
        if (o.item.startsWith('honey|')) expect(o.qty).toBe(1);
      }
    }
  });

  it('specials for animal goods wait for animals that make them', () => {
    const s = newState();
    s.time.season = 'spring';
    s.stats['animalsAdded'] = 2;
    house(s, 'barn', 2); // cows, but no hens
    const ids = () => specialCandidates(s).map((d) => d.id);
    const eggSpecial = specials.find((d) => d.item === 'egg')!.id;
    expect(ids()).not.toContain(eggSpecial);
    house(s, 'coop', 3, 6);
    expect(ids()).toContain(eggSpecial);
    s.time.season = 'summer';
    expect(ids()).toContain('milk');
    expect(ids()).not.toContain('truffles');
    house(s, 'sty', 1, 9);
    expect(ids()).toContain('truffles');
  });
});

describe('specials sized to the farm (critique 6, F4)', () => {
  it('one hen is never asked for 30 eggs; a big coop gets the full special', async () => {
    const { makeSpecial, specialCap } = await import('../src/systems/specials');
    const def = specials.find((d) => d.item === 'egg')!;
    const s = newState();
    s.time.season = 'spring';
    s.time.day = 5;
    house(s, 'coop', 1);
    const one = makeSpecial(s, def);
    expect(one.qty).toBeLessThanOrEqual(specialCap(s, 'egg'));
    expect(one.qty).toBeLessThanOrEqual(28 - 5 - 1);
    house(s, 'coop', 3, 6);
    expect(makeSpecial(s, def).qty).toBeGreaterThan(one.qty);
    // With too few days left for even five eggs, no egg special goes up at all.
    const late = newState();
    late.time.season = 'spring';
    late.time.day = 24;
    house(late, 'coop', 1);
    expect(specialCandidates(late).some((d) => d.item === 'egg')).toBe(false);
  });
});
