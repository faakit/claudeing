import { afterEach, describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, plots } from '../src/data';
import { performAction } from '../src/systems/actions';
import { houseOf, moveIn } from '../src/systems/animals';
import { endDay } from '../src/systems/day';
import { addItem, countItem } from '../src/systems/inventory';
import { npcLocation } from '../src/systems/npcs';
import { daysLeft, deliverOrder, ensureOrders, refreshBoard } from '../src/systems/orders';
import {
  interactWith,
  occupantsOf,
  pickUpPlaced,
  placeObject,
  placedAt,
  setPickupClock,
} from '../src/systems/placeables';
import { POINTS_PER_HEART } from '../src/systems/friendship';
import { applyRival, rivalMinute, rivalNotice, rivalPicks } from '../src/systems/rival';
import { migrate } from '../src/systems/save';
import { siloStock } from '../src/systems/silo';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import { orderSub } from '../src/ui/panels/boardText';
import { moveText } from '../src/ui/panels/moveText';
import type { GameState } from '../src/state/GameState';
import { equip, grass, newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

/** A state on the rival's first day at 7 AM, board up. */
function rivalDay(): GameState {
  const s = newState();
  s.time.day = game.rival.startDay;
  s.time.minutes = 420;
  ensureOrders(s);
  return s;
}

/** Fixes for critique 5 (agents/critiques/critique-5.md). */
describe('critique 5 fixes', () => {
  afterEach(() => setPickupClock(() => Date.now()));

  it('F1: requests stay two or three days, then come down', () => {
    const s = rivalDay();
    const first = s.orders.list.map((o) => o.id);
    expect(first).toHaveLength(3);
    for (const o of s.orders.list) expect(daysLeft(s, o)).toBeGreaterThanOrEqual(2);
    s.time.day += 1;
    refreshBoard(s);
    // Nothing expired after one day: the same requests are still up.
    expect(s.orders.list.map((o) => o.id)).toEqual(first);
    s.time.day += 2;
    refreshBoard(s);
    expect(s.orders.list.some((o) => first.includes(o.id))).toBe(false);
    expect(s.orders.list).toHaveLength(3);
  });

  it('F1: a filled request makes room for a new one the next morning', () => {
    const s = rivalDay();
    const o = s.orders.list[0]!;
    addItem(s, o.item.split('|')[0]!, o.qty);
    expect(deliverOrder(s, o.id)).toBe('ok');
    s.time.day += 1;
    refreshBoard(s);
    expect(s.orders.list.find((x) => x.id === o.id)).toBeUndefined();
    expect(s.orders.list).toHaveLength(3);
    expect(new Set(s.orders.list.map((x) => x.item)).size).toBe(3); // never the same good twice
  });

  it('C6 F3 / C7 F2: Clay takes a request only on its last day, and the board names it', () => {
    const s = rivalDay();
    s.time.minutes = rivalMinute(s);
    expect(rivalPicks(s)).toEqual([]);
    expect(applyRival(s)).toBeNull(); // everything was posted today
    expect(rivalNotice(s)).toBe('Clay wants nothing here today.');
    // Next morning: the requests whose last day it is are fair game; longer ones are not.
    const day = absoluteDay(s) + 1;
    const [a, b, c] = s.orders.list;
    a!.until = day;
    b!.until = day;
    c!.until = day + 1;
    s.time.day += 1;
    s.time.minutes = 420;
    refreshBoard(s);
    const target = rivalPicks(s)[0]!;
    const best = [a!, b!].sort((x, y) => y.reward - x.reward)[0]!;
    expect(target.id).toBe(best.id);
    expect(rivalPicks(s).some((o) => o.id === c!.id)).toBe(false);
    expect(rivalNotice(s)).toBe('Clay wants this one at 2:00 PM.');
    expect(orderSub(s, target, 0, true)).toMatch(/Clay's!$/);
    s.time.minutes = rivalMinute(s);
    expect(applyRival(s)?.id).toBe(target.id);
  });

  it('C6 F2: Clay comes even when nobody looks at the board after 2 PM', () => {
    const s = rivalDay();
    for (const o of s.orders.list) o.until = absoluteDay(s) + 1;
    s.time.day += 1;
    refreshBoard(s); // a morning look only, every day
    const target = rivalPicks(s)[0]!;
    const sum = sleep(s);
    expect(s.stats['rivalTook']).toBe(1);
    expect(s.orders.list.find((o) => o.id === target.id)).toBeUndefined();
    expect(sum.notes?.some((n) => n.startsWith('Clay filled'))).toBe(true);
    // Never twice for a day he already acted on.
    const t = rivalDay();
    for (const o of t.orders.list) o.until = absoluteDay(t) + 1;
    t.time.day += 1;
    refreshBoard(t);
    t.time.minutes = rivalMinute(t);
    applyRival(t);
    sleep(t);
    expect(t.stats['rivalTook']).toBe(1);
  });

  it('F1: Clay is in town when his 2-heart perk says he comes (5 PM)', () => {
    const s = rivalDay();
    s.friends[game.rival.npc] = { points: 2 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    expect(npcLocation(game.rival.npc, game.rival.minute)?.map).toBe('town');
    expect(npcLocation(game.rival.npc, rivalMinute(s))?.map).toBe('town');
  });

  it('F1: old saves keep their board; a request without a last day ends that day', () => {
    const s = rivalDay();
    const raw = JSON.parse(JSON.stringify(s)) as GameState;
    for (const o of raw.orders.list) delete o.until;
    const back = migrate(raw as unknown as Record<string, unknown>);
    expect(back.orders.list).toHaveLength(3);
    back.time.day += 1;
    refreshBoard(back);
    expect(back.orders.list.some((o) => s.orders.list.some((x) => x.id === o.id))).toBe(false);
    expect(migrate(JSON.parse(JSON.stringify(s))).orders).toEqual(s.orders);
  });

  it('F1: the request line fits the board', () => {
    const s = rivalDay();
    const o = { ...s.orders.list[0]!, qty: 9, reward: 1200 };
    // 200 px sheet - icon column - one 36 px Give button.
    expect(measureText(orderSub(s, o, 99))).toBeLessThanOrEqual(200 - 8 - 28 - 39 - 2);
  });

  it('F3: chore taps never lift a coop with hens; the second tap opens the Move sheet', () => {
    let now = 1000;
    setPickupClock(() => now);
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 3);
    moveIn(s, coop);
    houseOf(coop).ready = 3;
    addItem(s, 'chicken_feed', 10);
    // The four taps of critique 5: collect + feed, pat, "All fed", and a fourth.
    const kinds: string[] = [];
    for (let i = 0; i < 4; i++) {
      kinds.push(interactWith(s, coop).kind);
      now += 450;
    }
    expect(kinds).not.toContain('pickup');
    expect(kinds).toContain('panel');
    expect(placedAt(s, 'farm', 4, 4)).toBe(coop);
    expect(occupantsOf(coop)).toBe('3 chickens');
    // A hungry coop with no feed in the bag: a second tap shows the sheet, never lifts it.
    const hungry = placeObject(s, 'farm', 8, 4, 'coop');
    houseOf(hungry).n = 2;
    s.inventory.slots = s.inventory.slots.map((x) => (x?.item === 'chicken_feed' ? null : x));
    expect(interactWith(s, hungry)).toMatchObject({ kind: 'message' });
    expect(interactWith(s, hungry)).toEqual({ kind: 'panel', panel: 'move', id: hungry.id });
    // The sheet's Move button picks it up, hens and all.
    expect(pickUpPlaced(s, 'farm', hungry)).toBe('ok');
    expect(s.stored['coop']).toHaveLength(1);
  });

  it('F3: the Move sheet says what comes along, and it fits', () => {
    expect(measureText(moveText('3 chickens, 6 egg waiting'), 1)).toBeGreaterThan(0);
    const s = newState();
    const silo = placeObject(s, 'farm', 4, 4, 'silo');
    expect(occupantsOf(silo)).toBeNull();
    siloStock(silo)['hay'] = 40;
    expect(occupantsOf(silo)).toBe('40 feed');
    // Two wrapped lines at most under the title (sheet text is 184 px wide).
    expect(measureText(moveText('6 chickens, 6 truffle waiting'))).toBeLessThanOrEqual(184 * 3);
  });

  it('F5/owner: nothing is placed on land not yet bought or on the greenhouse site', () => {
    const s = newState();
    addItem(s, 'sprinkler', 3);
    equip(s, 'sprinkler');
    const [gx, gy] = plots['greenhouse']!.rect;
    const site = performAction(s, grass(gx, gy));
    expect(site).toMatchObject({ ok: false });
    expect(!site.ok && site.message).toMatch(/Greenhouse will stand here/);
    const [wx, wy] = plots['west']!.rect;
    const west = performAction(s, grass(wx, wy));
    expect(!west.ok && west.message).toMatch(/Not your land yet/);
    // Your own plot, and the yard outside every plot, are fine.
    const [hx, hy] = plots['home']!.rect;
    expect(performAction(s, grass(hx, hy))).toMatchObject({ ok: true });
    expect(performAction(s, grass(4, 4))).toMatchObject({ ok: true });
    s.stats['project.greenhouse'] = 1;
    expect(performAction(s, grass(gx, gy))).toMatchObject({ ok: true });
    expect(countItem(s, 'sprinkler')).toBe(0);
  });

  it('F7: a house the silo cannot feed is named in the morning summary', () => {
    const s = newState();
    const silo = placeObject(s, 'farm', 5, 5, 'silo');
    siloStock(silo)['hay'] = 1;
    siloStock(silo)['chicken_feed'] = 10;
    const barn = placeObject(s, 'farm', 7, 5, 'barn');
    houseOf(barn).n = 2;
    const coop = placeObject(s, 'farm', 9, 5, 'coop');
    houseOf(coop).n = 3;
    const sum = sleep(s);
    expect(sum.notes).toContain('The silo fed 1 animal house.');
    expect(sum.notes?.some((n) => n.startsWith('The barn went hungry'))).toBe(true);
    expect(absoluteDay(s)).toBe(2);
  });
});

describe('critique 5 minor fixes', () => {
  it('F8: a shop row keeps the "own" count and fits beside its buttons', async () => {
    const { items } = await import('../src/data');
    const { shopFacts, shopFactsRoom } = await import('../src/ui/panels/shopFacts');
    for (const id of Object.keys(items))
      for (const x5 of [true, false]) {
        const line = shopFacts(id, 99, 1, true, shopFactsRoom(x5));
        expect(line, id).toMatch(/own 99|Own 99|Decor 99/i);
        expect(measureText(line), id).toBeLessThanOrEqual(shopFactsRoom(x5));
      }
    expect(shopFacts('parsnip_seed', 12, 1)).toBe('4d 35g, own 12');
    expect(shopFacts('parsnip_seed', 0, 1)).toBe('4 days  35g');
  });

  it('F8: truffles have a Book page', async () => {
    const { collections } = await import('../src/data');
    expect(Object.values(collections).some((c) => c.items.includes('truffle'))).toBe(true);
  });
});

describe('round 2 probe fixes', () => {
  it('the Move sheet counts goods the way people say them', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    houseOf(coop).n = 3;
    houseOf(coop).ready = 2;
    expect(occupantsOf(coop)).toBe('3 chickens, 2 eggs waiting');
    const barn = placeObject(s, 'farm', 6, 4, 'barn');
    houseOf(barn).n = 1;
    houseOf(barn).ready = 2;
    expect(occupantsOf(barn)).toBe('1 cow, 2 milk waiting');
  });
});

describe('critique 6 shop fixes', () => {
  it('F5/F8: seed rows fit, say "Glass only" out of season and say when a crop regrows', async () => {
    const { items } = await import('../src/data');
    const { shopFacts, shopFactsRoom } = await import('../src/ui/panels/shopFacts');
    for (const season of ['spring', 'summer', 'fall', 'winter'])
      for (const id of Object.keys(items).filter((i) => items[i]!.type === 'seed'))
        for (const own of [0, 99])
          for (const x5 of [true, false]) {
            const line = shopFacts(id, own, 1, true, shopFactsRoom(x5), season);
            expect(measureText(line), `${id} ${season} ${line}`).toBeLessThanOrEqual(
              shopFactsRoom(x5),
            );
          }
    expect(shopFacts('melon_seed', 0, 1, true, shopFactsRoom(true), 'fall')).toMatch(/^Glass/);
    expect(shopFacts('strawberry_seed', 0, 1, true, shopFactsRoom(false), 'spring')).toMatch(
      /again 4d/,
    );
  });

  it("F5: with a greenhouse the season's own seeds come first on the shelf", async () => {
    const { stockFor } = await import('../src/systems/economy');
    const s = newState();
    s.stats['project.greenhouse'] = 1;
    const fall = stockFor('town_general_store', 'fall', s).filter((i) => i.endsWith('_seed'));
    expect(fall[0]).toBe('pumpkin_seed');
    expect(fall.indexOf('yam_seed')).toBeLessThan(fall.indexOf('parsnip_seed'));
  });
});
