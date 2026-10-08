import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, goals } from '../src/data';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { isShippable } from '../src/systems/economy';
import { addItem } from '../src/systems/inventory';
import { interactWith, placeObject, canPickUp } from '../src/systems/placeables';
import { addXp } from '../src/systems/skills';
import { tillAndPlant } from './critique-helpers';
import { equip, grass, newState } from './helpers';

describe('first-week pacing', () => {
  it('forage and shopping come before the harvest goal, so days 2 to 4 have a purpose', () => {
    const ids = goals.map((g) => g.id);
    expect(ids.indexOf('forage')).toBeLessThan(ids.indexOf('harvest'));
    expect(ids.indexOf('buy')).toBeLessThan(ids.indexOf('harvest'));
  });
});

describe('planting guard', () => {
  it('refuses a seed that cannot ripen before the season ends', () => {
    const s = newState();
    s.time.day = 26; // parsnip needs 4 days
    const res = tillAndPlant(s, 'parsnip_seed');
    expect(res).toMatchObject({ ok: false });
    expect(!res.ok && res.message).toMatch(/ripen/);
  });
  it('still plants when there is time', () => {
    const s = newState();
    s.time.day = 20;
    expect(tillAndPlant(s, 'parsnip_seed').ok).toBe(true);
  });
});

describe('hotbar rules', () => {
  it('produce lands in the bag and keeps hotbar slots for seeds and machines', () => {
    const s = newState();
    addItem(s, 'tomato', 3);
    addItem(s, 'sprinkler', 1);
    const where = (id: string) => s.inventory.slots.findIndex((x) => x?.item === id);
    expect(where('tomato')).toBeGreaterThanOrEqual(game.hotbarSlots);
    expect(where('sprinkler')).toBeLessThan(game.hotbarSlots);
  });
  it('overflows into the other region when one is full', () => {
    const s = newState();
    for (let i = 0; i < game.inventorySlots; i++)
      addItem(
        s,
        `${['parsnip', 'potato', 'melon', 'corn', 'yam', 'tomato', 'pumpkin', 'cauliflower', 'fiber', 'egg', 'milk', 'carp', 'perch', 'trout', 'salmon', 'catfish', 'bluegill', 'jam', 'pickles', 'daffodil', 'holly', 'mushroom', 'wild_berry', 'blackberry'][i % 24]}`,
        1,
      );
    expect(s.inventory.slots.filter(Boolean).length).toBeGreaterThan(game.hotbarSlots);
  });
});

describe('placeable limits and mistakes', () => {
  it('limits jars and houses', () => {
    const s = newState();
    for (let i = 0; i < 6; i++) placeObject(s, 'farm', 3 + i, 3, 'preserve_jar');
    addItem(s, 'preserve_jar', 1);
    equip(s, 'preserve_jar');
    const res = performAction(s, grass(5, 8));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(/only have 6/);
  });
  it('an empty coop is picked up on a second deliberate tap', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    expect(interactWith(s, coop).kind).toBe('message');
    expect(interactWith(s, coop).kind).toBe('pickup');
    expect(canPickUp(coop)).toBe(true);
  });
  it('a coop with chickens is never picked up', () => {
    const s = newState();
    const coop = placeObject(s, 'farm', 4, 4, 'coop');
    addItem(s, 'chicken', 1);
    interactWith(s, coop);
    expect(canPickUp(coop)).toBe(false);
  });
  it('the bin does not take machines', () => {
    expect(isShippable({ item: 'coop' })).toBe(false);
    expect(isShippable({ item: 'preserve_jar' })).toBe(false);
    expect(isShippable({ item: 'parsnip' })).toBe(true);
  });
});

describe('perks that promise something do it', () => {
  it('the farming level 10 sell bonus raises the payout', () => {
    const plain = newState();
    plain.shipping['parsnip|0|'] = 10;
    const base = endDay(plain, { passedOut: false, weedCandidates: [] }).total;
    const pro = newState();
    addXp(pro, 'farming', 99999);
    pro.shipping['parsnip|0|'] = 10;
    const boosted = endDay(pro, { passedOut: false, weedCandidates: [] }).total;
    expect(boosted).toBe(Math.round(base * 1.05));
  });
});
