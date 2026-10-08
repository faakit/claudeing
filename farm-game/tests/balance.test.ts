import { describe, expect, it } from 'vitest';
import {
  animals,
  crops,
  fish,
  forage,
  items,
  machines,
  orders as ordersCfg,
  placeables,
  recipes,
  tools,
} from '../src/data';
import { forageTable } from '../src/systems/forage';
import { sellValue } from '../src/systems/itemRef';
import { SEASONS } from '../src/state/GameState';
import { game } from '../src/data';

/**
 * Economy guard rails. These do not pin exact numbers; they stop a data edit from creating a runaway
 * money loop (a source that pays far more per effort than farming) or a dead one (never pays back).
 */
const price = (id: string): number => items[id]?.sellPrice ?? 0;

/** Gold per energy of the best crop: price / (till + water + plant energy). */
function bestCropGoldPerEnergy(): number {
  const perTile = tools['hoe']!.energyCost + tools['watering_can']!.energyCost * 4; // water ~4 days
  return Math.max(
    ...Object.values(crops).map((c) => (price(c.harvestItem) * c.harvestQuantity) / perTile),
  );
}

describe('balance guard rails', () => {
  it('fishing pays less per energy than the best crop, but is still worth doing', () => {
    const weighted = (map: string) => {
      const pool = fish.filter((f) => f.maps.includes(map));
      const total = pool.reduce((n, f) => n + f.weight, 0);
      return pool.reduce((n, f) => n + (f.weight / total) * price(f.item), 0);
    };
    const cost = tools['fishing_rod']!.energyCost;
    for (const map of ['farm', 'town', 'woods']) {
      const perEnergy = (0.7 * weighted(map)) / cost; // ~70% of fights are won
      expect(perEnergy, map).toBeLessThan(bestCropGoldPerEnergy());
      expect(perEnergy, map).toBeGreaterThan(2);
    }
  });

  it('the most a player could forage in a day stays modest', () => {
    for (const season of SEASONS) {
      let potential = 0;
      for (const [map, n] of Object.entries(forage.perDay)) {
        const table = forageTable(map, season);
        const total = table.reduce((s, e) => s + e.weight, 0);
        potential += n * table.reduce((s, e) => s + (e.weight / total) * price(e.item), 0);
      }
      expect(potential, season).toBeLessThan(300);
    }
  });

  it('animals pay back their cost in a sensible time', () => {
    for (const [id, a] of Object.entries(animals)) {
      const house = Object.entries(placeables).find(([, p]) => p.params['species'] === id)?.[0];
      const houseRecipe = house ? recipes[house] : undefined;
      const capital = (houseRecipe?.gold ?? 0) + a.capacity * (items[a.item]?.buyPrice ?? 0);
      const daily =
        a.capacity * a.perDay * price(a.product) - a.capacity * (items[a.feed]?.buyPrice ?? 0);
      expect(daily, id).toBeGreaterThan(0);
      const days = capital / daily;
      expect(days, `${id} payback ${days.toFixed(1)} days`).toBeGreaterThan(8);
      expect(days, `${id} payback ${days.toFixed(1)} days`).toBeLessThan(game.seasonLength * 1.5);
    }
  });

  it('processing beats raw selling but not wildly', () => {
    for (const [machine, m] of Object.entries(machines))
      for (const [id, def] of Object.entries(items)) {
        const out = def.family ? m.recipes[def.family] : undefined;
        if (!out) continue;
        const ratio = sellValue({ item: out, of: id }) / price(id);
        expect(ratio, `${machine}: ${id}`).toBeGreaterThan(1.3);
        expect(ratio, `${machine}: ${id}`).toBeLessThan(3.2);
      }
  });
});

describe('side income stays bounded', () => {
  it('jars, houses and orders together cannot outgrow the economy', () => {
    // Machines (jar, keg...): best gain per machine-day, times the cap.
    let jarPerDay = 0;
    for (const [id, m] of Object.entries(machines)) {
      const max = Number(placeables[id]?.params['max']);
      const gains = Object.entries(items).flatMap(([src, d]) => {
        const out = d.family ? m.recipes[d.family] : undefined;
        return out ? [sellValue({ item: out, of: src }) - price(src)] : [];
      });
      jarPerDay += (max * Math.max(...gains)) / m.days;
    }
    // Animal houses at their caps.
    let animalPerDay = 0;
    for (const [id, a] of Object.entries(animals)) {
      const house = Object.entries(placeables).find(([, p]) => p.params['species'] === id)?.[1];
      const max = Number(house?.params['max'] ?? 1);
      animalPerDay += max * a.capacity * (price(a.product) - (items[a.feed]?.buyPrice ?? 0));
    }
    // Orders: the premium over selling, at the cap.
    const orderPerDay = ordersCfg.perDay * Math.min(ordersCfg.maxReward, 600);
    expect(jarPerDay).toBeLessThan(650);
    expect(animalPerDay).toBeLessThan(900);
    expect(jarPerDay + animalPerDay + orderPerDay).toBeLessThan(3200);
    expect(ordersCfg.rewardMultiplier[1]).toBeLessThanOrEqual(1.7);
  });
});
