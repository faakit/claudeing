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
  type WorldObject,
} from '../src/systems/world';

const load = (file: string): TiledMapLike =>
  JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as TiledMapLike;
const maps = Object.fromEntries(Object.entries(mapsData.maps).map(([id, d]) => [id, load(d.file)]));
const grids = Object.fromEntries(
  Object.entries(maps).map(([id, m]) => [id, buildCollisionGrid(m)]),
);
const objects = Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, parseMapObjects(m)]));

/** Flood-fill the walkable tiles of a map from a start tile. */
function reachable(id: string, tx: number, ty: number): Set<string> {
  const grid = grids[id]!;
  const seen = new Set<string>();
  const stack: [number, number][] = [[tx, ty]];
  while (stack.length) {
    const [x, y] = stack.pop()!;
    const key = `${x},${y}`;
    if (seen.has(key) || isTileBlocked(grid, x, y)) continue;
    seen.add(key);
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  return seen;
}

const touchable = (seen: Set<string>, o: WorldObject): boolean => {
  for (let y = o.ty - 1; y <= o.ty + o.th; y++) {
    for (let x = o.tx - 1; x <= o.tx + o.tw; x++) {
      const inside = x >= o.tx && x < o.tx + o.tw && y >= o.ty && y < o.ty + o.th;
      if (
        !inside &&
        (x === o.tx - 1 || x === o.tx + o.tw || y === o.ty - 1 || y === o.ty + o.th) &&
        seen.has(`${x},${y}`)
      ) {
        return true;
      }
    }
  }
  return seen.has(`${o.tx},${o.ty}`);
};

describe('map content', () => {
  it('every map is portrait (taller than wide), the shape the game is designed around', () => {
    for (const [id, m] of Object.entries(maps)) {
      if (id === 'house') continue; // a small room is exempt
      expect(m.height, id).toBeGreaterThan(m.width);
    }
  });

  it('start and wake tiles are walkable', () => {
    for (const s of [mapsData.start, mapsData.wake]) {
      expect(isTileBlocked(grids[s.map]!, s.tx, s.ty)).toBe(false);
    }
  });

  it.each(Object.keys(mapsData.maps))('%s: doors are walkable and lead somewhere valid', (id) => {
    const doors = objects[id]!.filter((o) => o.type === 'door');
    expect(doors.length).toBeGreaterThan(0);
    for (const d of doors) {
      expect(isTileBlocked(grids[id]!, d.tx, d.ty)).toBe(false);
      const t = doorTarget(d);
      expect(maps[t.map], `door ${d.id} targets unknown map ${t.map}`).toBeDefined();
      // Spawn tile must be walkable and must not itself be a door (no instant re-trigger).
      expect(isTileBlocked(grids[t.map]!, t.tx, t.ty)).toBe(false);
      expect(objects[t.map]!.some((o) => o.type === 'door' && o.tx === t.tx && o.ty === t.ty)).toBe(
        false,
      );
      expect(spawnPosition(t.tx, t.ty).x).toBeGreaterThan(0);
    }
  });

  it('interactables (bed, bin, shop, board) are solid so the player stands beside them', () => {
    for (const [id, list] of Object.entries(objects)) {
      for (const o of list.filter((o) => ['bed', 'bin', 'shop', 'board'].includes(o.type))) {
        expect(isTileBlocked(grids[id]!, o.tx, o.ty), `${id}:${o.type}`).toBe(true);
      }
    }
  });

  it('the whole world is connected: from the start you can reach every door and interactable', () => {
    // Walk the door graph, flood-filling each map from wherever we enter it.
    const entry = new Map<string, Set<string>>();
    const queue: [string, number, number][] = [
      [mapsData.start.map, mapsData.start.tx, mapsData.start.ty],
    ];
    while (queue.length) {
      const [id, tx, ty] = queue.shift()!;
      const seen = reachable(id, tx, ty);
      const known = entry.get(id);
      if (known && [...seen].every((k) => known.has(k))) continue;
      entry.set(id, new Set([...(known ?? []), ...seen]));
      for (const d of objects[id]!.filter(
        (o) => o.type === 'door' && seen.has(`${o.tx},${o.ty}`),
      )) {
        const t = doorTarget(d);
        queue.push([t.map, t.tx, t.ty]);
      }
    }
    expect([...entry.keys()].sort()).toEqual(Object.keys(maps).sort());
    for (const [id, list] of Object.entries(objects)) {
      const seen = entry.get(id)!;
      for (const o of list.filter((o) => o.type !== 'weedzone' && o.type !== 'forage')) {
        expect(touchable(seen, o), `${id}: ${o.type} #${o.id} is unreachable`).toBe(true);
      }
    }
  });

  it('every door has a way back: map A to B implies a door from B to A', () => {
    for (const [id, list] of Object.entries(objects)) {
      for (const d of list.filter((o) => o.type === 'door')) {
        const t = doorTarget(d);
        expect(
          objects[t.map]!.some((o) => o.type === 'door' && doorTarget(o).map === id),
          `${id} -> ${t.map} has no return`,
        ).toBe(true);
      }
    }
  });

  it('the farm has a weed zone with plenty of tillable tiles, and forage zones exist where promised', () => {
    const zone = objects['farm']!.find((o) => o.type === 'weedzone')!;
    expect(zone.tw * zone.th).toBeGreaterThan(300);
    for (const id of ['farm', 'town', 'woods']) {
      expect(
        objects[id]!.some((o) => o.type === 'forage'),
        `${id} needs a forage zone`,
      ).toBe(true);
    }
  });

  it('forage zones sit inside their map and contain walkable grass', () => {
    for (const [id, list] of Object.entries(objects)) {
      for (const z of list.filter((o) => o.type === 'forage')) {
        expect(z.tx + z.tw).toBeLessThanOrEqual(maps[id]!.width);
        expect(z.ty + z.th).toBeLessThanOrEqual(maps[id]!.height);
        let walkable = 0;
        for (let y = z.ty; y < z.ty + z.th; y++)
          for (let x = z.tx; x < z.tx + z.tw; x++) if (!isTileBlocked(grids[id]!, x, y)) walkable++;
        expect(walkable, `${id} zone ${z.id}`).toBeGreaterThan(5);
      }
    }
  });
});
