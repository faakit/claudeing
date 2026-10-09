import { animals, items, placeables } from '../data';
import type { AnimalDef } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { addItem, countItem, removeItem, roomFor } from './inventory';
import { rollQuality } from './quality';

/** One house's animals. Lives in the placed object's `data`, so it saves and migrates for free. */
export interface HouseData {
  /** How many animals live here. */
  n: number;
  /** Fed today? Reset every morning. */
  fed: boolean;
  /** Products waiting to be collected. */
  ready: number;
  /** Petted today? Reset every morning. A daily pat makes them a little happier. */
  petted: boolean;
  /** Happiness 0-5: grows with every day they are fed, shrinks when they go hungry. Better quality. */
  joy: number;
}

export const MAX_JOY = 5;
const MAX_READY = 6;

export function speciesOf(obj: PlacedObject): AnimalDef | undefined {
  const id = placeables[obj.type]?.params['species'];
  return typeof id === 'string' ? animals[id] : undefined;
}

/** The house's data, repaired if a hand-edited save left it malformed. */
export function houseOf(obj: PlacedObject): HouseData {
  const raw = obj.data['house'] as Partial<HouseData> | undefined;
  const cap = speciesOf(obj)?.capacity ?? 0;
  const clamp = (v: unknown, hi: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : 0;
  const h: HouseData = {
    n: clamp(raw?.n, cap),
    fed: raw?.fed === true,
    petted: raw?.petted === true,
    ready: clamp(raw?.ready, MAX_READY),
    joy: clamp(raw?.joy, MAX_JOY),
  };
  obj.data['house'] = h;
  return h;
}

export const isFull = (obj: PlacedObject): boolean => {
  const sp = speciesOf(obj);
  return !sp || houseOf(obj).n >= sp.capacity;
};

export type MoveInResult = 'ok' | 'full' | 'none';

/** Move animals from the bag into the house, as many as fit. Returns how many moved in. */
export function moveIn(state: GameState, obj: PlacedObject): number {
  const sp = speciesOf(obj);
  if (!sp) return 0;
  const h = houseOf(obj);
  const moved = Math.min(sp.capacity - h.n, countItem(state, sp.item));
  if (moved <= 0 || !removeItem(state, sp.item, moved)) return 0;
  h.n += moved;
  return moved;
}

/** Feed everyone (one feed each). Returns false when not enough feed or nothing to feed. */
export function feed(state: GameState, obj: PlacedObject): 'ok' | 'empty' | 'fed' | 'no_feed' {
  const sp = speciesOf(obj);
  const h = houseOf(obj);
  if (!sp || h.n === 0) return 'empty';
  if (h.fed) return 'fed';
  if (countItem(state, sp.feed) < h.n) return 'no_feed';
  removeItem(state, sp.feed, h.n);
  h.fed = true;
  return 'ok';
}

/** A daily pat: friendlier animals give better goods. Once a day, only if someone lives here. */
export function pet(obj: PlacedObject): boolean {
  const h = houseOf(obj);
  if (h.n === 0 || h.petted) return false;
  h.petted = true;
  h.joy = Math.min(MAX_JOY, h.joy + 1);
  return true;
}

/** Collect what is waiting; happier animals give better quality. Returns how many were taken. */
export function collect(state: GameState, obj: PlacedObject): number {
  const sp = speciesOf(obj);
  const h = houseOf(obj);
  if (!sp || h.ready === 0) return 0;
  const take = Math.min(h.ready, roomFor(state, sp.product, h.ready));
  for (let i = 0; i < take; i++) {
    const q = rollQuality(state, h.joy * 0.04);
    addItem(state, q > 0 ? { item: sp.product, q } : sp.product, 1);
  }
  h.ready -= take;
  return take;
}

/**
 * Morning: fed animals produce and cheer up; hungry ones sulk. Outdoor workers (pigs) only find goods when
 * `outdoorOk` (a dry day outside winter); they still cheer up when fed. Returns true if something is waiting.
 */
export function morning(obj: PlacedObject, outdoorOk = true): boolean {
  const sp = speciesOf(obj);
  const h = houseOf(obj);
  if (!sp || h.n === 0) return false;
  if (h.fed) {
    if (!sp.outdoor || outdoorOk) h.ready = Math.min(MAX_READY, h.ready + h.n * sp.perDay);
    h.joy = Math.min(MAX_JOY, h.joy + 1);
  } else h.joy = Math.max(0, h.joy - 1);
  h.fed = false;
  h.petted = false;
  return h.ready > 0;
}

export const productName = (obj: PlacedObject): string =>
  items[speciesOf(obj)?.product ?? '']?.name ?? 'goods';

/**
 * Animal goods the farm makes now, per day: eggs from hens, milk from cows, truffles from pigs (none in
 * winter, and only on dry days: counted at 60%), honey from bee houses that have some ready (one per
 * `days` mornings). Orders and specials ask only for these, and never for more than the farm can make.
 */
export function animalOutput(state: GameState): Map<string, number> {
  const out = new Map<string, number>();
  const add = (item: string, n: number) => n > 0 && out.set(item, (out.get(item) ?? 0) + n);
  for (const list of Object.values(state.placed))
    for (const obj of list) {
      const def = placeables[obj.type];
      // Honey is slow: a request only goes up when a hive has some ready to hand over.
      const hive = obj.data['hive'] as { ready?: number } | undefined;
      if (def?.behavior === 'beeHouse' && (hive?.ready ?? 0) > 0)
        add('honey', 1 / Math.max(1, Number(def.params['days'] ?? 4)));
      const sp = speciesOf(obj);
      if (def?.behavior !== 'animalHouse' || !sp) continue;
      if (sp.outdoor && state.time.season === 'winter') continue;
      add(sp.product, houseOf(obj).n * sp.perDay * (sp.outdoor ? DRY_SHARE : 1));
    }
  return out;
}

/** Share of days an outdoor animal (a pig) can work: dry, not winter. */
export const DRY_SHARE = 0.6;

/** The most of an animal good a request may ask for: about two days of what the farm makes. */
export const animalOrderCap = (perDay: number): number => Math.max(1, Math.ceil(perDay * 2));
