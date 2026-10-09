import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items } from '../src/data';
import type { TileInfo } from '../src/systems/actions';
import {
  actOn,
  autoMode,
  chooseAction,
  registerAutoItem,
  seedSlot,
  unregisterAutoItem,
} from '../src/systems/autoTool';
import { getSoil, plant, till } from '../src/systems/farming';
import { addItem } from '../src/systems/inventory';
import { equip, grass, newState, pond } from './helpers';
import type { GameState } from '../src/state/GameState';

/** A farm tile that knows its neighbours (area tools look along the line). */
const field = (tx: number, ty: number): TileInfo => ({
  ...grass(tx, ty),
  at: (x, y) => field(x, y),
});
const itemAt = (s: GameState, slot: number) => s.inventory.slots[slot]?.item;

/** Fresh game: hoe, can, scythe, rod, pickaxe, parsnip seeds; hoe in hand; player facing down. */
function game(): GameState {
  const s = newState();
  s.player.facing = 'down';
  return s;
}

describe('auto tool chooses the farm item for the tile', () => {
  it('grass -> hoe', () => {
    const s = game();
    equip(s, 'watering_can');
    const c = chooseAction(s, [field(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('hoe');
    expect(c?.plan.kind).toBe('till');
  });

  it('tilled empty soil -> the seed planted last; never a seed the player did not choose', () => {
    const s = game();
    till(s, 5, 5);
    expect(chooseAction(s, [field(5, 5)])?.plan.kind).not.toBe('plant');
    s.controls.lastSeed = 'parsnip_seed';
    const c = chooseAction(s, [field(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('parsnip_seed');
    expect(c?.plan.kind).toBe('plant');
  });

  it('no seed chosen yet: Action on empty soil says to pick seeds', async () => {
    const { refusalFor, NO_SEED_HINT } = await import('../src/systems/autoTool');
    const s = game();
    till(s, 5, 5);
    s.farm.tiles['5,5']!.watered = true; // nothing else to do there
    expect(chooseAction(s, [field(5, 5)])).toBeNull();
    expect(refusalFor(s, [field(5, 5)])).toBe(NO_SEED_HINT);
  });

  it('what you hold wins whenever it can act', () => {
    const s = game();
    s.farm.weeds['5,5'] = true;
    s.controls.lastSeed = 'parsnip_seed';
    till(s, 6, 5);
    equip(s, 'watering_can'); // the can can water the tilled tile: it wins over planting there
    const c = chooseAction(s, [field(6, 5), field(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('watering_can');
  });

  it('a held Action repeats only the kind of step it started with', () => {
    const s = game();
    s.controls.lastSeed = 'parsnip_seed';
    till(s, 6, 5);
    // the front is grass (till), the side tilled (plant): asked for "till" only, it never plants
    const c = chooseAction(s, [field(5, 5), field(6, 5)], { kind: 'till' });
    expect(c?.plan.kind).toBe('till');
    till(s, 5, 5);
    expect(chooseAction(s, [field(5, 5), field(6, 5)], { kind: 'till' })).toBeNull();
  });

  it('a dry crop -> can; a watered crop -> nothing to do', () => {
    const s = game();
    till(s, 5, 5);
    plant(s, 5, 5, 'parsnip');
    const c = chooseAction(s, [field(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('watering_can');
    getSoil(s, 5, 5)!.watered = true;
    expect(chooseAction(s, [field(5, 5)])).toBeNull();
  });

  it('a ripe crop -> harvest, whatever is in hand', () => {
    const s = game();
    till(s, 5, 5);
    plant(s, 5, 5, 'parsnip');
    getSoil(s, 5, 5)!.crop!.stage = 9;
    for (const held of ['hoe', 'fishing_rod', 'parsnip_seed']) {
      equip(s, held);
      expect(chooseAction(s, [field(5, 5)])?.plan.kind, held).toBe('harvest');
    }
  });

  it('weeds -> scythe (with an item in hand that cannot clear them)', () => {
    const s = game();
    s.farm.weeds['5,5'] = true;
    equip(s, 'watering_can');
    const c = chooseAction(s, [field(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('scythe');
  });

  it('an empty can facing water -> refill', () => {
    const s = game();
    s.water = 0;
    const c = chooseAction(s, [pond(5, 5)]);
    expect(c && itemAt(s, c.slot)).toBe('watering_can');
    expect(c?.plan.kind).toBe('refill');
  });

  it('never the rod or a placeable unless it is in hand', () => {
    const s = game();
    addItem(s, 'sprinkler', 1);
    for (const tile of [field(5, 5), pond(5, 5)]) {
      const c = chooseAction(s, [tile]);
      const item = c ? itemAt(s, c.slot) : null;
      expect(item).not.toBe('fishing_rod');
      expect(item === null || items[item!]?.type !== 'placeable').toBe(true);
    }
  });

  it('holding the rod or a placeable is explicit: Action does exactly what it does', () => {
    const s = game();
    equip(s, 'fishing_rod');
    expect(autoMode(s)).toBe(false);
    expect(chooseAction(s, [field(5, 5)])).toBeNull(); // no hoe swing with the rod in hand
    expect(chooseAction(s, [pond(5, 5)])?.plan.kind).toBe('cast');
    addItem(s, 'sprinkler', 1);
    equip(s, 'sprinkler');
    expect(autoMode(s)).toBe(false);
    expect(chooseAction(s, [field(5, 5)])?.plan.kind).toBe('place');
  });

  it('auto tool off: only the item in hand, as before', () => {
    const s = game();
    s.settings.controls.autoTool = false;
    equip(s, 'watering_can');
    expect(chooseAction(s, [field(5, 5)])).toBeNull();
    const res = actOn(s, [field(5, 5)]);
    expect(res.ok).toBe(false);
  });

  it('nothing possible: a refusal for the item in hand on the tile in front', () => {
    const s = game();
    s.farm.tiles['5,5'] = {
      watered: true,
      crop: { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false },
    };
    const res = actOn(s, [field(5, 5)]);
    expect(res.ok).toBe(false);
  });

  it('the hotbar selection never changes; the seed planted is remembered', () => {
    const s = game();
    till(s, 5, 5);
    s.farm.tiles['5,5']!.watered = true; // the hoe and can have nothing to do; seeds in hand plant
    equip(s, 'parsnip_seed');
    const sel = s.inventory.selected;
    const res = actOn(s, [field(5, 5)]);
    expect(res).toMatchObject({ ok: true, kind: 'plant' });
    expect(s.inventory.selected).toBe(sel);
    expect(s.controls.lastSeed).toBe('parsnip_seed');
  });

  it('seeds: the one in hand, else the last planted (anywhere in the bag), else none', () => {
    const s = game();
    addItem(s, 'cauliflower_seed', 3);
    expect(seedSlot(s)).toBeNull();
    s.controls.lastSeed = 'cauliflower_seed';
    expect(itemAt(s, seedSlot(s)!)).toBe('cauliflower_seed');
    equip(s, 'parsnip_seed');
    expect(itemAt(s, seedSlot(s)!)).toBe('parsnip_seed');
  });

  it('energy spent equals using the same tool by hand', () => {
    const a = game();
    const b = game();
    actOn(a, [field(5, 5)]); // auto: hoe
    equip(b, 'hoe');
    actOn(b, [field(5, 5)]);
    expect(a.energy).toBe(b.energy);
    expect(a.energy).toBeLessThan(newState().energy);
  });

  it('a mechanic can register its own auto item without touching core files', () => {
    const s = game();
    registerAutoItem({
      id: 'test-rod',
      priority: 1,
      eligible: (_st, d) => d.tool === 'fishing_rod',
    });
    try {
      expect(chooseAction(s, [pond(5, 5)])?.plan.kind).toBeDefined();
    } finally {
      unregisterAutoItem('test-rod');
    }
    expect(chooseAction(s, [pond(5, 5)])?.plan.kind ?? null).not.toBe('cast');
  });
});
