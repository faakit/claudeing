import { game, npcs } from '../data';
import type { GameState, Order } from '../state/GameState';
import { perk } from './skills';
import { heartsOf } from './friendship';
import { absoluteDay, formatClock } from './time';
import { gameEvents } from './events';

/**
 * The rival farmer competes for the town board: once a day, at a set time, they fill one open request
 * (the best-paying one) unless the player got there first. Friendship softens it: they come later, then
 * leave the best request to you, then stop competing (perks `rivalLate`, `rivalPolite`, `rivalOff`).
 *
 * Resolved lazily (whenever the board is looked at or an order is delivered), so it needs no clock hook
 * and is exact in tests. The day it acted is kept as the `rival.day` stat.
 */
export const rivalName = (): string => npcs[game.rival.npc]?.name ?? 'Your rival';

export const rivalActive = (state: GameState): boolean =>
  absoluteDay(state) >= game.rival.startDay && perk(state, 'rivalOff') < 1;

/** Minute of the day the rival comes by the board. */
export const rivalMinute = (state: GameState): number =>
  game.rival.minute + Math.max(0, perk(state, 'rivalLate'));

/**
 * How many requests the rival takes a day: one in year one, then `perYear` more each year (up to
 * `maxTakes`), back to one once he likes you (`calmHearts`). Never the whole board.
 */
export function rivalTakes(state: GameState): number {
  const r = game.rival;
  if (heartsOf(state, r.npc) >= (r.calmHearts ?? Infinity)) return 1;
  const n = 1 + Math.floor((state.time.year - 1) * (r.perYear ?? 0));
  return Math.max(1, Math.min(n, r.maxTakes ?? 1));
}

const NUMBER_WORDS = ['none', 'one', 'two', 'three'];

/**
 * The requests the rival wants on board day `day`: the best-paying open ones that were posted before that
 * day (a request is always safe on the day it goes up), at most `rivalTakes`, and never the last open one.
 * Polite (4 hearts): the smallest instead.
 */
export function rivalPicks(state: GameState, day = state.orders.day): Order[] {
  const open = state.orders.list.filter((o) => !o.done);
  const polite = perk(state, 'rivalPolite') >= 1;
  return open
    .filter((o) => (o.from ?? -Infinity) < day)
    .sort((a, b) => (polite ? a.reward - b.reward : b.reward - a.reward))
    .slice(0, Math.min(rivalTakes(state), Math.max(0, open.length - 1)));
}

/** The board's line about the rival: whom he is after today, or what he already took. */
export function rivalNotice(state: GameState): string {
  if (!rivalActive(state)) return 'Requests stay two or three days.';
  const took = state.orders.list.filter((o) => o.rival && o.takenOn === absoluteDay(state)).length;
  if (took) return `${rivalName()} took ${NUMBER_WORDS[took] ?? took} today.`;
  const picks = state.stats['rival.day'] === absoluteDay(state) ? [] : rivalPicks(state);
  if (picks.length === 0) return `${rivalName()} wants nothing here today.`;
  const at = formatClock(rivalMinute(state));
  return picks.length > 1
    ? `${rivalName()} wants two of these at ${at}.`
    : `${rivalName()} wants this one at ${at}.`;
}

/** Take the picks: they are done, marked as his, and counted. */
function take(state: GameState, picks: Order[], day: number): void {
  for (const order of picks) {
    order.done = true;
    order.rival = true;
    order.takenOn = day;
  }
  state.stats['rival.day'] = day;
  state.stats['rivalTook'] = (state.stats['rivalTook'] ?? 0) + picks.length;
  if (picks.length) gameEvents.emit('goalChanged', undefined);
}

/** If it is time, the rival fills his requests for the day. Returns the first order taken, if any. */
export function applyRival(state: GameState): Order | null {
  const today = absoluteDay(state);
  if (!rivalActive(state) || state.orders.day !== today) return null;
  if (state.time.minutes < rivalMinute(state) || state.stats['rival.day'] === today) return null;
  const picks = rivalPicks(state, today);
  take(state, picks, today);
  return picks[0] ?? null;
}

/**
 * Overnight, before the board is refreshed: if nobody looked at the board after the rival's hour, he still
 * came (critique 6, F2). Settles the board's own day; returns what he took, for the morning summary.
 */
export function settleRival(state: GameState): Order[] {
  const day = state.orders.day;
  const r = game.rival;
  if (day < r.startDay || perk(state, 'rivalOff') >= 1 || state.stats['rival.day'] === day)
    return [];
  const picks = rivalPicks(state, day);
  take(state, picks, day);
  return picks;
}
