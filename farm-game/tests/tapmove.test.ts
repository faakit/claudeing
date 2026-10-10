import { describe, expect, it } from 'vitest';
import { spawnPosition, type PlayerState } from '../src/state/GameState';
import {
  createGrid,
  createMoveState,
  createRoute,
  stepRoute,
  type CollisionGrid,
} from '../src/systems/movement';
import { findPath, pathToFace, pathToFaceAny, standTiles } from '../src/systems/pathfind';
import { TAP_ACTS, tapIntent, type TapWorld } from '../src/systems/tapIntent';
import type { TileCoord } from '../src/systems/world';

const TS = 16;
function gridFrom(rows: string[]): CollisionGrid {
  return createGrid(
    rows[0]!.length,
    rows.length,
    TS,
    rows.flatMap((r) => [...r].map((c) => (c === '#' ? 1 : 0))),
  );
}
const ROOM = gridFrom([
  '##########',
  '#........#',
  '#.####...#',
  '#....#...#',
  '#....#...#',
  '##########',
]);

describe('pathfind', () => {
  it('finds the shortest 4-way path around walls', () => {
    const p = findPath(ROOM, { tx: 1, ty: 3 }, [{ tx: 6, ty: 3 }])!;
    expect(p[0]).toEqual({ tx: 1, ty: 3 });
    expect(p[p.length - 1]).toEqual({ tx: 6, ty: 3 });
    // around the wall: up the left side, along row 1, down the right side
    expect(p.length).toBe(1 + 2 + 5 + 2);
    for (let i = 1; i < p.length; i++)
      expect(Math.abs(p[i]!.tx - p[i - 1]!.tx) + Math.abs(p[i]!.ty - p[i - 1]!.ty)).toBe(1);
  });

  it('returns null when the goal is unreachable or solid', () => {
    const boxed = gridFrom(['#####', '#.#.#', '#####']);
    expect(findPath(boxed, { tx: 1, ty: 1 }, [{ tx: 3, ty: 1 }])).toBeNull();
    expect(findPath(ROOM, { tx: 1, ty: 1 }, [{ tx: 2, ty: 2 }])).toBeNull();
  });

  it('never walks through a door unless the door is the goal', () => {
    const corridor = gridFrom(['#####', '#...#', '#...#', '#####']);
    const door = (tx: number, ty: number) => tx === 2 && ty === 1;
    const p = findPath(corridor, { tx: 1, ty: 1 }, [{ tx: 3, ty: 1 }], { avoid: door })!;
    expect(p.some((t) => door(t.tx, t.ty))).toBe(false);
    const q = findPath(corridor, { tx: 1, ty: 1 }, [{ tx: 2, ty: 1 }], { avoid: door })!;
    expect(q[q.length - 1]).toEqual({ tx: 2, ty: 1 });
  });

  it('stands next to a target and faces it', () => {
    const r = pathToFace(ROOM, { tx: 1, ty: 1 }, { tx: 3, ty: 2 })!; // a wall tile: stand above it
    expect(r.path[r.path.length - 1]).toEqual({ tx: 3, ty: 1 });
    expect(r.face).toBe('down');
    expect(standTiles({ tx: 3, ty: 2 })).toHaveLength(4);
    // already next to it: no walk, just face
    const here = pathToFace(ROOM, { tx: 3, ty: 1 }, { tx: 3, ty: 2 })!;
    expect(here.path).toEqual([{ tx: 3, ty: 1 }]);
  });

  it('takes well under 2 ms on a 60x60 map', () => {
    const rows = Array.from({ length: 60 }, (_, y) =>
      Array.from({ length: 60 }, (_, x) =>
        x === 0 || y === 0 || x === 59 || y === 59 || (x % 6 === 3 && y % 9 !== 4) ? '#' : '.',
      ).join(''),
    );
    const g = gridFrom(rows);
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) findPath(g, { tx: 1, ty: 1 }, [{ tx: 58, ty: 58 }]);
    expect((performance.now() - t0) / 50).toBeLessThan(2);
  });
});

describe('walking a route', () => {
  it('walks centre to centre and arrives exactly on the last centre', () => {
    const p: PlayerState = { map: 't', ...spawnPosition(1, 3), facing: 'down' };
    const ms = createMoveState();
    const path = findPath(ROOM, { tx: 1, ty: 3 }, [{ tx: 6, ty: 3 }])!;
    const route = createRoute(path);
    let res: string = 'moving';
    let frames = 0;
    while (res === 'moving' && frames < 1000) {
      res = stepRoute(p, ms, route, 16, ROOM);
      frames++;
    }
    expect(res).toBe('arrived');
    expect(p.x).toBeCloseTo(spawnPosition(6, 3).x, 6);
    expect(p.y).toBeCloseTo(spawnPosition(6, 3).y, 6);
    // 9 tiles at 64 px/s is 2.25 s
    expect(frames * 16).toBeLessThan(2400);
  });

  it('reports blocked when something stands in the way', () => {
    const p: PlayerState = { map: 't', ...spawnPosition(1, 1), facing: 'right' };
    const route = createRoute([
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
    ]);
    const blocked = gridFrom(['####', '#.##', '####']);
    let res: string = 'moving';
    for (let i = 0; i < 20 && res === 'moving'; i++)
      res = stepRoute(p, createMoveState(), route, 16, blocked);
    expect(res).toBe('blocked');
  });
});

describe('tap intent', () => {
  /** A little farm: a bin at (5,2), a ripe crop at (2,4), a wall at (8,1), grass elsewhere. */
  const world = (over: Partial<TapWorld> = {}): TapWorld => ({
    tileSize: TS,
    inMap: (t) => t.tx >= 0 && t.ty >= 0 && t.tx < 10 && t.ty < 8,
    blocked: (t) => (t.tx === 5 && t.ty === 2) || (t.tx === 8 && t.ty === 1),
    interactable: (t) => (t.tx === 5 && t.ty === 2 ? 'bin' : null),
    actKind: (t) => (t.tx === 2 && t.ty === 4 ? 'harvest' : null),
    ...over,
  });
  const at = (t: TileCoord, ox = 8, oy = 8) => [t.tx * TS + ox, t.ty * TS + oy] as const;

  it('interact > act > walk on the tapped tile', () => {
    expect(tapIntent(world(), ...at({ tx: 5, ty: 2 }))).toMatchObject({
      kind: 'interact',
      type: 'bin',
    });
    expect(tapIntent(world(), ...at({ tx: 2, ty: 4 }))).toMatchObject({
      kind: 'act',
      plan: 'harvest',
    });
    expect(tapIntent(world(), ...at({ tx: 3, ty: 6 }))).toMatchObject({ kind: 'walk' });
    // a lone wall tile with open ground below: the thumb meant the ground (taps land low)
    expect(tapIntent(world(), ...at({ tx: 8, ty: 1 }))).toEqual({
      kind: 'walk',
      target: { tx: 8, ty: 2 },
    });
    // solid with nothing open below it: nothing
    const edge = world({ blocked: (t) => t.ty === 7 });
    expect(tapIntent(edge, ...at({ tx: 4, ty: 7 }))).toMatchObject({ kind: 'none' });
  });

  it('no magnets: a tap on the walkable tile next to the bin walks there', () => {
    expect(tapIntent(world(), 5 * TS - 4, 2 * TS + 8).kind).toBe('walk');
    expect(tapIntent(world(), 5 * TS + 8, 3 * TS + 2).kind).toBe('walk');
  });

  it('a tap on a sprite drawn over the tile above opens what it belongs to', () => {
    // Rosa stands on (3,6); her head is drawn over (3,5)
    const w = world({
      spriteTarget: (x, y) =>
        x >= 3 * TS && x < 4 * TS && y >= 5 * TS + 6 && y < 7 * TS
          ? { tile: { tx: 3, ty: 6 }, type: 'npc:rosa' }
          : null,
    });
    expect(tapIntent(w, 3 * TS + 8, 5 * TS + 10)).toMatchObject({
      kind: 'interact',
      type: 'npc:rosa',
    });
  });

  it('a miss next to a crop never works a different tile: it walks', () => {
    const r = tapIntent(world(), 3 * TS + 2, 4 * TS + 8); // just right of the ripe crop
    expect(r.kind).toBe('walk');
  });

  it('a tap never tills or plants: grass and empty soil just walk', () => {
    const w = world({ actKind: (t) => (t.tx === 4 ? 'till' : t.tx === 6 ? 'plant' : 'water') });
    expect(tapIntent(w, 4 * TS + 8, 6 * TS + 8).kind).toBe('walk');
    expect(tapIntent(w, 6 * TS + 8, 6 * TS + 8).kind).toBe('walk');
    expect(tapIntent(w, 7 * TS + 8, 6 * TS + 8)).toMatchObject({ kind: 'act', plan: 'water' });
    for (const k of ['till', 'plant', 'place', 'fertilize']) expect(TAP_ACTS.has(k)).toBe(false);
  });

  it('accuracy: Gaussian taps at a lone target resolve to it (no magnet: the tile alone)', () => {
    let s = 99;
    const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
    const g = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    const px = 3.17; // iPhone 13: logical px per mm
    let hit = 0;
    for (let i = 0; i < 2000; i++) {
      const x = 5 * TS + 8 + g() * 1.0 * px;
      const y = 2 * TS + 8 + g() * 1.0 * px;
      if (tapIntent(world(), x, y).kind === 'interact') hit++;
    }
    // a 16 px tile under a 1 mm spread: about 95%
    expect(hit / 2000).toBeGreaterThan(0.9);
  });
});

describe('touch offset compensation', () => {
  it('moves a tap up and away from the thumb base by about 1 mm, mirrored for the left hand', async () => {
    const { compensateTouch } = await import('../src/systems/tapIntent');
    const r = compensateTouch(100, 200, false, 1.9);
    expect(r.x).toBeLessThan(100);
    expect(r.y).toBeLessThan(200);
    expect(100 - r.x).toBeCloseTo(200 - r.y, 6);
    expect(100 - r.x).toBeGreaterThan(1.5);
    expect(100 - r.x).toBeLessThan(3.5); // ~0.7 mm per axis on a 1.9 css/logical phone
    const l = compensateTouch(100, 200, true, 1.9);
    expect(l.x).toBeGreaterThan(100);
  });
});

describe('taps on solid art and multi-tile things (round 3, guided-start findings)', () => {
  // A house facade (rows 1-3, cols 2-6) with its door at (4,3); a bed (2x2) against the top-left wall of a
  // room; the bin at (8,4) under a tall prop tile (8,3).
  const rows = ['..........', '..#####...', '..#####...', '..##.##.#.', '........#.', '..........'];
  const g = gridFrom(rows);
  const world: TapWorld = {
    tileSize: TS,
    inMap: (t) => t.tx >= 0 && t.ty >= 0 && t.tx < 10 && t.ty < 6,
    blocked: (t) => rows[t.ty]![t.tx] === '#',
    interactable: (t) => (t.tx === 8 && t.ty === 4 ? 'bin' : null),
    actKind: () => null,
    door: (t) => t.tx === 4 && t.ty === 3,
  };
  const at = (tx: number, ty: number) => tapIntent(world, tx * TS + 8, ty * TS + 8);

  it('a tap on a door walks through it; a tap anywhere on the facade leads to its door', () => {
    expect(at(4, 3)).toEqual({ kind: 'walk', target: { tx: 4, ty: 3 }, door: true });
    for (const [tx, ty] of [
      [4, 2], // the door's top half, drawn on the wall
      [4, 1],
      [2, 1], // the facade's far corner
      [3, 2], // the wall just above the bottom row, beside the door
    ] as const)
      expect(at(tx, ty), `${tx},${ty}`).toEqual({
        kind: 'walk',
        target: { tx: 4, ty: 3 },
        door: true,
      });
  });

  it("a tap on the facade's bottom row away from the door walks to the path below it", () => {
    const tap = (tx: number, ty: number, oy: number) => tapIntent(world, tx * TS + 8, ty * TS + oy);
    // two or more tiles from the door: the path below, wherever in the tile
    for (const tx of [2, 6])
      for (const oy of [3, 8, 13])
        expect(tap(tx, 3, oy), `${tx}`).toEqual({ kind: 'walk', target: { tx, ty: 4 } });
    // beside the door: its upper half leads in, its lower half (a thumb aiming at the path) walks below
    for (const tx of [3, 5]) {
      expect(tap(tx, 3, 4)).toEqual({ kind: 'walk', target: { tx: 4, ty: 3 }, door: true });
      expect(tap(tx, 3, 12)).toEqual({ kind: 'walk', target: { tx, ty: 4 } });
    }
  });

  it('a tap on the art above the bin opens the bin; plain walls far from anything stay nothing', () => {
    expect(at(8, 3)).toMatchObject({ kind: 'interact', target: { tx: 8, ty: 4 }, type: 'bin' });
    expect(findPath(g, { tx: 0, ty: 5 }, [{ tx: 4, ty: 3 }])).not.toBeNull();
    const walls: TapWorld = { ...world, door: () => false, interactable: () => null };
    expect(tapIntent(walls, 3 * TS + 8, 2 * TS + 8).kind).toBe('none');
  });

  it('a multi-tile thing is reached from whichever side is open', () => {
    const room = gridFrom(
      ['#####', '#XX.#', '#XX.#', '#...#', '#####'].map((r) => r.replace(/X/g, '#')),
    );
    const bed = [
      { tx: 1, ty: 1 },
      { tx: 2, ty: 1 },
      { tx: 1, ty: 2 },
      { tx: 2, ty: 2 },
    ];
    // the top-left tile alone has no open side: the bed as a whole does
    expect(pathToFace(room, { tx: 3, ty: 3 }, { tx: 1, ty: 1 })).toBeNull();
    const r = pathToFaceAny(room, { tx: 3, ty: 3 }, bed)!;
    expect(r).not.toBeNull();
    const stand = r.path[r.path.length - 1]!;
    expect(Math.abs(stand.tx - r.target.tx) + Math.abs(stand.ty - r.target.ty)).toBe(1);
  });
});
