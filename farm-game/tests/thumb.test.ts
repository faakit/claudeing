import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { npcs, tips } from '../src/data';
import { performAction, type TileInfo } from '../src/systems/actions';
import { till, getSoil } from '../src/systems/farming';
import { giveGift, knownReaction, POINTS_PER_HEART } from '../src/systems/friendship';
import { addItem, countItem } from '../src/systems/inventory';
import { placeObject } from '../src/systems/placeables';
import { idleMachines, jarContents, loadAll } from '../src/systems/preserves';
import { measureText } from '../src/ui/fontMetrics';
import { giftSub, KNOWN_TEXT } from '../src/ui/panels/giftText';
import { SUMMARY_TIPS, summaryTip } from '../src/ui/panels/summaryTips';
import { equip, grass, newState } from './helpers';

/** A farm tile that knows its neighbours, so area actions (rows) can look along the line. */
const field = (tx: number, ty: number): TileInfo => ({
  ...grass(tx, ty),
  at: (x, y) => field(x, y),
});

describe('gifts are never blind twice', () => {
  it('a villager remembers how they took an item, and the list shows it next time', () => {
    const s = newState();
    const rosa = npcs['rosa']!;
    const loved = rosa.loves[0]!;
    expect(knownReaction(s, 'rosa', { item: loved })).toBeNull();
    addItem(s, loved, 2);
    expect(giveGift(s, 'rosa', { item: loved })).toMatchObject({ ok: true, reaction: 'love' });
    expect(knownReaction(s, 'rosa', { item: loved })).toBe('love');
    expect(knownReaction(s, 'mara', { item: loved })).toBeNull(); // per villager
    expect(knownReaction(s, 'rosa', { item: loved, q: 2 })).toBe('love'); // any quality
  });

  it('from 3 hearts every favourite is known without trying', () => {
    const s = newState();
    s.friends['finn'] = { points: 3 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    expect(knownReaction(s, 'finn', { item: npcs['finn']!.loves[1]! })).toBe('love');
    expect(knownReaction(s, 'finn', { item: 'stone' })).toBeNull();
  });

  it('the hint fits the gift row next to its Give button', () => {
    for (const r of [...Object.keys(KNOWN_TEXT), null] as (keyof typeof KNOWN_TEXT | null)[])
      expect(measureText(giftSub(99, r)), String(r)).toBeLessThanOrEqual(121);
  });
});

describe('plant a row', () => {
  it('seeds follow the hoe: a better hoe sows its whole row in one press', () => {
    const s = newState();
    s.upgrades.hoe = 2;
    s.player.facing = 'right';
    for (const x of [3, 4, 5, 6]) till(s, x, 3);
    equip(s, 'parsnip_seed');
    const before = countItem(s, 'parsnip_seed');
    expect(performAction(s, field(3, 3))).toMatchObject({ ok: true, kind: 'plant', count: 3 });
    expect([3, 4, 5].every((x) => getSoil(s, x, 3)?.crop)).toBe(true);
    expect(getSoil(s, 6, 3)?.crop).toBeNull(); // the row is three long at hoe level 2
    expect(countItem(s, 'parsnip_seed')).toBe(before - 3);
    expect(s.stats['planted']).toBe(3);
  });

  it('a basic hoe still plants one, and a row stops at untilled ground or the last seed', () => {
    const s = newState();
    s.player.facing = 'right';
    for (const x of [3, 4]) till(s, x, 3);
    equip(s, 'parsnip_seed');
    expect(performAction(s, field(3, 3))).toMatchObject({ ok: true, count: 1 });
    s.upgrades.hoe = 3;
    const slot = s.inventory.selected;
    s.inventory.slots[slot]!.qty = 1;
    till(s, 10, 3);
    till(s, 11, 3);
    expect(performAction(s, field(10, 3))).toMatchObject({ ok: true, count: 1 });
    expect(getSoil(s, 11, 3)?.crop).toBeNull();
  });
});

describe('load all machines', () => {
  it('fills every empty machine of the same kind on the map, as far as the stack goes', () => {
    const s = newState();
    for (const x of [1, 2, 3]) placeObject(s, 'farm', x, 1, 'preserve_jar');
    placeObject(s, 'farm', 4, 1, 'keg');
    addItem(s, 'tomato', 5);
    expect(idleMachines(s, 'farm', 'preserve_jar')).toHaveLength(3);
    expect(loadAll(s, 'farm', 'preserve_jar', { item: 'tomato' })).toBe(3);
    expect(countItem(s, 'tomato')).toBe(2);
    expect(idleMachines(s, 'farm', 'preserve_jar')).toHaveLength(0);
    expect(jarContents(s.placed['farm']![3]!)).toBeNull(); // the keg was not touched
    expect(loadAll(s, 'farm', 'preserve_jar', { item: 'tomato' })).toBe(0);
  });
});

describe('morning tips', () => {
  it('never talk about winter in spring', () => {
    for (let day = 1; day <= 28; day++)
      expect(summaryTip('spring', day, 1)).not.toMatch(/Winter has no wild crops/);
    expect(SUMMARY_TIPS.some((t) => summaryTip('fall', 1, 1) === t.text)).toBe(true);
  });

  it('fit three lines of the summary', () => {
    for (const t of SUMMARY_TIPS)
      expect(measureText(`Tip: ${t.text}`), t.text).toBeLessThan(184 * 3 - 30);
    expect(tips.length).toBeGreaterThan(0);
  });
});
