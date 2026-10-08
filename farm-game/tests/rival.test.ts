import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { festivals, game, npcs } from '../src/data';
import { enterBasket } from '../src/systems/festivals';
import { POINTS_PER_HEART } from '../src/systems/friendship';
import { addItem } from '../src/systems/inventory';
import { deliverOrder, ensureOrders, generateOrders } from '../src/systems/orders';
import {
  applyRival,
  rivalActive,
  rivalMinute,
  rivalNotice,
  rivalPicks,
  rivalTakes,
} from '../src/systems/rival';
import { migrate } from '../src/systems/save';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

/** A state on the rival's first day, every request posted the day before and on its last day (fair game). */
function boardDay(): GameState {
  const s = newState();
  s.time.day = game.rival.startDay;
  s.orders = { day: absoluteDay(s), list: generateOrders(s) };
  for (const o of s.orders.list) {
    o.from = absoluteDay(s) - 1;
    o.until = absoluteDay(s);
  }
  return s;
}
const hearts = (s: GameState, n: number) =>
  (s.friends[game.rival.npc] = { points: n * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 });

describe('the rival farmer', () => {
  it('stays away during the first week', () => {
    const s = newState();
    s.time.minutes = 1200;
    ensureOrders(s);
    expect(rivalActive(s)).toBe(false);
    expect(applyRival(s)).toBeNull();
  });

  it('takes the best-paying open request once the clock passes 2 PM, once a day', () => {
    const s = boardDay();
    s.time.minutes = rivalMinute(s) - 1;
    expect(applyRival(s)).toBeNull();
    s.time.minutes = rivalMinute(s);
    const best = Math.max(...s.orders.list.map((o) => o.reward));
    const took = applyRival(s);
    expect(took?.reward).toBe(best);
    expect(took).toMatchObject({ done: true, rival: true });
    expect(applyRival(s)).toBeNull();
    expect(s.orders.list.filter((o) => o.rival)).toHaveLength(1);
    expect(rivalNotice(s)).toBe('Clay took one today.');
  });

  it('a request you filled first is safe, and that day the rival stays home', () => {
    const s = boardDay();
    const [a, b] = s.orders.list;
    for (const o of [a!, b!]) addItem(s, o.item.split('|')[0]!, o.qty);
    s.time.minutes = 600;
    expect(deliverOrder(s, a!.id)).toBe('ok');
    s.time.minutes = rivalMinute(s) + 10;
    expect(deliverOrder(s, b!.id)).toBe('ok');
    expect(s.orders.list.some((o) => o.rival)).toBe(false);
    // Without a delivery, a late visit finds his pick gone.
    const t = boardDay();
    t.time.minutes = rivalMinute(t) + 10;
    const target = rivalPicks(t)[0]!;
    addItem(t, target.item.split('|')[0]!, target.qty);
    expect(deliverOrder(t, target.id)).toBe('done');
  });

  it('friendship softens the rivalry: later, then polite, then not at all', () => {
    const s = boardDay();
    hearts(s, 2);
    expect(rivalMinute(s)).toBe(game.rival.minute + 180);
    expect(rivalNotice(s)).toMatch(/wants this one at 5:00 PM/);
    hearts(s, 4);
    expect(rivalNotice(s)).toMatch(/wants this one at 5:00 PM/);
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
    s.time.minutes = 1300;
    const cheapest = Math.min(...s.orders.list.map((o) => o.reward));
    expect(applyRival(s)?.reward).toBe(cheapest);
    const t = boardDay();
    hearts(t, 5);
    t.time.minutes = 1500;
    expect(rivalActive(t)).toBe(false);
    expect(applyRival(t)).toBeNull();
  });

  it('is a villager with heart events, and the notice fits the board', () => {
    const def = npcs[game.rival.npc]!;
    expect(def.role).toBe('rival');
    expect(def.events?.map((e) => e.hearts)).toEqual([2, 4, 5]);
    const s = boardDay();
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
    s.time.minutes = 2000;
    applyRival(s);
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
  });

  it('beating the field at a festival brings a letter from the rival', () => {
    const s = newState();
    const id = 'flower_show';
    const f = festivals[id]!;
    s.time.season = f.season;
    s.time.day = f.day;
    addItem(s, { item: 'daffodil', q: 2 }, 1);
    addItem(s, { item: 'tulip', q: 2 }, 1);
    const res = enterBasket(s, [
      { item: 'daffodil', q: 2 },
      { item: 'tulip', q: 2 },
    ]);
    expect(res).toMatchObject({ ok: true, place: 1 });
    expect(s.mail.list.some((l) => l.from === game.rival.npc)).toBe(true);
    expect(id).toBeTruthy();
  });

  it('the rival flag survives a save; v11 saves load unchanged', () => {
    const s = boardDay();
    s.time.minutes = 2000;
    applyRival(s);
    expect(migrate(JSON.parse(JSON.stringify(s))).orders).toEqual(s.orders);
    const v11 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v11['version'] = 11;
    expect(migrate(v11).version).toBeGreaterThan(11);
  });
});

describe('the rival in year two (handover goal 3)', () => {
  it('takes two requests a day from year two, never the last open one', () => {
    const s = boardDay();
    s.time.year = 2;
    s.orders.day = absoluteDay(s);
    expect(rivalTakes(s)).toBe(2);
    expect(rivalNotice(s)).toMatch(/wants two of these at 2:00 PM/);
    s.time.minutes = rivalMinute(s);
    const sorted = [...s.orders.list].sort((a, b) => b.reward - a.reward);
    applyRival(s);
    const gone = s.orders.list.filter((o) => o.rival).map((o) => o.id);
    expect(gone).toEqual(sorted.slice(0, 2).map((o) => o.id));
    expect(rivalNotice(s)).toBe('Clay took two today.');
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
    // With one request left open he leaves it to you.
    const t = boardDay();
    t.time.year = 3;
    t.orders.day = absoluteDay(t);
    t.orders.list[0]!.done = true;
    t.time.minutes = 1300;
    applyRival(t);
    expect(t.orders.list.filter((o) => !o.done)).toHaveLength(1);
  });

  it('a friend takes only one, however many years go by', () => {
    const s = boardDay();
    s.time.year = 4;
    hearts(s, 2);
    expect(rivalTakes(s)).toBe(1);
    expect(rivalTakes({ ...s, friends: {} })).toBe(2); // capped at two
  });
});
