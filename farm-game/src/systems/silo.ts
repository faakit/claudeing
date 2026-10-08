import { animals, items, placeables } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { houseOf, speciesOf } from './animals';
import { countItem, removeItem } from './inventory';
import { forEachPlaced } from './placeables';

/** Every feed an animal eats (hay, chicken feed...). A silo only takes these. */
export const feedIds = (): string[] => [...new Set(Object.values(animals).map((a) => a.feed))];

/** A silo's store: feed id -> how many. Lives in the placed object's data (repaired on read). */
export function siloStock(obj: PlacedObject): Record<string, number> {
  const raw = obj.data['stock'];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) obj.data['stock'] = {};
  // Repair in place, so a reference held by the caller stays the live store.
  const stock = obj.data['stock'] as Record<string, unknown>;
  for (const [k, v] of Object.entries(stock)) {
    if (!feedIds().includes(k) || typeof v !== 'number' || !(v > 0)) delete stock[k];
    else stock[k] = Math.floor(v);
  }
  return stock as Record<string, number>;
}

export const siloTotal = (obj: PlacedObject): number =>
  Object.values(siloStock(obj)).reduce((a, b) => a + b, 0);

export const siloCap = (obj: PlacedObject): number =>
  Number(placeables[obj.type]?.params['cap'] ?? 300);

/** Pour every feed in the bag into the silo, as far as it holds. Returns how many went in. */
export function depositFeed(state: GameState, obj: PlacedObject): number {
  const stock = siloStock(obj);
  let room = siloCap(obj) - siloTotal(obj);
  let n = 0;
  for (const id of feedIds()) {
    const take = Math.min(room, countItem(state, id));
    if (take <= 0 || !removeItem(state, id, take)) continue;
    stock[id] = (stock[id] ?? 0) + take;
    room -= take;
    n += take;
  }
  return n;
}

/**
 * Overnight, before animals wake: every house nobody fed today eats from a silo that holds its feed.
 * Returns how many houses were fed. Feed in the player's bag is never touched.
 */
export function feedFromSilos(state: GameState): number {
  const silos: PlacedObject[] = [];
  forEachPlaced(state, (obj, def) => {
    if (def.behavior === 'silo') silos.push(obj);
  });
  if (silos.length === 0) return 0;
  let fed = 0;
  forEachPlaced(state, (obj, def) => {
    if (def.behavior !== 'animalHouse') return;
    const sp = speciesOf(obj);
    const h = houseOf(obj);
    if (!sp || h.n === 0 || h.fed) return;
    const silo = silos.find((s) => (siloStock(s)[sp.feed] ?? 0) >= h.n);
    if (!silo) return;
    siloStock(silo)[sp.feed] = (siloStock(silo)[sp.feed] ?? 0) - h.n;
    h.fed = true;
    fed += 1;
  });
  return fed;
}

/** "120 Hay, 30 Chicken Feed" for the silo's message. */
export function siloLabel(obj: PlacedObject): string {
  const parts = Object.entries(siloStock(obj)).map(([id, n]) => `${n} ${items[id]?.name ?? id}`);
  return parts.length ? parts.join(', ') : 'empty';
}
