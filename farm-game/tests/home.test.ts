import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, goals, items, placeables, shops } from '../src/data';
import { performAction } from '../src/systems/actions';
import { buyItem, buyUpgrade, isShippable } from '../src/systems/economy';
import { isGiftable } from '../src/systems/friendship';
import { addItem, bagSize, countItem } from '../src/systems/inventory';
import { interactWith, placedAt } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { measureText } from '../src/ui/fontMetrics';
import { SHOP_TABS, shopFacts, shopTabOf } from '../src/ui/panels/shopFacts';
import { equip, grass, newState } from './helpers';

const bag = shops['town_general_store']!.upgrades.find((u) => u.id === 'bag')!;
const decorIds = Object.keys(placeables).filter((id) => placeables[id]!.behavior === 'decor');

describe('Bigger Bag', () => {
  it('each level adds a row of empty slots that new goods fill', () => {
    const s = newState();
    s.money = 10000;
    expect(s.inventory.slots).toHaveLength(game.inventorySlots);
    expect(buyUpgrade(s, bag)).toBe('ok');
    expect(s.inventory.slots).toHaveLength(game.inventorySlots + game.bagSlotsPerLevel);
    expect(bagSize(s)).toBe(s.inventory.slots.length);
    expect(s.stats['upgraded.bag']).toBe(1);
    // Fill the old bag, then the new row takes the rest.
    addItem(s, 'stone', 99 * 40);
    expect(s.inventory.slots.at(-1)?.item).toBe('stone');
  });

  it('the second level needs cloth, and the last level is the end', () => {
    const s = newState();
    s.money = 100000;
    buyUpgrade(s, bag);
    expect(buyUpgrade(s, bag)).toBe('no_items');
    expect(s.inventory.slots).toHaveLength(game.inventorySlots + 8);
    addItem(s, 'cloth', 3);
    expect(buyUpgrade(s, bag)).toBe('ok');
    expect(countItem(s, 'cloth')).toBe(0);
    expect(s.inventory.slots).toHaveLength(game.inventorySlots + 16);
    expect(buyUpgrade(s, bag)).toBe('maxed');
  });

  it('a bigger bag and what is in its new slots survive a save', () => {
    const s = newState();
    s.money = 5000;
    buyUpgrade(s, bag);
    s.inventory.slots[30] = { item: 'ruby', qty: 2 };
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.inventory.slots).toHaveLength(32);
    expect(back.inventory.slots[30]).toEqual({ item: 'ruby', qty: 2 });
  });

  it('v8 saves keep their slot count and their goal', () => {
    const v8 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v8['version'] = 8;
    delete (v8['upgrades'] as Record<string, unknown>)['bag'];
    v8['goalIndex'] = 24; // "jars" in the v8 chain
    const s = migrate(v8);
    expect(s.upgrades.bag).toBe(0);
    expect(s.inventory.slots).toHaveLength(game.inventorySlots);
    expect(goals[s.goalIndex]?.id).toBe('jars');
  });
});

describe('decorations', () => {
  it('are sold on the Home tab, cost gold, and are never shipped or gifted', () => {
    expect(decorIds.length).toBeGreaterThanOrEqual(5);
    for (const id of decorIds) {
      expect(shopTabOf(id), id).toBe('home');
      expect(items[id]?.buyPrice, id).toBeGreaterThan(0);
      expect(isShippable(id), id).toBe(false);
      expect(isGiftable({ item: id }), id).toBe(false);
    }
    // The priciest ones are a real late sink.
    const top = Math.max(
      ...decorIds.map((id) => items[id]!.buyPrice! * Number(placeables[id]!.params['max'])),
    );
    expect(top).toBeGreaterThanOrEqual(10000);
  });

  it('go on the hotbar when bought and are placed with Action, counting toward the goal', () => {
    const s = newState();
    s.money = 1000;
    expect(buyItem(s, 'town_general_store', 'fence', 5)).toBe('ok');
    const slot = s.inventory.slots.findIndex((x) => x?.item === 'fence');
    expect(slot).toBeLessThan(game.hotbarSlots);
    equip(s, 'fence');
    expect(performAction(s, grass(3, 3))).toMatchObject({ ok: true, kind: 'place' });
    expect(placedAt(s, 'farm', 3, 3)?.type).toBe('fence');
    expect(s.stats['decorPlaced']).toBe(1);
  });

  it('respect their limit', () => {
    const s = newState();
    addItem(s, 'garden_fountain', 2);
    equip(s, 'garden_fountain');
    expect(performAction(s, grass(3, 3)).ok).toBe(true);
    expect(performAction(s, grass(4, 3))).toMatchObject({ ok: false });
  });

  it('say their name on the first tap and come back to the bag on the second', () => {
    const s = newState();
    addItem(s, 'flower_pot', 1);
    equip(s, 'flower_pot');
    performAction(s, grass(5, 5));
    const obj = placedAt(s, 'farm', 5, 5)!;
    expect(interactWith(s, obj)).toEqual({
      kind: 'message',
      text: 'Flower Pot Tap again to pick up.',
    });
    expect(interactWith(s, obj)).toEqual({ kind: 'pickup' });
  });

  it('paths are flat and walkable; fences are solid', () => {
    expect(placeables['stone_path']?.solid).toBe(false);
    expect(placeables['stone_path']?.params['flat']).toBe(true);
    expect(placeables['fence']?.solid).toBe(true);
  });
});

describe('shop rows', () => {
  it('the four tab labels fit their buttons, and the buttons fit the sheet', () => {
    let w = 0;
    for (const [id, label, width] of SHOP_TABS) {
      expect(measureText(label), id).toBeLessThanOrEqual(width - 6);
      w += width + 2;
    }
    expect(w - 2).toBeLessThanOrEqual(184);
  });

  it('decoration facts fit the sub-line', () => {
    for (const id of decorIds)
      expect(measureText(shopFacts(id, 99, 1)), id).toBeLessThanOrEqual(110);
  });
});
