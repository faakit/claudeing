import { crops, fish as fishTable, items, orders as ordersCfg, recipes } from '../data';
import type { GameState, Order } from '../state/GameState';
import { forageTable } from './forage';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { addItem, countItem, removeStack } from './inventory';
import { displayName, keyOf, parseKey, refOf, sellValue, type ItemRef } from './itemRef';
import { preserveOf } from './preserves';
import { random } from './rng';
import { addXp, isRecipeUnlocked } from './skills';
import { absoluteDay } from './time';

/** Goods a town order may ask for today: what the season gives, what the player can make. */
export function orderCandidates(state: GameState): ItemRef[] {
  const season = state.time.season;
  const out = new Map<string, ItemRef>();
  const add = (r: ItemRef) => out.set(keyOf(r), r);
  for (const c of Object.values(crops))
    if (c.seasons.includes(season)) add({ item: c.harvestItem });
  for (const map of ['farm', 'town', 'woods'])
    for (const f of forageTable(map, season)) add({ item: f.item });
  for (const f of fishTable) if (f.seasons.includes(season)) add({ item: f.item });
  const jar = recipes['preserve_jar'];
  if (jar && isRecipeUnlocked(state, jar)) {
    for (const r of [...out.values()]) {
      const p = preserveOf(r);
      if (p) add(p);
    }
  }
  return [...out.values()];
}

const between = (state: GameState, [lo, hi]: [number, number]): number =>
  lo + Math.floor(random(state) * (hi - lo + 1));

/** Make today's board: `perDay` distinct requests, priced above shipping value. */
export function generateOrders(state: GameState): Order[] {
  const pool = orderCandidates(state);
  const list: Order[] = [];
  let id = (state.orders.list.reduce((n, o) => Math.max(n, o.id), 0) || 0) + 1;
  for (let i = 0; i < ordersCfg.perDay && pool.length > 0; i++) {
    const ref = pool.splice(Math.floor(random(state) * pool.length), 1)[0] as ItemRef;
    const value = sellValue(ref);
    const tier = ordersCfg.tiers.find((t) => value <= t.maxValue) ?? ordersCfg.tiers[0];
    if (!tier) break;
    const qty = between(state, tier.qty);
    const [lo, hi] = ordersCfg.rewardMultiplier;
    const mult = lo + random(state) * (hi - lo);
    const reward = Math.max(5, Math.round((value * qty * mult) / 5) * 5);
    list.push({
      id: id++,
      item: keyOf(ref),
      qty,
      reward,
      xp: Math.max(4, Math.round(value * qty * ordersCfg.xpPerValue)),
      done: false,
    });
  }
  return list;
}

/** Make sure the board shows today's orders (it is rewritten on the first look of a new day). */
export function ensureOrders(state: GameState): void {
  const today = absoluteDay(state);
  if (state.orders.day === today) return;
  state.orders = { day: today, list: generateOrders(state) };
  gameEvents.emit('goalChanged', undefined);
}

/** How many matching goods the player holds (any quality, never lower than the order's). */
export function haveFor(state: GameState, order: Order): number {
  const want = parseKey(order.item);
  return state.inventory.slots.reduce(
    (n, s) =>
      s && s.item === want.item && (s.of ?? '') === (want.of ?? '') && (s.q ?? 0) >= (want.q ?? 0)
        ? n + s.qty
        : n,
    0,
  );
}

export const orderLabel = (order: Order): string =>
  `${order.qty} ${displayName(parseKey(order.item))}`;

export type DeliverResult = 'ok' | 'missing' | 'done' | 'unknown';

/** Hand over the goods (lowest quality first) and collect the reward. Better quality earns a bonus. */
export function deliverOrder(state: GameState, id: number): DeliverResult {
  const order = state.orders.list.find((o) => o.id === id);
  if (!order) return 'unknown';
  if (order.done) return 'done';
  if (haveFor(state, order) < order.qty) return 'missing';
  const want = parseKey(order.item);
  const kinds = new Map<string, ItemRef>();
  for (const s of state.inventory.slots)
    if (
      s &&
      s.item === want.item &&
      (s.of ?? '') === (want.of ?? '') &&
      (s.q ?? 0) >= (want.q ?? 0)
    )
      kinds.set(keyOf(s), refOf(s));
  let left = order.qty;
  let bonus = 0;
  for (const ref of [...kinds.values()].sort((a, b) => (a.q ?? 0) - (b.q ?? 0))) {
    const take = Math.min(
      left,
      state.inventory.slots.reduce(
        (n, s) => (s && keyOf(refOf(s)) === keyOf(ref) ? n + s.qty : n),
        0,
      ),
    );
    if (take <= 0) continue;
    removeStack(state, ref, take);
    bonus += take * (ref.q ?? 0) * 0.15;
    left -= take;
    if (left <= 0) break;
  }
  const gold = Math.round((order.reward * (1 + bonus / order.qty)) / 5) * 5;
  order.done = true;
  state.money += gold;
  gameEvents.emit('moneyChanged', { delta: gold });
  state.stats['earned'] = (state.stats['earned'] ?? 0) + gold;
  const skill =
    items[want.item]?.type === 'fish'
      ? 'fishing'
      : items[want.item]?.type === 'forage'
        ? 'foraging'
        : 'farming';
  addXp(state, skill, order.xp);
  addStat(state, 'ordersDone');
  toast(`Order done! +${gold}g`, 'good');
  return 'ok';
}

export const openOrders = (state: GameState): number =>
  state.orders.list.filter((o) => !o.done).length;

// Re-exported for tests that want to give the player goods directly.
export { addItem, countItem };
