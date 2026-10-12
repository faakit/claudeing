import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { PLACEHOLDER_TILES } from '../src/config';
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
import { deltaRects, inDelta, mapVariants, variantFile } from '../src/systems/valley';

const load = (file: string): TiledMapLike =>
  JSON.parse(readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8')) as TiledMapLike;

/**
 * Map stages (WORLD-PLAN 4.2.3): every variant passes every map test. A world is every map in its final look, or
 * one staged map in one of its earlier variants (the others final); each world runs the whole suite below.
 */
const WORLDS: { label: string; map?: string; variant?: string }[] = [
  { label: 'final' },
  ...Object.keys(mapsData.maps).flatMap((map) =>
    mapVariants(map)
      .slice(0, -1)
      .map((variant) => ({ label: `${map}@${variant}`, map, variant })),
  ),
];
let maps: Record<string, TiledMapLike> = {};
let grids: Record<string, ReturnType<typeof buildCollisionGrid>> = {};
let objects: Record<string, WorldObject[]> = {};
function useWorld(w: { map?: string; variant?: string }): void {
  maps = Object.fromEntries(
    Object.keys(mapsData.maps).map((id) => [
      id,
      load(variantFile(id, id === w.map ? (w.variant ?? null) : null)),
    ]),
  );
  grids = Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, buildCollisionGrid(m)]));
  objects = Object.fromEntries(Object.entries(maps).map(([id, m]) => [id, parseMapObjects(m)]));
}
useWorld({});

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

describe.each(WORLDS)('map content ($label)', (world) => {
  beforeAll(() => useWorld(world));

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
      for (const o of list.filter((o) => !['weedzone', 'forage', 'delta'].includes(o.type))) {
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

describe.each(WORLDS)('fixed spots on the maps ($label)', (world) => {
  beforeAll(() => useWorld(world));

  it('every villager stands on open ground, never in water or a wall', async () => {
    const { npcs } = await import('../src/data');
    for (const [id, n] of Object.entries(npcs))
      for (const w of n.schedule ?? [{ map: n.map, tx: n.tx, ty: n.ty, from: 0 }]) {
        if (w.map === 'away') continue;
        expect(isTileBlocked(grids[w.map]!, w.tx, w.ty), `${id} at ${w.map} ${w.tx},${w.ty}`).toBe(
          false,
        );
      }
  });

  it('landmarks, the mailbox and project plots sit on open ground you can walk up to', async () => {
    const { game, mail, plots, projects } = await import('../src/data');
    const spots: [string, number, number, string][] = [
      [mail.mailbox.map, mail.mailbox.tx, mail.mailbox.ty, 'mailbox'],
      ...Object.entries(projects).flatMap(([id, p]) =>
        p.landmark
          ? [[p.landmark.map, p.landmark.tx, p.landmark.ty, id] as [string, number, number, string]]
          : [],
      ),
      // Trophies at home (critique 9 F1, round 3).
      ...(game.trophies ?? []).map(
        (t) => [t.map, t.tx, t.ty, `trophy ${t.id}`] as [string, number, number, string],
      ),
    ];
    // Two things never share a tile.
    const keys = spots.map(([m, x, y]) => `${m}:${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const [map, tx, ty, what] of spots) {
      expect(isTileBlocked(grids[map]!, tx, ty), what).toBe(false);
      const open = [
        [tx + 1, ty],
        [tx - 1, ty],
        [tx, ty + 1],
        [tx, ty - 1],
      ].some(([x, y]) => !isTileBlocked(grids[map]!, x!, y!));
      expect(open, `${what} can be reached`).toBe(true);
    }
    // Project plots (the greenhouse) must be fully usable; old plots may hold a tree or two.
    for (const [id, p] of Object.entries(plots).filter(([, p]) => p.project)) {
      const [x, y, w, h] = p.rect;
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++)
          expect(isTileBlocked(grids['farm']!, i, j), `${id} ${i},${j}`).toBe(false);
    }
  });
});

describe('map stages: variants differ only inside their delta rects (WORLD-PLAN 4.2)', () => {
  const staged = Object.keys(mapsData.maps).filter((m) => mapVariants(m).length > 0);
  const variants = (map: string) =>
    mapVariants(map).map((v) => ({ v, raw: load(variantFile(map, v)) }));
  const layer = (raw: TiledMapLike, name: string) => raw.layers.find((l) => l.name === name)!.data!;

  it('the farm has stages', () => expect(staged).toContain('farm'));

  it.each(staged)('%s: every variant carries the delta rects of valley.json as objects', (map) => {
    for (const { v, raw } of variants(map)) {
      const rects = parseMapObjects(raw)
        .filter((o) => o.type === 'delta')
        .map((o) => [o.tx, o.ty, o.tw, o.th]);
      expect(rects, v).toEqual(deltaRects(map).map((r) => [...r]));
    }
  });

  it.each(staged)('%s: outside the delta rects, ground and collision are tile-identical', (map) => {
    const all = variants(map);
    const fin = all[all.length - 1]!.raw;
    for (const { v, raw } of all) {
      expect([raw.width, raw.height], v).toEqual([fin.width, fin.height]);
      for (const name of ['ground', 'collision']) {
        const a = layer(raw, name);
        const b = layer(fin, name);
        const diff: string[] = [];
        a.forEach((g, i) => {
          const x = i % raw.width;
          const y = Math.floor(i / raw.width);
          if (g !== b[i] && !inDelta(map, x, y)) diff.push(`${x},${y}`);
        });
        expect(diff, `${v} ${name}`).toEqual([]);
      }
    }
  });

  it.each(staged)('%s: doors, zones and interactables are identical in every variant', (map) => {
    const all = variants(map).map(({ v, raw }) => ({ v, objs: parseMapObjects(raw) }));
    for (const { v, objs } of all) expect(objs, v).toEqual(all[all.length - 1]!.objs);
  });

  it.each(staged)('%s: nothing fixed sits in a delta rect', async (map) => {
    const { game, mail, npcs, plots, projects } = await import('../src/data');
    const fixed: [number, number, string][] = [];
    const raw = load(variantFile(map, null));
    for (const o of parseMapObjects(raw))
      if (!['weedzone', 'forage', 'ore', 'delta'].includes(o.type))
        for (let y = o.ty; y < o.ty + o.th; y++)
          for (let x = o.tx; x < o.tx + o.tw; x++) fixed.push([x, y, `${o.type} #${o.id}`]);
    // where every door in the world drops the player on this map
    for (const id of Object.keys(mapsData.maps))
      for (const d of parseMapObjects(load(variantFile(id, null))).filter(
        (o) => o.type === 'door',
      )) {
        const t = doorTarget(d);
        if (t.map === map) fixed.push([t.tx, t.ty, `spawn of ${id} door #${d.id}`]);
      }
    for (const [what, sp] of [
      ['start', mapsData.start],
      ['wake', mapsData.wake],
    ] as const)
      if (sp.map === map) fixed.push([sp.tx, sp.ty, what]);
    for (const [id, n] of Object.entries(npcs))
      for (const w of n.schedule ?? [{ map: n.map, tx: n.tx, ty: n.ty }])
        if (w.map === map) fixed.push([w.tx, w.ty, `villager ${id}`]);
    for (const [id, p] of Object.entries(projects))
      if (p.landmark?.map === map) fixed.push([p.landmark.tx, p.landmark.ty, `landmark ${id}`]);
    for (const t of game.trophies ?? [])
      if (t.map === map) fixed.push([t.tx, t.ty, `trophy ${t.id}`]);
    if (mail.mailbox.map === map) fixed.push([mail.mailbox.tx, mail.mailbox.ty, 'mailbox']);
    if (mapsData.maps[map]?.farmland)
      for (const [id, p] of Object.entries(plots)) {
        const [x0, y0, w, h] = p.rect;
        for (let y = y0; y < y0 + h; y++)
          for (let x = x0; x < x0 + w; x++) fixed.push([x, y, `plot ${id}`]);
        if (p.sign) fixed.push([p.sign[0], p.sign[1], `sign of plot ${id}`]);
      }
    expect(
      fixed.filter(([x, y]) => inDelta(map, x, y)).map(([x, y, w]) => `${w} at ${x},${y}`),
    ).toEqual([]);
  });

  it.each(staged)(
    '%s: every stage is walkable exactly where its final (water) stage is (owner bug 3: dry beds are solid)',
    (map) => {
      const all = variants(map);
      const fin = buildCollisionGrid(all[all.length - 1]!.raw);
      for (const { v, raw } of all.slice(0, -1)) {
        const grid = buildCollisionGrid(raw);
        const differ: string[] = [];
        for (let y = 0; y < grid.height; y++)
          for (let x = 0; x < grid.width; x++)
            if (isTileBlocked(grid, x, y) !== isTileBlocked(fin, x, y)) differ.push(`${x},${y}`);
        expect(differ, `${map}@${v}`).toEqual([]);
      }
    },
  );

  it.each(staged)('%s: a zone tile in a delta rect is walkable in every variant', (map) => {
    const bad: string[] = [];
    for (const { v, raw } of variants(map)) {
      const grid = buildCollisionGrid(raw);
      for (const z of parseMapObjects(raw).filter((o) =>
        ['weedzone', 'forage', 'ore'].includes(o.type),
      ))
        for (let y = z.ty; y < z.ty + z.th; y++)
          for (let x = z.tx; x < z.tx + z.tw; x++)
            if (inDelta(map, x, y) && isTileBlocked(grid, x, y))
              bad.push(`${v}: ${z.type} ${x},${y}`);
    }
    expect(bad).toEqual([]);
  });

  it("the farm creek: a dry stony bed before the spring, water after; the footbridge open; Ilse's gate", () => {
    const kind = (raw: TiledMapLike, x: number, y: number) =>
      PLACEHOLDER_TILES[(layer(raw, 'ground')[y * raw.width + x] ?? 0) - 1]?.name;
    for (const { v, raw } of variants('farm')) {
      const grid = buildCollisionGrid(raw);
      for (let y = 3; y <= 30; y++)
        for (const x of [26, 27]) {
          const want = y === 6 ? 'path' : v === 'restored' ? 'water' : 'stone';
          expect(kind(raw, x, y), `${v} ${x},${y}`).toBe(want);
          // dry or wet, the bed is solid: the footbridge is the crossing (owner bug 3, coordinator ruling)
          expect(isTileBlocked(grid, x, y), `${v} ${x},${y}`).toBe(want !== 'path');
        }
      expect(kind(raw, 26, 31), v).toBe(v === 'restored' ? 'water' : 'stone');
      // the creek's old trees moved to the west bank; the weed field stops short of the creek
      expect([kind(raw, 25, 8), kind(raw, 25, 19)], v).toEqual(['tree', 'tree']);
      const field = parseMapObjects(raw).find((o) => o.type === 'weedzone')!;
      expect([field.tx, field.tx + field.tw - 1], v).toEqual([3, 25]);
      const gate = parseMapObjects(raw).find(
        (o) => o.type === 'door' && o.tx === 29 && o.ty === 3,
      )!;
      expect(doorTarget(gate).map, v).toBe('wendhead');
      expect(gate.props['lockedText'], v).toBe("Ilse's old gate. Locked.");
      // shut until the first green (WORLD-PLAN section 1); the art carries its shut and open tiles
      expect(gate.props['lockStat'], v).toBe('valley.farmGreen');
      expect(gate.props['gateShut'], v).toBeGreaterThan(0);
      expect(gate.props['gateOpen'], v).toBeGreaterThan(0);
      expect(gate.props['gateOpen'], v).not.toBe(gate.props['gateShut']);
    }
  });

  it("the town river (M6): today's town exactly once the weir is back; mud and a trickle before", () => {
    const today = JSON.parse(
      readFileSync(new URL('./fixtures/town-before-m6.json', import.meta.url), 'utf8'),
    ) as { ground: string[]; collision: string[] };
    const flat = (rows: string[]) => rows.join(',').split(',').map(Number);
    const all = Object.fromEntries(variants('town').map(({ v, raw }) => [v, raw]));
    // walkability and ground of the river town are today's, tile for tile (WORLD-PLAN 1)
    expect(layer(all['river']!, 'ground')).toEqual(flat(today.ground));
    expect(layer(all['river']!, 'collision')).toEqual(flat(today.collision));
    const kind = (raw: TiledMapLike, x: number, y: number) =>
      PLACEHOLDER_TILES[(layer(raw, 'ground')[y * raw.width + x] ?? 0) - 1]?.name;
    const dry = all['dry']!;
    const grid = buildCollisionGrid(dry);
    let trickle = 0;
    for (let y = 22; y <= 31; y++) {
      for (let x = 17; x <= 20; x++) expect(kind(dry, x, y), `${x},${y}`).toBe('stone');
      for (let x = 21; x <= 22; x++) if (kind(dry, x, y) === 'water') trickle++;
    }
    expect(trickle).toBe(20); // the dry town fishes a two-tile trickle (WORLD-PLAN 1: 20 tiles, 60 after)
    // the mud is solid like the river it was (owner bug 3, coordinator ruling), the Heron's tiles too
    for (let y = 22; y <= 31; y++)
      for (let x = 17; x <= 22; x++) expect(isTileBlocked(grid, x, y), `${x},${y}`).toBe(true);
    expect(isTileBlocked(grid, 16, 25)).toBe(false); // the bank
  });

  it("Wendhead's gorge (M6): a stony bed until the weir, water after; its bridge open in every stage", () => {
    const kind = (raw: TiledMapLike, x: number, y: number) =>
      PLACEHOLDER_TILES[(layer(raw, 'ground')[y * raw.width + x] ?? 0) - 1]?.name;
    for (const { v, raw } of variants('wendhead')) {
      const runs = v === 'gorge' || v === 'restored';
      const pool = v === 'spring' || v === 'restored';
      for (const x of [19, 20, 21]) {
        expect(kind(raw, x, 22), `${v} bridge`).toBe('path');
        for (const y of [0, 10, 21, 23, 27])
          expect(kind(raw, x, y), `${v} ${x},${y}`).toBe(runs ? 'water' : 'stone');
      }
      expect(kind(raw, 8, 17), `${v} pool`).toBe(pool ? 'water' : 'stone');
      // dry or running, the beds are solid (owner bug 3): the plank bridges are the crossings
      const grid = buildCollisionGrid(raw);
      for (const [x, y] of [
        [20, 10],
        [19, 27],
        [8, 17],
        [10, 20],
        [11, 25],
      ] as const)
        expect(isTileBlocked(grid, x, y), `${v} bed ${x},${y}`).toBe(true);
      expect(isTileBlocked(grid, 20, 22), `${v} gorge bridge`).toBe(false);
      expect(isTileBlocked(grid, 10, 22), `${v} creek bridge`).toBe(false);
      // the weir's site on the gorge's west bank, reached up the bank path
      expect(kind(raw, 17, 12), v).toBe('path');
      expect(isTileBlocked(buildCollisionGrid(raw), 17, 12), v).toBe(false);
    }
  });
});
