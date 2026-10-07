import { items, shops } from '../data';
import type { UpgradeDef } from '../data';
import type { GameState, Season } from '../state/GameState';
import { gameEvents } from './events';
import { addStat } from './goals';
import { addItem, countItem, removeItem, roomFor } from './inventory';
import { waterCapacity } from './actions';
import { restoreEnergy } from './energy';

export const sellPrice = (itemId: string): number => items[itemId]?.sellPrice ?? 0;
export const buyPrice = (itemId: string): number => items[itemId]?.buyPrice ?? 0;

export const isShippable = (itemId: string): boolean =>
  items[itemId]?.type !== 'tool' && sellPrice(itemId) > 0;

/** Move items from the inventory into the shipping bin. Returns how many moved. */
export function shipItem(state: GameState, itemId: string, qty: number): number {
  if (!isShippable(itemId)) return 0;
  const n = Math.min(qty, countItem(state, itemId));
  if (n <= 0 || !removeItem(state, itemId, n)) return 0;
  state.shipping[itemId] = (state.shipping[itemId] ?? 0) + n;
  addStat(state, 'shipped', n);
  return n;
}

/** Take items back out of the bin (before payout). Returns how many came back. */
export function unshipItem(state: GameState, itemId: string, qty: number): number {
  const inBin = state.shipping[itemId] ?? 0;
  const n = Math.min(qty, inBin, roomFor(state, itemId, qty));
  if (n <= 0) return 0;
  addItem(state, itemId, n);
  state.stats['shipped'] = Math.max(0, (state.stats['shipped'] ?? 0) - n);
  if (inBin - n <= 0) delete state.shipping[itemId];
  else state.shipping[itemId] = inBin - n;
  return n;
}

export function shippingValue(state: GameState): number {
  return Object.entries(state.shipping).reduce((sum, [id, qty]) => sum + sellPrice(id) * qty, 0);
}

export type BuyResult = 'ok' | 'no_money' | 'full' | 'out_of_season' | 'unknown';

export function stockFor(shopId: string, season: Season): string[] {
  return (shops[shopId]?.stock ?? []).filter((s) => s.seasons.includes(season)).map((s) => s.item);
}

export function buyItem(state: GameState, shopId: string, itemId: string, qty: number): BuyResult {
  if (!stockFor(shopId, state.time.season).includes(itemId)) {
    return shops[shopId]?.stock.some((s) => s.item === itemId) ? 'out_of_season' : 'unknown';
  }
  const cost = buyPrice(itemId) * qty;
  if (state.money < cost) return 'no_money';
  if (roomFor(state, itemId, qty) < qty) return 'full';
  state.money -= cost;
  addItem(state, itemId, qty);
  gameEvents.emit('moneyChanged', { delta: -cost });
  addStat(state, 'bought', qty);
  return 'ok';
}

export const upgradeLevel = (state: GameState, up: UpgradeDef): number => state.upgrades[up.id];

/** Price of the next level, or null when maxed. */
export const nextUpgrade = (
  state: GameState,
  up: UpgradeDef,
): { price: number; label: string } | null => up.levels[upgradeLevel(state, up)] ?? null;

export function buyUpgrade(state: GameState, up: UpgradeDef): 'ok' | 'no_money' | 'maxed' {
  const next = nextUpgrade(state, up);
  if (!next) return 'maxed';
  if (state.money < next.price) return 'no_money';
  state.money -= next.price;
  state.upgrades[up.id] += 1;
  if (up.id === 'can') state.water = waterCapacity(state);
  else restoreEnergy(state, 1);
  gameEvents.emit('moneyChanged', { delta: -next.price });
  addStat(state, 'upgrades');
  return 'ok';
}
