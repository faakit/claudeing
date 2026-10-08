import { crops, fish as fishTable, items, machines, orders as ordersCfg, recipes } from '../data';
import type { GameState, Order } from '../state/GameState';
import { forageTable } from './forage';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { addItem, countItem, removeStack } from './inventory';
import { displayName, keyOf, parseKey, refOf, sellValue, type ItemRef } from './itemRef';
import { preserveOf } from './preserves';
import { random } from './rng';
import { addXp, isRecipeUnlocked, perk } from './skills';
import { absoluteDay } from './time';
import { applyRival } from './rival';
import { isProjectDone } from './projects';
import { shops } from '../data';

/** Is this crop's seed on a shelf the player can buy from (not waiting on a town project)? */
function seedOnSale(state: GameState, cropId: string): boolean {
  const seed = Object.entries(items).find(([, d]) => d.plants === cropId)?.[0];
  const entry = Object.values(shops)
    .flatMap((s) => s.stock)
    .find((e) => e.item === seed);
  return !entry?.project || isProjectDone(state, entry.project);
}

/** Goods a town order may ask for today: what the season gives, what the player can make. */
export function orderCandidates(state: GameState): ItemRef[] {
  const season = state.time.season;
  const out = new Map<string, ItemRef>();
  const add = (r: ItemRef) => out.set(keyOf(r), r);
  for (const [id, c] of Object.entries(crops))
    if (c.seasons.includes(season) && seedOnSale(state, id)) add({ item: c.harvestItem });
  for (const map of ['farm', 'town', 'woods'])
    for (const f of forageTable(map, season)) add({ item: f.item });
  for (const f of fishTable) if (f.seasons.includes(season)) add({ item: f.item });
  // Goods from any machine the player has unlocked (jam, pickles, wine...).
  for (const machine of Object.keys(machines)) {
    const recipe = recipes[machine];
    if (!recipe || !isRecipeUnlocked(state, recipe)) continue;
    // Only once the player has one standing: a recipe alone does not make pickles.
    if (!Object.values(state.placed).some((list) => list.some((o) => o.type === machine))) continue;
    for (const r of [...out.values()]) {
      const p = preserveOf(r, machine);
      if (p) add(p);
    }
  }
  return [...out.values()];
}

const between = (state: GameState, [lo, hi]: [number, number]): number =>
  lo + Math.floor(random(state) * (hi - lo + 1));

/** How many requests the board holds. Town projects (the board canopy) can post extra ones. */
export const boardSize = (state: GameState): number =>
  ordersCfg.perDay + Math.max(0, Math.round(perk(state, 'orderSlots')));

/**
 * New requests, priced above shipping value: `count` of them (default a full board), none for goods
 * already asked for in `standing`. Each stays open two or three days (`orders.json` `days`).
 */
export function generateOrders(
  state: GameState,
  count = boardSize(state),
  standing: readonly Order[] = [],
): Order[] {
  const asked = new Set(standing.map((o) => o.item));
  const pool = orderCandidates(state).filter((r) => !asked.has(keyOf(r)));
  const list: Order[] = [];
  let id = [...state.orders.list, ...standing].reduce((n, o) => Math.max(n, o.id), 0) + 1;
  const today = absoluteDay(state);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const ref = pool.splice(Math.floor(random(state) * pool.length), 1)[0] as ItemRef;
    const value = sellValue(ref);
    const tier = ordersCfg.tiers.find((t) => value <= t.maxValue) ?? ordersCfg.tiers[0];
    if (!tier) break;
    const qty = between(state, tier.qty);
    const [lo, hi] = ordersCfg.rewardMultiplier;
    const mult = lo + random(state) * (hi - lo);
    const reward = Math.min(
      ordersCfg.maxReward,
      Math.max(5, Math.round((value * qty * mult) / 5) * 5),
    );
    list.push({
      id: id++,
      item: keyOf(ref),
      qty,
      reward,
      xp: Math.max(4, Math.round(value * qty * ordersCfg.xpPerValue)),
      done: false,
      until: today + between(state, ordersCfg.days ?? [1, 1]) - 1,
    });
  }
  return list;
}

/** The last day a request is open (older saves kept no `until`: their posting day). */
export const lastDayOf = (state: GameState, order: Order): number =>
  order.until ?? state.orders.day;

/** Days a request has left, today included (1 = last day). */
export const daysLeft = (state: GameState, order: Order): number =>
  lastDayOf(state, order) - absoluteDay(state) + 1;

/**
 * The morning board: filled and expired requests come down, open ones stay, and new ones fill the free
 * places. Because requests last two or three days, the rival can take one you were still working on
 * (critique 5, F1). Returns how many new requests went up.
 */
export function refreshBoard(state: GameState): number {
  const today = absoluteDay(state);
  const standing = state.orders.list.filter((o) => !o.done && lastDayOf(state, o) >= today);
  const fresh = generateOrders(state, Math.max(0, boardSize(state) - standing.length), standing);
  state.orders = { day: today, list: [...standing, ...fresh] };
  return fresh.length;
}

/** Make sure the board shows today's orders (it is refreshed on the first look of a new day). */
export function ensureOrders(state: GameState): void {
  if (state.orders.day === absoluteDay(state)) return;
  refreshBoard(state);
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
  applyRival(state); // the rival may have been here first
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
