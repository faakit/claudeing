import { game, items } from '../data';
import type { GameState, ItemStack } from '../state/GameState';
import { gameEvents } from './events';
import { discover } from './almanac';
import { keyOf, refOf, sameRef, type ItemRef } from './itemRef';

export const stackLimit = (itemId: string): number => items[itemId]?.stackLimit ?? game.stackLimit;
export const isToolSlot = (slot: number): boolean => slot < game.toolSlots;

/** Item types you reach for while working; they claim hotbar slots before other goods do. */
const HOTBAR_FIRST = new Set([
  'seed',
  'sapling',
  'fertilizer',
  'bait',
  'placeable',
  'feed',
  'animal',
]);

const changed = () => gameEvents.emit('inventoryChanged', undefined);
const asRef = (r: string | ItemRef): ItemRef => (typeof r === 'string' ? { item: r } : refOf(r));

/** Total of an item across every quality and origin (e.g. all tomatoes, any tier). */
export function countItem(state: GameState, itemId: string): number {
  return state.inventory.slots.reduce((n, s) => (s?.item === itemId ? n + s.qty : n), 0);
}

/** Count of exactly this kind of stack (same item, quality and origin). */
export function countStack(state: GameState, ref: ItemRef): number {
  const r = refOf(ref);
  return state.inventory.slots.reduce((n, s) => (s && sameRef(refOf(s), r) ? n + s.qty : n), 0);
}

/** How many of `qty` would fit right now. */
export function roomFor(state: GameState, ref: string | ItemRef, qty: number): number {
  const r = asRef(ref);
  const limit = stackLimit(r.item);
  let room = 0;
  state.inventory.slots.forEach((s, i) => {
    if (isToolSlot(i)) return;
    if (!s) room += limit;
    else if (sameRef(refOf(s), r)) room += limit - s.qty;
  });
  return Math.min(qty, room);
}

/** Fill matching stacks first, then empty slots. Returns the leftover that did not fit. */
export function addItem(state: GameState, ref: string | ItemRef, qty: number): number {
  const r = asRef(ref);
  if (!items[r.item]) throw new Error(`Unknown item "${r.item}"`);
  if (qty > 0) discover(state, r.item);
  const limit = stackLimit(r.item);
  let left = qty;
  const slots = state.inventory.slots;
  slots.forEach((s, i) => {
    if (left <= 0 || isToolSlot(i) || !s || !sameRef(refOf(s), r)) return;
    const add = Math.min(left, limit - s.qty);
    s.qty += add;
    left -= add;
  });
  // Things you use (seeds, fertilizer, machines) go to the hotbar first; produce goes to the bag first,
  // so harvests never push your seeds out of reach of the thumb.
  const toHotbar = items[r.item]?.type !== undefined && HOTBAR_FIRST.has(items[r.item]!.type);
  const order = slots.map((_, i) => i).filter((i) => !isToolSlot(i));
  order.sort((a, b) => {
    const rank = (i: number) => (i < game.hotbarSlots === toHotbar ? 0 : 1);
    return rank(a) - rank(b) || a - b;
  });
  for (const i of order) {
    if (left <= 0) break;
    if (slots[i]) continue;
    const add = Math.min(left, limit);
    slots[i] = { ...r, qty: add } as ItemStack;
    left -= add;
  }
  if (left !== qty) changed();
  return left;
}

/** All-or-nothing removal of exactly this kind of stack. Tools can never be removed. */
export function removeStack(state: GameState, ref: ItemRef, qty: number): boolean {
  const r = refOf(ref);
  if (qty <= 0 || items[r.item]?.type === 'tool') return false;
  if (countStack(state, r) < qty) return false;
  let left = qty;
  const slots = state.inventory.slots;
  // Take from the back so hotbar stacks are drained last.
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const s = slots[i];
    if (!s || !sameRef(refOf(s), r)) continue;
    const take = Math.min(left, s.qty);
    s.qty -= take;
    left -= take;
    if (s.qty === 0) slots[i] = null;
  }
  changed();
  return true;
}

/**
 * Remove `qty` of an item regardless of quality/origin, spending the lowest quality first so the
 * player keeps their best goods. All-or-nothing. Tools can never be removed.
 */
export function removeItem(state: GameState, itemId: string, qty: number): boolean {
  if (qty <= 0 || items[itemId]?.type === 'tool') return false;
  if (countItem(state, itemId) < qty) return false;
  const kinds = new Map<string, ItemRef>();
  for (const s of state.inventory.slots) if (s?.item === itemId) kinds.set(keyOf(s), refOf(s));
  const order = [...kinds.values()].sort((a, b) => (a.q ?? 0) - (b.q ?? 0));
  let left = qty;
  for (const ref of order) {
    const take = Math.min(left, countStack(state, ref));
    if (take > 0) removeStack(state, ref, take);
    left -= take;
    if (left <= 0) break;
  }
  return true;
}

export function removeFromSlot(state: GameState, slot: number, qty = 1): boolean {
  const s = state.inventory.slots[slot];
  if (!s || isToolSlot(slot) || s.qty < qty) return false;
  s.qty -= qty;
  if (s.qty === 0) state.inventory.slots[slot] = null;
  changed();
  return true;
}

export const selectedStack = (state: GameState): ItemStack | null =>
  state.inventory.slots[state.inventory.selected] ?? null;

export function selectSlot(state: GameState, slot: number): void {
  const next = Math.max(0, Math.min(game.hotbarSlots - 1, slot));
  if (next === state.inventory.selected) return;
  state.inventory.selected = next;
  changed();
}

export function cycleSlot(state: GameState, step: number): void {
  selectSlot(state, (state.inventory.selected + step + game.hotbarSlots) % game.hotbarSlots);
}

/** Swap two non-tool slots (inventory rearranging). Merges stacks of the same kind. */
export function swapSlots(state: GameState, a: number, b: number): boolean {
  if (a === b || isToolSlot(a) || isToolSlot(b)) return false;
  const slots = state.inventory.slots;
  const sa = slots[a] ?? null;
  const sb = slots[b] ?? null;
  if (sa && sb && sameRef(refOf(sa), refOf(sb))) {
    const move = Math.min(sa.qty, stackLimit(sa.item) - sb.qty);
    sb.qty += move;
    sa.qty -= move;
    if (sa.qty === 0) slots[a] = null;
  } else {
    slots[a] = sb;
    slots[b] = sa;
  }
  changed();
  return true;
}
