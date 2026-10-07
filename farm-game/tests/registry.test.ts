import { afterEach, describe, expect, it } from 'vitest';
import { items, placeables, tools } from '../src/data';
import { performAction, performBest, planAction, registerToolAction } from '../src/systems/actions';
import { registerActionHandler, unregisterActionHandler } from '../src/systems/actionRegistry';
import { endDay } from '../src/systems/day';
import {
  hooksFor,
  registerDayHook,
  registeredHookIds,
  unregisterDayHook,
} from '../src/systems/dayHooks';
import { getSoil, till } from '../src/systems/farming';
import { placeObject, registerPlaceableBehavior } from '../src/systems/placeables';
import { equip, grass, newState } from './helpers';

/**
 * These tests are the proof that the architecture is open: each one adds a brand-new mechanic using
 * only the public registration points, without touching a line of the core.
 */
describe('extending actions', () => {
  afterEach(() => unregisterActionHandler('test:wave'));

  it('a new high-priority handler takes over, and removing it restores the built-ins', () => {
    const s = newState();
    registerActionHandler({
      id: 'test:wave',
      priority: 999,
      plan: ({ tile }) => ({
        plan: { kind: 'wave', tx: tile.tx, ty: tile.ty, run: () => ({ item: 'sparkles' }) },
      }),
    });
    expect(performAction(s, grass(3, 3))).toMatchObject({
      ok: true,
      kind: 'wave',
      item: 'sparkles',
    });
    expect(getSoil(s, 3, 3)).toBeUndefined(); // the hoe never ran
    unregisterActionHandler('test:wave');
    expect(performAction(s, grass(3, 3))).toMatchObject({ ok: true, kind: 'till' });
  });

  it('a handler that returns null defers to the next one', () => {
    const s = newState();
    registerActionHandler({ id: 'test:wave', priority: 999, plan: () => null });
    expect(performAction(s, grass(3, 3))).toMatchObject({ kind: 'till' });
  });

  it('a new tool action works with data alone: one item, one tools.json row, one registration', () => {
    const s = newState();
    items['test_whistle'] = {
      name: 'Whistle',
      type: 'tool',
      icon: 'item_hoe',
      color: '#fff',
      tool: 'test_whistle',
      description: 'x',
    };
    tools['test_whistle'] = { energyCost: 3, action: 'whistle', icon: 'item_hoe' };
    let blown = 0;
    registerToolAction('whistle', ({ tile, tool, state }) =>
      state.energy < tool.energyCost
        ? { refusal: 'Too tired' }
        : {
            plan: {
              kind: 'whistle',
              tx: tile.tx,
              ty: tile.ty,
              run: () => ((state.energy -= tool.energyCost), ++blown, {}),
            },
          },
    );
    s.inventory.slots[10] = { item: 'test_whistle', qty: 1 };
    s.inventory.selected = 10;
    expect(performAction(s, grass(1, 1))).toMatchObject({ ok: true, kind: 'whistle' });
    expect(blown).toBe(1);
    expect(s.energy).toBe(97);
    s.energy = 1;
    expect(performAction(s, grass(1, 1))).toEqual({ ok: false, message: 'Too tired' });
    delete items['test_whistle'];
    delete tools['test_whistle'];
  });

  it('plans change nothing, so the game can ask what Action would do before doing it', () => {
    const s = newState();
    const before = JSON.stringify(s);
    expect(planAction(s, grass(2, 2)).ok).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('performBest acts on the first nearby tile where the equipped item can do something', () => {
    const s = newState();
    const path = { ...grass(5, 5), tillable: false, kind: 'path' };
    const result = performBest(s, [path, grass(6, 5), grass(4, 5)]);
    expect(result).toMatchObject({ ok: true, kind: 'till', tx: 6, ty: 5 });
    expect(result.tile.tx).toBe(6);
    expect(getSoil(s, 6, 5)).toBeDefined();
    expect(getSoil(s, 4, 5)).toBeUndefined(); // only one tile is acted on
  });

  it('performBest reports the refusal for the tile the player faces when nothing works', () => {
    const s = newState();
    const path = (x: number) => ({ ...grass(x, 5), tillable: false });
    const result = performBest(s, [path(5), path(6), path(4)]);
    expect(result.ok).toBe(false);
    expect(result.tile.tx).toBe(5);
  });

  it('smart targeting prefers the facing tile when it works', () => {
    const s = newState();
    expect(performBest(s, [grass(5, 5), grass(6, 5)]).tile.tx).toBe(5);
  });
});

describe('extending the day rollover', () => {
  afterEach(() => {
    unregisterDayHook('test:note');
    unregisterDayHook('test:early');
  });

  it('a hook joins the pipeline and its note reaches the summary', () => {
    const s = newState();
    registerDayHook({
      id: 'test:note',
      phase: 'morning',
      order: 999,
      run: (_s, ctx) => ctx.notes.push('A bird sang.'),
    });
    const summary = endDay(s, { passedOut: false, weedCandidates: [] });
    expect(summary.notes).toContain('A bird sang.');
  });

  it('phases run in order and `order` breaks ties within a phase', () => {
    const calls: string[] = [];
    registerDayHook({
      id: 'test:note',
      phase: 'payout',
      order: 5,
      run: () => calls.push('late-payout'),
    });
    registerDayHook({
      id: 'test:early',
      phase: 'payout',
      order: -5,
      run: () => calls.push('early-payout'),
    });
    registerDayHook({ id: 'test:after', phase: 'end', run: () => calls.push('end') });
    endDay(newState(), { passedOut: false, weedCandidates: [] });
    unregisterDayHook('test:after');
    expect(calls).toEqual(['early-payout', 'late-payout', 'end']);
  });

  it('the built-in order is growth, payout, calendar, morning (crops grow before the date moves)', () => {
    const phases = [
      'start',
      'pre-growth',
      'growth',
      'payout',
      'calendar',
      'morning',
      'end',
    ] as const;
    const seen = phases.flatMap((p) => hooksFor(p).map((h) => h.phase));
    expect(seen).toEqual([...seen].sort((a, b) => phases.indexOf(a) - phases.indexOf(b)));
    expect(registeredHookIds()).toEqual(
      expect.arrayContaining(['core:growth', 'core:payout', 'core:calendar', 'core:morning']),
    );
  });

  it('re-registering an id replaces the hook instead of running it twice', () => {
    let n = 0;
    registerDayHook({ id: 'test:note', phase: 'end', run: () => n++ });
    registerDayHook({ id: 'test:note', phase: 'end', run: () => (n += 10) });
    endDay(newState(), { passedOut: false, weedCandidates: [] });
    expect(n).toBe(10);
  });

  it('a hook can hand data to a later hook through scratch', () => {
    registerDayHook({
      id: 'test:early',
      phase: 'start',
      run: (_s, ctx) => void (ctx.scratch['v'] = 42),
    });
    let seen: unknown;
    registerDayHook({
      id: 'test:note',
      phase: 'end',
      run: (_s, ctx) => void (seen = ctx.scratch['v']),
    });
    endDay(newState(), { passedOut: false, weedCandidates: [] });
    expect(seen).toBe(42);
  });
});

describe('extending placeables', () => {
  it('a new behavior plus one JSON-shaped definition is a working machine', () => {
    const s = newState();
    placeables['test_beacon'] = {
      name: 'Beacon',
      behavior: 'beacon',
      solid: true,
      sprite: 'obj_jar',
      params: { glow: 3 },
    };
    registerPlaceableBehavior('beacon', {
      onMorning: (_state, obj, def, ctx) => {
        obj.data['nights'] = Number(obj.data['nights'] ?? 0) + 1;
        ctx.notes.push(`Beacon glows ${def.params['glow']}`);
      },
    });
    const obj = placeObject(s, 'farm', 4, 4, 'test_beacon');
    const summary = endDay(s, { passedOut: false, weedCandidates: [] });
    endDay(s, { passedOut: false, weedCandidates: [] });
    expect(obj.data['nights']).toBe(2);
    expect(summary.notes).toContain('Beacon glows 3');
    delete placeables['test_beacon'];
  });

  it('tilling is unaffected by registered extras', () => {
    const s = newState();
    till(s, 2, 2);
    equip(s, 'parsnip_seed');
    expect(performAction(s, grass(2, 2))).toMatchObject({ kind: 'plant' });
  });
});
