import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { goals, mapsData } from '../src/data';
import { STATE_VERSION } from '../src/state/GameState';
import { migrate } from '../src/systems/save';
import { LAB_MAP, labMap, registerLabMapDef } from '../src/dev/labDef';
import {
  buildScenarioState,
  mapInfoFromTiled,
  parseClock,
  scenarioVariant,
  ScenarioError,
  validateScenario,
  type MapInfoFn,
  type ScenarioDef,
} from '../src/dev/scenarios';
import { SCENARIOS } from '../src/dev/scenarioIndex';
import { valleyStage, variantFile } from '../src/systems/valley';

registerLabMapDef();

/** Bounds and walkability from the real .tmj files of the stage asked for (and the generated lab). */
const mapInfo: MapInfoFn = (map, variant) => {
  if (map === LAB_MAP)
    return {
      w: labMap.w,
      h: labMap.h,
      blocked: (tx, ty) => (labMap.collision[ty * labMap.w + tx] ?? 0) !== 0,
    };
  const def = mapsData.maps[map];
  if (!def) return null;
  const raw = JSON.parse(readFileSync(`public/${variantFile(map, variant ?? null)}`, 'utf8'));
  return mapInfoFromTiled(raw);
};

describe('scenarios', () => {
  const names = Object.keys(SCENARIOS);

  it('seeds the core flows', () => {
    expect(names.length).toBeGreaterThanOrEqual(15);
    for (const n of names) expect(n).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it.each(names)('%s is valid and loads into a state that survives a save round trip', (name) => {
    const def = SCENARIOS[name]!;
    expect(validateScenario(def, mapInfo)).toEqual([]);
    const s = buildScenarioState(def, mapInfo);
    expect(s.version).toBe(STATE_VERSION);
    expect(migrate(JSON.parse(JSON.stringify(s)))).toEqual(s);
    // Every map shows the stage the scenario pins (WORLD-PLAN 4.2.6): the stage file it was validated against.
    for (const map of Object.keys(mapsData.maps)) {
      const look = valleyStage(s, map);
      expect(look.final ? null : look.variant, `${name}: ${map}`).toBe(scenarioVariant(def, map));
    }
    // Where it says the player stands is where the state puts them.
    if (def.at) {
      expect(s.player.map).toBe(def.at.map);
      expect(Math.floor(s.player.x / 16)).toBe(def.at.tx);
    }
  });

  it('is deterministic: the same scenario builds the same state, with a fixed seed', () => {
    for (const name of names) {
      const a = buildScenarioState(SCENARIOS[name]!);
      const b = buildScenarioState(SCENARIOS[name]!);
      expect(a).toEqual(b);
      expect(a.rng).toBe(12345);
    }
  });

  it('applies the semantic keys through the rules', () => {
    const s = buildScenarioState({
      title: 't',
      version: STATE_VERSION,
      at: { map: 'farm', tx: 12, ty: 10, facing: 'up' },
      time: { season: 'summer', day: 9, clock: '18:30' },
      items: [{ item: 'parsnip', qty: 5, q: 1 }],
      select: 'parsnip_seed',
      crops: [{ crop: 'tomato', stage: 'ripe', tiles: [[9, 16]], watered: true }],
      friends: { rosa: 3 },
      goal: 'ship',
      settings: { leftHanded: true, controls: { tapToMove: false } },
      letters: ['welcome'],
    });
    expect(s.time).toMatchObject({ season: 'summer', day: 9, minutes: 18 * 60 + 30 });
    expect(s.player).toMatchObject({ map: 'farm', facing: 'up' });
    expect(s.inventory.slots.some((x) => x?.item === 'parsnip' && x.q === 1 && x.qty === 5)).toBe(
      true,
    );
    expect(s.inventory.slots[s.inventory.selected]?.item).toBe('parsnip_seed');
    expect(s.farm.tiles['9,16']).toMatchObject({
      watered: true,
      crop: { cropId: 'tomato', stage: 4 },
    });
    expect(s.friends['rosa']?.points).toBe(150);
    expect(goals[s.goalIndex]?.id).toBe('ship');
    expect(s.settings.leftHanded).toBe(true);
    expect(s.settings.controls.tapToMove).toBe(false);
    expect(s.stats['tut.off']).toBe(1);
    expect(s.mail.list.map((l) => l.from)).toEqual(['mara']);
    // Letters due by summer 9 but not asked for count as delivered long ago (no backlog tomorrow).
    expect(s.stats['mail.clay_intro']).toBe(1);
    expect(s.stats['mail.summer']).toBeUndefined(); // a dated letter (summer 1) is not due on summer 9
  });

  it('fills the lab showcase from the generated layout', () => {
    const s = buildScenarioState(SCENARIOS['lab']!, mapInfo);
    const L = labMap.layout;
    expect(L.cropRows.length).toBeGreaterThan(10);
    for (const r of L.cropRows)
      for (let st = 0; st <= r.stages; st++)
        expect(s.farm.tiles[`${r.tx + st},${r.ty}`]?.crop).toMatchObject({
          cropId: r.crop,
          stage: st,
        });
    expect(s.placed[LAB_MAP]?.length).toBe(L.placed.length);
    expect(Object.keys(s.nodes[LAB_MAP] ?? {}).length).toBe(L.nodes.length);
    for (const p of L.placed) expect(labMap.collision[p.ty * labMap.w + p.tx]).toBe(0);
  });

  it('migrates an old fixture: a raw patch written at an older save version', () => {
    // At save version 16 the goal chain had no guided-start goals; goal 2 was "water". v17 moves it to "forage".
    const old: ScenarioDef = { title: 'old', version: 16, state: { goalIndex: 2 } };
    const s = buildScenarioState(old);
    expect(goals[s.goalIndex]?.id).toBe('forage');
  });

  it('refuses typos and impossible states loudly', () => {
    const bad = {
      title: 'bad',
      version: STATE_VERSION,
      itmes: [],
      at: { map: 'farm', tx: 19, ty: 31 }, // in the pond
      crops: [{ crop: 'parsnipp', stage: 'ripe', tiles: [[1, 1]] }],
      goal: 'nope',
    };
    const p = validateScenario(bad, mapInfo);
    expect(p.join('\n')).toMatch(/unknown key "itmes"/);
    expect(p.join('\n')).toMatch(/blocked/);
    expect(p.join('\n')).toMatch(/unknown crop "parsnipp"/);
    expect(p.join('\n')).toMatch(/unknown goal "nope"/);
    expect(() => buildScenarioState(bad as unknown as ScenarioDef, mapInfo)).toThrow(ScenarioError);
    expect(validateScenario({ title: 'x', version: STATE_VERSION + 1 })).toEqual([
      `version ${STATE_VERSION + 1} is newer than this game (${STATE_VERSION})`,
    ]);
  });

  it('pins map stages: the farm-variant scenarios load in the variant they name', () => {
    for (const v of ['dry', 'waking', 'restored']) {
      const s = buildScenarioState(SCENARIOS[`farm-variant-${v}`]!, mapInfo);
      expect(valleyStage(s, 'farm').variant).toBe(v);
    }
    // a scenario without the key starts as a new game: the dry farm
    expect(valleyStage(buildScenarioState(SCENARIOS['day1-fresh']!), 'farm').variant).toBe('dry');
  });

  it('refuses a bad valley key, and a tile in a delta rect without one', () => {
    const base = { title: 't', version: STATE_VERSION };
    expect(validateScenario({ ...base, valley: { sprnig: 3 } }).join()).toMatch(
      /unknown key "sprnig"/,
    );
    expect(validateScenario({ ...base, valley: { spring: 4 } }).join()).toMatch(
      /spring must be 0-3/,
    );
    expect(validateScenario({ ...base, valley: { farmGreen: 2 } }).join()).toMatch(
      /farmGreen must be 0-1/,
    );
    const inBed = { ...base, at: { map: 'farm', tx: 26, ty: 12 } };
    expect(validateScenario(inBed, mapInfo).join()).toMatch(/changes with the valley's stage/);
    expect(validateScenario({ ...inBed, valley: { farmGreen: 0 } }, mapInfo)).toEqual([]);
    // pinned to the restored farm, that tile is water
    expect(
      validateScenario({ ...inBed, valley: { spring: 3, farmGreen: 1 } }, mapInfo).join(),
    ).toMatch(/blocked/);
  });

  it('parses clock times, after midnight too', () => {
    expect(parseClock('06:00')).toBe(360);
    expect(parseClock('25:30')).toBe(1530);
    expect(parseClock('7pm')).toBeNull();
  });
});
