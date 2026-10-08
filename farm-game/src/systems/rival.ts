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

/** "Clay takes the best one at 2:00 PM." or what already happened today. */
export function rivalNotice(state: GameState): string {
  if (!rivalActive(state)) return 'Requests stay two or three days.';
  const took = state.orders.list.filter((o) => o.rival).length;
  const n = rivalTakes(state);
  if (took) return `${rivalName()} took ${NUMBER_WORDS[took] ?? took} today.`;
  return `${rivalName()} takes the best ${NUMBER_WORDS[n] ?? n} at ${formatClock(rivalMinute(state))}.`;
}

/** If it is time, the rival fills his requests for the day. Returns the first order taken, if any. */
export function applyRival(state: GameState): Order | null {
  const today = absoluteDay(state);
  if (!rivalActive(state) || state.orders.day !== today) return null;
  if (state.time.minutes < rivalMinute(state) || state.stats['rival.day'] === today) return null;
  state.stats['rival.day'] = today;
  const open = state.orders.list.filter((o) => !o.done);
  if (open.length === 0) return null;
  const polite = perk(state, 'rivalPolite') >= 1;
  open.sort((a, b) => (polite ? a.reward - b.reward : b.reward - a.reward));
  // Never the whole board: at least one open request is left for you.
  const taken = open.slice(0, Math.min(rivalTakes(state), Math.max(1, open.length - 1)));
  for (const order of taken) {
    order.done = true;
    order.rival = true;
  }
  state.stats['rivalTook'] = (state.stats['rivalTook'] ?? 0) + taken.length;
  gameEvents.emit('goalChanged', undefined);
  return taken[0] ?? null;
}
