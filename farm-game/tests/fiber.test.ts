import { describe, expect, it } from 'vitest';
import { forage, game, items, mail, projects, recipes, reveal } from '../src/data';
import { performAction } from '../src/systems/actions';
import { bundleQty, collectForage, forageTable } from '../src/systems/forage';
import { addItem, countItem } from '../src/systems/inventory';
import { tileKey } from '../src/systems/farming';
import { FIBER_PER_WEED } from '../src/mechanics/farmingActions';
import { WEEDS_BEFORE_MAKE, weedsToday } from '../src/mechanics/dayCore';
import { startTutorial } from '../src/systems/tutorial';
import { migrate } from '../src/systems/save';
import { recipeNeedLine } from '../src/ui/panels/craftText';
import { TOOL_SLOTS, equip, grass, newState } from './helpers';

// QA round: "Tá muito difícil pegar fibra" (fiber is too hard to get); then the tutorial review: "fiber is now super
// easy to get". A bit of effort, never a wall.
describe('fiber takes a little gathering', () => {
  it('a cut weed gives one fiber', () => {
    const s = newState();
    s.farm.weeds[tileKey(5, 5)] = true;
    equip(s, 'scythe');
    const res = performAction(s, grass(5, 5));
    expect(res).toMatchObject({ ok: true, kind: 'clear', qty: FIBER_PER_WEED });
    expect(countItem(s, 'fiber')).toBe(1);
  });

  it('a guided game grows one weed a morning until Make arrives, then the usual four; other saves always four', () => {
    const s = newState();
    startTutorial(s, { on: true, gift: false });
    expect(weedsToday(s)).toBe(WEEDS_BEFORE_MAKE);
    s.stats['reveal.crafting'] = 7;
    expect(weedsToday(s)).toBe(game.weedsPerDay);
    expect(weedsToday(newState())).toBe(game.weedsPerDay); // an old save, a sim
  });

  it('fiber never piles up before Make: under 20 by the morning it arrives, gathering everything', () => {
    // Make's latest morning is its day; until then every weed grown is cut and every bundle found picked up
    const make = reveal.features.find((f) => f.id === 'crafting')!.day!;
    let wildPerDay = 0;
    for (const map of ['farm', 'town', 'woods'] as const) {
      const table = forageTable(map, 'spring');
      const f = table.find((e) => e.item === 'fiber')!;
      wildPerDay += forage.perDay[map]! * (f.weight / table.reduce((a, e) => a + e.weight, 0)) * 2;
    }
    const before = (make - 2) * (WEEDS_BEFORE_MAKE * FIBER_PER_WEED + wildPerDay);
    expect(before).toBeLessThan(20);
    // Orin's letter on that morning brings 5, Mara sells it at 10
    expect(mail.letters.find((l) => l.id === 'reveal_crafting')?.gift).toEqual({
      item: 'fiber',
      qty: 5,
    });
    expect(items['fiber']?.buyPrice).toBeGreaterThanOrEqual(10);
  });

  it('with room for one, a weed gives one and is still cut', () => {
    const s = newState();
    // every slot past the tools full of melons, but one holding 98 fiber
    s.inventory.slots = s.inventory.slots.map((st, i) =>
      i < TOOL_SLOTS
        ? st
        : { item: i === TOOL_SLOTS ? 'fiber' : 'melon', qty: i === TOOL_SLOTS ? 98 : 99 },
    );
    s.farm.weeds[tileKey(5, 5)] = true;
    equip(s, 'scythe');
    expect(performAction(s, grass(5, 5)).ok).toBe(true);
    expect(countItem(s, 'fiber')).toBe(99);
    expect(s.farm.weeds[tileKey(5, 5)]).toBeUndefined();
  });

  it('dry grass bundles lie in the wild every season, on the farm, in town and in the woods, now and then', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const)
      for (const map of ['farm', 'town', 'woods']) {
        const table = forageTable(map, season);
        expect(table.map((e) => e.item)).toContain('fiber');
        // a bundle is a rare find: one wild good in five (winter) to eleven (the spring woods)
        const w = (e: { weight: number }) => e.weight;
        const share =
          w(table.find((e) => e.item === 'fiber')!) / table.reduce((a, e) => a + w(e), 0);
        expect(share).toBeLessThanOrEqual(0.2);
      }
    expect(bundleQty('fiber')).toBe(2);
    expect(bundleQty('wild_leek')).toBeNull();
  });

  it('once Make is open: a bait mix in a morning, a sprinkler in about two days, a coop in three or four', () => {
    // the farm's weeds (4 a morning), every wild good on the farm, in town and in the woods (spring): expected fiber
    const perDay = game.weedsPerDay * FIBER_PER_WEED;
    let wild = 0;
    for (const map of ['farm', 'town', 'woods'] as const) {
      const table = forageTable(map, 'spring');
      const total = table.reduce((a, e) => a + e.weight, 0);
      const f = table.find((e) => e.item === 'fiber')!;
      wild += forage.perDay[map]! * (f.weight / total) * (bundleQty(f.item) ?? 1);
    }
    const day = perDay + wild;
    expect(day).toBeGreaterThan(5);
    expect(day).toBeLessThan(9);
    // what the first weeks ask, in about a day: bait mix, chum, glow grub, fertilizer, speed-gro, rich fertilizer
    for (const id of ['bait', 'chum', 'glow_grub', 'fertilizer', 'speed_gro', 'rich_fertilizer']) {
      const need = recipes[id]!.ingredients.find((i) => i.item === 'fiber')!.qty;
      expect(need, id).toBeLessThanOrEqual(day * 1.25); // a day, a little more for fertilizer (6)
    }
    const days = (id: string) =>
      recipes[id]!.ingredients.find((i) => i.item === 'fiber')!.qty / day;
    expect(days('bait')).toBeLessThanOrEqual(0.6); // a morning
    // the machines take about two days of it (or Mara's shelf): effort, not a wall
    for (const id of ['sprinkler', 'preserve_jar']) {
      expect(days(id), id).toBeGreaterThan(1.5);
      expect(days(id), id).toBeLessThan(2.5);
    }
    expect(days('coop')).toBeGreaterThanOrEqual(3);
    expect(days('coop')).toBeLessThanOrEqual(4);
  });

  it('a bundle gives two fiber, no quality, and counts as one pickup', () => {
    const s = newState();
    s.forage['woods'] = { [tileKey(5, 5)]: 'fiber' };
    const res = performAction(s, { ...grass(5, 5), map: 'woods', farmland: false });
    expect(res).toMatchObject({ ok: true, kind: 'forage', item: 'fiber', qty: 2 });
    expect(countItem(s, 'fiber')).toBe(2);
    expect(s.stats['foraged']).toBe(1);
    expect(s.inventory.slots.some((st) => st?.item === 'fiber' && st.q)).toBe(false);
  });

  it('a bundle never fills past the bag and still draws the same random numbers as a wild good', () => {
    const a = newState();
    const b = newState();
    a.forage['farm'] = { [tileKey(1, 1)]: 'fiber' };
    b.forage['farm'] = { [tileKey(1, 1)]: 'wild_leek' };
    collectForage(a, 'farm', 1, 1);
    collectForage(b, 'farm', 1, 1);
    expect(a.rng).toBe(b.rng);
  });

  it('a bundle on the ground survives a save and load', () => {
    const s = newState();
    s.forage['woods'] = { [tileKey(5, 5)]: 'fiber' };
    expect(migrate(JSON.parse(JSON.stringify(s))).forage['woods']).toEqual({ '5,5': 'fiber' });
  });

  it('only a material can be a bundle, and every bundle has a qty', () => {
    for (const e of forage.table)
      if (items[e.item]?.type === 'material') expect(e.qty).toBeGreaterThanOrEqual(1);
      else expect(e.qty).toBeUndefined();
  });

  it('every recipe, project and site that asks for fiber can say where it comes from', () => {
    expect(items['fiber']?.source).toMatch(/weeds/);
    const asks = [
      ...Object.values(recipes).flatMap((r) => r.ingredients.map((i) => i.item)),
      ...Object.values(projects).flatMap((p) => (p.items ?? []).map((i) => i.item)),
    ];
    expect(asks).toContain('fiber');
    for (const id of new Set(asks)) if (id === 'fiber') expect(items[id]?.source).toBeTruthy();
  });

  it('a recipe short of fiber names the source on its row; with enough it shows the plain list', () => {
    const s = newState();
    const bait = recipes['bait']!;
    expect(recipeNeedLine(s, bait)).toMatch(/3 Fiber: cut weeds, or at Mara's/);
    addItem(s, 'fiber', 3);
    expect(recipeNeedLine(s, bait)).toBe('3 Fiber');
  });
});
