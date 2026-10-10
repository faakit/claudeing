import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({ default: {} }));

import { HOLE, holeCircles, holeRuns } from '../src/fx/SeeThrough';
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

  it('cuts a pixel-art hole around the player and the target: clear inside, a checker rim, nothing translucent', () => {
    const runs = holeRuns(holeCircles(100, 200, { tx: 6, ty: 13 }));
    const on = new Set<string>();
    for (const [x, y, w] of runs) for (let i = 0; i < w; i++) on.add(`${x + i},${y}`);
    // the chest, the head and the target tile's centre are fully clear
    for (const [x, y] of [
      [100, 194],
      [100, 182],
      [104, 200],
      [104, 216],
    ])
      expect(on.has(`${x},${y}`), `${x},${y}`).toBe(true);
    // the rim alternates (checker), and nothing beyond the rim is cut
    const rimY = 194;
    const edge = 100 + HOLE.body + 1;
    expect(on.has(`${edge},${rimY}`)).not.toBe(on.has(`${edge + 1},${rimY}`));
    expect(on.has(`${100 + HOLE.body + HOLE.rim + 2},${rimY}`)).toBe(false);
  });
});
