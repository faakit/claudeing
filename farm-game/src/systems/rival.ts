import { game, npcs } from '../data';
import type { GameState, Order } from '../state/GameState';
import { perk } from './skills';
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

/** "Clay takes one at 2:00 PM." or what already happened today. */
export function rivalNotice(state: GameState): string {
  if (!rivalActive(state)) return 'New requests every morning.';
  const took = state.orders.list.find((o) => o.rival);
  if (took) return `${rivalName()} took one today.`;
  return `${rivalName()} takes one at ${formatClock(rivalMinute(state))}.`;
}

/** If it is time, the rival fills one open request. Returns the order taken, if any. */
export function applyRival(state: GameState): Order | null {
  const today = absoluteDay(state);
  if (!rivalActive(state) || state.orders.day !== today) return null;
  if (state.time.minutes < rivalMinute(state) || state.stats['rival.day'] === today) return null;
  state.stats['rival.day'] = today;
  const open = state.orders.list.filter((o) => !o.done);
  if (open.length === 0) return null;
  const polite = perk(state, 'rivalPolite') >= 1;
  open.sort((a, b) => (polite ? a.reward - b.reward : b.reward - a.reward));
  const order = open[0] as Order;
  order.done = true;
  order.rival = true;
  state.stats['rivalTook'] = (state.stats['rivalTook'] ?? 0) + 1;
  gameEvents.emit('goalChanged', undefined);
  return order;
}
