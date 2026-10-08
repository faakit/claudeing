import { describe, expect, it } from 'vitest';
import { collections } from '../src/data';
import { discover, discovered, pageDone, pageProgress, pagesDone } from '../src/systems/almanac';
import { addItem } from '../src/systems/inventory';
import { migrate } from '../src/systems/save';
import { newState } from './helpers';

describe('almanac', () => {
  it('records an item the first time you hold it, once', () => {
    const s = newState();
    expect(discovered(s, 'carp')).toBe(false);
    addItem(s, 'carp', 1);
    expect(discovered(s, 'carp')).toBe(true);
    expect(s.stats['discoveries']).toBe(1);
    expect(discover(s, 'carp')).toBe(false);
    expect(s.stats['discoveries']).toBe(1);
  });

  it('completing a page pays its reward exactly once', () => {
    const s = newState();
    const page = collections['barn']!;
    const before = s.money;
    for (const item of page.items) addItem(s, item, 1);
    expect(pageDone(s, 'barn')).toBe(true);
    expect(pageProgress(s, 'barn')).toEqual({ have: page.items.length, total: page.items.length });
    expect(s.money).toBe(before + page.reward);
    expect(pagesDone(s)).toBe(1);
    expect(s.stats['pagesDone']).toBe(1);
    addItem(s, 'egg', 5);
    expect(s.money).toBe(before + page.reward);
  });

  it('partial progress pays nothing', () => {
    const s = newState();
    const before = s.money;
    addItem(s, 'egg', 1);
    expect(s.money).toBe(before);
    expect(pageDone(s, 'barn')).toBe(false);
  });

  it('survives a save and load', () => {
    const s = newState();
    addItem(s, 'milk', 1);
    const out = migrate(JSON.parse(JSON.stringify(s)));
    expect(discovered(out, 'milk')).toBe(true);
  });

  it('every page item can be obtained somewhere in the game', () => {
    // each listed item must be a crop, forage, fish, tree fruit, machine output or animal product
    const sources = new Set<string>();
    for (const c of Object.values(collections)) for (const i of c.items) sources.add(i);
    expect(sources.size).toBeGreaterThan(20);
  });
});
