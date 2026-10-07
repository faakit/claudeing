import { items, placeables } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { addItem, removeStack, roomFor } from './inventory';
import { refOf, type ItemRef } from './itemRef';

/** What a jar makes from an item, by the item's `family`. Data-driven so new families just add a row. */
export const JAR_RECIPES: Record<string, string> = { fruit: 'jam', veg: 'pickles' };

export interface JarContents {
  /** The finished good, already worked out when loaded. */
  out: ItemRef;
  /** Mornings until it is ready (0 = ready). */
  days: number;
}

/** What `ref` would become in a jar, or null if it can't be preserved. */
export function preserveOf(ref: ItemRef): ItemRef | null {
  const family = items[ref.item]?.family;
  const out = family ? JAR_RECIPES[family] : undefined;
  if (!out || ref.of) return null;
  return refOf({ item: out, of: ref.item, q: ref.q });
}

export const jarContents = (obj: PlacedObject): JarContents | null =>
  (obj.data['jar'] as JarContents | undefined) ?? null;

export const jarReady = (obj: PlacedObject): boolean => (jarContents(obj)?.days ?? 1) <= 0;

export const jarDays = (obj: PlacedObject): number =>
  Number(placeables[obj.type]?.params['days'] ?? 3);

/** Put one item into an empty jar. */
export function loadJar(
  state: GameState,
  obj: PlacedObject,
  ref: ItemRef,
): 'ok' | 'busy' | 'invalid' {
  if (jarContents(obj)) return 'busy';
  const out = preserveOf(ref);
  if (!out) return 'invalid';
  if (!removeStack(state, ref, 1)) return 'invalid';
  obj.data['jar'] = { out, days: jarDays(obj) } satisfies JarContents;
  return 'ok';
}

/** Take the finished good. */
export function collectJar(
  state: GameState,
  obj: PlacedObject,
): ItemRef | 'empty' | 'waiting' | 'full' {
  const c = jarContents(obj);
  if (!c) return 'empty';
  if (c.days > 0) return 'waiting';
  if (roomFor(state, c.out, 1) < 1) return 'full';
  addItem(state, c.out, 1);
  delete obj.data['jar'];
  return c.out;
}

/** Morning tick: one day closer. */
export function tickJar(obj: PlacedObject): void {
  const c = jarContents(obj);
  if (c && c.days > 0) c.days -= 1;
}
