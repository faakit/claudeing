import { crops, items } from '../data';
import type { PlaceableDef } from '../data';
import type { GameState, PlacedObject } from '../state/GameState';
import { parseKey } from '../systems/farming';
import { addItem, roomFor } from '../systems/inventory';
import { addStat } from '../systems/goals';
import { toast } from '../systems/events';
import { registerPlaceableBehavior } from '../systems/placeables';
import { rollQuality } from '../systems/quality';
import { addXp } from '../systems/skills';

/** What a bee house holds (in the object's `data`, so it saves for free). */
export interface HiveData {
  /** Mornings until the next honey. */
  timer: number;
  /** Honey waiting to be collected. */
  ready: number;
}

const num = (v: unknown, hi: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, Math.floor(v))) : 0;

export function hiveOf(obj: { data: Record<string, unknown> }, cap = 3): HiveData {
  const raw = obj.data['hive'] as Partial<HiveData> | undefined;
  const h = { timer: num(raw?.timer, 99), ready: num(raw?.ready, cap) };
  obj.data['hive'] = h;
  return h;
}

/** Is a flower crop (a tulip) growing within `radius` tiles of this bee house? */
export function flowersNear(state: GameState, obj: PlacedObject, radius: number): boolean {
  if (radius <= 0) return false;
  return Object.entries(state.farm.tiles).some(([key, soil]) => {
    if (!soil.crop) return false;
    const [tx, ty] = parseKey(key);
    const crop = crops[soil.crop.cropId];
    return (
      !!crop &&
      items[crop.harvestItem]?.family === 'flower' &&
      Math.max(Math.abs(tx - obj.tx), Math.abs(ty - obj.ty)) <= radius
    );
  });
}

/** Mornings per honey: `days`, or `flowerDays` while flowers grow nearby. */
export function hiveDays(state: GameState, obj: PlacedObject, def: PlaceableDef): number {
  const days = Number(def.params['days'] ?? 4);
  const radius = Number(def.params['flowerRadius'] ?? 0);
  return flowersNear(state, obj, radius) ? Number(def.params['flowerDays'] ?? days) : days;
}

/** A bee house makes honey every few mornings with no input: low effort, low reward, never stops. */
registerPlaceableBehavior('beeHouse', {
  status: (obj) => (hiveOf(obj).ready > 0 ? 'ready' : 'busy'),
  onMorning(state, obj, def, ctx) {
    const days = hiveDays(state, obj, def);
    const cap = Number(def.params['cap'] ?? 3);
    const h = hiveOf(obj, cap);
    h.timer += 1;
    if (h.timer >= days) {
      h.timer = 0;
      h.ready = Math.min(cap, h.ready + 1);
      ctx.notes.push('Honey is ready in a bee house.');
    }
  },
  interact(state, obj, def) {
    const h = hiveOf(obj, Number(def.params['cap'] ?? 3));
    if (h.ready === 0) {
      const left = Math.max(1, hiveDays(state, obj, def) - h.timer);
      const near = flowersNear(state, obj, Number(def.params['flowerRadius'] ?? 0));
      return {
        kind: 'message',
        text: `Honey in ${left} day${left > 1 ? 's' : ''}.${near ? ' The bees love your flowers.' : ''}`,
      };
    }
    const take = Math.min(h.ready, roomFor(state, 'honey', h.ready));
    if (take === 0) return { kind: 'message', text: 'Inventory full!' };
    for (let i = 0; i < take; i++) {
      const q = rollQuality(state, 0, 'forageQuality');
      addItem(state, q > 0 ? { item: 'honey', q } : 'honey', 1);
    }
    h.ready -= take;
    addStat(state, 'collected', take);
    addXp(state, 'foraging', 5 * take);
    toast(`+${take} ${items['honey']?.name}`, 'good');
    return { kind: 'message', text: '' };
  },
  canPickUp: () => true,
});
