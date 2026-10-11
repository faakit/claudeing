import { describe, expect, it } from 'vitest';
import { goals, tutorial, validateTutorial, type TutorialData } from '../src/data';
import { GOALS_V16, migrate } from '../src/systems/save';
import {
  CLOSE_BUTTON,
  COACH_LINE_PX,
  WELCOME_PX,
  advance,
  allLines,
  bestPaint,
  coachView,
  guidedNotes,
  guidedTracksDone,
  isFreshGame,
  layGift,
  referencedStats,
  replayTutorial,
  skipStep,
  skipTutorial,
  startTutorial,
  stepDone,
  tutorialOn,
  welcome,
  type CoachFacts,
  type CoachWorld,
} from '../src/systems/tutorial';
import { measureText } from '../src/ui/fontMetrics';
import { addStat, checkTips, currentGoal } from '../src/systems/goals';
import { gameEvents } from '../src/systems/events';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';
import { STATE_VERSION } from '../src/state/GameState';

const NO_SHEET: CoachFacts = { panel: null, tab: null };

/** A small stand-in for the farm as the scene would describe it. */
function world(s: GameState, over: Partial<CoachWorld> = {}): CoachWorld {
  return {
    map: 'farm',
    tile: { tx: 14, ty: 11 },
    facing: 'down',
    action: null,
    objects: [
      { type: 'bin', tx: 12, ty: 9, w: 1, h: 1 },
      { type: 'mailbox', tx: 13, ty: 9, w: 1, h: 1 },
      { type: 'door', tx: 14, ty: 7, w: 1, h: 1, to: 'house' },
      { type: 'door', tx: 14, ty: 43, w: 1, h: 1, to: 'town' },
    ],
    npcs: [],
    blocked: (tx, ty) => tx < 0 || ty < 0 || (tx === 12 && ty === 9) || (tx === 13 && ty === 9),
    // grass in the home plot can be tilled; empty soil planted; dry crops watered
    actKind: (tx, ty) => {
      if (tx < 9 || tx > 12 || ty < 16 || ty > 23) return null;
      const soil = s.farm.tiles[`${tx},${ty}`];
      if (!soil) return 'till';
      if (!soil.crop) return 'plant';
      return soil.watered ? null : 'water';
    },
    inView: () => true,
    ...over,
  };
}

function freshGuided(): GameState {
  const s = newState();
  startTutorial(s, { on: true, gift: true });
  return s;
}

const step = (s: GameState, w = world(s), f = NO_SHEET) => advance(s, w, f).current?.id ?? null;

describe('guided start: content', () => {
  it('the steps validate, and bad steps fail loudly', () => {
    expect(() => validateTutorial(tutorial)).not.toThrow();
    const bad = (mut: (t: TutorialData) => void): (() => void) => {
      const t = JSON.parse(JSON.stringify(tutorial)) as TutorialData;
      mut(t);
      return () => validateTutorial(t);
    };
    expect(bad((t) => (t.steps[0]!.done = []))).toThrow(/done/);
    expect(bad((t) => ((t.steps[0]!.done[0] as Record<string, unknown>)['stats'] = 1))).toThrow(
      /unknown condition/,
    );
    expect(bad((t) => (t.steps[0]!.target = { ui: 'menu', hud: 'goal' }))).toThrow(/exactly one/);
    expect(bad((t) => (t.gift.tiles = [[1, 1]]))).toThrow(/home plot/);
    expect(bad((t) => t.steps.push({ ...t.steps[0]! }))).toThrow(/unique/);
    expect(bad((t) => (t.steps[0]!.id = 'gift'))).toThrow(/reserved/);
    expect(bad((t) => (t.steps.find((x) => x.id === 'water2')!.when = undefined))).toThrow(/when/);
    expect(bad((t) => (t.steps[0]!.target = { find: 'ripe', map: 'moon' }))).toThrow(/map/);
  });

  it('every coach line fits one row, and the welcome two lines of its strip', () => {
    for (const l of [...allLines(), 'Close this to carry on.', 'Head back to the house.'])
      expect(measureText(l), l).toBeLessThanOrEqual(COACH_LINE_PX);
    expect(measureText(welcome().text)).toBeLessThanOrEqual(WELCOME_PX * 2 - 20);
  });

  it('every early goal agrees with the guided day: pick, plant, sell, sleep', () => {
    expect(goals.slice(0, 6).map((g) => g.id)).toEqual([
      'gift',
      'plant',
      'ship1',
      'forage',
      'talk',
      'sleep',
    ]);
    for (const g of goals.slice(0, 6)) expect(measureText(g.text), g.id).toBeLessThanOrEqual(182);
  });
});

describe('guided start: the step machine', () => {
  it('a new game lays out the gift once and starts on the first step', () => {
    const s = newState();
    expect(isFreshGame(s)).toBe(true);
    startTutorial(s, { on: true, gift: true });
    expect(isFreshGame(s)).toBe(false);
    expect(tutorialOn(s)).toBe(true);
    const ripe = Object.values(s.farm.tiles).filter((t) => t.crop?.stage === 4);
    expect(ripe).toHaveLength(3);
    expect(Object.keys(s.forage['farm'] ?? {})).toHaveLength(1);
    expect(layGift(s)).toBe(false); // never twice
    expect(step(s)).toBe('harvest');
    expect(currentGoal(s)?.id).toBe('gift');
  });

  it('a bare new game (automated checks) has no guide and no gift', () => {
    const s = newState();
    startTutorial(s, { on: false, gift: false });
    expect(tutorialOn(s)).toBe(false);
    expect(Object.keys(s.farm.tiles)).toHaveLength(0);
    expect(step(s)).toBeNull();
  });

  it('day 1 completes step by step, only by doing each thing', () => {
    const s = freshGuided();
    const w = world(s);
    expect(step(s, w)).toBe('harvest');
    s.inventory.slots[9] = { item: 'parsnip', qty: 3 };
    for (const [k, t] of Object.entries(s.farm.tiles)) {
      if (k === '12,16') continue;
      t.crop = null; // two picked
    }
    addStat(s, 'harvested', 2);
    expect(step(s, w)).toBe('harvest'); // 2 of 3: not yet
    s.farm.tiles['12,16']!.crop = null;
    addStat(s, 'harvested', 1);
    expect(step(s, w)).toBe('seeds');
    s.inventory.selected = 5; // the parsnip seeds
    expect(step(s, w)).toBe('plant');
    s.farm.tiles['12,16']!.crop = { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false };
    addStat(s, 'planted', 1);
    expect(step(s, w)).toBe('water');
    // watering bare soil does not finish the water step (critic finding 4): a crop must be wet
    s.farm.tiles['11,16']!.watered = true;
    addStat(s, 'watered', 3);
    expect(step(s, w)).toBe('water');
    s.farm.tiles['12,16']!.watered = true;
    expect(step(s, w)).toBe('grow');
    addStat(s, 'planted', 4);
    expect(step(s, w)).toBe('ship');
    expect(step(s, w)).toBe('ship');
    addStat(s, 'shipped', 3);
    // three info lines (clock, energy, errands), each gone with the player's next touch
    expect(step(s, w)).toBe('clock');
    const touch = (id: string) => ({ panel: null, tab: null, touches: 1, touchStep: id });
    expect(step(s, w, touch('clock'))).toBe('energy');
    expect(step(s, w, touch('clock'))).toBe('energy'); // a touch counted for another step does nothing
    expect(step(s, w, touch('energy'))).toBe('errands');
    expect(step(s, w, touch('errands'))).not.toBe('sleep'); // free play until evening
    s.time.minutes = 1080;
    expect(step(s, w)).toBe('sleep');
    addStat(s, 'daysSlept', 1);
    step(s, w);
    expect(stepDone(s, 'sleep')).toBe(true);
  });

  it('the row tip is offered after two tiles worked one at a time, and is never required', () => {
    const s = freshGuided();
    for (const k of Object.keys(s.farm.tiles)) s.farm.tiles[k]!.crop = null;
    addStat(s, 'harvested', 3);
    s.inventory.selected = 5;
    addStat(s, 'planted', 1);
    s.farm.tiles['12,16']!.crop = { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false };
    s.farm.tiles['12,16']!.watered = true;
    const w = world(s, { tile: { tx: 12, ty: 15 }, action: { plan: 'till', tx: 12, ty: 16 } });
    expect(step(s, w)).toBe('grow');
    const st = advance(s, w, NO_SHEET).current!;
    expect(coachView(s, w, NO_SHEET, st).pointer?.kind).toBe('ui');
    addStat(s, 'tilled', 2);
    const tip = coachView(s, world(s, { tile: { tx: 10, ty: 15 } }), NO_SHEET, st);
    expect(tip.text).toMatch(/^Tip: hold Action, drag down/);
    expect(tip.pointer).toMatchObject({ kind: 'paint', dir: 'down' });
    expect(s.stats['tip.paint']).toBe(1); // the old first-run tip will not repeat it
    addStat(s, 'planted', 4); // kept tapping instead: the step still completes
    step(s, w);
    expect(stepDone(s, 'grow')).toBe(true);
  });

  it('a step that cannot be done is passed (nothing to ship, no ripe crop)', () => {
    const s = freshGuided();
    s.farm.tiles = {};
    expect(step(s)).not.toBe('harvest');
    expect(stepDone(s, 'harvest')).toBe(true);
  });

  it('recovers when the player wanders: another map points at the door, an open sheet at Close', () => {
    const s = freshGuided();
    const house = world(s, {
      map: 'house',
      tile: { tx: 5, ty: 6 },
      objects: [{ type: 'door', tx: 5, ty: 8, w: 1, h: 1, to: 'farm' }],
    });
    const cur = advance(s, house, NO_SHEET).current!;
    const v = coachView(s, house, NO_SHEET, cur);
    expect(v.away).toBe(true);
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 5, ty: 8 });
    expect(v.text).toBe('Tap the door to go outside.');
    const town = world(s, {
      map: 'town',
      objects: [{ type: 'door', tx: 11, ty: 1, w: 1, h: 1, to: 'farm' }],
    });
    expect(coachView(s, town, NO_SHEET, cur).text).toBe('Head back to the farm.');
    const menu = coachView(s, world(s), { panel: 'menu', tab: 'bag' }, cur);
    expect(menu.pointer).toEqual({ kind: 'button', pattern: CLOSE_BUTTON });
  });

  it('points at the bed tile that has a free side (the top half has none)', () => {
    const s = freshGuided();
    for (const id of [
      'harvest',
      'seeds',
      'plant',
      'water',
      'grow',
      'ship',
      'clock',
      'energy',
      'errands',
    ])
      s.stats[`tut.${id}`] = 1;
    s.time.minutes = 1100;
    const house = world(s, {
      map: 'house',
      tile: { tx: 5, ty: 7 },
      objects: [{ type: 'bed', tx: 1, ty: 2, w: 2, h: 2 }],
      blocked: (tx, ty) => tx <= 0 || ty <= 1 || (tx >= 1 && tx <= 2 && ty >= 2 && ty <= 3),
    });
    const cur = advance(s, house, NO_SHEET).current!;
    expect(cur.id).toBe('sleep');
    const p = coachView(s, house, NO_SHEET, cur).pointer;
    expect(p).toMatchObject({ kind: 'tile', tx: 2, ty: 3 });
  });

  it('skip ends the guide for good (saved); one step can be skipped alone', () => {
    const s = freshGuided();
    skipStep(s, 'harvest');
    expect(step(s)).toBe('seeds');
    skipTutorial(s);
    expect(tutorialOn(s)).toBe(false);
    expect(step(s)).toBeNull();
    expect(tutorialOn(migrate(JSON.parse(JSON.stringify(s))))).toBe(false);
  });

  it('replay on a day-30 save never touches goals, gold or crops, and starts at the first possible step', () => {
    const s = freshGuided();
    s.time.day = 30;
    s.goalIndex = 12;
    s.money = 4321;
    s.stats['harvested'] = 80;
    s.stats['planted'] = 90;
    skipTutorial(s);
    s.farm.tiles = {
      '10,17': {
        watered: true,
        crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false },
      },
    };
    const before = JSON.stringify({ g: s.goalIndex, m: s.money, f: s.farm });
    replayTutorial(s);
    expect(JSON.stringify({ g: s.goalIndex, m: s.money, f: s.farm })).toBe(before);
    expect(tutorialOn(s)).toBe(true);
    expect(s.stats['tut.gift']).toBe(1); // no second gift
    for (const name of referencedStats())
      expect(s.stats[`tut.base.${name}`]).toBe(s.stats[name] ?? 0);
    // no ripe crop: harvest is passed; planting counts from now, not from the 90 lifetime plantings
    expect(step(s)).toBe('seeds');
    s.inventory.selected = 5;
    // no empty soil to plant and the one crop is watered: on to "dig, plant, water" (5 from now)
    expect(step(s)).toBe('grow');
    addStat(s, 'planted', 4);
    expect(step(s)).toBe('grow');
  });

  it('progress survives a save round-trip, mid-step', () => {
    const s = freshGuided();
    addStat(s, 'harvested', 3);
    for (const k of Object.keys(s.farm.tiles)) s.farm.tiles[k]!.crop = null;
    expect(step(s)).toBe('seeds');
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(step(back)).toBe('seeds');
    expect(stepDone(back, 'harvest')).toBe(true);
  });

  it('day 2 waits for day 2, then intros come one at a time', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
    // still day 1: the day-2 track waits; meanwhile only introductions (the wild leek in view)
    expect(tutorial.steps.find((x) => x.id === step(s))?.track).toBe('intro');
    s.stats['tut.forage'] = 1;
    s.time.day = 2;
    // nothing dry and no letter: those two pass at once, the Menu is next
    expect(step(s)).toBe('menu');
    expect(stepDone(s, 'water2') && stepDone(s, 'mail')).toBe(true);
    expect(step(s, world(s), { panel: 'menu', tab: 'bag' })).toBe('jobs');
  });

  it('the first guided morning keeps one note: the letter', () => {
    expect(
      guidedNotes([
        'Special order: 15 Potato',
        'New jobs from Finn.',
        'A new letter in the mailbox.',
      ]),
    ).toEqual(['A new letter in the mailbox.']);
    expect(guidedNotes(['Fresh wild goods today.'])).toEqual(['Fresh wild goods today.']);
  });

  it('first-time tips wait until the guided days are over', () => {
    const s = freshGuided();
    const seen: string[] = [];
    const off = gameEvents.on('toast', (t) => seen.push(t.text));
    addStat(s, 'foraged', 1);
    checkTips(s);
    expect(seen.some((t) => t.includes('Wild goods'))).toBe(false);
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    expect(guidedTracksDone(s)).toBe(true);
    checkTips(s);
    off();
    expect(seen.some((t) => t.includes('Wild goods'))).toBe(true);
  });

  it('the row tip runs straight ahead from the faced tile, unbroken, and never flips', () => {
    const s = freshGuided();
    // facing left from the plot's edge: the 4 plot tiles in a row
    const p = bestPaint(world(s, { tile: { tx: 13, ty: 18 }, facing: 'left' }));
    expect(p?.dir).toBe('left');
    expect(p?.tiles.length).toBe(4);
    // facing away from the plot: the row the other way (two refusals there and the tip gives way)
    expect(bestPaint(world(s, { tile: { tx: 13, ty: 18 }, facing: 'right' }))?.dir).toBe('left');
    expect(bestPaint(world(s, { tile: { tx: 20, ty: 30 } }))).toBeNull();
    // a watered crop right beside breaks the row at once (a row starts where Action works)
    s.farm.tiles['12,18'] = {
      watered: true,
      crop: { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false },
    };
    expect(bestPaint(world(s, { tile: { tx: 13, ty: 18 }, facing: 'left' }))).toBeNull();
    // ahead wins over a longer row elsewhere
    const mid = bestPaint(world(s, { tile: { tx: 10, ty: 20 }, facing: 'right' }));
    expect(mid).toMatchObject({ dir: 'right' });
  });
});

describe('save v17: the guided start goals', () => {
  const at = (id: string): Record<string, unknown> => {
    const raw = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    raw['version'] = 16;
    raw['goalIndex'] = GOALS_V16.indexOf(id as (typeof GOALS_V16)[number]);
    raw['money'] = 777;
    return raw;
  };
  it.each([
    ['till', 'plant'],
    ['plant', 'plant'],
    ['water', 'forage'],
    ['sleep', 'forage'],
    ['forage', 'forage'],
    ['buy', 'buy'],
    ['board1', 'board1'],
  ])('a save on "%s" moves to "%s" and pays nothing twice', (from, to) => {
    const raw = at(from);
    if (from === 'till') raw['stats'] = { tilled: 3 };
    const s = migrate(raw);
    expect(goals[s.goalIndex]?.id).toBe(to);
    expect(s.money).toBe(777);
    expect(s.version).toBe(STATE_VERSION);
    expect(tutorialOn(s)).toBe(false); // old saves never get the guide unless they replay it
  });

  it('a v16 save in the middle of day 1 keeps its farm and lands on a sensible goal', () => {
    const raw = at('water');
    (raw['farm'] as { tiles: Record<string, unknown> }).tiles = {
      '10,17': {
        watered: false,
        crop: { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false },
      },
    };
    const s = migrate(raw);
    expect(Object.keys(s.farm.tiles)).toEqual(['10,17']);
    expect(goals[s.goalIndex]?.id).toBe('forage');
  });

  it('every save past the end stays past the end', () => {
    const raw = at('board1');
    raw['goalIndex'] = GOALS_V16.length;
    expect(migrate(raw).goalIndex).toBe(goals.length);
  });
});

describe('coach marks geometry', () => {
  it('the off-screen arrow sits where the way to the target leaves the view, never on the farmer', async () => {
    const { edgePoint } = await import('../src/ui/coachGeometry');
    const box = { x0: 10, x1: 190, y0: 120, y1: 280 };
    const me = { x: 100, y: 181 };
    // straight up, behind the coach strip: the arrow is at the top of what is visible
    expect(edgePoint(me, { x: 100, y: 60 }, box)).toEqual({ x: 100, y: 120 });
    // far down-left: on the way, inside the box
    const e = edgePoint(me, { x: -200, y: 500 }, box);
    expect(e.x).toBe(10);
    expect(e.y).toBeGreaterThan(181);
    expect(Math.hypot(e.x - me.x, e.y - me.y)).toBeGreaterThan(16);
  });
});

describe('guided start: never stalls far from the plot', () => {
  const grown = (): GameState => {
    const s = freshGuided();
    for (const id of ['harvest', 'seeds', 'plant', 'water']) s.stats[`tut.${id}`] = 1;
    s.inventory.selected = 5;
    return s;
  };

  it('"dig, plant, water" points at a spot beside the plot from anywhere on the farm', () => {
    const s = grown();
    const far = world(s, { tile: { tx: 2, ty: 31 } });
    const cur = advance(s, far, NO_SHEET).current!;
    expect(cur.id).toBe('grow');
    const v = coachView(s, far, NO_SHEET, cur);
    expect(v.pointer?.kind).toBe('tile');
    expect(v.text).toBe('Tap here, then press Action.');
  });

  it('the long walk to town is a stick drag, then a tap on the gate once it is near', () => {
    const s = grown();
    for (const st of tutorial.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
    for (const id of ['water2', 'mail', 'menu', 'jobs']) s.stats[`tut.${id}`] = 1;
    s.time.day = 2;
    const w = world(s);
    const cur = advance(s, w, NO_SHEET).current!;
    expect(cur.id).toBe('town');
    expect(coachView(s, w, NO_SHEET, cur).pointer).toEqual({ kind: 'stick', dir: 'down' });
    const near = world(s, { tile: { tx: 14, ty: 40 } });
    expect(coachView(s, near, NO_SHEET, cur).pointer).toMatchObject({
      kind: 'tile',
      tx: 14,
      ty: 43,
    });
  });
});

describe('guided start: day 1 ends in the evening, never at breakfast', () => {
  it('the bed step waits for 6 PM or low energy; sleeping earlier still finishes it', () => {
    const s = freshGuided();
    for (const st of tutorial.steps)
      if (st.track === 'day1' && st.id !== 'sleep') s.stats[`tut.${st.id}`] = 1;
    s.time.minutes = 9 * 60;
    expect(step(s)).not.toBe('sleep');
    s.energy = 20;
    expect(step(s)).toBe('sleep');
    s.energy = 100;
    s.stats['daysSlept'] = 1; // went to bed early anyway
    step(s);
    expect(stepDone(s, 'sleep')).toBe(true);
  });

  it('an info line goes with the next touch, not by itself', () => {
    const s = freshGuided();
    for (const id of ['harvest', 'seeds', 'plant', 'water', 'grow', 'ship'])
      s.stats[`tut.${id}`] = 1;
    expect(step(s)).toBe('clock');
    expect(step(s)).toBe('clock');
    expect(step(s, world(s), { panel: null, tab: null, touches: 1, touchStep: 'clock' })).toBe(
      'energy',
    );
  });

  it('an empty can points at the pond', () => {
    const s = freshGuided();
    for (const id of ['harvest', 'seeds', 'plant']) s.stats[`tut.${id}`] = 1;
    s.farm.tiles['10,16']!.crop = { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false };
    s.water = 0;
    const w = world(s, { water: [{ tx: 18, ty: 33 }] });
    const cur = advance(s, w, NO_SHEET).current!;
    expect(cur.id).toBe('water');
    const v = coachView(s, w, NO_SHEET, cur);
    expect(v.text).toBe('Your can is empty: tap the pond.');
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 18, ty: 33 });
  });
});

describe('guided start: the wrong thing in hand', () => {
  it('with the rod in hand, watering points at the can on the hotbar first', () => {
    const s = freshGuided();
    for (const id of ['harvest', 'seeds', 'plant']) s.stats[`tut.${id}`] = 1;
    s.farm.tiles['10,16']!.crop = { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false };
    s.inventory.selected = 3; // the rod: Action and taps do only what it does
    const cur = advance(s, world(s), NO_SHEET).current!;
    expect(cur.id).toBe('water');
    const v = coachView(s, world(s), NO_SHEET, cur);
    expect(v.text).toBe('Tap the can on the hotbar first.');
    expect(v.pointer).toEqual({ kind: 'slot', slot: 1 });
  });
});

describe('guided start: review 3', () => {
  it('the first guided morning fills the can once, and says so', async () => {
    const { guidedMorningCan, CAN_NOTE } = await import('../src/systems/tutorial');
    const s = freshGuided();
    s.water = 3;
    expect(guidedMorningCan(s, 20)).toBe(false); // still day 1
    s.time.day = 2;
    expect(guidedMorningCan(s, 20)).toBe(true);
    expect(s.water).toBe(20);
    s.water = 0;
    expect(guidedMorningCan(s, 20)).toBe(false); // once
    expect(guidedNotes(['A new letter in the mailbox.', CAN_NOTE, 'New jobs.'])).toEqual([
      CAN_NOTE,
      'A new letter in the mailbox.',
    ]);
  });

  it('arriving in town on the "buy" goal points at Mara, never at the rod', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    s.stats['tut.townHello'] = 1;
    s.stats['foraged'] = 3; // the wild-goods intro is over
    s.goalIndex = goals.findIndex((g) => g.id === 'buy');
    s.time.day = 2;
    s.time.minutes = 9 * 60;
    s.jobs = {
      day: 30,
      list: [{ id: 'fish', giver: 'finn', stat: 'caught', base: 0, n: 1, reward: 20, done: false }],
    };
    const town = world(s, { map: 'town', npcs: [{ id: 'mara', tx: 8, ty: 10 }], objects: [] });
    expect(step(s, town)).toBe('buySeeds');
  });
});

describe('guided start: final-round fixes', () => {
  it('the stick is only shown when the straight way is open; otherwise the gate is pointed at', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
    for (const id of ['water2', 'mail', 'menu', 'jobs']) s.stats[`tut.${id}`] = 1;
    s.time.day = 2;
    const blockedBelow = world(s, { blocked: (tx, ty) => tx === 14 && ty === 13 });
    const cur = advance(s, blockedBelow, NO_SHEET).current!;
    expect(coachView(s, blockedBelow, NO_SHEET, cur).pointer).toMatchObject({
      kind: 'tile',
      tx: 14,
      ty: 43,
    });
  });

  it('while watering, a planting refusal never says "seed packet"', async () => {
    const { rewriteRefusal } = await import('../src/systems/tutorial');
    expect(rewriteRefusal('Pick seeds on the hotbar first.', 'water2')).toBe(
      'Tap a dry crop to water it.',
    );
    expect(rewriteRefusal('Pick seeds on the hotbar first.', 'grow')).toBe(
      'Tap the seed packet on the hotbar.',
    );
  });
});

describe('guided start: onboarding round 2', () => {
  const crop = (watered: boolean) => ({
    watered,
    crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false },
  });
  const dayOneDone = (s: GameState, except: string[] = []): void => {
    for (const st of tutorial.steps)
      if (st.track === 'day1' && !except.includes(st.id)) s.stats[`tut.${st.id}`] = 1;
  };

  it('a guided game rains on day 2 (no chore), a bare one keeps its sunny start', () => {
    expect(freshGuided().forecast).toBe('rain');
    const bare = newState();
    startTutorial(bare, { on: false, gift: false });
    expect(bare.forecast).toBe('sunny');
  });

  it('on the rain morning the day-2 track starts at the letter, and the can fills quietly', async () => {
    const { guidedMorningCan } = await import('../src/systems/tutorial');
    const s = freshGuided();
    dayOneDone(s);
    s.stats['tut.forage'] = 1;
    s.farm.tiles['10,16'] = crop(true);
    s.time.day = 2;
    s.weather = 'rain';
    s.water = 2;
    expect(guidedMorningCan(s, 20)).toBe(false); // filled, but no note
    expect(s.water).toBe(20);
    s.mail.list.push({ id: 1, from: 'rosa', day: 2, text: 'Hi', read: false } as never);
    expect(step(s)).toBe('mail');
    expect(stepDone(s, 'water2')).toBe(true);
  });

  it('while watering, the row tip is a row of dry crops, never grass to till', () => {
    const s = freshGuided();
    dayOneDone(s);
    s.stats['tut.forage'] = 1;
    s.time.day = 2;
    for (const k of Object.keys(s.farm.tiles)) delete s.farm.tiles[k];
    s.farm.tiles['10,17'] = crop(false);
    s.farm.tiles['10,18'] = crop(false);
    s.farm.tiles['10,19'] = crop(false);
    s.stats['watered'] = 0;
    const w = world(s, { tile: { tx: 10, ty: 16 }, facing: 'down' });
    expect(step(s, w)).toBe('water2');
    s.stats['watered'] = 2; // two watered one at a time: the tip is offered
    const v = coachView(
      s,
      w,
      NO_SHEET,
      tutorial.steps.find((x) => x.id === 'water2')!,
    );
    expect(v.pointer).toMatchObject({ kind: 'paint', dir: 'down' });
    expect((v.pointer as { tiles: unknown[] }).tiles).toHaveLength(3);
    // facing the plot's grass: never a tilling row; the dry crops' row is offered
    const w2 = tutorial.steps.find((x) => x.id === 'water2')!;
    const side = world(s, { tile: { tx: 10, ty: 16 }, facing: 'right' });
    expect(coachView(s, side, NO_SHEET, w2).pointer).toMatchObject({ kind: 'paint', dir: 'down' });
    // no row of dry crops from here: the ring goes back on a dry crop
    const off = world(s, { tile: { tx: 12, ty: 16 }, facing: 'left' });
    const v3 = coachView(s, off, NO_SHEET, w2);
    expect(v3.pointer?.kind).toBe('tile');
    expect(v3.text).toMatch(/^Water every dry crop/);
  });

  it('once the errands are done, the bed is offered; exploring on lets it go until 6 PM', () => {
    const s = freshGuided();
    dayOneDone(s, ['bedOffer', 'sleep']);
    s.stats['tut.forage'] = 1;
    s.time.minutes = 10 * 60;
    s.goalIndex = goals.findIndex((g) => g.id === 'talk');
    expect(step(s)).not.toBe('bedOffer'); // errands still open
    s.goalIndex = goals.findIndex((g) => g.id === 'sleep');
    const cur = advance(s, world(s), NO_SHEET).current!;
    expect(cur.id).toBe('bedOffer');
    const v = coachView(s, world(s), NO_SHEET, cur);
    expect(v.text).toBe('All done! Sleep, or keep exploring.');
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 14, ty: 7 }); // the house door
    // inside, the bed
    const house = world(s, {
      map: 'house',
      tile: { tx: 5, ty: 8 },
      objects: [{ type: 'bed', tx: 2, ty: 3, w: 1, h: 2 }],
      blocked: () => false,
    });
    expect(coachView(s, house, NO_SHEET, cur).text).toBe('Tap the bed to sleep, or explore.');
    // keeps exploring on the farm: after 40 game minutes the offer goes
    s.time.minutes += 41;
    expect(step(s)).not.toBe('bedOffer');
    expect(stepDone(s, 'bedOffer') && !stepDone(s, 'sleep')).toBe(true);
    // the evening still nudges
    s.time.minutes = 18 * 60;
    expect(step(s)).toBe('sleep');
  });

  it('errands finished in town: the offer shows there (home or explore), and goes after a while', () => {
    const s = freshGuided();
    dayOneDone(s, ['bedOffer', 'sleep']);
    s.stats['tut.forage'] = 1;
    s.time.minutes = 9 * 60;
    s.goalIndex = goals.findIndex((g) => g.id === 'sleep');
    const town = world(s, {
      map: 'town',
      objects: [{ type: 'door', tx: 14, ty: 0, w: 1, h: 1, to: 'farm' }],
    });
    const cur = advance(s, town, NO_SHEET).current!;
    expect(cur.id).toBe('bedOffer');
    const v = coachView(s, town, NO_SHEET, cur);
    expect(v.text).toBe('All done! Sleep at home, or explore.');
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 14, ty: 0 });
    s.time.minutes += 41;
    step(s, town);
    expect(stepDone(s, 'bedOffer')).toBe(true);
  });

  it('a letter left with its gift points at Read again, and reading one then closing ends the step', () => {
    const s = freshGuided();
    dayOneDone(s);
    s.stats['tut.forage'] = 1;
    s.time.day = 2;
    s.weather = 'rain';
    s.mail.list.push(
      {
        id: 1,
        from: 'rosa',
        day: 2,
        text: 'Hi',
        read: true,
        gift: { item: 'parsnip_seed', qty: 5 },
      } as never,
      { id: 2, from: 'mara', day: 2, text: 'Hello', read: false } as never,
    );
    const mailOpen: CoachFacts = { panel: 'mail', tab: null };
    const cur = advance(s, world(s), mailOpen).current!;
    expect(cur.id).toBe('mail');
    const v = coachView(s, world(s), mailOpen, cur);
    expect(v.pointer).toEqual({ kind: 'button', pattern: '^Take gift$||^Read$' });
    // closed without taking it: done, never a loop back to the mailbox
    expect(step(s)).not.toBe('mail');
    expect(stepDone(s, 'mail')).toBe(true);
  });

  it('the first dry morning after the guided days teaches daily watering, with a row of dry crops', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    s.stats['tut.forage'] = 1;
    s.stats['foraged'] = 3;
    for (const k of Object.keys(s.farm.tiles)) delete s.farm.tiles[k];
    s.farm.tiles['10,17'] = crop(false);
    s.farm.tiles['10,18'] = crop(false);
    s.time.day = 2;
    expect(step(s)).not.toBe('waterDaily');
    s.time.day = 3;
    s.weather = 'sunny';
    const w = world(s, { tile: { tx: 10, ty: 16 }, facing: 'down' });
    const cur = advance(s, w, NO_SHEET).current!;
    expect(cur.id).toBe('waterDaily');
    expect(coachView(s, w, NO_SHEET, cur).text).toBe('Sunny! Water your crops: 2 left.');
    s.stats['watered'] = (s.stats['watered'] ?? 0) + 1;
    s.farm.tiles['10,17']!.watered = true;
    s.farm.tiles['10,19'] = crop(false);
    const v = coachView(s, world(s, { tile: { tx: 10, ty: 17 }, facing: 'down' }), NO_SHEET, cur);
    expect(v.pointer).toMatchObject({ kind: 'paint', dir: 'down' });
    // leaving the farm with crops still dry: the intro is over (it never nags in town)
    step(s, world(s, { map: 'town', objects: [] }));
    expect(stepDone(s, 'waterDaily')).toBe(true);
  });
});

describe('guided start: the walk to town follows the real way', () => {
  const onTownStep = (): GameState => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
    for (const id of ['water2', 'mail', 'menu', 'jobs', 'forage']) s.stats[`tut.${id}`] = 1;
    s.time.day = 2;
    return s;
  };
  const line = (from: [number, number], to: [number, number]) => {
    const out = [];
    let [x, y] = from;
    out.push({ tx: x, ty: y });
    while (x !== to[0] || y !== to[1]) {
      if (x !== to[0]) x += Math.sign(to[0] - x);
      else y += Math.sign(to[1] - y);
      out.push({ tx: x, ty: y });
    }
    return out;
  };

  it('the stick shows the way the walk really goes; a walk that turns soon gets the arrow instead', async () => {
    const { steerDir } = await import('../src/systems/tutorial');
    const s = onTownStep();
    // the walk heads right first (round the woodpile), then down: the stick drags right
    const right = world(s, {
      route: () => [...line([14, 11], [20, 11]), ...line([20, 12], [14, 43])],
    });
    expect(steerDir(right, { tx: 14, ty: 43 })).toBe('right');
    const cur = advance(s, right, NO_SHEET).current!;
    expect(cur.id).toBe('town');
    expect(coachView(s, right, NO_SHEET, cur).pointer).toEqual({ kind: 'stick', dir: 'right' });
    // it turns after 2 tiles: no stick, the gate (its arrow walks the route)
    const turns = world(s, {
      route: () => [...line([14, 11], [16, 11]), ...line([16, 12], [14, 43])],
    });
    expect(coachView(s, turns, NO_SHEET, cur).pointer).toMatchObject({
      kind: 'tile',
      tx: 14,
      ty: 43,
    });
  });

  it("an off-screen target's arrow sits on the farthest walk tile in view, never on soil or water", async () => {
    const { routeWaypoint } = await import('../src/systems/tutorial');
    const s = onTownStep();
    const w = world(s, {
      tile: { tx: 14, ty: 20 },
      route: () => [...line([14, 20], [11, 20]), ...line([11, 21], [11, 30])],
    });
    // in view: rows up to 24; tiles 9-12 x 16-23 are plot (actKind), so the last plain tile is (11, 24)
    const way = routeWaypoint(w, { tx: 11, ty: 30 }, (t) => t.ty <= 24);
    expect(way).toEqual({ tx: 11, ty: 24 });
  });
});

describe('guided start: round-5 critic findings', () => {
  it('after two refusals in a row the row tip gives way to the one-tile pointer', () => {
    const s = freshGuided();
    for (const id of ['harvest', 'seeds', 'plant', 'water']) s.stats[`tut.${id}`] = 1;
    s.inventory.selected = s.inventory.slots.findIndex((x) => x?.item === 'parsnip_seed');
    const w = world(s, { tile: { tx: 13, ty: 18 }, facing: 'left' });
    const cur = advance(s, w, NO_SHEET).current!;
    expect(cur.id).toBe('grow');
    s.stats['tilled'] = (s.stats['tilled'] ?? 0) + 2; // two tiles worked one at a time: the tip is offered
    expect(coachView(s, w, NO_SHEET, cur).pointer?.kind).toBe('paint');
    const v = coachView(s, w, { ...NO_SHEET, refused: 2 }, cur);
    expect(v.pointer?.kind).not.toBe('paint');
    expect(v.text).not.toMatch(/^Tip:/);
  });

  it('while planting, "already growing" says to tap an empty spot', async () => {
    const { rewriteRefusal } = await import('../src/systems/tutorial');
    expect(rewriteRefusal('Something is already growing here.', 'grow')).toBe(
      'Tap an empty spot, then Action.',
    );
  });

  it('next to the mailbox with Interact lit for it, the coach points at the lit button too', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track === 'day1') s.stats[`tut.${st.id}`] = 1;
    s.stats['tut.forage'] = 1;
    s.time.day = 2;
    s.weather = 'rain';
    s.mail.list.push({ id: 1, from: 'rosa', day: 2, text: 'Hi', read: false } as never);
    const w = world(s, { tile: { tx: 14, ty: 9 }, facing: 'left' });
    const cur = advance(s, w, NO_SHEET).current!;
    expect(cur.id).toBe('mail');
    expect(coachView(s, w, NO_SHEET, cur).pointer).toMatchObject({ kind: 'tile', tx: 13, ty: 9 });
    const v = coachView(s, w, { ...NO_SHEET, interact: 'mailbox' }, cur);
    expect(v.pointer).toEqual({ kind: 'ui', id: 'interact', tile: { tx: 13, ty: 9 } });
    expect(v.text).toBe('Tap the lit button to open it.');
    // lit for something else: the mailbox itself stays the target
    expect(coachView(s, w, { ...NO_SHEET, interact: 'bin' }, cur).pointer?.kind).toBe('tile');
  });
});

describe('guided start: review 6', () => {
  it('in town before Mara arrives, the counter is pointed at (it sells at any hour), never a closed shop', () => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    s.stats['foraged'] = 3;
    s.goalIndex = goals.findIndex((g) => g.id === 'buy');
    s.time.day = 2;
    s.time.minutes = 6 * 60 + 55;
    const town = world(s, {
      map: 'town',
      npcs: [],
      objects: [{ type: 'shop', tx: 4, ty: 9, w: 3, h: 1 }],
      blocked: () => false,
    });
    const cur = advance(s, town, NO_SHEET).current!;
    const v = coachView(s, town, NO_SHEET, cur);
    expect(v.text).toBe('Tap the counter to buy seeds.');
    expect(v.pointer).toMatchObject({ kind: 'tile', ty: 9 });
    expect(allLines().some((l) => /opens at/.test(l))).toBe(false);
  });

  it('the early goals have an arrow from the house and from town (never silent indoors)', () => {
    for (const g of goals.slice(0, 7)) {
      expect(g.where?.['house'], g.id).toBeDefined();
      expect(g.where?.['town'], g.id).toBeDefined();
    }
  });

  it('gesture tips are held back during the guided days', async () => {
    const { tipsHeldNow } = await import('../src/systems/goals');
    const s = freshGuided();
    expect(tipsHeldNow(s)).toBe(true);
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    expect(tipsHeldNow(s)).toBe(false);
  });
});

describe('guided start: depth round 4 introductions', () => {
  it('on the settling-in days an open job gets one line: Menu, then Goal', async () => {
    const { game } = await import('../src/data');
    const g = game as { welcomeJobs?: { from: number; to: number; factor: number } };
    const before = g.welcomeJobs;
    g.welcomeJobs = { from: 3, to: 4, factor: 2 };
    try {
      const s = freshGuided();
      for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
      s.stats['foraged'] = 3;
      s.time.day = 3;
      s.jobs = {
        day: 3,
        list: [{ id: 'j', giver: 'finn', stat: 'caught', base: 0, n: 1, reward: 40, done: false }],
      };
      const house = world(s, { map: 'house', objects: [] });
      expect(step(s, house)).toBe('welcomeJobs');
      const cur = tutorial.steps.find((x) => x.id === 'welcomeJobs')!;
      expect(coachView(s, house, NO_SHEET, cur).pointer).toEqual({ kind: 'ui', id: 'menu' });
      const menu: CoachFacts = { panel: 'menu', tab: 'bag' };
      expect(coachView(s, house, menu, cur).pointer).toEqual({ kind: 'button', pattern: '^Goal$' });
      step(s, house, { panel: 'menu', tab: 'goals' });
      expect(stepDone(s, 'welcomeJobs')).toBe(true);
      // without settling-in days in the data, it never shows
      g.welcomeJobs = undefined;
      const t = freshGuided();
      for (const st of tutorial.steps) if (st.track !== 'intro') t.stats[`tut.${st.id}`] = 1;
      t.stats['foraged'] = 3;
      t.time.day = 3;
      t.jobs = s.jobs;
      expect(step(t, house)).not.toBe('welcomeJobs');
    } finally {
      g.welcomeJobs = before;
    }
  });
});

describe('guided start: review 7', () => {
  const afterGuide = (): GameState => {
    const s = freshGuided();
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    s.stats['foraged'] = 3;
    s.stats['tut.forage'] = 1;
    return s;
  };

  it('late at night in town, the way home is pointed at (gate, then door, then bed)', () => {
    const s = afterGuide();
    s.time.day = 2;
    s.time.minutes = 23 * 60;
    const town = world(s, {
      map: 'town',
      objects: [{ type: 'door', tx: 11, ty: 0, w: 1, h: 1, to: 'farm' }],
    });
    const cur = advance(s, town, NO_SHEET).current!;
    expect(cur.id).toBe('late');
    let v = coachView(s, town, NO_SHEET, cur);
    expect(v.text).toBe("It's late! Head home to sleep.");
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 11, ty: 0 });
    v = coachView(s, world(s), NO_SHEET, cur);
    expect(v.text).toBe("It's late! Tap the door, then bed.");
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 14, ty: 7 });
  });

  it('waking indoors on the first dry morning points at the door, and leaving the farm ends it', () => {
    const s = afterGuide();
    for (const k of Object.keys(s.farm.tiles)) delete s.farm.tiles[k];
    s.farm.tiles['10,17'] = {
      watered: false,
      crop: { cropId: 'parsnip', stage: 1, daysInStage: 0, regrow: false },
    };
    s.time.day = 3;
    const house = world(s, {
      map: 'house',
      objects: [{ type: 'door', tx: 5, ty: 8, w: 1, h: 1, to: 'farm' }],
    });
    const cur = advance(s, house, NO_SHEET).current!;
    expect(cur.id).toBe('waterDaily');
    const v = coachView(s, house, NO_SHEET, cur);
    expect(v.pointer).toMatchObject({ kind: 'tile', tx: 5, ty: 8 });
    expect(v.away).toBe(true);
    step(s, world(s, { map: 'town', objects: [] }));
    expect(stepDone(s, 'waterDaily')).toBe(true);
  });

  it('the shop line stays for every purchase while the goal is to buy', () => {
    const s = afterGuide();
    s.stats['tut.townHello'] = 1;
    s.stats['tut.buySeeds'] = 1;
    s.goalIndex = goals.findIndex((g) => g.id === 'buy');
    s.time.day = 2;
    const shop: CoachFacts = { panel: 'shop', tab: null };
    const town = world(s, { map: 'town', objects: [] });
    expect(step(s, town, shop)).toBe('shop');
    s.stats['bought'] = (s.stats['bought'] ?? 0) + 1;
    expect(step(s, town, shop)).toBe('shop');
    s.goalIndex += 1;
    expect(step(s, town, shop)).not.toBe('shop');
  });
});
