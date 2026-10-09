import { cart, crops, game, items } from '../data';
import { stockFor } from './economy';
import type { GameState } from '../state/GameState';
import { gameEvents } from './events';
import { addStat } from './goals';
import { addItem, roomFor } from './inventory';
import { ownsGreenhouse } from './plots';
import { absoluteDay } from './time';

/**
 * The traveling cart: on a few days each season it stands by the town board with a handful of things the
 * store does not sell (rare seeds before the Seed Exchange, bars and quartz for projects, saplings), at a
 * premium. A weekly reason to visit town and a gold sink. Its stock is a pure function of the day, so it
 * needs no saved state; what you bought is counted in stats (`cart.<day>.<item>`).
 */
export const cartHere = (state: GameState): boolean => cart.days.includes(state.time.day);

/**
 * Is this stock entry worth offering now? Never what the store sells today (critique 8, F4); seeds only
 * when they can still ripen this season (or you have a greenhouse).
 */
function fits(state: GameState, item: string): boolean {
  if (stockFor(STORE, state.time.season, state).includes(item)) return false;
  const plants = items[item]?.plants;
  if (!plants) return true;
  if (ownsGreenhouse(state)) return true;
  const crop = crops[plants];
  const grow = crop?.stageDays.reduce((a, b) => a + b, 0) ?? Infinity;
  return !!crop?.seasons.includes(state.time.season) && grow < game.seasonLength - state.time.day;
}

const STORE = 'town_general_store';

/**
 * What a cart good is for in a word or two, shown on its row before you pay (critique 9, F7): the data's
 * `tag`, or a seed's season ("Summer crop").
 */
export function cartTag(item: string): string | undefined {
  const tag = cart.stock.find((e) => e.item === item)?.tag;
  if (tag) return tag;
  const season = crops[items[item]?.plants ?? '']?.seasons[0];
  return season ? `${season[0]!.toUpperCase()}${season.slice(1)} crop` : undefined;
}

/** What a cart good is for, if the data says. */
export const cartUse = (item: string): string | undefined =>
  cart.stock.find((e) => e.item === item)?.use;

/** Today's stock: `slots` entries picked by a hash of the day (the same all day, different each visit). */
export function cartStock(state: GameState): string[] {
  if (!cartHere(state)) return [];
  const day = absoluteDay(state);
  const pool = cart.stock.filter((e) => fits(state, e.item));
  const scored = pool.map((e, i) => ({ item: e.item, h: hash(day * 131 + i * 7919) }));
  return scored
    .sort((a, b) => a.h - b.h)
    .slice(0, cart.slots)
    .map((e) => e.item);
}

const hash = (n: number): number => {
  let x = (n ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
};

/** The cart's price: its own `price`, or the store price times `mult`. */
export function cartPrice(item: string): number {
  const e = cart.stock.find((x) => x.item === item);
  if (!e) return 0;
  return e.price ?? Math.round(((items[item]?.buyPrice ?? 0) * e.mult) / 5) * 5;
}

const boughtKey = (state: GameState, item: string): string => `cart.${absoluteDay(state)}.${item}`;

/** How many more of this the cart will sell you today. */
export const cartLeft = (state: GameState, item: string): number =>
  Math.max(0, cart.limit - (state.stats[boughtKey(state, item)] ?? 0));

export type CartResult = 'ok' | 'closed' | 'sold_out' | 'no_money' | 'full';

export function buyFromCart(state: GameState, item: string): CartResult {
  if (!cartStock(state).includes(item)) return 'closed';
  if (cartLeft(state, item) <= 0) return 'sold_out';
  const price = cartPrice(item);
  if (state.money < price) return 'no_money';
  if (roomFor(state, item, 1) < 1) return 'full';
  state.money -= price;
  gameEvents.emit('moneyChanged', { delta: -price });
  addItem(state, item, 1);
  state.stats[boughtKey(state, item)] = (state.stats[boughtKey(state, item)] ?? 0) + 1;
  addStat(state, 'cartBought');
  return 'ok';
}
