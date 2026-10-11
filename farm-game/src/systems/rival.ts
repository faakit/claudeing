import { game, items, npcs } from '../data';
import type { GameState, Order } from '../state/GameState';
import { perk } from './skills';
import { befriend, heartsOf } from './friendship';
import { sendLetter } from './mail';
import { absoluteDay, formatClock } from './time';
import { gameEvents } from './events';
import { parseKey } from './itemRef';
import { fmtGold, t } from '../i18n';

/**
 * The rival farmer competes for the town board: once a day, at a set time, they fill one open request
 * (the best-paying one) unless the player got there first. Friendship softens it: they come later, then
 * spare your farm goods, then stop competing (perks `rivalLate`, `rivalPolite`, `rivalOff`).
 *
 * Resolved lazily (whenever the board is looked at or an order is delivered), so it needs no clock hook
 * and is exact in tests. The day it acted is kept as the `rival.day` stat.
 */
export const rivalName = (): string => npcs[game.rival.npc]?.name ?? t('rival.fallbackName');

export const rivalActive = (state: GameState): boolean =>
  absoluteDay(state) >= game.rival.startDay && perk(state, 'rivalOff') < 1;

/**
 * The board keeps score from the rival's first day on, even once he is your friend and stops taking requests
 * (critique 10, F3: the race, the trophy and the last goal no longer end silently at 5 hearts).
 */
export const boardRaceOn = (state: GameState, day = absoluteDay(state)): boolean =>
  day >= game.rival.startDay;

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

/** "one", "two", "three" in the current language (a bigger number stays a figure). */
const numberWord = (n: number): string =>
  n >= 1 && n <= 3 ? t(`rival.number${n as 1 | 2 | 3}`) : String(n);

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
 * The requests the rival wants on board day `day`: open ones on their last day and posted before it (a request is
 * always safe on the day it goes up), at most `rivalTakes`, and never the last open one. He plays to win
 * (critique 10, F2): farm goods first, the ones that score, best-paying first; a fish or wild row only when
 * no farm row is due. Polite (4 hearts): the other way round, rows that are no point first, then the smallest.
 */
export function rivalPicks(state: GameState, day = state.orders.day): Order[] {
  const open = state.orders.list.filter((o) => !o.done);
  const polite = perk(state, 'rivalPolite') >= 1;
  // Only requests on their last day (critique 7, F2): "3 days" on a row is then the truth.
  return open
    .filter((o) => (o.from ?? -Infinity) < day && (o.until ?? state.orders.day) <= day)
    .sort((a, b) =>
      polite
        ? Number(isFarmGood(a)) - Number(isFarmGood(b)) || a.reward - b.reward
        : Number(isFarmGood(b)) - Number(isFarmGood(a)) || b.reward - a.reward,
    )
    .slice(0, Math.min(rivalTakes(state), Math.max(0, open.length - 1)));
}

/**
 * The board's line about the rival: what he took today, whom he is after (and whether it scores), or else the
 * rule that he scores on farm goods only (critique 9 F1, critique 10 F2).
 */
export function rivalNotice(state: GameState): string {
  if (!boardRaceOn(state)) return t('rival.requestsStay');
  const name = rivalName();
  const crate = crateTonight(state);
  if (!rivalActive(state))
    return crate ? t('rival.crateTonight', { name }) : t('rival.noLongerTakes', { name });
  const taken = state.orders.list.filter((o) => o.rival && o.takenOn === absoluteDay(state));
  if (taken.length) {
    // Whether it scored is said here too, not only on the row (critique 12, F6).
    const points = taken.filter(isFarmGood).length;
    const said =
      points === 0
        ? t('rival.noPoint')
        : points === 1
          ? t('rival.aPoint')
          : t('rival.points', { n: numberWord(points) });
    return t('rival.took', { name, n: numberWord(taken.length), said });
  }
  const picks = state.stats['rival.day'] === absoluteDay(state) ? [] : rivalPicks(state);
  const at = formatClock(rivalMinute(state));
  const scoring = picks.filter(isFarmGood).length;
  // His target is named only when it would score (critique 10, F2), counted right in year two (critique 11, F4).
  if (scoring > 1) return t('rival.wantsTwo', { name, at });
  if (scoring === 1) return t('rival.wantsOne', { name, at });
  // While you lead, the catch-up rule is said where the player looks (critique 12, F2); the score line above
  // says when a crate comes tonight.
  const tally = boardTally(state, absoluteDay(state));
  const every = crateEvery(tally.you - tally.rival);
  if (every === 1) return t('rival.aheadDaily', { lead: CATCH_UP[0]!.lead });
  if (every < CRATE_EVERY) return t('rival.aheadEvery', { lead: CATCH_UP[1]!.lead, every });
  // A crate tonight is said before it scores (critique 11, F2).
  if (crate) return t('rival.crateTonight', { name });
  if (picks.length > 1) return t('rival.takesTwo', { name, at });
  if (picks.length === 1) return t('rival.takesOne', { name, at });
  return t('rival.farmGoodsOnly', { name });
}

/** The board rows the rival is after today that would score for him (marked "Clay's!" on the board). */
export function rivalTargets(state: GameState): Order[] {
  if (!rivalActive(state) || state.stats['rival.day'] === state.orders.day) return [];
  return rivalPicks(state).filter(isFarmGood);
}

/**
 * The board's score line, shown every day once the race is on (critique 9, F1); null before. For the first days
 * of a season, while this season is still 0 to 0, it names last season's result instead (critique 10, F4).
 */
export function boardScoreLine(state: GameState): string | null {
  if (!boardRaceOn(state)) return null;
  const tally = boardTally(state, absoluteDay(state));
  const last = tally.you === 0 && tally.rival === 0 ? lastSeasonLine(state) : null;
  const score = { you: tally.you, name: rivalName(), rival: tally.rival };
  // A crate tonight is always said, even when the line below names a target or a take (critique 12, F2).
  if (!last && crateTonight(state)) return t('rival.scoreCrate', score);
  return last ?? t('rival.score', score);
}

/** Days into a season that the board still names last season's result. */
export const LAST_SEASON_DAYS = 3;

/** "Last season: you won 25 to 7." for the first days of a season, from the stats `settleSeason` keeps. */
export function lastSeasonLine(state: GameState): string | null {
  const day = state.stats['board.last.day'];
  if (day === undefined || absoluteDay(state) - day >= LAST_SEASON_DAYS) return null;
  const you = state.stats['board.last.you'] ?? 0;
  const rival = state.stats['board.last.rival'] ?? 0;
  if (you > rival) return t('rival.lastYouWon', { you, rival });
  if (rival > you) return t('rival.lastHeWon', { name: rivalName(), you, rival });
  return t('rival.lastDraw', { you, rival });
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

/** What the winner gets this year, said in the rival's letters before anyone has won (critique 9, F1). */
export const boardStakes = (state: GameState): string =>
  t('rival.stakes', { gold: fmtGold(BOARD_PRIZE * state.time.year) });

/**
 * On the first morning of a season, settle the season just ended. Beat the rival on the board and the town
 * pays a prize, the trophy at home counts one more season (Mara writes) and he respects you a little; lose
 * and he gloats; a draw is said too. The result is kept for the board (`board.last.*` stats).
 * Returns the morning news, if any.
 */
export function settleSeason(state: GameState): string | null {
  const day = absoluteDay(state) - 1; // the last day of the season that just ended
  if (!boardRaceOn(state, day)) return null;
  const tally = boardTally(state, day);
  if (tally.you === 0 && tally.rival === 0) return t('rival.quietSeason');
  state.stats['board.last.day'] = absoluteDay(state);
  state.stats['board.last.you'] = tally.you;
  state.stats['board.last.rival'] = tally.rival;
  const name = rivalName();
  const score = { name, you: tally.you, rival: tally.rival };
  if (tally.you > tally.rival) {
    // The year of the season settled, not the new one: winter of year one pays year one's prize (critique 11, F9).
    const gold = BOARD_PRIZE * yearOf(day);
    state.money += gold;
    state.stats['earned'] = (state.stats['earned'] ?? 0) + gold;
    gameEvents.emit('moneyChanged', { delta: gold });
    befriend(state, game.rival.npc, 20);
    const wins = (state.stats['boardWins'] ?? 0) + 1;
    state.stats['boardWins'] = wins;
    sendLetter(state, {
      from: 'mara',
      title: t('rival.bestTitle'),
      text:
        wins === 1
          ? t('rival.bestFirst', { ...score, gold: fmtGold(gold) })
          : t('rival.bestAgain', { ...score, wins, gold: fmtGold(gold) }),
    });
    gameEvents.emit('placedChanged', { map: 'house' }); // the trophy appears (or counts one more)
    return t('rival.youBeat', { ...score, gold: fmtGold(gold) });
  }
  if (tally.rival > tally.you) {
    // A friend who no longer takes requests does not gloat (critique 11, F3).
    if (rivalActive(state))
      sendLetter(state, {
        from: game.rival.npc,
        title: t('rival.mineTitle'),
        text: t('rival.mineText', { ...score, stakes: boardStakes(state) }),
      });
    return t('rival.heWon', score);
  }
  return t('rival.draw', score);
}

/** Clay's own crates: this many days after his last one (or the season's start) he scores a point from his field. */
export const CRATE_EVERY = 7;
/**
 * Catch-up (critique 12, F1): while you lead by `lead` or more, his next crate comes `every` days after the last.
 * A steady keeper (about 0.6 fills a day) then stays a few points ahead instead of running away.
 */
export const CATCH_UP: readonly { lead: number; every: number }[] = [
  { lead: 5, every: 1 },
  { lead: 3, every: 2 },
];

/** Days from one crate to the next at a lead of `lead`. */
export const crateEvery = (lead: number): number =>
  CATCH_UP.find((c) => lead >= c.lead)?.every ?? CRATE_EVERY;

/** A crate is due tonight and not shipped yet (the board says so). */
export const crateTonight = (state: GameState): boolean =>
  crateDue(state, absoluteDay(state)) && state.stats['rival.crate'] !== absoluteDay(state);

/** The year an absolute day belongs to. */
const yearOf = (day: number): number => Math.floor((day - 1) / (game.seasonLength * 4)) + 1;

/**
 * Is a crate due on absolute day `day` (shipped that night)? Seven days after his last crate of the season (or
 * its start), sooner while you lead (`CATCH_UP`), counted from the last one so a bigger lead never means fewer
 * crates (critique 12, F2). Never on a season's last day, so the last move of a season is yours (critique 11, F2).
 * He keeps shipping crates once he is your friend, so a friendly season still has an opponent (critique 11, F3).
 */
export function crateDue(state: GameState, day: number): boolean {
  const seasonDay = ((day - 1) % game.seasonLength) + 1;
  if (!boardRaceOn(state, day) || seasonDay >= game.seasonLength) return false;
  const last = Math.max(
    day - seasonDay,
    game.rival.startDay - 1,
    Math.min(day, state.stats['rival.crate'] ?? 0),
  );
  const t = boardTally(state, day);
  return day - last >= crateEvery(t.you - t.rival);
}

/**
 * Overnight: the rival ships a crate from his own field when one is due (`crateDue`), a point on the board
 * (critique 10, F2: keeping goods for the board is needed, not enough on its own). Settles the day that just
 * ended; returns true when he scored.
 */
export function rivalCrate(state: GameState): boolean {
  const day = absoluteDay(state) - 1;
  if (!crateDue(state, day) || state.stats['rival.crate'] === day) return false;
  state.stats['rival.crate'] = day;
  state.stats[`${tallyKey(day)}.rival`] = boardTally(state, day).rival + 1;
  return true;
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
