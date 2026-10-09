import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items, recipes, shops } from '../src/data';
import { performAction } from '../src/systems/actions';
import { craft, craftBlock } from '../src/systems/crafting';
import { buyUpgrade } from '../src/systems/economy';
import { maxEnergy } from '../src/systems/energy';
import { eat, tiredText } from '../src/systems/food';
import { addItem, countItem } from '../src/systems/inventory';
import { migrate } from '../src/systems/save';
import { hasKitchen } from '../src/systems/skills';
import { measureText } from '../src/ui/fontMetrics';
import { lockedText } from '../src/ui/panels/craftText';
import { equip, grass, newState } from './helpers';

const kitchen = shops['town_general_store']!.upgrades.find((u) => u.id === 'kitchen')!;
const dishes = Object.entries(recipes).filter(([, r]) => r.kitchen);

describe('the kitchen and cooking (a Home upgrade)', () => {
  it('dishes are locked until the kitchen is bought, and the kitchen survives a save', () => {
    const s = newState();
    addItem(s, 'parsnip', 2);
    expect(craftBlock(s, 'parsnip_soup')).toBe('locked');
    expect(lockedText(s, recipes['parsnip_soup']!)).toMatch(/kitchen/);
    s.money = 5000;
    expect(buyUpgrade(s, kitchen)).toBe('ok');
    expect(hasKitchen(s)).toBe(true);
    expect(buyUpgrade(s, kitchen)).toBe('maxed');
    expect(hasKitchen(migrate(JSON.parse(JSON.stringify(s))))).toBe(true);
    expect(craft(s, 'parsnip_soup')).toBe('ok');
    expect(countItem(s, 'parsnip_soup')).toBe(1);
    expect(s.stats['cooked']).toBe(1);
  });

  it('eating gives energy back, never past the maximum, and a full player keeps the dish', () => {
    const s = newState();
    addItem(s, 'baked_potato', 2);
    const slot = s.inventory.slots.findIndex((x) => x?.item === 'baked_potato');
    s.energy = maxEnergy(s);
    expect(eat(s, slot)).toBe('full');
    expect(countItem(s, 'baked_potato')).toBe(2);
    s.energy = maxEnergy(s) - 10; // only a quarter of a 40-energy dish would count: kept
    expect(eat(s, slot)).toBe('full');
    expect(tiredText(s)).toMatch(/Eat something/);
    s.energy = maxEnergy(s) - 25;
    expect(eat(s, slot)).toBe('ok');
    expect(s.energy).toBe(maxEnergy(s));
    expect(countItem(s, 'baked_potato')).toBe(1);
    // With a dish in hand, Action eats it.
    s.energy = 20;
    s.inventory.slots[7] = { item: 'baked_potato', qty: 1 };
    equip(s, 'baked_potato');
    expect(performAction(s, grass(4, 4))).toMatchObject({ ok: true, kind: 'eat' });
    expect(s.energy).toBe(20 + items['baked_potato']!.energy!);
  });

  it('cooking is energy, not a money machine: a dish sells for at most 15% over its ingredients', () => {
    for (const [id, r] of dishes) {
      const cost = r.ingredients.reduce((n, i) => n + (items[i.item]?.sellPrice ?? 0) * i.qty, 0);
      const sell = items[r.output.item]!.sellPrice!;
      expect(sell, id).toBeLessThanOrEqual(cost * 1.15);
      expect(sell, id).toBeGreaterThanOrEqual(cost);
      expect(items[r.output.item]!.energy!, id).toBeGreaterThan(0);
    }
  });

  it('every dish line fits the workbench and the bag card', () => {
    const s = newState();
    for (const [id, r] of dishes) {
      expect(measureText(lockedText(s, r)), id).toBeLessThanOrEqual(200 - 8 - 28 - 41 - 2);
      expect(measureText(items[id]!.description), id).toBeLessThanOrEqual(184 * 2);
      expect(measureText(`Eat +${items[id]!.energy}`)).toBeLessThanOrEqual(78);
    }
  });
});

it('a dish row with Make and x5 still shows its ingredients whole', async () => {
  const { recipeNeed } = await import('../src/ui/panels/craftText');
  for (const [id, r] of dishes)
    expect(measureText(recipeNeed(r)), id).toBeLessThanOrEqual(200 - 8 - 28 - 41 - 27 - 2);
});

it('batch cooking uses plain ingredients only and says how many it made (critique 8, F7)', async () => {
  const { craftBatch, plainBatch } = await import('../src/systems/crafting');
  const s = newState();
  s.stats['upgraded.kitchen'] = 1;
  addItem(s, 'potato', 7);
  addItem(s, { item: 'potato', q: 2 }, 3);
  expect(plainBatch(s, 'baked_potato', 5)).toBe(3);
  expect(craftBatch(s, 'baked_potato', 5)).toBe(3);
  expect(countItem(s, 'baked_potato')).toBe(3);
  expect(countItem(s, 'potato')).toBe(4); // the gold ones and one plain are left
});
