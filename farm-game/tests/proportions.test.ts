import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import { fadeTiles } from '../src/art/mapLayers';
import { artKeys } from '../src/art/registry';
import { spriteOf } from '../src/systems/placeables';
import '../src/mechanics';

type Layer = {
  name: string;
  data?: number[];
  objects?: { type: string; x: number; y: number; width: number; height: number }[];
};
const map = (id: string) =>
  JSON.parse(readFileSync(`public/assets/maps/${id}.tmj`, 'utf8')) as {
    width: number;
    height: number;
    layers: Layer[];
  };

describe('proportions (art round 3, review 8)', () => {
  it('fades the overhead layer about 24 px around the player and around the target tile', () => {
    const t = new Set(fadeTiles(10, 10, { tx: 10, ty: 12 }).map(([x, y]) => `${x},${y}`));
    for (const k of ['8,10', '12,10', '10,7', '9,8', '10,11']) expect(t.has(k), k).toBe(true);
    for (const k of ['9,13', '11,13', '10,13']) expect(t.has(k), `target ${k}`).toBe(true);
    expect(t.has('8,7')).toBe(false); // the far corners stay
    expect(t.has('10,14')).toBe(false);
  });

  it('never bakes an overhanging crown over a forage zone or a door', () => {
    for (const id of ['farm', 'town', 'woods']) {
      const m = map(id);
      const over = m.layers.find((l) => l.name === 'overhead')!.data!;
      const objs = m.layers.find((l) => l.name === 'objects')!.objects!;
      for (const o of objs) {
        if (o.type !== 'forage' && o.type !== 'door') continue;
        for (let y = o.y / 16; y < (o.y + o.height) / 16; y++)
          for (let x = o.x / 16; x < (o.x + o.width) / 16; x++)
            if (o.type === 'forage')
              expect(over[y * m.width + x], `${id} ${o.type} ${x},${y}`).toBe(0);
      }
    }
  });

  it('shows a young fruit tree growing through three stages, then the grown tree', () => {
    for (const k of ['obj_sapling_2', 'obj_sapling_3']) artKeys.add(k);
    const tree = (age: number) =>
      ({
        id: 1,
        type: 'apple_sapling',
        tx: 0,
        ty: 0,
        data: { tree: { age, timer: 0, fruit: 0 } },
      }) as unknown as Parameters<typeof spriteOf>[0];
    expect(spriteOf(tree(0))).toBe('obj_sapling');
    expect(spriteOf(tree(4))).toBe('obj_sapling_2');
    expect(spriteOf(tree(8))).toBe('obj_sapling_3');
    expect(spriteOf(tree(30))).toBe('obj_tree_apple_sapling');
    artKeys.clear();
  });
});
