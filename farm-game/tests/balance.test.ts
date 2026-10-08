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
  projects,
  recipes,
  trees,
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
    // Town projects (the board canopy) may post extra requests; count them all.
    const extraOrders = Object.values(projects).reduce(
      (n, p) => n + (p.perks['orderSlots'] ?? 0),
      0,
    );
    expect(extraOrders).toBeLessThanOrEqual(1);
    const orderPerDay = (ordersCfg.perDay + extraOrders) * Math.min(ordersCfg.maxReward, 600);
    expect(jarPerDay).toBeLessThan(900);
    // 1,200 (was 1,000 before pigs): one sty of two pigs adds 220 a day at most, and pigs only dig on
    // dry days outside winter, so the real average is well under this bound.
    expect(animalPerDay).toBeLessThan(1200);
    // 4,600 (3,800 before the board canopy's 4th order, 4,400 before pigs): this bound counts whole order
    // rewards, not the premium over the bin, so one more order moves it by up to 600 without a money loop.
    expect(jarPerDay + animalPerDay + orderPerDay).toBeLessThan(4600);
    expect(ordersCfg.rewardMultiplier[1]).toBeLessThanOrEqual(1.7);
  });
});

describe('fruit trees', () => {
  it('one season of trees stays a modest income and the sapling pays back within a season', () => {
    for (const [id, t] of Object.entries(trees)) {
      const perTree = Math.floor(game.seasonLength / t.every) * price(t.fruit);
      const max = Number(placeables[id]?.params['max']);
      expect(perTree * max, id).toBeLessThan(3600);
      const days = (items[id]?.buyPrice ?? 0) / (price(t.fruit) / t.every);
      expect(days, `${id} payback ${days.toFixed(0)} days`).toBeLessThan(game.seasonLength * 1.2);
      expect(days, id).toBeGreaterThan(8);
    }
  });
});

describe('town projects', () => {
  it('are sinks first: a money perk takes a long time to pay its project back', () => {
    // A late-game player earns about 6,500 gold a day (critique 2's estimate for year two).
    const lateIncome = 6500;
    for (const [id, p] of Object.entries(projects)) {
      const perDay = (p.perks['sellBonus'] ?? 0) * lateIncome;
      // 80 days (was 100): critique 4 found the 5% Market Road took about 1M gold of shipping to pay back,
      // so it is now 10% at 60,000g; still more than three seasons of late-game income.
      if (perDay > 0) expect(p.gold / perDay, id).toBeGreaterThan(80);
      // No project hands out gold directly.
      expect(
        Object.keys(p.perks).some((k) => /gold|money/i.test(k)),
        id,
      ).toBe(false);
    }
  });

  it('cost more as the chain goes on, so late gold has somewhere to go', () => {
    // A repeatable sink starts lower than the project before it, then grows each level.
    for (const p of Object.values(projects))
      if (p.after && !p.repeat) expect(p.gold, p.name).toBeGreaterThan(projects[p.after]!.gold);
  });
});
