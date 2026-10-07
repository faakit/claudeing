import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mapsData } from '../src/data';
import { spawnPosition } from '../src/state/GameState';
import { isTileBlocked } from '../src/systems/movement';
import {
  buildCollisionGrid,
  doorTarget,
  parseMapObjects,
  type TiledMapLike,
} from '../src/systems/world';

const load = (file: string): TiledMapLike =>
  JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as TiledMapLike;
const maps = Object.fromEntries(Object.entries(mapsData.maps).map(([id, d]) => [id, load(d.file)]));

describe('map content', () => {
  it('start tile is walkable', () => {
    const { map, tx, ty } = mapsData.start;
    expect(isTileBlocked(buildCollisionGrid(maps[map]!), tx, ty)).toBe(false);
  });

  it.each(Object.keys(mapsData.maps))('%s: doors are walkable and lead somewhere valid', (id) => {
    const grid = buildCollisionGrid(maps[id]!);
    const doors = parseMapObjects(maps[id]!).filter((o) => o.type === 'door');
    expect(doors.length).toBeGreaterThan(0);
    for (const d of doors) {
      expect(isTileBlocked(grid, d.tx, d.ty)).toBe(false);
      const t = doorTarget(d);
      const dest = maps[t.map];
      expect(dest, `door ${d.id} targets unknown map ${t.map}`).toBeDefined();
      // Spawn tile must be walkable and must not itself be a door (no instant re-trigger).
      expect(isTileBlocked(buildCollisionGrid(dest!), t.tx, t.ty)).toBe(false);
      expect(
        parseMapObjects(dest!).some((o) => o.type === 'door' && o.tx === t.tx && o.ty === t.ty),
      ).toBe(false);
      expect(spawnPosition(t.tx, t.ty).x).toBeGreaterThan(0);
    }
  });

  it('interactables (bed, bin) are solid so the player stands beside them', () => {
    for (const [id, map] of Object.entries(maps)) {
      const grid = buildCollisionGrid(map);
      for (const o of parseMapObjects(map).filter((o) => o.type !== 'door')) {
        expect(isTileBlocked(grid, o.tx, o.ty), `${id}:${o.type}`).toBe(true);
      }
    }
  });
});
