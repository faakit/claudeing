import { describe, expect, it } from 'vitest';
import { items, shops } from '../src/data';
import {
  buyItem,
  buyUpgrade,
  shipItem,
  shippingValue,
  stockFor,
  unshipItem,
} from '../src/systems/economy';
import { addItem, countItem } from '../src/systems/inventory';
import { FULL_INVENTORY, newState, TOOL_SLOTS } from './helpers';

const STORE = 'town_general_store';

describe('economy', () => {
  it('stock is filtered by season', () => {
    expect(stockFor(STORE, 'spring')).toContain('parsnip_seed');
    expect(stockFor(STORE, 'spring')).not.toContain('tomato_seed');
    expect(stockFor(STORE, 'winter').filter((id) => items[id]?.type === 'seed')).toEqual([
      'kale_seed',
    ]);
  });

  it('buys with exact gold, never below zero', () => {
    const s = newState();
    s.money = 40;
    expect(buyItem(s, STORE, 'parsnip_seed', 2)).toBe('ok');
    expect(s.money).toBe(0);
    expect(buyItem(s, STORE, 'parsnip_seed', 1)).toBe('no_money');
    expect(s.money).toBe(0);
  });

  it('refuses out-of-season and unknown items', () => {
    const s = newState();
    expect(buyItem(s, STORE, 'tomato_seed', 1)).toBe('out_of_season');
    expect(buyItem(s, STORE, 'hoe', 1)).toBe('unknown');
    expect(s.money).toBe(500);
  });

  it('a full inventory blocks a purchase without charging', () => {
    const s = newState();
    addItem(s, 'melon', FULL_INVENTORY);
    s.inventory.slots[TOOL_SLOTS] = { item: 'melon', qty: 99 };
    expect(buyItem(s, STORE, 'potato_seed', 1)).toBe('full');
    expect(s.money).toBe(500);
  });

  it('ships items, values the bin, and can take them back', () => {
    const s = newState();
    addItem(s, 'parsnip', 10);
    expect(shipItem(s, 'parsnip', 4)).toBe(4);
    expect(shippingValue(s)).toBe(4 * 35);
    expect(countItem(s, 'parsnip')).toBe(6);
    expect(unshipItem(s, 'parsnip', 3)).toBe(3);
    expect(shippingValue(s)).toBe(35);
    expect(s.stats['shipped']).toBe(1);
  });

  it('tools cannot be shipped and shipping more than owned caps', () => {
    const s = newState();
    expect(shipItem(s, 'hoe', 1)).toBe(0);
    expect(shipItem(s, 'parsnip_seed', 99)).toBe(10);
  });

  it('upgrades cost gold, raise capacity, and max out', () => {
    const s = newState();
    const can = shops[STORE]!.upgrades.find((u) => u.id === 'can')!;
    s.money = 10000;
    addItem(s, { item: 'copper_bar', of: 'copper_ore' }, 10);
    addItem(s, { item: 'iron_bar', of: 'iron_ore' }, 10);
    expect(buyUpgrade(s, can)).toBe('ok');
    expect(s.water).toBe(40);
    expect(buyUpgrade(s, can)).toBe('ok');
    expect(buyUpgrade(s, can)).toBe('ok');
    expect(s.water).toBe(100);
    expect(buyUpgrade(s, can)).toBe('maxed');
    s.money = 0;
    const stamina = shops[STORE]!.upgrades.find((u) => u.id === 'stamina')!;
    expect(buyUpgrade(s, stamina)).toBe('no_money');
  });
});
