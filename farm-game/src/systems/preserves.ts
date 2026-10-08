import { items, machines } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { addItem, removeStack, roomFor } from './inventory';
import { refOf, type ItemRef } from './itemRef';

/** What `ref` would become in a machine (default: the preserve jar), or null if it can't be made. */
export function preserveOf(ref: ItemRef, machine = 'preserve_jar'): ItemRef | null {
  const family = items[ref.item]?.family;
  const out = family ? machines[machine]?.recipes[family] : undefined;
  if (!out || ref.of) return null;
  return refOf({ item: out, of: ref.item, q: ref.q });
}

export interface JarContents {
  /** The finished good, already worked out when loaded. */
  out: ItemRef;
  /** Mornings until it is ready (0 = ready). */
  days: number;
}

export const jarContents = (obj: PlacedObject): JarContents | null =>
  (obj.data['jar'] as JarContents | undefined) ?? null;

export const jarReady = (obj: PlacedObject): boolean => (jarContents(obj)?.days ?? 1) <= 0;

export const jarDays = (obj: PlacedObject): number => machines[obj.type]?.days ?? 3;

/** Put one item into an empty jar. */
export function loadJar(
  state: GameState,
  obj: PlacedObject,
  ref: ItemRef,
): 'ok' | 'busy' | 'invalid' {
  if (jarContents(obj)) return 'busy';
  const out = preserveOf(ref, obj.type);
  if (!out) return 'invalid';
  if (!removeStack(state, ref, 1)) return 'invalid';
  obj.data['jar'] = { out, days: jarDays(obj) } satisfies JarContents;
  return 'ok';
}

/** Empty machines of one kind on a map (the ones "Load all" can fill). */
export const idleMachines = (state: GameState, map: string, type: string): PlacedObject[] =>
  (state.placed[map] ?? []).filter((o) => o.type === type && !jarContents(o));

/**
 * One tap fills every empty machine of this kind on the map with `ref`, as far as the stack goes.
 * Returns how many were loaded.
 */
export function loadAll(state: GameState, map: string, type: string, ref: ItemRef): number {
  let n = 0;
  for (const obj of idleMachines(state, map, type)) {
    if (loadJar(state, obj, ref) !== 'ok') break;
    n += 1;
  }
  return n;
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
