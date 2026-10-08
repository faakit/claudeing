import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { animals } from '../src/data';
import { endDay } from '../src/systems/day';
import { feed, houseOf, morning } from '../src/systems/animals';
import { addItem, countItem } from '../src/systems/inventory';
import { interactWith, placeObject } from '../src/systems/placeables';
import { depositFeed, feedFromSilos, siloStock, siloTotal } from '../src/systems/silo';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

function sty(s: GameState, pigs = 2) {
  const obj = placeObject(s, 'farm', 3, 3, 'sty');
  houseOf(obj).n = pigs;
  return obj;
}

describe('pigs', () => {
  it('are an outdoor animal whose product is the truffle', () => {
    expect(animals['pig']).toMatchObject({ product: 'truffle', outdoor: true, feed: 'slop' });
  });

  it('dig truffles on dry days, but not in the rain or in winter (they still cheer up when fed)', () => {
    const s = newState();
    const obj = sty(s);
    houseOf(obj).fed = true;
    expect(morning(obj, true)).toBe(true);
    expect(houseOf(obj).ready).toBe(2);
    houseOf(obj).fed = true;
    const joy = houseOf(obj).joy;
    morning(obj, false);
    expect(houseOf(obj).ready).toBe(2);
    expect(houseOf(obj).joy).toBe(joy + 1);
  });

  it('the morning rollover uses the weather', () => {
    const s = newState();
    const obj = sty(s);
    addItem(s, 'slop', 2);
    expect(feed(s, obj)).toBe('ok');
    s.forecast = 'rain';
    sleep(s);
    expect(houseOf(obj).ready).toBe(0);
    addItem(s, 'slop', 2);
    feed(s, obj);
    s.forecast = 'sunny';
    sleep(s);
    expect(houseOf(obj).ready).toBe(2);
  });
});

describe('feed silo', () => {
  it('one tap pours every feed in the bag into it, up to its capacity', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 5, 5, 'silo');
    addItem(s, 'hay', 40);
    addItem(s, 'chicken_feed', 30);
    addItem(s, 'tomato', 3); // not feed
    interactWith(s, silo);
    expect(siloTotal(silo)).toBe(70);
    expect(countItem(s, 'hay')).toBe(0);
    expect(countItem(s, 'tomato')).toBe(3);
    addItem(s, 'hay', 99);
    addItem(s, 'hay', 99);
    addItem(s, 'hay', 99);
    expect(depositFeed(s, silo)).toBe(230);
    expect(siloTotal(silo)).toBe(300);
    expect(countItem(s, 'hay')).toBe(67);
  });

  it('feeds hungry houses overnight, never those already fed, and only from matching feed', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 5, 5, 'silo');
    siloStock(silo)['hay'] = 3;
    const barn = placeObject(s, 'farm', 7, 5, 'barn');
    houseOf(barn).n = 2;
    const coop = placeObject(s, 'farm', 9, 5, 'coop');
    houseOf(coop).n = 3;
    expect(feedFromSilos(s)).toBe(1); // the barn; the silo holds no chicken feed
    expect(houseOf(barn).fed).toBe(true);
    expect(houseOf(coop).fed).toBe(false);
    expect(siloStock(silo)['hay']).toBe(1);
    expect(feedFromSilos(s)).toBe(0); // the barn is already fed, one hay is not enough for two cows
  });

  it('in the rollover, silo-fed animals produce the next morning', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 5, 5, 'silo');
    siloStock(silo)['chicken_feed'] = 30;
    const coop = placeObject(s, 'farm', 9, 5, 'coop');
    houseOf(coop).n = 3;
    const sum = sleep(s);
    expect(houseOf(coop).ready).toBe(3);
    expect(sum.notes).toContain('The silo fed 1 animal house.');
    expect(siloStock(silo)['chicken_feed']).toBe(27);
  });

  it('a stocked silo is moved from the Move sheet, an empty one with a second tap', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 5, 5, 'silo');
    siloStock(silo)['hay'] = 5;
    expect(interactWith(s, silo)).toMatchObject({ kind: 'message' });
    expect(interactWith(s, silo)).toEqual({ kind: 'panel', panel: 'move', id: silo.id });
    const empty = placeObject(s, 'farm', 7, 5, 'silo');
    interactWith(s, empty);
    expect(interactWith(s, empty)).toEqual({ kind: 'pickup' });
  });
});
