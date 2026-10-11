/**
 * Map stages (MILESTONES M2, WORLD-PLAN section 4): the stage a map shows, the delta rectangles where its variants
 * may differ, and the rules that keep them safe (nothing fixed in them, nothing placed or tilled in them, old saves
 * cleared out of them). The per-variant map tests are in tests/maps.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { mapsData, validateValley, valley } from '../src/data';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { countItem } from '../src/systems/inventory';
import { createGrid } from '../src/systems/movement';
import {
  allMapLooks,
  clearDeltaRegions,
  deltaRefusal,
  inDelta,
  mapLook,
  mapVariants,
  pinStage,
  stageWhenHolds,
  valleyKeys,
  valleyStage,
  valleyStatKey,
  variantFile,
} from '../src/systems/valley';
import { doorLocked, nearestDoorSpawn, type WorldObject } from '../src/systems/world';
import { equip, grass, newState } from './helpers';

const stats = (s: Record<string, number>) => ({ stats: s });
const CREEK = 'The old creek bed. Best left clear.';

describe('valleyStage: which variant a map shows', () => {
  it('the farm is dry until the first green, waking until the spring is restored, then restored', () => {
    expect(valleyStage(stats({}), 'farm')).toMatchObject({
      variant: 'dry',
      stage: 0,
      final: false,
      file: 'assets/maps/farm@dry.tmj',
      palette: 'dry',
    });
    expect(valleyStage(stats({ 'valley.farmGreen': 1 }), 'farm')).toMatchObject({
      variant: 'waking',
      stage: 1,
      file: 'assets/maps/farm@waking.tmj',
    });
    expect(valleyStage(stats({ 'valley.farmGreen': 1 }), 'farm').palette).toBeUndefined();
    // every boundary of the spring's place stat: 0 untouched, 1 asked, 2 funded stay waking; 3 is restored
    for (const n of [0, 1, 2])
      expect(valleyStage(stats({ 'valley.farmGreen': 1, 'place.spring': n }), 'farm').variant).toBe(
        'waking',
      );
    expect(valleyStage(stats({ 'valley.farmGreen': 1, 'place.spring': 3 }), 'farm')).toMatchObject({
      variant: 'restored',
      stage: 2,
      final: true,
      file: 'assets/maps/farm.tmj',
    });
    // the first matching stage wins: a dry farm stays dry even with the spring somehow restored
    expect(valleyStage(stats({ 'place.spring': 3 }), 'farm').variant).toBe('dry');
  });

  it('maps without stages have one look: their own file, no variant', () => {
    for (const map of ['house', 'woods', 'mine'])
      expect(valleyStage(stats({ 'place.spring': 3 }), map)).toEqual({
        map,
        variant: null,
        stage: 0,
        final: true,
        file: mapsData.maps[map]!.file,
      });
  });

  it('mapLook gives the file and the palette (the name WORLD-PLAN uses)', () => {
    expect(mapLook(stats({}), 'farm')).toEqual({
      file: 'assets/maps/farm@dry.tmj',
      palette: 'dry',
    });
    expect(mapLook(stats({ 'valley.farmGreen': 1 }), 'farm')).toEqual({
      file: 'assets/maps/farm@waking.tmj',
    });
  });

  it('conditions: stat or place, min and max inclusive, missing stats count as 0', () => {
    expect(stageWhenHolds(stats({}), { stat: 'x', max: 0 })).toBe(true);
    expect(stageWhenHolds(stats({}), { stat: 'x', min: 1 })).toBe(false);
    expect(stageWhenHolds(stats({ 'place.weir': 2 }), { place: 'weir', min: 2, max: 2 })).toBe(
      true,
    );
    expect(stageWhenHolds(stats({ 'place.weir': 3 }), { place: 'weir', max: 2 })).toBe(false);
  });

  it('conditions nest: all of them, or any of them', () => {
    const both = {
      all: [
        { place: 'spring', max: 2 },
        { place: 'weir', max: 2 },
      ],
    };
    expect(stageWhenHolds(stats({}), both)).toBe(true);
    expect(stageWhenHolds(stats({ 'place.weir': 3 }), both)).toBe(false);
    const either = {
      any: [
        { place: 'spring', min: 3 },
        { place: 'weir', min: 3 },
      ],
    };
    expect(stageWhenHolds(stats({}), either)).toBe(false);
    expect(stageWhenHolds(stats({ 'place.weir': 3 }), either)).toBe(true);
  });

  it("the town is dry until the weir is restored, then its river (today's town.tmj)", () => {
    expect(mapVariants('town')).toEqual(['dry', 'river']);
    for (const weir of [0, 1, 2])
      expect(mapLook(stats({ 'place.weir': weir }), 'town')).toEqual({
        file: 'assets/maps/town@dry.tmj',
        palette: 'dry',
      });
    expect(mapLook(stats({ 'place.weir': 3 }), 'town')).toEqual({ file: 'assets/maps/town.tmj' });
  });

  it("Wendhead's pool follows the spring and its gorge the weir, either first (an old save's weir)", () => {
    const at = (spring: number, weir: number) =>
      valleyStage(stats({ 'place.spring': spring, 'place.weir': weir }), 'wendhead');
    expect(at(0, 0).variant).toBe('dry');
    expect(at(0, 3).variant).toBe('gorge');
    expect(at(3, 0).variant).toBe('spring');
    expect(at(3, 3).variant).toBe('restored');
    expect(at(3, 3).file).toBe('assets/maps/wendhead.tmj');
    // straw until the spring opens, whatever the gorge does
    expect([at(0, 0).palette, at(0, 3).palette, at(3, 0).palette]).toEqual([
      'dry',
      'dry',
      undefined,
    ]);
  });

  it('lists one file per variant, the last keeping the map name', () => {
    expect(mapVariants('farm')).toEqual(['dry', 'waking', 'restored']);
    expect(variantFile('farm', 'restored')).toBe('assets/maps/farm.tmj');
    expect(variantFile('farm', null)).toBe('assets/maps/farm.tmj');
    expect(() => variantFile('farm', 'nope')).toThrow();
    const files = allMapLooks().map((l) => l.file);
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain('assets/maps/farm@dry.tmj');
    // the farm's dry and waking files, Wendhead's dry (M3), gorge and spring ones, the town's dry one (M6)
    expect(files.length).toBe(Object.keys(mapsData.maps).length + 6);
    for (const f of ['wendhead@dry', 'wendhead@gorge', 'wendhead@spring', 'town@dry'])
      expect(files).toContain(`assets/maps/${f}.tmj`);
  });

  it('pinStage finds the stats that show a stage (the dev menu and __farm.dev.stage)', () => {
    expect(pinStage('farm', 'dry', { 'valley.farmGreen': 1, other: 7 })).toEqual({
      'valley.farmGreen': 0,
      other: 7,
    });
    expect(pinStage('farm', 'waking')).toEqual({ 'valley.farmGreen': 1 });
    expect(pinStage('farm', 'restored')).toEqual({ 'valley.farmGreen': 1, 'place.spring': 3 });
    expect(pinStage('farm', 'waking', { 'valley.farmGreen': 1, 'place.spring': 3 })).toEqual({
      'valley.farmGreen': 1,
      'place.spring': 2,
    });
    expect(pinStage('farm', 'nope')).toBeNull();
    expect(pinStage('woods', 'dry')).toBeNull();
    expect(pinStage('town', 'river')).toEqual({ 'place.weir': 3 });
    expect(pinStage('town', 'dry', { 'place.weir': 3 })).toEqual({ 'place.weir': 2 });
    // nested conditions: the fewest changes that show the stage
    for (const v of ['dry', 'gorge', 'spring', 'restored'])
      for (const base of <Record<string, number>[]>[
        {},
        { 'place.spring': 3 },
        { 'place.weir': 3 },
        { 'place.spring': 3, 'place.weir': 3 },
      ]) {
        const pinned = pinStage('wendhead', v, base)!;
        expect(
          valleyStage(stats(pinned), 'wendhead').variant,
          `${v} from ${JSON.stringify(base)}`,
        ).toBe(v);
      }
    expect(pinStage('wendhead', 'gorge', {})).toEqual({ 'place.spring': 0, 'place.weir': 3 });
  });

  it('the scenario valley key names farmGreen and the places the stage tables read', () => {
    expect(valleyStatKey('farmGreen')).toBe('valley.farmGreen');
    expect(valleyStatKey('spring')).toBe('place.spring');
    expect(valleyKeys().sort()).toEqual(['farmGreen', 'spring', 'weir']);
  });

  it('refuses a broken stage table at load', () => {
    const maps = mapsData.maps;
    const ok = valley.maps['farm']!;
    const bad = (m: unknown) => () => validateValley({ maps: { farm: m } }, maps);
    expect(bad({ ...ok, variants: [ok.variants[0]] })).toThrow(/2-4 variants/);
    expect(bad({ ...ok, variants: [ok.variants[0], ok.variants[0]] })).toThrow(/twice/);
    expect(bad({ ...ok, variants: [ok.variants[2], ok.variants[0]] })).toThrow(/needs a "when"/);
    expect(bad({ ...ok, variants: [ok.variants[0], ok.variants[1]] })).toThrow(/default/);
    expect(
      bad({ ...ok, variants: [{ variant: 'a', when: { stat: 'x' } }, ok.variants[2]] }),
    ).toThrow(/min or max/);
    expect(bad({ ...ok, delta: [[1, 2, 0, 3]] })).toThrow(/delta rect/);
    expect(() => validateValley({ maps: { nowhere: ok } }, maps)).toThrow(/unknown map/);
  });
});

describe('delta rectangles', () => {
  it('cover the farm creek bed (x 26-27, y 3-31) but not the footbridge row (y 6)', () => {
    for (let y = 3; y <= 30; y++)
      for (const x of [26, 27]) expect(inDelta('farm', x, y), `${x},${y}`).toBe(y !== 6);
    expect(inDelta('farm', 26, 31)).toBe(true);
    expect(inDelta('farm', 25, 12)).toBe(false);
    expect(inDelta('farm', 28, 12)).toBe(false);
    expect(inDelta('town', 26, 12)).toBe(false);
    expect(deltaRefusal('farm', 26, 12)).toBe(CREEK);
    expect(deltaRefusal('farm', 25, 12)).toBeNull();
  });

  it('placing in the creek bed is refused with its line, and nothing changes', () => {
    const s = newState();
    s.inventory.slots[5] = { item: 'sprinkler', qty: 2 };
    equip(s, 'sprinkler');
    const before = JSON.stringify(s);
    expect(performAction(s, { ...grass(26, 12), kind: 'stone', tillable: false })).toEqual({
      ok: false,
      message: CREEK,
    });
    expect(JSON.stringify(s)).toBe(before);
    // on the bank it works as anywhere
    expect(performAction(s, grass(25, 12)).ok).toBe(true);
    expect(s.placed['farm']?.some((o) => o.tx === 25 && o.ty === 12)).toBe(true);
  });

  it('tilling in the creek bed is refused with the same line, before the land-for-sale one', () => {
    const s = newState();
    equip(s, 'hoe');
    const before = JSON.stringify(s);
    // as the scene builds it: the bed is stone, lies in no plot (owned: false) and is open in the dry stage
    const bed = { ...grass(27, 20), kind: 'stone', tillable: false, owned: false };
    expect(performAction(s, bed)).toEqual({
      ok: false,
      message: CREEK,
    });
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('old saves: the night clears the creek bed', () => {
  const free: [number, number][] = [
    [24, 12],
    [20, 20],
    [25, 12],
  ];

  it('moves placed things to the nearest free tile with their state, lifts soil, and gives seeds back', () => {
    const s = newState();
    s.placed['farm'] = [
      { id: 90, type: 'sprinkler', tx: 26, ty: 12, data: {} },
      { id: 91, type: 'keg', tx: 27, ty: 13, data: { input: { item: 'tomato' }, days: 2 } },
    ];
    s.farm.tiles['26,20'] = {
      watered: true,
      crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false },
    };
    s.farm.tiles['27,21'] = {
      watered: false,
      crop: { cropId: 'parsnip', stage: 4, daysInStage: 0, regrow: false },
    };
    s.farm.tiles['26,22'] = { watered: false, crop: null };
    s.farm.weeds['27,9'] = true;
    (s.forage['farm'] ??= {})['26,25'] = 'wild_leek';
    s.farm.tiles['5,16'] = { watered: false, crop: null }; // outside: untouched
    const seeds = countItem(s, 'parsnip_seed');
    const res = clearDeltaRegions(s, 'farm', free);
    expect(res).toMatchObject({ moved: 2, returned: 0, crops: 2 });
    expect(res.note).toMatch(/old creek bed was cleared/);
    const at = (id: number) => s.placed['farm']!.find((o) => o.id === id)!;
    expect([at(90).tx, at(90).ty]).toEqual([25, 12]);
    expect([at(91).tx, at(91).ty]).toEqual([24, 12]);
    expect(at(91).data).toEqual({ input: { item: 'tomato' }, days: 2 });
    expect(Object.keys(s.farm.tiles)).toEqual(['5,16']);
    expect(s.farm.weeds['27,9']).toBeUndefined();
    expect(s.forage['farm']?.['26,25']).toBeUndefined();
    expect(countItem(s, 'parsnip_seed')).toBe(seeds + 1); // the growing one
    expect(countItem(s, 'parsnip')).toBe(1); // the ripe one, harvested
  });

  it('with no free ground, a placed thing goes into the bag; nothing in the bed means no note', () => {
    const s = newState();
    s.placed['farm'] = [{ id: 90, type: 'sprinkler', tx: 26, ty: 12, data: {} }];
    const res = clearDeltaRegions(s, 'farm', []);
    expect(res).toMatchObject({ moved: 0, returned: 1 });
    expect(s.placed['farm']).toBeUndefined();
    expect(countItem(s, 'sprinkler')).toBe(1);
    expect(clearDeltaRegions(s, 'farm', free)).toEqual({
      moved: 0,
      returned: 0,
      crops: 0,
      note: null,
    });
    expect(clearDeltaRegions(s, 'town', free).note).toBeNull();
  });

  it('runs every night, with a line in the morning summary', () => {
    const s = newState();
    s.placed['farm'] = [{ id: 90, type: 'sprinkler', tx: 27, ty: 4, data: {} }];
    const summary = endDay(s, { passedOut: false, weedCandidates: free });
    expect(s.placed['farm']![0]).toMatchObject({ tx: 25, ty: 12 });
    expect((summary.notes ?? []).join(' ')).toMatch(/old creek bed was cleared/);
  });
});

describe('doors', () => {
  const gate = (props: Record<string, string | number>): WorldObject => ({
    id: 1,
    type: 'door',
    tx: 29,
    ty: 3,
    tw: 1,
    th: 1,
    props: { targetMap: 'wendhead', spawnTx: 1, spawnTy: 13, facing: 'right', ...props },
  });

  it("Ilse's gate stays shut until its stat reaches the value", () => {
    const g = gate({
      lockStat: 'place.spring',
      lockMin: 1,
      lockedText: "Ilse's old gate. Locked.",
    });
    expect(doorLocked(stats({}), g)).toBe("Ilse's old gate. Locked.");
    expect(doorLocked(stats({ 'place.spring': 1 }), g)).toBeNull();
    expect(doorLocked(stats({}), gate({}))).toBeNull(); // a plain door
  });

  it('a player in the running creek goes to the nearest open door spawn', () => {
    const grid = createGrid(30, 44, 16, new Array(30 * 44).fill(0));
    grid.blocked[3 * 30 + 28] = 0;
    const spawns = [
      { tx: 14, ty: 42 },
      { tx: 14, ty: 8 },
      { tx: 28, ty: 3 },
    ];
    expect(nearestDoorSpawn(grid, spawns, 26, 12)).toEqual({ tx: 28, ty: 3 });
    grid.blocked[3 * 30 + 28] = 1; // that one blocked: the next nearest
    expect(nearestDoorSpawn(grid, spawns, 26, 12)).toEqual({ tx: 14, ty: 8 });
  });
});
