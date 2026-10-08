import { trees } from '../data';
import type { TreeDef } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { addItem, roomFor } from './inventory';
import { rollQuality } from './quality';

/** A tree's state, kept in the placed object's `data` so it saves and migrates for free. */
export interface TreeData {
  /** Mornings since planting. */
  age: number;
  /** Mornings since the last fruit. */
  timer: number;
  /** Fruit waiting on the tree. */
  fruit: number;
}

const num = (v: unknown, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : 0;

export const treeDef = (obj: PlacedObject): TreeDef | undefined => trees[obj.type];

/** The tree's data, repaired if a hand-edited save left it malformed. */
export function treeOf(obj: PlacedObject): TreeData {
  const raw = obj.data['tree'] as Partial<TreeData> | undefined;
  const cap = treeDef(obj)?.cap ?? 0;
  const t = { age: num(raw?.age, 9999), timer: num(raw?.timer, 99), fruit: num(raw?.fruit, cap) };
  obj.data['tree'] = t;
  return t;
}

export const isGrown = (obj: PlacedObject): boolean => {
  const def = treeDef(obj);
  return !!def && treeOf(obj).age >= def.growDays;
};

/** Morning: it ages, and once grown bears fruit every few days during its season. Returns true if fruit appeared. */
export function growTree(obj: PlacedObject, season: string): boolean {
  const def = treeDef(obj);
  if (!def) return false;
  const t = treeOf(obj);
  t.age += 1;
  if (t.age < def.growDays || season !== def.season) {
    t.timer = 0;
    return false;
  }
  t.timer += 1;
  if (t.timer < def.every) return false;
  t.timer = 0;
  const before = t.fruit;
  t.fruit = Math.min(def.cap, t.fruit + 1);
  return t.fruit > before;
}

/** Pick the fruit; quality rolls like a harvest. Returns how many were taken. */
export function pickFruit(state: GameState, obj: PlacedObject): number {
  const def = treeDef(obj);
  const t = treeOf(obj);
  if (!def || t.fruit === 0) return 0;
  const take = Math.min(t.fruit, roomFor(state, def.fruit, t.fruit));
  for (let i = 0; i < take; i++) {
    const q = rollQuality(state);
    addItem(state, q > 0 ? { item: def.fruit, q } : def.fruit, 1);
  }
  t.fruit -= take;
  return take;
}
