import { game, items } from '../data';
import type { GameState, ItemStack } from '../state/GameState';
import { gameEvents } from './events';

export const stackLimit = (itemId: string): number => items[itemId]?.stackLimit ?? game.stackLimit;
export const isToolSlot = (slot: number): boolean => slot < game.toolSlots;

const changed = () => gameEvents.emit('inventoryChanged', undefined);

export function countItem(state: GameState, itemId: string): number {
  return state.inventory.slots.reduce((n, s) => (s?.item === itemId ? n + s.qty : n), 0);
}

/** How many of `qty` would fit right now. */
export function roomFor(state: GameState, itemId: string, qty: number): number {
  const limit = stackLimit(itemId);
  let room = 0;
  state.inventory.slots.forEach((s, i) => {
    if (isToolSlot(i)) return;
    if (!s) room += limit;
    else if (s.item === itemId) room += limit - s.qty;
  });
  return Math.min(qty, room);
}

/** Fill existing stacks first, then empty slots. Returns the leftover that did not fit. */
export function addItem(state: GameState, itemId: string, qty: number): number {
  if (!items[itemId]) throw new Error(`Unknown item "${itemId}"`);
  const limit = stackLimit(itemId);
  let left = qty;
  const slots = state.inventory.slots;
  slots.forEach((s, i) => {
    if (left <= 0 || isToolSlot(i) || s?.item !== itemId) return;
    const add = Math.min(left, limit - s.qty);
    s.qty += add;
    left -= add;
  });
  slots.forEach((s, i) => {
    if (left <= 0 || isToolSlot(i) || s) return;
    const add = Math.min(left, limit);
    slots[i] = { item: itemId, qty: add };
    left -= add;
  });
  if (left !== qty) changed();
  return left;
}

/** All-or-nothing removal across stacks. Tools can never be removed. */
export function removeItem(state: GameState, itemId: string, qty: number): boolean {
  if (qty <= 0 || items[itemId]?.type === 'tool') return false;
  if (countItem(state, itemId) < qty) return false;
  let left = qty;
  const slots = state.inventory.slots;
  // Take from the back so hotbar stacks are drained last.
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const s = slots[i];
    if (!s || s.item !== itemId) continue;
    const take = Math.min(left, s.qty);
    s.qty -= take;
    left -= take;
    if (s.qty === 0) slots[i] = null;
  }
  changed();
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

/** Swap two non-tool slots (inventory rearranging). Merges stacks of the same item. */
export function swapSlots(state: GameState, a: number, b: number): boolean {
  if (a === b || isToolSlot(a) || isToolSlot(b)) return false;
  const slots = state.inventory.slots;
  const sa = slots[a] ?? null;
  const sb = slots[b] ?? null;
  if (sa && sb && sa.item === sb.item) {
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
