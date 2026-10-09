import { items, placeables, shops } from '../data';
import type { UpgradeDef, UpgradeNeed } from '../data';
import type { GameState, Season } from '../state/GameState';
import { waterCapacity } from './actions';
import { restoreEnergy } from './energy';
import { gameEvents } from './events';
import { addStat } from './goals';
import {
  addItem,
  countItem,
  countStack,
  growBag,
  removeItem,
  removeStack,
  roomFor,
} from './inventory';
import { perk } from './skills';
import { ownsGreenhouse } from './plots';
import { isProjectDone } from './projects';
import { keyOf, parseKey, refOf, sellValue, type ItemRef } from './itemRef';

/** Base price of an item id (normal quality, not derived). */
export const sellPrice = (itemId: string): number => items[itemId]?.sellPrice ?? 0;
export const buyPrice = (itemId: string): number => items[itemId]?.buyPrice ?? 0;

/** What the player actually pays: the list price less any friendship discount (never more than 30%). */
export const priceFor = (state: GameState, itemId: string): number =>
  Math.max(1, Math.round(buyPrice(itemId) * (1 - Math.min(0.3, perk(state, 'shopDiscount')))));

export const isShippable = (ref: string | ItemRef): boolean => {
  const r = typeof ref === 'string' ? { item: ref } : ref;
  const type = items[r.item]?.type;
  return type !== 'tool' && type !== 'placeable' && sellValue(r) > 0;
};

/** Move exactly this kind of stack from the inventory into the shipping bin. Returns how many moved. */
export function shipStack(state: GameState, ref: ItemRef, qty: number): number {
  const r = refOf(ref);
  if (!isShippable(r)) return 0;
  const n = Math.min(qty, countStack(state, r));
  if (n <= 0 || !removeStack(state, r, n)) return 0;
  const key = keyOf(r);
  state.shipping[key] = (state.shipping[key] ?? 0) + n;
  addStat(state, 'shipped', n);
  return n;
}

/** Take items back out of the bin (before payout). Returns how many came back. */
export function unshipStack(state: GameState, ref: ItemRef, qty: number): number {
  const key = keyOf(ref);
  const inBin = state.shipping[key] ?? 0;
  const n = Math.min(qty, inBin, roomFor(state, ref, qty));
  if (n <= 0) return 0;
  addItem(state, ref, n);
  state.stats['shipped'] = Math.max(0, (state.stats['shipped'] ?? 0) - n);
  if (inBin - n <= 0) delete state.shipping[key];
  else state.shipping[key] = inBin - n;
  return n;
}

/** Convenience for plain items of normal quality. */
export const shipItem = (state: GameState, itemId: string, qty: number): number =>
  shipStack(state, { item: itemId }, qty);
export const unshipItem = (state: GameState, itemId: string, qty: number): number =>
  unshipStack(state, { item: itemId }, qty);

export function shippingValue(state: GameState): number {
  return Object.entries(state.shipping).reduce(
    (sum, [key, qty]) => sum + sellValue(parseKey(key)) * qty,
    0,
  );
}

export type BuyResult = 'ok' | 'no_money' | 'full' | 'out_of_season' | 'unknown' | 'limit';

/** For things with a placement cap: how many you have (placed plus carried) and the cap, else null. */
export function placeLimit(state: GameState, itemId: string): { have: number; max: number } | null {
  const max = Number(placeables[itemId]?.params['max']);
  if (!Number.isFinite(max)) return null;
  const placed = Object.values(state.placed).reduce(
    (n, list) => n + list.filter((o) => o.type === itemId).length,
    0,
  );
  return { have: placed + countItem(state, itemId), max };
}

/**
 * What a shop sells today. With a greenhouse (pass `state`), seeds of every season are on the shelf, after
 * this season's (critique 6, F5: out-of-season seeds first made a trap).
 */
export function stockFor(shopId: string, season: Season, state?: GameState): string[] {
  const allSeeds = !!state && ownsGreenhouse(state);
  const stock = (shops[shopId]?.stock ?? []).filter(
    (s) => !s.project || (!!state && isProjectDone(state, s.project)),
  );
  const now = stock.filter((s) => s.seasons.includes(season));
  const glass = allSeeds
    ? stock.filter((s) => !s.seasons.includes(season) && items[s.item]?.type === 'seed')
    : [];
  // Seeds together: this season's, then the glass-only ones, then everything else.
  const seed = (s: { item: string }) => items[s.item]?.type === 'seed';
  return [...now.filter(seed), ...glass, ...now.filter((s) => !seed(s))].map((s) => s.item);
}

export function buyItem(state: GameState, shopId: string, itemId: string, qty: number): BuyResult {
  if (!stockFor(shopId, state.time.season, state).includes(itemId)) {
    return shops[shopId]?.stock.some((s) => s.item === itemId) ? 'out_of_season' : 'unknown';
  }
  // Never sell more of a capped placeable than can be put down (a second fountain would be dead money).
  const lim = placeLimit(state, itemId);
  if (lim && lim.have + qty > lim.max) return 'limit';
  const cost = priceFor(state, itemId) * qty;
  if (state.money < cost) return 'no_money';
  if (roomFor(state, itemId, qty) < qty) return 'full';
  state.money -= cost;
  addItem(state, itemId, qty);
  gameEvents.emit('moneyChanged', { delta: -cost });
  addStat(state, 'bought', qty);
  return 'ok';
}

/**
 * Level of an upgrade. Tools, stamina and the bag live in `state.upgrades`; newer house upgrades (the
 * kitchen) only in their `upgraded.<id>` stat, so they needed no save change.
 */
export const upgradeLevel = (state: GameState, up: UpgradeDef): number =>
  (state.upgrades as Record<string, number>)[up.id] ?? state.stats[`upgraded.${up.id}`] ?? 0;

/** Price of the next level, or null when maxed. */
export const nextUpgrade = (
  state: GameState,
  up: UpgradeDef,
): { price: number; label: string; needs?: UpgradeNeed } | null => {
  const lvl = up.levels[upgradeLevel(state, up)];
  if (!lvl) return null;
  // The blacksmith's friendship takes a little off tool upgrades (not the stamina tonic).
  const off = up.id === 'stamina' ? 0 : Math.min(0.25, perk(state, 'upgradeDiscount'));
  return { ...lvl, price: Math.round(lvl.price * (1 - off)) };
};

export function buyUpgrade(
  state: GameState,
  up: UpgradeDef,
): 'ok' | 'no_money' | 'no_items' | 'maxed' {
  const next = nextUpgrade(state, up);
  if (!next) return 'maxed';
  if (state.money < next.price) return 'no_money';
  if (next.needs && countItem(state, next.needs.item) < next.needs.qty) return 'no_items';
  if (next.needs) {
    removeItem(state, next.needs.item, next.needs.qty);
    addStat(state, 'barUpgrades');
  }
  state.money -= next.price;
  const level = upgradeLevel(state, up) + 1;
  if (up.id in state.upgrades) (state.upgrades as Record<string, number>)[up.id] = level;
  if (up.id === 'can') state.water = waterCapacity(state);
  else if (up.id === 'stamina') restoreEnergy(state, 1);
  else if (up.id === 'bag') growBag(state);
  gameEvents.emit('moneyChanged', { delta: -next.price });
  state.stats[`upgraded.${up.id}`] = level;
  addStat(state, 'upgrades');
  return 'ok';
}
