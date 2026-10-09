import { game, items, npcs } from '../data';
import type { GameState, Order } from '../state/GameState';
import { perk } from './skills';
import { befriend, heartsOf } from './friendship';
import { sendLetter } from './mail';
import { absoluteDay, formatClock } from './time';
import { gameEvents } from './events';
import { parseKey } from './itemRef';

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

/** Goods of the farm (weighted up on the board, and the only rows the rival scores on). */
export const FARM_TYPES = ['crop', 'preserve', 'product'];

/**
 * Is this request for a good of the farm, so a point for the rival when he takes it? Crops and animal goods,
 * and preserves made from them; not fish, wild goods, or jam and pickles made from wild goods.
 */
export function isFarmGood(order: Pick<Order, 'item'>): boolean {
  const ref = parseKey(order.item);
  const type = items[ref.item]?.type ?? '';
  if (type === 'preserve') return ['crop', 'product'].includes(items[ref.of ?? '']?.type ?? '');
  return FARM_TYPES.includes(type);
}

/**
 * The requests the rival wants on board day `day`: the best-paying open ones on their last day (and posted before it)
 * day (a request is always safe on the day it goes up), at most `rivalTakes`, and never the last open one.
 * Polite (4 hearts): the smallest instead.
 */
export function rivalPicks(state: GameState, day = state.orders.day): Order[] {
  const open = state.orders.list.filter((o) => !o.done);
  const polite = perk(state, 'rivalPolite') >= 1;
  // Only requests on their last day (critique 7, F2): "3 days" on a row is then the truth.
  return open
    .filter((o) => (o.from ?? -Infinity) < day && (o.until ?? state.orders.day) <= day)
    .sort((a, b) => (polite ? a.reward - b.reward : b.reward - a.reward))
    .slice(0, Math.min(rivalTakes(state), Math.max(0, open.length - 1)));
}

/**
 * The board's line about the rival: what he took today, whom he is after, last season's result for the
 * first days of a season, or else the rule that he scores on farm goods only (critique 9, F1).
 */
export function rivalNotice(state: GameState): string {
  if (!rivalActive(state)) return 'Requests stay a few days.';
  const took = state.orders.list.filter((o) => o.rival && o.takenOn === absoluteDay(state)).length;
  if (took) return `${rivalName()} took ${NUMBER_WORDS[took] ?? took} today.`;
  const picks = state.stats['rival.day'] === absoluteDay(state) ? [] : rivalPicks(state);
  if (picks.length === 0)
    return lastSeasonLine(state) ?? `${rivalName()} scores on farm goods only.`;
  const at = formatClock(rivalMinute(state));
  return picks.length > 1
    ? `${rivalName()} wants two of these at ${at}.`
    : `${rivalName()} wants this one at ${at}.`;
}

/** The board's score line, shown every day once the rival is about (critique 9, F1); null before. */
export function boardScoreLine(state: GameState): string | null {
  if (!rivalActive(state)) return null;
  const t = boardTally(state, absoluteDay(state));
  return `This season: you ${t.you}, ${rivalName()} ${t.rival}.`;
}

/** Days into a season that the board still names last season's result. */
export const LAST_SEASON_DAYS = 3;

/** "Last season: you won 25 to 7." for the first days of a season, from the stats `settleSeason` keeps. */
export function lastSeasonLine(state: GameState): string | null {
  const day = state.stats['board.last.day'];
  if (day === undefined || absoluteDay(state) - day >= LAST_SEASON_DAYS) return null;
  const you = state.stats['board.last.you'] ?? 0;
  const rival = state.stats['board.last.rival'] ?? 0;
  if (you > rival) return `Last season: you won ${you} to ${rival}.`;
  if (rival > you) return `Last season: ${rivalName()} won ${rival} to ${you}.`;
  return `Last season: a draw, ${you} to ${rival}.`;
}

/**
 * Take the picks: they are done, marked as his, and counted. Only a farm good is a point for him
 * (critique 9, F1): a farmer who never fishes is not scored against for the fish and wild rows.
 */
function take(state: GameState, picks: Order[], day: number): void {
  let points = 0;
  for (const order of picks) {
    order.done = true;
    order.rival = true;
    order.takenOn = day;
    if (isFarmGood(order)) points += 1;
    else order.noPoint = true;
  }
  state.stats['rival.day'] = day;
  state.stats['rivalTook'] = (state.stats['rivalTook'] ?? 0) + picks.length;
  if (points) state.stats[`${tallyKey(day)}.rival`] = boardTally(state, day).rival + points;
  if (picks.length) gameEvents.emit('goalChanged', undefined);
}

/**
 * The board keeps score each season (critique 8, F2): a request you fill is a point for you, a farm good
 * left to its last day and taken by the rival is a point for him. At the season's end the leader is
 * rewarded (`settleSeason`), so leaving requests to expire costs something even when he only takes those.
 */
const tallyKey = (day: number): string => `board.s${Math.floor((day - 1) / game.seasonLength)}`;

export function boardTally(state: GameState, day: number): { you: number; rival: number } {
  const k = tallyKey(day);
  return { you: state.stats[`${k}.you`] ?? 0, rival: state.stats[`${k}.rival`] ?? 0 };
}

/** A request you filled: a point on the board. */
export function scoreFill(state: GameState, day: number): void {
  state.stats[`${tallyKey(day)}.you`] = boardTally(state, day).you + 1;
}

/** Board prize for out-filling the rival over a season, before the yearly rise. */
export const BOARD_PRIZE = 300;

/** What the winner gets, said in the rival's letters before anyone has won (critique 9, F1). */
export const BOARD_STAKES = `the town pays ${BOARD_PRIZE}g and puts a trophy in your house`;

/**
 * On the first morning of a season, settle the season just ended. Beat the rival on the board and the town
 * pays a prize, the trophy at home counts one more season (Mara writes) and he respects you a little; lose
 * and he gloats; a draw is said too. The result is kept for the board (`board.last.*` stats).
 * Returns the morning news, if any.
 */
export function settleSeason(state: GameState): string | null {
  const day = absoluteDay(state) - 1; // the last day of the season that just ended
  if (day < game.rival.startDay || perk(state, 'rivalOff') >= 1) return null;
  const t = boardTally(state, day);
  if (t.you === 0 && t.rival === 0) return null;
  state.stats['board.last.day'] = absoluteDay(state);
  state.stats['board.last.you'] = t.you;
  state.stats['board.last.rival'] = t.rival;
  const name = rivalName();
  if (t.you > t.rival) {
    const gold = BOARD_PRIZE * state.time.year;
    state.money += gold;
    state.stats['earned'] = (state.stats['earned'] ?? 0) + gold;
    gameEvents.emit('moneyChanged', { delta: gold });
    befriend(state, game.rival.npc, 20);
    const wins = (state.stats['boardWins'] ?? 0) + 1;
    state.stats['boardWins'] = wins;
    sendLetter(state, {
      from: 'mara',
      title: 'Best on the board',
      text:
        wins === 1
          ? `You filled more requests than ${name} last season, ${t.you} to ${t.rival}! The town put a trophy in your house, and ${gold}g is yours.`
          : `Best on the board again, ${t.you} to ${t.rival}! Your trophy at home now counts ${wins} seasons, and ${gold}g is yours.`,
    });
    gameEvents.emit('placedChanged', { map: 'house' }); // the trophy appears (or counts one more)
    return `You beat ${name} on the board last season (${t.you} to ${t.rival}): +${gold}g.`;
  }
  if (t.rival > t.you) {
    sendLetter(state, {
      from: game.rival.npc,
      title: 'The board is mine',
      text: `Last season the board was ${t.rival} to ${t.you}, my way. A farm good left to its last day is mine. Beat me this season and ${BOARD_STAKES}.`,
    });
    return `${name} won the board last season (${t.rival} to ${t.you}).`;
  }
  return `A draw with ${name} on the board last season (${t.you} to ${t.rival}).`;
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
