import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  channelMask,
  channelTileName,
  culvertTileName,
  isGroundDecal,
  mouthTileName,
  namesBySlot,
  tileGid,
} from '../src/art/channelTiles';

const index = JSON.parse(readFileSync('public/assets/tilesets/tiles.json', 'utf8')) as {
  columns: number;
  tiles: Record<string, number>;
};
const set = (cells: [number, number][]) => {
  const s = new Set(cells.map(([x, y]) => `${x},${y}`));
  return (x: number, y: number) => s.has(`${x},${y}`);
};

describe('channel tiles', () => {
  it('has a dry and a wet tile for every mask, a culvert for every side set and four mouths', () => {
    for (let m = 0; m < 16; m++)
      for (const look of ['dry', 'wet'] as const)
        expect(tileGid(index, channelTileName(look, m)), `${look} ${m}`).not.toBeNull();
    for (let m = 1; m < 16; m++)
      expect(tileGid(index, `culvert:${m}`), `culvert ${m}`).not.toBeNull();
    for (const s of ['n', 'e', 's', 'w'] as const)
      expect(tileGid(index, mouthTileName(s)), s).not.toBeNull();
  });

  it('sits after every map tile, so painting channels never needs a map rebuild', () => {
    const chan = Object.entries(index.tiles).filter(([n]) =>
      /^(chan:|culvert:|chanmouth:)/.test(n),
    );
    const others = Object.entries(index.tiles).filter(
      ([n]) => !/^(chan:|culvert:|chanmouth:)/.test(n),
    );
    const lastMap = Math.max(...others.map(([, s]) => s));
    for (const [n, s] of chan) expect(s, n).toBeGreaterThan(lastMap);
  });

  it('masks a cell by its channel and creek neighbours (N1 E2 S4 W8)', () => {
    const chan = set([
      [5, 4],
      [4, 5],
    ]);
    const creek = set([[6, 5]]);
    expect(channelMask(5, 5, chan, creek)).toBe(1 | 2 | 8);
    expect(channelMask(9, 9, chan, creek)).toBe(0);
  });

  it('draws culvert walls only where a channel meets the path', () => {
    expect(culvertTileName(3, 3, set([[3, 2]]))).toBe('culvert:1');
    expect(
      culvertTileName(
        3,
        3,
        set([
          [3, 2],
          [3, 4],
        ]),
      ),
    ).toBe('culvert:5');
    expect(culvertTileName(3, 3, set([]))).toBeNull();
  });

  it('cuts flowers and tufts away but never tree crowns', () => {
    expect(isGroundDecal('patch_daisies')).toBe(true);
    expect(isGroundDecal('crown:189:20:10:u:x')).toBe(false);
    expect(isGroundDecal(undefined)).toBe(false);
    const names = namesBySlot(index);
    expect(names.get(index.tiles['patch_daisies']! + 1)).toBeDefined();
  });

  it('returns null for a tile the tileset does not have', () => {
    expect(tileGid(index, 'chan:wet:99')).toBeNull();
    expect(tileGid(undefined, 'chan:wet:0')).toBeNull();
  });
});
