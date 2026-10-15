import { afterEach, describe, expect, it } from 'vitest';
import '../src/mechanics';
import { readFileSync } from 'node:fs';
import { items, mapsData, projects, tutorial } from '../src/data';
import { setLocale, t } from '../src/i18n';
import { measureText } from '../src/ui/fontMetrics';
import { needLine } from '../src/ui/panels/projectText';
import { noteFishingResult } from '../src/systems/fishing';
import { addItem, removeItem, countItem } from '../src/systems/inventory';
import { takeJob, turnInJob } from '../src/systems/jobs';
import {
  advance,
  coachView,
  goodsShort,
  nextMapToward,
  startTutorial,
  stepDone,
  type CoachFacts,
  type CoachWorld,
} from '../src/systems/tutorial';
import { addStat } from '../src/systems/goals';
import type { GameState } from '../src/state/GameState';
import { equip, newState } from './helpers';

const NO_SHEET: CoachFacts = { panel: null, tab: null };

function world(map: string, over: Partial<CoachWorld> = {}): CoachWorld {
  return {
    map,
    tile: { tx: 14, ty: 13 },
    facing: 'up',
    action: null,
    objects: [
      { type: 'board', tx: 14, ty: 11, w: 1, h: 1 },
      { type: 'door', tx: 14, ty: 43, w: 1, h: 1, to: map === 'farm' ? 'town' : 'farm' },
    ],
    npcs: [],
    blocked: () => false,
    actKind: () => null,
    inView: () => true,
    ...over,
  };
}

/** A guided save past day 2 with every step done but the ones named (so one intro is tested at a time). */
function guidedWith(...open: string[]): GameState {
  const s = newState();
  startTutorial(s, { on: true, gift: false });
  for (const st of tutorial.steps) if (!open.includes(st.id)) s.stats[`tut.${st.id}`] = 1;
  s.time.day = 3;
  return s;
}

const step = (s: GameState, w: CoachWorld, f = NO_SHEET) => advance(s, w, f).current?.id ?? null;
const view = (s: GameState, w: CoachWorld, f = NO_SHEET) => {
  const cur = advance(s, w, f).current;
  return cur ? coachView(s, w, f, cur) : null;
};

const postJobs = (s: GameState) =>
  (s.jobs = {
    day: 3,
    list: [
      { id: 'fish', giver: 'finn', stat: 'caught', base: 0, n: 1, reward: 40, done: false },
      { id: 'forage', giver: 'rosa', stat: 'foraged', base: 0, n: 2, reward: 30, done: false },
    ],
  });

describe('guided start: no new step before the walk to town (onboarding gate)', () => {
  it('day 1 and day 2 hold exactly these steps (the review cut the clock, energy and Menu lines)', () => {
    const tracks = (t: string) => tutorial.steps.filter((s) => s.track === t).map((s) => s.id);
    expect(tracks('day1')).toEqual([
      'harvest',
      'seeds',
      'plant',
      'water',
      'grow',
      'ship',
      'errands',
      'bedOffer',
      'sleep',
    ]);
    expect(tracks('day2')).toEqual(['water2', 'mail', 'town']);
  });

  it('no new intro can show on day 1 or 2 before town: every one waits for town, a job, bait, a goal or an ask', () => {
    const fresh = ['jobBoard', 'jobTurnIn', 'noBait', 'baitNext', 'craft', 'festival', 'stone'];
    const s = guidedWith(...fresh);
    s.time.day = 2;
    expect(step(s, world('farm'))).toBeNull();
    expect(step(s, world('house'))).toBeNull();
  });
});

describe('guided start: the town board', () => {
  it('in town with jobs posted: points at the board, then at Take, and ends once one is taken', () => {
    const s = guidedWith('jobBoard');
    postJobs(s);
    const town = world('town');
    expect(step(s, town)).toBe('jobBoard');
    expect(view(s, town)?.pointer).toEqual({ kind: 'tile', tx: 14, ty: 11 });
    const board: CoachFacts = { panel: 'board', tab: null };
    expect(view(s, town, board)?.pointer).toEqual({ kind: 'button', pattern: '^Take$' });
    takeJob(s, 0);
    expect(step(s, town, board)).toBeNull();
    expect(stepDone(s, 'jobBoard')).toBe(true);
  });

  it('waits while the day-2 seed errand is the goal, and never shows on the farm', () => {
    const s = guidedWith('jobBoard');
    postJobs(s);
    expect(step(s, world('farm'))).toBeNull();
    s.goalIndex = 6; // "buy": seeds first
    expect(step(s, world('town'))).toBeNull();
  });

  it('a finished job says to turn it in at the board (the door from the farm), then Turn in', () => {
    const s = guidedWith('jobTurnIn');
    postJobs(s);
    takeJob(s, 0);
    expect(step(s, world('town'))).toBeNull();
    addStat(s, 'caught');
    const farm = world('farm');
    expect(step(s, farm)).toBe('jobTurnIn');
    expect(view(s, farm)?.away).toBe(true);
    const board: CoachFacts = { panel: 'board', tab: null };
    expect(view(s, world('town'), board)?.pointer).toEqual({
      kind: 'button',
      pattern: '^Turn in$',
    });
    turnInJob(s, 0);
    expect(step(s, world('town'), board)).toBeNull();
    expect(stepDone(s, 'jobTurnIn')).toBe(true);
  });
});

describe('guided start: bait', () => {
  afterEach(() => noteFishingResult(false));

  it('the rod in hand with no bait: one line points at the hoe, and ends once a bait is had', () => {
    const s = guidedWith('noBait');
    equip(s, 'fishing_rod');
    expect(step(s, world('farm'))).toBeNull(); // the starter worms
    removeItem(s, 'worms', countItem(s, 'worms'));
    expect(step(s, world('farm'))).toBe('noBait');
    expect(view(s, world('farm'))?.pointer).toEqual({ kind: 'slot', slot: 0 });
    addItem(s, 'worms', 1);
    expect(step(s, world('farm'))).toBeNull();
    expect(stepDone(s, 'noBait')).toBe(true);
  });

  it("after a catch, with two kinds of bait, it points at the sheet's Bait switch", () => {
    const s = guidedWith('baitNext');
    const fishing: CoachFacts = { panel: 'fishing', tab: null };
    noteFishingResult(true);
    expect(step(s, world('farm'), fishing)).toBeNull(); // worms only
    addItem(s, 'bait', 3);
    noteFishingResult(false);
    expect(step(s, world('farm'), fishing)).toBeNull(); // still fighting the fish
    noteFishingResult(true);
    expect(step(s, world('farm'), fishing)).toBe('baitNext');
    expect(view(s, world('farm'), fishing)?.pointer).toEqual({
      kind: 'button',
      pattern: '^Bait: ',
    });
  });

  it('the fishing intro waits for the fishing job to be taken at the board', () => {
    const s = guidedWith('fish');
    postJobs(s);
    expect(step(s, world('farm'))).toBeNull();
    takeJob(s, 0);
    expect(step(s, world('farm'))).toBe('fish');
  });
});

describe('guided start: stone before the site (owner)', () => {
  const asked = () => {
    const s = guidedWith('stone', 'valleyAsk');
    s.stats['place.spring'] = 1;
    s.stats['valley.farmGreen'] = 1;
    return s;
  };

  it('the spring asked and stone short: first the mine, and the site waits', () => {
    const s = asked();
    expect(goodsShort(s, 'place_spring', 'stone')).toBe(true);
    expect(step(s, world('farm'))).toBe('stone');
    expect(view(s, world('farm'))?.away).toBe(true); // the way to the mine
    const mine = world('mine');
    s.nodes['mine'] = { '5,5': 'rock_node' };
    expect(view(s, mine)?.pointer).toMatchObject({ kind: 'tile' });
    addStat(s, 'mined');
    // one rock is not 20 stone: no walk back to the site today (critic D3-1)
    expect(step(s, mine)).toBeNull();
    expect(stepDone(s, 'stone')).toBe(true);
    expect(step(s, world('farm'))).toBeNull();
    // ...the next morning the site's own line says what is left
    s.time.day += 1;
    expect(step(s, world('farm'))).toBe('valleyAsk');
  });

  it('or as soon as the stone is all gathered, the same day', () => {
    const s = asked();
    expect(step(s, world('farm'))).toBe('stone');
    addStat(s, 'mined');
    addItem(s, 'stone', 20);
    expect(step(s, world('farm'))).toBe('valleyAsk');
  });

  it('an empty mine says the rocks are back tomorrow and points at nothing (critic D3-3)', () => {
    const s = asked();
    s.nodes['mine'] = {};
    const v = view(s, world('mine'));
    expect(v?.step.id).toBe('stone');
    expect(v?.text).toBe('No rocks today: back tomorrow.');
    expect(v?.pointer).toBeNull();
  });

  it('with the stone in hand, or already given, it is skipped and the site shows at once', () => {
    const s = asked();
    addItem(s, 'stone', 12);
    s.stats['fund.place_spring.stone'] = 8;
    expect(goodsShort(s, 'place_spring', 'stone')).toBe(false);
    expect(step(s, world('farm'))).toBe('valleyAsk');
  });

  it('with auto tool off in the mine, it shows the pickaxe slot first', () => {
    const s = asked();
    s.settings.controls.autoTool = false;
    s.nodes['mine'] = { '5,5': 'rock_node' };
    equip(s, 'fishing_rod');
    expect(view(s, world('mine'))?.pointer).toEqual({ kind: 'slot', slot: 4 });
  });

  it("the weir's stone ask teaches it too when the spring never needed to", () => {
    const s = guidedWith('stone');
    s.stats['place.weir'] = 1;
    expect(step(s, world('farm'))).toBe('stone');
  });
});

describe('guided start: crafting and festivals', () => {
  it('the craft goal: Menu, then Make', () => {
    const s = guidedWith('craft');
    s.goalIndex = 11; // "craft"
    expect(step(s, world('farm'))).toBe('craft');
    expect(view(s, world('farm'))?.pointer).toEqual({ kind: 'ui', id: 'menu' });
    const menu: CoachFacts = { panel: 'menu', tab: 'bag' };
    expect(view(s, world('farm'), menu)?.pointer).toEqual({ kind: 'button', pattern: '^Make$' });
    expect(step(s, world('farm'), { panel: 'menu', tab: 'craft' })).toBeNull();
  });

  it('a festival day in town points at the board, then its Enter button', () => {
    const s = guidedWith('festival');
    expect(step(s, world('town'))).toBeNull();
    s.time.day = 14; // the Flower Show (spring 14)
    const fest = step(s, world('town'));
    expect(fest).toBe('festival');
    const board: CoachFacts = { panel: 'board', tab: null };
    expect(view(s, world('town'), board)?.pointer).toEqual({
      kind: 'button',
      pattern: '^Enter the .*!$||^Requests \\d+$',
    });
  });
});

describe('every ask says where its goods come from (owner)', () => {
  afterEach(() => setLocale('en'));
  it('each good a project or a place asks for, and house timber, has a source', () => {
    const asked = new Set(
      Object.values(projects).flatMap((p) => (p.items ?? []).map((i) => i.item)),
    );
    asked.add('timber');
    for (const id of asked) expect(items[id]?.source, id).toBeTruthy();
  });
  it.each(['en', 'pt-BR'] as const)(
    "%s: the spring's stone line names the mine and fits",
    (lang) => {
      setLocale(lang);
      const label = t('project.need', { item: items['stone']!.name, given: 0, need: 20, have: 0 });
      const line = needLine(label, items['stone']!.source, true);
      expect(line).not.toBe(label);
      expect(measureText(line)).toBeLessThanOrEqual(184);
    },
  );
});

describe('the coach leads through the real door chain (critic D2-1)', () => {
  it('each map lists exactly the maps its doors lead to', () => {
    for (const [id, def] of Object.entries(mapsData.maps)) {
      const tmj = JSON.parse(readFileSync(`public/${def.file}`, 'utf8')) as {
        layers: { objects?: { type: string; properties?: { name: string; value: unknown }[] }[] }[];
      };
      const to = new Set<string>();
      for (const l of tmj.layers)
        for (const o of l.objects ?? [])
          if (o.type === 'door')
            to.add(String(o.properties?.find((p) => p.name === 'targetMap')?.value));
      expect([...to].sort(), id).toEqual([...(def.links ?? [])].sort());
    }
  });

  it('farm to the mine goes through town and the woods, never back', () => {
    expect(nextMapToward('farm', 'mine')).toBe('town');
    expect(nextMapToward('town', 'mine')).toBe('woods');
    expect(nextMapToward('woods', 'mine')).toBe('mine');
    expect(nextMapToward('house', 'mine')).toBe('farm');
    expect(nextMapToward('mine', 'farm')).toBe('woods');
    expect(nextMapToward('farm', 'farm')).toBeNull();
  });

  it('in town, the stone intro points at the woods door, not back to the farm', () => {
    const s = guidedWith('stone');
    s.stats['place.spring'] = 1;
    const town = world('town', {
      objects: [
        { type: 'door', tx: 11, ty: 0, w: 1, h: 1, to: 'farm' },
        { type: 'door', tx: 0, ty: 24, w: 1, h: 1, to: 'woods' },
      ],
    });
    expect(view(s, town)?.pointer).toEqual({ kind: 'tile', tx: 0, ty: 24 });
  });
});

describe('a leading intro keeps the floor (critic D2-4)', () => {
  it("Clay's town intro does not take over the walk to the mine once the stone line showed", () => {
    const s = guidedWith('stone', 'clay');
    s.stats['place.spring'] = 1;
    s.time.day = 9;
    s.stats['reveal.clay'] = 8; // the race's morning came (its letter and note)
    expect(step(s, world('farm'))).toBe('stone');
    const town = world('town', {
      objects: [
        { type: 'board', tx: 14, ty: 11, w: 1, h: 1 },
        { type: 'door', tx: 0, ty: 24, w: 1, h: 1, to: 'woods' },
      ],
    });
    expect(step(s, town)).toBe('stone');
    addStat(s, 'mined');
    expect(step(s, town)).toBe('clay');
  });
});
