import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { cart, game, items } from '../src/data';
import { cartTag } from '../src/systems/cart';
import { endDay } from '../src/systems/day';
import { shipAllProduce } from '../src/systems/economy';
import { POINTS_PER_HEART } from '../src/systems/friendship';
import { addItem, countItem } from '../src/systems/inventory';
import { boardWants } from '../src/systems/orders';
import {
  applyRival,
  boardScoreLine,
  boardTally,
  rivalCrate,
  rivalMinute,
  rivalNotice,
  rivalPicks,
  rivalTargets,
  settleSeason,
} from '../src/systems/rival';
import { specialSub, specialTitle } from '../src/systems/specials';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import { binWantedSub } from '../src/ui/panels/binText';
import { ORDER_SUB_PX, orderSub } from '../src/ui/panels/boardText';
import { cartSub } from '../src/ui/panels/cartText';
import type { GameState, Order } from '../src/state/GameState';
import { newState } from './helpers';

/** A board on Clay's first day: rows posted yesterday, all on their last day. */
function board(rows: [string, number][]): GameState {
  const s = newState();
  s.time.day = game.rival.startDay;
  const today = absoluteDay(s);
  s.orders = {
    day: today,
    list: rows.map(([item, reward], i): Order => ({
      id: i + 1,
      item: `${item}|0|`,
      qty: 2,
      reward,
      xp: 5,
      done: false,
      from: today - 1,
      until: today,
    })),
  };
  return s;
}

describe('critique 10 F2: Clay plays to win', () => {
  it('he takes the farm row on its last day before a dearer fish row, and names only a scoring target', () => {
    const s = board([
      ['bluegill', 400],
      ['parsnip', 200],
      ['wild_leek', 100],
    ]);
    expect(rivalPicks(s)[0]?.item).toBe('parsnip|0|');
    expect(rivalTargets(s).map((o) => o.item)).toEqual(['parsnip|0|']);
    expect(rivalNotice(s)).toBe('Clay wants this one at 2:00 PM.');
    s.time.minutes = rivalMinute(s);
    applyRival(s);
    expect(boardTally(s, absoluteDay(s)).rival).toBe(1);
  });

  it('with only fish and wild rows due, the board says his take is no point and marks no target', () => {
    const s = board([
      ['bluegill', 400],
      ['wild_leek', 100],
    ]);
    expect(rivalTargets(s)).toEqual([]);
    expect(rivalNotice(s)).toBe('Clay takes one at 2:00 PM: no point.');
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
  });

  it('he ships a crate of his own once a week: a point, said in the morning', () => {
    const s = newState();
    s.time.day = 14;
    s.time.minutes = 600;
    const sum = endDay(s, { passedOut: false, weedCandidates: [] });
    expect(boardTally(s, 14).rival).toBe(1);
    expect((sum.notes ?? []).some((n) => /crate from his own field/.test(n))).toBe(true);
    expect(rivalCrate(s)).toBe(false); // once for that day
    // Not on other days, and not before the race starts (day 7).
    const t = newState();
    t.time.day = 8;
    expect(rivalCrate(t)).toBe(false);
  });
});

describe('critique 10 F3: at 5 hearts the race goes on without his takes', () => {
  it('the score stays on the board, seasons still settle, the trophy can still be won', () => {
    const s = newState();
    s.friends['clay'] = { points: 5 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    s.time.day = 20;
    expect(boardScoreLine(s)).toBe('This season: you 0, Clay 0.');
    expect(rivalNotice(s)).toBe('Clay no longer takes requests.');
    expect(rivalCrate(s)).toBe(false);
    s.stats['board.s0.you'] = 3;
    s.time.season = 'summer';
    s.time.day = 1;
    expect(settleSeason(s)).toMatch(/You beat Clay/);
    expect(s.stats['boardWins']).toBe(1);
  });

  it('a 0 to 0 season is said', () => {
    const s = newState();
    s.time.season = 'summer';
    s.time.day = 1;
    expect(settleSeason(s)).toBe('The board was quiet last season: nobody scored.');
  });
});

describe('critique 10 F5: "Ship all produce" keeps the special too', () => {
  it("the special's open quantity is kept after the requests'", () => {
    const s = newState();
    s.special = {
      id: 'x',
      giver: 'rosa',
      item: 'potato',
      qty: 15,
      given: 12,
      reward: 2250,
      due: absoluteDay(s) + 5,
    };
    addItem(s, 'potato', 5);
    expect(boardWants(s).get('potato|')).toBe(3);
    shipAllProduce(s, boardWants(s));
    expect(countItem(s, 'potato')).toBe(3);
    s.time.day += 10; // past its due day: nothing kept
    expect(boardWants(s).get('potato|')).toBeUndefined();
  });
});

describe('critique 10 F6: text and numbers', () => {
  it('a four-digit reward keeps "last day" on the row', () => {
    const s = board([['cauliflower', 1045]]);
    const sub = orderSub(s, s.orders.list[0]!, 3);
    expect(sub).toBe('2/2  1,045g  last day');
    expect(measureText(sub)).toBeLessThanOrEqual(ORDER_SUB_PX);
    s.orders.list[0]!.reward = 120;
    expect(orderSub(s, s.orders.list[0]!, 1)).toBe('Have 1/2  120g  last day');
  });

  it("the special's title and line fit, the giver on the second line", () => {
    const sp = {
      id: 'x',
      giver: 'rosa',
      item: 'cauliflower',
      qty: 15,
      given: 15,
      reward: 9999,
      due: 1,
    };
    expect(specialTitle(sp)).toBe('Special: 15 Cauliflower');
    expect(specialSub(sp)).toBe('Rosa 15/15  9,999g');
    for (const t of [specialTitle(sp), specialSub(sp)])
      expect(measureText(t)).toBeLessThanOrEqual(200 - 8 - 28 - 43 - 2);
  });

  it('a cart row shows how many are left once you bought some; out-of-season seeds say Greenhouse', () => {
    expect(cartSub(900, 5, 'Market Road', cart.limit)).toBe('900g  Market Road');
    expect(cartSub(900, 2, 'Market Road', cart.limit)).toBe('900g  2 left');
    const s = newState();
    s.time.season = 'fall';
    expect(cartTag('strawberry_seed', s)).toBe('Greenhouse');
    s.time.season = 'spring';
    expect(cartTag('strawberry_seed', s)).toBe('Spring crop');
  });

  it('a wanted bin row says the number in words, and fits', () => {
    expect(binWantedSub(15, 99, 0)).toBe('Board 15  x99');
    // The bin row's text room (three buttons) after its usual shortening ("have 9" to "x9").
    expect(measureText(binWantedSub(15, 99, 0))).toBeLessThanOrEqual(81);
    expect(items['potato']).toBeDefined();
  });
});
