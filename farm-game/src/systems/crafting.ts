import { items, recipes } from '../data';
import type { RecipeDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat } from './goals';
import { addItem, countItem, countStack, removeItem, roomFor } from './inventory';
import { isRecipeUnlocked } from './skills';

export type CraftBlock = 'locked' | 'no_gold' | 'no_items' | 'full';

/** Why a recipe can't be made right now, or null if it can. */
export function craftBlock(state: GameState, id: string): CraftBlock | null {
  const r: RecipeDef | undefined = recipes[id];
  if (!r || !isRecipeUnlocked(state, r)) return 'locked';
  if (state.money < r.gold) return 'no_gold';
  if (r.ingredients.some((i) => countItem(state, i.item) < i.qty)) return 'no_items';
  // Ingredients are removed first, so measure room after they are gone.
  const sim = structuredClone(state);
  for (const i of r.ingredients) removeItem(sim, i.item, i.qty);
  if (roomFor(sim, r.output.item, r.output.qty) < r.output.qty) return 'full';
  return null;
}

/**
 * How many times a recipe can be made from plain (normal-quality) ingredients only, up to `max`: batch
 * cooking never quietly spends silver or gold goods (critique 8, F7).
 */
export function plainBatch(state: GameState, id: string, max: number): number {
  const r = recipes[id];
  if (!r) return 0;
  const n = Math.min(
    ...r.ingredients.map((i) => Math.floor(countStack(state, { item: i.item }) / i.qty)),
  );
  return Math.max(0, Math.min(max, n));
}

/** Make a recipe up to `n` times from plain ingredients, with one toast. Returns how many were made. */
export function craftBatch(state: GameState, id: string, n: number): number {
  const times = plainBatch(state, id, n);
  let made = 0;
  while (made < times && craft(state, id, true) === 'ok') made += 1;
  const r = recipes[id];
  if (made > 0 && r)
    toast(`Made ${made * r.output.qty} ${items[r.output.item]?.name ?? id}`, 'good');
  return made;
}

/** Make a recipe: pays gold and ingredients, yields the output. All-or-nothing. */
export function craft(state: GameState, id: string, quiet = false): CraftBlock | 'ok' {
  const block = craftBlock(state, id);
  if (block) return block;
  const r = recipes[id] as RecipeDef;
  for (const i of r.ingredients) removeItem(state, i.item, i.qty);
  if (r.gold > 0) {
    state.money -= r.gold;
    gameEvents.emit('moneyChanged', { delta: -r.gold });
  }
  addItem(state, r.output.item, r.output.qty);
  addStat(state, 'crafted');
  if (r.kitchen) addStat(state, 'cooked');
  if (!quiet)
    toast(
      `Made ${r.output.qty > 1 ? `${r.output.qty} ` : ''}${items[r.output.item]?.name ?? id}`,
      'good',
    );
  return 'ok';
}
