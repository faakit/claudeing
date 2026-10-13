import { describe, expect, it } from 'vitest';
import { forage, items, projects, recipes } from '../src/data';
import { performAction } from '../src/systems/actions';
import { bundleQty, collectForage, forageTable } from '../src/systems/forage';
import { addItem, countItem } from '../src/systems/inventory';
import { tileKey } from '../src/systems/farming';
import { FIBER_PER_WEED } from '../src/mechanics/farmingActions';
import { migrate } from '../src/systems/save';
import { recipeNeedLine } from '../src/ui/panels/craftText';
import { TOOL_SLOTS, equip, grass, newState } from './helpers';

// QA round: "Tá muito difícil pegar fibra" (fiber is too hard to get).
describe('fiber is easy to find', () => {
  it('a cut weed gives two fiber', () => {
    const s = newState();
    s.farm.weeds[tileKey(5, 5)] = true;
    equip(s, 'scythe');
    const res = performAction(s, grass(5, 5));
    expect(res).toMatchObject({ ok: true, kind: 'clear', qty: FIBER_PER_WEED });
    expect(countItem(s, 'fiber')).toBe(2);
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

  it('dry grass bundles lie in the wild every season, on the farm, in town and in the woods', () => {
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const)
      for (const map of ['farm', 'town', 'woods'])
        expect(forageTable(map, season).map((e) => e.item)).toContain('fiber');
    expect(bundleQty('fiber')).toBe(3);
    expect(bundleQty('wild_leek')).toBeNull();
  });

  it('a bundle gives three fiber, no quality, and counts as one pickup', () => {
    const s = newState();
    s.forage['woods'] = { [tileKey(5, 5)]: 'fiber' };
    const res = performAction(s, { ...grass(5, 5), map: 'woods', farmland: false });
    expect(res).toMatchObject({ ok: true, kind: 'forage', item: 'fiber', qty: 3 });
    expect(countItem(s, 'fiber')).toBe(3);
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
