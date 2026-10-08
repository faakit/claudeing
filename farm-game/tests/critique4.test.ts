import { afterEach, describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, goals, placeables } from '../src/data';
import { performAction } from '../src/systems/actions';
import { buyItem } from '../src/systems/economy';
import { maxEnergy } from '../src/systems/energy';
import { spawnWeeds } from '../src/systems/farming';
import { addItem, equipFromBag } from '../src/systems/inventory';
import { ARM_MS, interactWith, placeObject, setPickupClock } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { equip, grass, newState } from './helpers';

/** Fixes for critique 4 (agents/critiques/critique-4.md). */
describe('critique 4 fixes', () => {
  afterEach(() => setPickupClock(() => Date.now()));

  it('F1: max-energy perks survive a save and a load', () => {
    const s = newState();
    s.stats['project.bathhouse'] = 1; // the Hot Spring: +30
    s.energy = maxEnergy(s);
    expect(s.energy).toBe(game.baseEnergy + 30);
    expect(migrate(JSON.parse(JSON.stringify(s))).energy).toBe(game.baseEnergy + 30);
  });

  it('F2: the shop never sells more of a capped thing than can be placed', () => {
    const s = newState();
    s.money = 100000;
    expect(buyItem(s, 'town_general_store', 'garden_fountain', 1)).toBe('ok');
    expect(buyItem(s, 'town_general_store', 'garden_fountain', 1)).toBe('limit');
    expect(s.money).toBe(100000 - 12000);
    equip(s, 'garden_fountain');
    performAction(s, grass(4, 4));
    expect(buyItem(s, 'town_general_store', 'garden_fountain', 1)).toBe('limit'); // placed counts too
    expect(buyItem(s, 'town_general_store', 'fence', 5)).toBe('ok');
  });

  it('F4: moving one decoration about does not count toward the decoration goal', () => {
    const s = newState();
    addItem(s, 'stone_path', 1);
    for (let i = 0; i < 5; i++) {
      equip(s, 'stone_path');
      performAction(s, grass(4, 4));
      const obj = s.placed['farm']!.find((o) => o.type === 'stone_path')!;
      interactWith(s, obj);
      expect(interactWith(s, obj)).toEqual({ kind: 'pickup' });
      s.placed['farm'] = s.placed['farm']!.filter((o) => o !== obj);
      addItem(s, 'stone_path', 1);
    }
    expect(s.stats['decorPlaced']).toBe(1);
  });

  it('F8: a bag item goes to the hand in one tap', () => {
    const s = newState();
    s.inventory.slots[12] = { item: 'flower_pot', qty: 2 };
    s.inventory.selected = 0; // a tool: the pot takes a free hotbar slot
    expect(equipFromBag(s, 12)).toBe(true);
    const at = s.inventory.selected;
    expect(at).toBeLessThan(game.hotbarSlots);
    expect(at).toBeGreaterThanOrEqual(game.toolSlots);
    expect(s.inventory.slots[at]).toEqual({ item: 'flower_pot', qty: 2 });
    expect(equipFromBag(s, 1)).toBe(false); // a hotbar slot is already in hand
  });

  it('F9: "tap again to pick up" expires after a few seconds and is never saved', () => {
    let now = 1000;
    setPickupClock(() => now);
    const s = newState();
    const obj = placeObject(s, 'farm', 3, 3, 'fence');
    expect(interactWith(s, obj)).toMatchObject({ kind: 'message' });
    expect(obj.data['armedPick']).toBeUndefined();
    now += ARM_MS + 1;
    expect(interactWith(s, obj)).toMatchObject({ kind: 'message' }); // re-armed, not picked up
    now += 500;
    expect(interactWith(s, obj)).toEqual({ kind: 'pickup' });
  });

  it('F11: nothing is placed on a villager spot, and weeds never grow under placed things', () => {
    const s = newState();
    addItem(s, 'fence', 2);
    equip(s, 'fence');
    expect(performAction(s, grass(16, 12))).toMatchObject({ ok: false }); // Rosa's spot
    placeObject(s, 'farm', 5, 5, 'fence');
    for (let i = 0; i < 20; i++) spawnWeeds(s, [[5, 5]]);
    expect(s.farm.weeds['5,5']).toBeUndefined();
    expect(Object.values(placeables).every((p) => p.params['charm'] === undefined)).toBe(true);
  });

  it('F3: the order goal comes after the jar goals, and v12 saves stay on their goal', () => {
    const ids = goals.map((g) => g.id);
    expect(ids.indexOf('order')).toBeGreaterThan(ids.indexOf('preserve'));
    const v12 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v12['version'] = 12;
    v12['goalIndex'] = 11; // "craft" in the v12 chain
    expect(goals[migrate(v12).goalIndex]?.id).toBe('craft');
    v12['goalIndex'] = 10; // "order" in the v12 chain: still on it after the move
    expect(goals[migrate(v12).goalIndex]?.id).toBe('order');
  });
});

describe('F6: the morning summary keeps news over routine', () => {
  it('folds the every-day lines into one, after the news', async () => {
    const { arrangeNotes } = await import('../src/ui/panels/summaryNotes');
    expect(
      arrangeNotes([
        'Wild goods are growing in the woods.',
        'Fresh ore in the mine.',
        'New requests on the town board.',
        'Flower Show tomorrow!',
      ]),
    ).toEqual(['Flower Show tomorrow!', 'Fresh wild goods, ore and requests today.']);
    expect(arrangeNotes(['Fresh ore in the mine.'])).toEqual(['Fresh ore today.']);
    expect(arrangeNotes([])).toEqual([]);
  });
});
