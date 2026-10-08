import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { npcs } from '../src/data';
import { measureText } from '../src/ui/fontMetrics';
import { collect, feed, houseOf, moveIn, morning } from '../src/systems/animals';
import { buyItem, priceFor } from '../src/systems/economy';
import {
  canChat,
  canGift,
  chat,
  friendPerk,
  giveGift,
  heartsOf,
  lineFor,
  reactionTo,
} from '../src/systems/friendship';
import { addItem, countItem } from '../src/systems/inventory';
import { canPickUp, interactWith, placeObject } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { perk } from '../src/systems/skills';
import { absoluteDay } from '../src/systems/time';
import { newState } from './helpers';

describe('animals', () => {
  it('a coop houses chickens, which need feed to lay and get happier', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 2);
    addItem(s, 'chicken_feed', 5);
    expect(moveIn(s, coop)).toBe(2);
    expect(houseOf(coop).n).toBe(2);
    expect(countItem(s, 'chicken')).toBe(0);
    expect(feed(s, coop)).toBe('ok');
    expect(feed(s, coop)).toBe('fed');
    expect(countItem(s, 'chicken_feed')).toBe(3);
    expect(morning(coop)).toBe(true);
    expect(houseOf(coop)).toMatchObject({ ready: 2, joy: 1, fed: false });
    expect(collect(s, coop)).toBe(2);
    expect(countItem(s, 'egg')).toBe(2);
  });
  it('hungry animals lay nothing and sulk', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 1);
    moveIn(s, coop);
    houseOf(coop).joy = 2;
    expect(morning(coop)).toBe(false);
    expect(houseOf(coop)).toMatchObject({ ready: 0, joy: 1 });
  });
  it('is capped by capacity, and refuses to feed without enough feed', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 5);
    expect(moveIn(s, coop)).toBe(3);
    expect(countItem(s, 'chicken')).toBe(2);
    addItem(s, 'chicken_feed', 2);
    expect(feed(s, coop)).toBe('no_feed');
  });
  it('one Interact does the chores in order', () => {
    const s = newState();
    const barn = placeObject(s, 'farm', 4, 4, 'barn');
    addItem(s, 'cow', 1);
    addItem(s, 'hay', 3);
    expect(interactWith(s, barn).kind).toBe('message');
    expect(houseOf(barn)).toMatchObject({ n: 1, fed: true });
    morning(barn);
    interactWith(s, barn);
    expect(countItem(s, 'milk')).toBe(1);
    expect(s.stats['collected']).toBe(1);
    expect(s.stats['animalsAdded']).toBe(1);
  });
  it('a house with animals cannot be picked up', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 1);
    moveIn(s, coop);
    expect(canPickUp(coop)).toBe(false);
    expect(canPickUp(placeObject(s, 'farm', 6, 4, 'coop'))).toBe(true);
  });
  it('repairs a malformed house in a hand-edited save', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    coop.data['house'] = { n: 999, fed: 'yes', ready: -4, joy: 'x' };
    expect(houseOf(coop)).toEqual({ n: 3, fed: false, petted: false, ready: 0, joy: 0 });
  });
});

describe('villagers', () => {
  it('the first chat of a day earns friendship, later ones do not', () => {
    const s = newState();
    expect(canChat(s, 'mara')).toBe(true);
    expect(chat(s, 'mara').gained).toBe(10);
    expect(canChat(s, 'mara')).toBe(false);
    expect(chat(s, 'mara').gained).toBe(0);
    expect(s.stats['talked']).toBe(1);
    s.time.day += 1;
    expect(canChat(s, 'mara')).toBe(true);
  });
  it('hearts rise with gifts; favourites are worth more and dislikes cost', () => {
    const s = newState();
    addItem(s, 'daffodil', 1);
    addItem(s, 'fiber', 1);
    expect(reactionTo('mara', { item: 'daffodil' })).toBe('love');
    expect(reactionTo('mara', { item: 'fiber' })).toBe('dislike');
    expect(reactionTo('mara', { item: 'jam', of: 'tomato' })).toBe('love');
    const res = giveGift(s, 'mara', { item: 'daffodil' });
    expect(res).toMatchObject({ ok: true, reaction: 'love', points: 80 });
    expect(heartsOf(s, 'mara')).toBe(1);
    expect(canGift(s, 'mara')).toBe(false);
    expect(giveGift(s, 'mara', { item: 'fiber' })).toEqual({ ok: false, reason: 'today' });
    s.time.day += 1;
    giveGift(s, 'mara', { item: 'fiber' });
    expect(s.friends['mara']!.points).toBe(60);
  });
  it('tools and animals cannot be gifted, and nothing is lost on refusal', () => {
    const s = newState();
    expect(giveGift(s, 'rosa', { item: 'hoe' })).toEqual({ ok: false, reason: 'invalid' });
    expect(canGift(s, 'rosa')).toBe(true);
  });
  it('friends hand over a daily gift once they are close enough', () => {
    const s = newState();
    s.friends['finn'] = { points: 150, talkedDay: 0, giftedDay: 0 };
    const res = chat(s, 'finn');
    expect(res.gift).toEqual({ item: 'bait', qty: 3 });
    expect(countItem(s, 'bait')).toBe(3);
  });
  it('friendship perks stack into perk(): the shopkeeper gives a discount', () => {
    const s = newState();
    expect(friendPerk(s, 'shopDiscount')).toBe(0);
    const full = priceFor(s, 'chicken_feed');
    s.friends['mara'] = { points: 100, talkedDay: 0, giftedDay: 0 };
    expect(perk(s, 'shopDiscount')).toBeCloseTo(0.05);
    expect(priceFor(s, 'chicken_feed')).toBeLessThanOrEqual(full);
    s.friends['mara']!.points = 250;
    expect(perk(s, 'shopDiscount')).toBeCloseTo(0.15);
    s.money = 10000;
    const money = s.money;
    expect(buyItem(s, 'town_general_store', 'chicken', 1)).toBe('ok');
    expect(money - s.money).toBe(priceFor(s, 'chicken'));
    expect(priceFor(s, 'chicken')).toBe(Math.round(350 * 0.85));
  });
  it('the same line is shown all day, and every line fits the dialogue box', () => {
    const s = newState();
    expect(lineFor(s, 'mara')).toBe(lineFor(s, 'mara'));
    for (const [id, def] of Object.entries(npcs)) {
      expect(absoluteDay(s)).toBeGreaterThan(0);
      for (const lines of Object.values(def.lines))
        for (const l of lines) {
          // The sheet wraps at 184px and has room for four lines.
          expect(measureText(`"${l}"`), `${id}: ${l}`).toBeLessThanOrEqual(184 * 3);
        }
    }
  });
});

describe('save v4', () => {
  it('migrates a v3 save and keeps friends sane', () => {
    const s = newState();
    const raw = JSON.parse(JSON.stringify({ ...s, version: 3 }));
    delete raw.friends;
    const out = migrate(raw);
    expect(out.friends).toEqual({});
    raw.version = 4;
    raw.friends = {
      mara: { points: 99999, talkedDay: -1, giftedDay: 'x' },
      ghost: { points: 10, talkedDay: 0, giftedDay: 0 },
    };
    const again = migrate(raw);
    expect(again.friends['mara']!.points).toBe(250);
    expect(again.friends['ghost']).toBeUndefined();
  });
});

describe('sheep, looms and petting', () => {
  it('a shed houses sheep that give wool; a loom weaves it into cloth', async () => {
    const { tickJar, loadJar, collectJar } = await import('../src/systems/preserves');
    const s = newState();
    const shed = placeObject(s, 'farm', 4, 4, 'shed');
    addItem(s, 'sheep', 1);
    addItem(s, 'feed_bale', 2);
    expect(moveIn(s, shed)).toBe(1);
    expect(feed(s, shed)).toBe('ok');
    morning(shed);
    expect(collect(s, shed)).toBe(1);
    expect(countItem(s, 'wool')).toBe(1);
    const loom = placeObject(s, 'farm', 6, 4, 'loom');
    expect(loadJar(s, loom, { item: 'wool' })).toBe('ok');
    for (let i = 0; i < 4; i++) tickJar(loom);
    expect(collectJar(s, loom)).toMatchObject({ item: 'cloth', of: 'wool' });
  });
  it('a daily pat makes animals happier, once', async () => {
    const { pet } = await import('../src/systems/animals');
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    expect(pet(coop)).toBe(false); // nobody home
    addItem(s, 'chicken', 1);
    moveIn(s, coop);
    expect(pet(coop)).toBe(true);
    expect(houseOf(coop).joy).toBe(1);
    expect(pet(coop)).toBe(false);
    morning(coop);
    expect(pet(coop)).toBe(true);
  });
  it('Interact on a fed house pats the animals', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 1);
    addItem(s, 'chicken_feed', 1);
    interactWith(s, coop); // moves in and feeds
    interactWith(s, coop); // already fed: pat
    expect(houseOf(coop).petted).toBe(true);
  });
});
