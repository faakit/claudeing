import { describe, expect, it } from 'vitest';
import { performAction } from '../src/systems/actions';
import { getSoil } from '../src/systems/farming';
import { countItem } from '../src/systems/inventory';
import { equip, grass, newState, pond } from './helpers';

describe('performAction', () => {
  it('hoe tills for 2 energy', () => {
    const s = newState();
    const r = performAction(s, grass(5, 5));
    expect(r).toMatchObject({ ok: true, kind: 'till' });
    expect(s.energy).toBe(98);
    expect(getSoil(s, 5, 5)).toBeDefined();
  });

  it('refuses to till non-tillable or blocked tiles without spending energy', () => {
    const s = newState();
    expect(performAction(s, { ...grass(5, 5), tillable: false }).ok).toBe(false);
    expect(performAction(s, { ...grass(5, 5), blocked: true }).ok).toBe(false);
    expect(s.energy).toBe(100);
  });

  it('0 energy blocks tool actions', () => {
    const s = newState();
    s.energy = 1;
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
    expect(getSoil(s, 5, 5)).toBeUndefined();
    expect(s.energy).toBe(1);
  });

  it('seeds plant on tilled soil and are consumed', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    equip(s, 'parsnip_seed');
    expect(performAction(s, grass(5, 5))).toMatchObject({ ok: true, kind: 'plant' });
    expect(countItem(s, 'parsnip_seed')).toBe(9);
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
  });

  it('planting costs no energy', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    const e = s.energy;
    equip(s, 'parsnip_seed');
    performAction(s, grass(5, 5));
    expect(s.energy).toBe(e);
  });

  it('the can waters for 1 energy and 1 charge, refills at water', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    s.inventory.selected = 1;
    const e = s.energy;
    expect(performAction(s, grass(5, 5))).toMatchObject({ ok: true, kind: 'water' });
    expect(s.energy).toBe(e - 1);
    expect(s.water).toBe(19);
    expect(performAction(s, grass(5, 5)).ok).toBe(false); // already watered
    expect(performAction(s, pond(9, 9))).toMatchObject({ ok: true, kind: 'refill' });
    expect(s.water).toBe(20);
    expect(performAction(s, pond(9, 9)).ok).toBe(false); // already full
  });

  it('an empty can refuses', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    s.inventory.selected = 1;
    s.water = 0;
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
  });

  it('scythe clears weeds into fiber for 1 energy', () => {
    const s = newState();
    s.farm.weeds['5,5'] = true;
    s.inventory.selected = 2;
    expect(performAction(s, grass(5, 5))).toMatchObject({ ok: true, kind: 'clear' });
    expect(countItem(s, 'fiber')).toBe(1);
    expect(s.energy).toBe(99);
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
  });

  it('a mature crop is harvested whatever is equipped', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    equip(s, 'parsnip_seed');
    performAction(s, grass(5, 5));
    const crop = getSoil(s, 5, 5)!.crop!;
    crop.stage = 4;
    s.inventory.selected = 0;
    expect(performAction(s, grass(5, 5))).toMatchObject({
      ok: true,
      kind: 'harvest',
      item: 'parsnip',
    });
    expect(s.stats['harvested']).toBe(1);
  });

  it('out-of-season seeds are refused and kept', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    s.inventory.slots[4] = { item: 'tomato_seed', qty: 3 };
    s.inventory.selected = 4;
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
    expect(countItem(s, 'tomato_seed')).toBe(3);
  });
});
