import { game, items, npcs, specials } from '../data';
import type { SpecialDef } from '../data';
import type { GameState, SpecialOrder } from '../state/GameState';
import { gameEvents, toast } from './events';
import { befriend } from './friendship';
import { addStat, stat } from './goals';
import { countItem, removeItem } from './inventory';
import { isProjectDone } from './projects';
import { random } from './rng';
import { absoluteDay } from './time';
import { animalOutput } from './animals';

/**
 * Special orders: one big seasonal request at a time on the town board ("10 Pumpkins for Rosa by Fall 28").
 * Goods are handed over a little at a time; the reward (well above the bin) and a lot of friendship come
 * when the last one is in. If time runs out, what was given is paid at bin price, so nothing is lost.
 */

/** Gold value of one special order's goods in year one; it grows half again each year. */
export const SPECIAL_VALUE = 1500;
/** Reward over the goods' value. */
export const SPECIAL_MULT = 1.5;
/** Friendship the giver adds when it is done (a loved gift is 80). */
export const SPECIAL_FRIENDSHIP = 60;
/** A new special is posted only if at least this many days are left in the season. */
export const SPECIAL_MIN_DAYS = 10;

export const specialCandidates = (state: GameState): SpecialDef[] =>
  specials.filter(
    (sp) =>
      sp.seasons.includes(state.time.season) &&
      // Not the one just finished again (critique 7, F4).
      absoluteDay(state) - (state.stats[`special.last.${sp.id}`] ?? -Infinity) >
        game.seasonLength &&
      (!sp.project || isProjectDone(state, sp.project)) &&
      (!sp.requires || stat(state, sp.requires.stat) >= sp.requires.min) &&
      // An animal good waits until the farm makes it (a cow alone never brings an egg special).
      (items[sp.item]?.type !== 'product' || specialCap(state, sp.item) >= SPECIAL_MIN_QTY),
  );

/** Share of the farm's output an animal special may ask for (critique 7, F8). */
export const SPECIAL_SHARE = 0.7;

/** Fewest goods a special asks for. */
export const SPECIAL_MIN_QTY = 5;

/**
 * Most of an animal good a special may ask for: what the farm makes by the deadline, with two days spare
 * (critique 6, F4: one hen was asked for 30 eggs). Unlimited for crops and bars.
 */
export function specialCap(state: GameState, item: string): number {
  if (items[item]?.type !== 'product') return Infinity;
  const perDay = animalOutput(state).get(item) ?? 0;
  // About 70% of what the farm makes by the deadline, so a small herd still has eggs for requests and gifts.
  return Math.floor(perDay * (game.seasonLength - state.time.day - 1) * SPECIAL_SHARE);
}

/** Build a special for today: quantity from the yearly value target, due the season's last day. */
export function makeSpecial(state: GameState, def: SpecialDef): SpecialOrder {
  const price = items[def.item]?.sellPrice ?? 1;
  const value = SPECIAL_VALUE * (1 + 0.5 * (state.time.year - 1));
  const qty = Math.min(
    Math.max(SPECIAL_MIN_QTY, Math.round(value / price)),
    specialCap(state, def.item),
  );
  return {
    id: def.id,
    giver: def.giver,
    item: def.item,
    qty,
    given: 0,
    reward: Math.round((qty * price * SPECIAL_MULT) / 50) * 50,
    due: absoluteDay(state) + (game.seasonLength - state.time.day),
  };
}

/**
 * Morning: settle an expired special (pay what was given at bin price) and post a new one when the board
 * is free and enough of the season is left. Returns a line for the morning news, if any.
 */
export function morningSpecial(state: GameState): string | null {
  const today = absoluteDay(state);
  let news: string | null = null;
  const sp = state.special;
  if (sp && today > sp.due) {
    const refund = sp.given * (items[sp.item]?.sellPrice ?? 0);
    if (refund > 0) {
      state.money += refund;
      state.stats['earned'] = stat(state, 'earned') + refund;
      gameEvents.emit('moneyChanged', { delta: refund });
    }
    news =
      `The special order ran out. ${refund > 0 ? `Paid ${refund}g for what you brought.` : ''}`.trim();
    state.special = null;
  }
  if (!state.special && game.seasonLength - state.time.day + 1 >= SPECIAL_MIN_DAYS) {
    const pool = specialCandidates(state);
    if (pool.length > 0) {
      const def = pool[Math.floor(random(state) * pool.length)] as SpecialDef;
      state.special = makeSpecial(state, def);
      const posted = `Special order: ${specialLabel(state.special)}, by the season's end.`;
      // Both lines when the old one ran out this morning (critique 11, F6).
      news = news ? `${news} ${posted}` : posted;
    }
  }
  return news;
}

export const specialLabel = (sp: SpecialOrder): string =>
  `${sp.qty} ${items[sp.item]?.name ?? sp.item} for ${npcs[sp.giver]?.name ?? sp.giver}`;

/** The board row's title: "Special: 15 Cauliflower" (the giver moves to the second line: critique 10, F6). */
export const specialTitle = (sp: SpecialOrder): string =>
  `Special: ${sp.qty} ${items[sp.item]?.name ?? sp.item}`;

/** The board row's second line: "Rosa 4/15  2,250g". Specials are always due at the season's end. */
export const specialSub = (sp: SpecialOrder): string =>
  `${npcs[sp.giver]?.name ?? sp.giver} ${sp.given}/${sp.qty}  ${sp.reward.toLocaleString('en-US')}g`;

export type SpecialResult =
  { ok: true; gave: number; finished: boolean } | { ok: false; reason: 'none' | 'nothing' };

/**
 * How many the special's Give hands over now: all it still needs that you carry, minus `keep` (goods held
 * back for a same-item request you can fill: critique 7, F4). Zero when they are all spoken for.
 */
export function specialGiveCount(state: GameState, keep = 0): number {
  const sp = state.special;
  if (!sp) return 0;
  // Goods a fillable same-item request needs are never handed over here (critique 8, F1).
  const spare = countItem(state, sp.item) - keep;
  return Math.max(0, Math.min(sp.qty - sp.given, spare));
}

/** Hand over what `specialGiveCount` says (any quality, lowest first). The last one finishes it. */
export function giveToSpecial(state: GameState, keep = 0): SpecialResult {
  const sp = state.special;
  if (!sp || absoluteDay(state) > sp.due) return { ok: false, reason: 'none' };
  const take = specialGiveCount(state, keep);
  if (take <= 0 || !removeItem(state, sp.item, take)) return { ok: false, reason: 'nothing' };
  sp.given += take;
  if (sp.given < sp.qty) return { ok: true, gave: take, finished: false };
  state.money += sp.reward;
  state.stats['earned'] = stat(state, 'earned') + sp.reward;
  gameEvents.emit('moneyChanged', { delta: sp.reward });
  befriend(state, sp.giver, SPECIAL_FRIENDSHIP);
  state.stats[`special.last.${sp.id}`] = absoluteDay(state);
  toast(`Special order done! +${sp.reward}g`, 'good');
  state.special = null;
  addStat(state, 'specialsDone');
  return { ok: true, gave: take, finished: true };
}
