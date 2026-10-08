import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { items, trees } from '../src/data';
import { performAction } from '../src/systems/actions';
import { addItem, countItem } from '../src/systems/inventory';
import { interactWith, placeObject, spriteOf, statusOf } from '../src/systems/placeables';
import { growTree, isGrown, pickFruit, treeOf } from '../src/systems/trees';
import { equip, grass, newState } from './helpers';

const grow = (obj: ReturnType<typeof placeObject>, days: number, season: string) => {
  for (let i = 0; i < days; i++) growTree(obj, season);
};

describe('fruit trees', () => {
  it('every tree bears a fruit that jars and kegs accept', () => {
    for (const t of Object.values(trees)) expect(items[t.fruit]?.family).toBe('fruit');
  });

  it('grows as a sapling for ten mornings, then is a tree', () => {
    const s = newState();
    const tree = placeObject(s, 'farm', 4, 4, 'cherry_sapling');
    expect(spriteOf(tree)).toBe('obj_sapling');
    expect(statusOf(tree)).toBe('busy');
    grow(tree, 9, 'spring');
    expect(isGrown(tree)).toBe(false);
    grow(tree, 1, 'spring');
    expect(isGrown(tree)).toBe(true);
    expect(spriteOf(tree)).toBe('obj_tree_cherry_sapling');
  });

  it('bears fruit every third morning, only in its season, up to its cap', () => {
    const s = newState();
    const tree = placeObject(s, 'farm', 4, 4, 'cherry_sapling');
    grow(tree, 10, 'winter'); // grown, but the wrong season
    expect(treeOf(tree).fruit).toBe(0);
    grow(tree, 2, 'spring');
    expect(treeOf(tree).fruit).toBe(1);
    expect(statusOf(tree)).toBe('ready');
    grow(tree, 40, 'spring');
    expect(treeOf(tree).fruit).toBe(trees['cherry_sapling']!.cap);
    grow(tree, 9, 'summer');
    expect(treeOf(tree).fruit).toBe(trees['cherry_sapling']!.cap); // nothing new out of season
  });

  it('picking fruit adds it with a quality roll and keeps the rest if the bag is full', () => {
    const s = newState();
    const tree = placeObject(s, 'farm', 4, 4, 'peach_sapling');
    grow(tree, 10, 'summer');
    grow(tree, 6, 'summer');
    expect(treeOf(tree).fruit).toBe(3);
    expect(pickFruit(s, tree)).toBe(3);
    expect(countItem(s, 'peach')).toBe(3);
    expect(treeOf(tree).fruit).toBe(0);
  });

  it('Interact explains a young tree, an off-season tree, and collects when ripe', () => {
    const s = newState();
    s.time.season = 'fall';
    const tree = placeObject(s, 'farm', 4, 4, 'apple_sapling');
    expect(interactWith(s, tree)).toMatchObject({
      kind: 'message',
      text: expect.stringContaining('growing'),
    });
    grow(tree, 10, 'fall');
    expect(interactWith(s, tree)).toMatchObject({
      kind: 'message',
      text: expect.stringContaining('No fruit'),
    });
    grow(tree, 2, 'fall');
    interactWith(s, tree);
    expect(countItem(s, 'apple')).toBe(1);
    s.time.season = 'spring';
    expect(interactWith(s, tree)).toMatchObject({
      text: expect.stringContaining('only bears fruit in fall'),
    });
  });

  it('is planted from the sapling item and limited to three per kind', () => {
    const s = newState();
    for (let i = 0; i < 3; i++) placeObject(s, 'farm', 3 + i, 3, 'plum_sapling');
    addItem(s, 'plum_sapling', 1);
    equip(s, 'plum_sapling');
    const res = performAction(s, grass(5, 8));
    expect(res.ok).toBe(false);
    expect(!res.ok && res.message).toMatch(/only have 3/);
  });

  it('repairs malformed tree data', () => {
    const s = newState();
    const tree = placeObject(s, 'farm', 4, 4, 'cherry_sapling');
    tree.data['tree'] = { age: 'x', timer: -5, fruit: 999 };
    expect(treeOf(tree)).toEqual({ age: 0, timer: 0, fruit: trees['cherry_sapling']!.cap });
  });
});
