import { describe, expect, it } from 'vitest';
import { forage, items, skills } from '../src/data';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import {
  clearForage,
  collectForage,
  forageAt,
  forageCount,
  forageTable,
  spawnForage,
} from '../src/systems/forage';
import { addItem, countItem } from '../src/systems/inventory';
import { placeObject } from '../src/systems/placeables';
import { tileKey } from '../src/systems/farming';
import { FULL_INVENTORY, grass, newState } from './helpers';

const grid = (x0: number, y0: number, w: number, h: number): [number, number][] =>
  Array.from({ length: w * h }, (_, i) => [x0 + (i % w), y0 + Math.floor(i / w)]);
const SPOTS = { farm: grid(0, 0, 10, 10), town: grid(0, 0, 10, 10), woods: grid(0, 0, 10, 10) };

describe('forage spawning', () => {
  it('only in-season items for that map appear', () => {
    const s = newState();
    spawnForage(s, SPOTS);
    for (const [map, tiles] of Object.entries(s.forage)) {
      const allowed = forageTable(map, 'spring').map((e) => e.item);
      for (const item of Object.values(tiles)) expect(allowed).toContain(item);
    }
    expect(forageTable('woods', 'summer').map((e) => e.item)).toContain('mushroom');
    expect(forageTable('farm', 'summer').map((e) => e.item)).not.toContain('mushroom');
  });

  it('spawns the configured number per map and respects the per-map cap', () => {
    const s = newState();
    const first = spawnForage(s, SPOTS);
    expect(first['woods']).toBe(forage.perDay['woods']);
    for (let i = 0; i < 30; i++) spawnForage(s, SPOTS);
    for (const map of Object.keys(forage.cap))
      expect(forageCount(s, map)).toBeLessThanOrEqual(forage.cap[map]!);
  });

  it('never lands on tilled soil, weeds, placed objects, or other forage', () => {
    const s = newState();
    const spots: [number, number][] = [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ];
    s.farm.tiles[tileKey(1, 1)] = { watered: false, crop: null };
    s.farm.weeds[tileKey(2, 1)] = true;
    placeObject(s, 'farm', 3, 1, 'sprinkler');
    s.forage['farm'] = { [tileKey(4, 1)]: 'daffodil' };
    spawnForage(s, { farm: spots });
    expect(Object.keys(s.forage['farm']!)).toEqual([tileKey(4, 1)]);
  });

  it('wilts when the season turns and is replaced by the new season’s goods', () => {
    const s = newState();
    spawnForage(s, SPOTS);
    s.time.day = 28;
    endDay(s, { passedOut: false, weedCandidates: [], forageSpots: SPOTS });
    expect(s.time.season).toBe('summer');
    const allowed = forageTable('woods', 'summer').map((e) => e.item);
    for (const item of Object.values(s.forage['woods'] ?? {})) expect(allowed).toContain(item);
  });

  it('a normal night adds goods and mentions it in the morning summary', () => {
    const s = newState();
    const sum = endDay(s, { passedOut: false, weedCandidates: [], forageSpots: SPOTS });
    expect(forageCount(s, 'woods')).toBeGreaterThan(0);
    expect(sum.notes?.join(' ')).toMatch(/Wild goods/);
  });

  it('clearForage empties everything', () => {
    const s = newState();
    spawnForage(s, SPOTS);
    clearForage(s);
    expect(s.forage).toEqual({});
  });
});

describe('collecting forage', () => {
  it('Action on a forageable picks it up whatever is equipped, and grants foraging XP', () => {
    const s = newState();
    s.forage['farm'] = { [tileKey(5, 5)]: 'wild_leek' };
    const res = performAction(s, grass(5, 5));
    expect(res).toMatchObject({ ok: true, kind: 'forage', item: 'wild_leek' });
    expect(countItem(s, 'wild_leek')).toBeGreaterThanOrEqual(1);
    expect(forageAt(s, 'farm', 5, 5)).toBeUndefined();
    expect(s.skills['foraging']).toBeGreaterThan(0);
    expect(s.stats['foraged']).toBeGreaterThanOrEqual(1);
  });

  it('works on any map, using that map’s own list', () => {
    const s = newState();
    s.forage['woods'] = { [tileKey(5, 5)]: 'mushroom' };
    expect(performAction(s, { ...grass(5, 5), map: 'woods', farmland: false }).ok).toBe(true);
    s.forage['town'] = { [tileKey(5, 5)]: 'daffodil' };
    performAction(s, { ...grass(5, 5), map: 'farm' }); // falls through to the hoe, not a forage pick
    expect(forageAt(s, 'town', 5, 5)).toBe('daffodil'); // the town's daffodil is not on the farm
  });

  it('a full inventory refuses and leaves the item on the ground', () => {
    const s = newState();
    addItem(s, 'melon', FULL_INVENTORY);
    s.forage['farm'] = { [tileKey(5, 5)]: 'wild_leek' };
    expect(performAction(s, grass(5, 5)).ok).toBe(false);
    expect(forageAt(s, 'farm', 5, 5)).toBe('wild_leek');
  });

  it('the foraging perk sometimes doubles a pick', () => {
    const s = newState();
    s.skills['foraging'] = skills['foraging']!.xpTable[8]!; // level 9: 40% double
    let doubles = 0;
    for (let i = 0; i < 200; i++) {
      s.forage['farm'] = { [tileKey(5, 5)]: 'wild_leek' };
      const res = collectForage(s, 'farm', 5, 5);
      if (res.ok && res.qty === 2) doubles++;
    }
    expect(doubles).toBeGreaterThan(40);
    expect(doubles).toBeLessThan(120);
  });

  it('collecting from an empty tile reports none', () => {
    expect(collectForage(newState(), 'farm', 1, 1)).toEqual({ ok: false, reason: 'none' });
  });

  it('all forage items exist with sensible prices', () => {
    for (const e of forage.table) expect(items[e.item]!.sellPrice).toBeGreaterThan(0);
  });
});
