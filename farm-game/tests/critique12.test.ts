import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { goals, mail } from '../src/data';
import { asideGoals, checkGoals, currentGoal, noteGoalDay, STALL_DAYS } from '../src/systems/goals';
import { hooksFor } from '../src/systems/dayHooks';
import {
  boardScoreLine,
  CRATE_EVERY,
  crateDue,
  crateEvery,
  rivalNotice,
} from '../src/systems/rival';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import { arrangeNotes } from '../src/ui/panels/summaryNotes';
import type { GameState, Order } from '../src/state/GameState';
import { newState } from './helpers';

const row = (s: GameState, id: number, item: string, lastDay = true): Order => ({
  id,
  item: `${item}|0|`,
  qty: 2,
  reward: 100,
  xp: 5,
  done: false,
  from: absoluteDay(s) - 1,
  until: lastDay ? absoluteDay(s) : absoluteDay(s) + 1,
});
const score = (s: GameState, you: number, rival: number) =>
  Object.assign(s.stats, { 'board.s0.you': you, 'board.s0.rival': rival });

describe('critique 12 F1/F2: crates keep a keeper a few points ahead, counted from the last one', () => {
  it('weekly when close, every 2 days ahead by 3, every day ahead by 5', () => {
    expect([0, 2, 3, 4, 5, 9, -4].map(crateEvery)).toEqual([7, 7, 2, 2, 1, 1, 7]);
  });

  it('a bigger lead never means fewer crates (the day-14 crate is not lost at a lead of 4)', () => {
    for (let day = 9; day < 28; day++)
      for (let last = 7; last < day; last++)
        for (let lead = 0; lead < 8; lead++) {
          const a = newState();
          const b = newState();
          a.stats['rival.crate'] = last;
          b.stats['rival.crate'] = last;
          score(a, lead, 0);
          score(b, lead + 1, 0);
          if (crateDue(a, day)) expect(crateDue(b, day)).toBe(true);
        }
    const s = newState();
    score(s, 4, 0);
    expect(crateDue(s, 14)).toBe(true);
  });

  it('the score line says a crate tonight even when the line below names a target', () => {
    const s = newState();
    s.time.day = 14;
    score(s, 12, 10);
    s.stats['rival.crate'] = 7;
    s.orders = { day: absoluteDay(s), list: [row(s, 1, 'potato'), row(s, 2, 'carp', false)] };
    expect(rivalNotice(s)).toBe('Clay wants this one at 2:00 PM.');
    expect(boardScoreLine(s)).toBe('You 12, Clay 10. His crate tonight.');
    expect(measureText(boardScoreLine(s)!)).toBeLessThanOrEqual(184);
  });

  it('while you lead, the board says the catch-up rule; every line fits', () => {
    const s = newState();
    s.time.day = 12;
    s.stats['rival.crate'] = 11;
    s.orders = { day: absoluteDay(s), list: [] };
    score(s, 13, 10);
    expect(rivalNotice(s)).toBe('Ahead 3+: his crate every 2 days.');
    score(s, 15, 10);
    expect(rivalNotice(s)).toBe('Ahead 5+: his crate every day.');
    score(s, 11, 10);
    expect(rivalNotice(s)).toBe('Clay scores on farm goods only.');
    for (const line of [
      'Ahead 3+: his crate every 2 days.',
      'Ahead 5+: his crate every day.',
      'Clay took two today: two points.',
      'You 99, Clay 99. His crate tonight.',
    ])
      expect(measureText(line)).toBeLessThanOrEqual(184);
  });

  it('"Clay took one today" says whether it scored', () => {
    const s = newState();
    s.time.day = 12;
    s.stats['rival.crate'] = 11;
    const fish = row(s, 1, 'carp');
    Object.assign(fish, { done: true, rival: true, takenOn: absoluteDay(s), noPoint: true });
    s.orders = { day: absoluteDay(s), list: [fish] };
    expect(rivalNotice(s)).toBe('Clay took one today: no point.');
    Object.assign(fish, { item: 'potato|0|', noPoint: undefined });
    expect(rivalNotice(s)).toBe('Clay took one today: a point.');
  });

  it('his intro letter says the crates come more often while you lead', () => {
    expect(mail.letters.find((l) => l.id === 'clay_intro')!.text).toMatch(
      /more often while you lead/,
    );
    expect(CRATE_EVERY).toBe(7);
  });
});

describe('critique 12 F3: a crowded season-change morning keeps the result', () => {
  it('the season result and the special that ended come first', () => {
    const out = arrangeNotes([
      'Clay filled 3 Potato on the board.',
      'New jobs from Finn. See Menu > Goal.',
      'A draw with Clay on the board last season (9 to 9).',
      'The special order ran out. Paid 900g for what you brought.',
      'New requests on the town board.',
    ]);
    expect(out[0]).toMatch(/^A draw with Clay/);
    expect(out[1]).toMatch(/^The special order ran out/);
  });
});

describe('critique 12 F4: a goal the player is not doing waits, and the next one shows', () => {
  const forage = goals.findIndex((g) => g.stat === 'foraged');
  it(`after ${STALL_DAYS} days without progress the next goal shows; the old one still completes`, () => {
    const s = newState();
    s.goalIndex = forage;
    const stuck = goals[forage]!;
    expect(noteGoalDay(s, 5)).toBeNull();
    expect(noteGoalDay(s, 6)).toBeNull();
    expect(noteGoalDay(s, 7)).toBeNull();
    expect(noteGoalDay(s, 8)?.id).toBe(stuck.id);
    expect(currentGoal(s)?.id).toBe(goals[forage + 1]!.id);
    expect(asideGoals(s).map((g) => g.id)).toEqual([stuck.id]);
    // Pick them up later: it pays and the index moves on.
    const gold = s.money;
    s.stats[stuck.stat] = stuck.target;
    checkGoals(s);
    expect(s.money).toBeGreaterThanOrEqual(gold + stuck.reward);
    expect(s.goalIndex).toBeGreaterThan(forage);
    expect(s.stats[`goalWait.${stuck.id}`]).toBeUndefined();
  });

  it('a next goal already met pays at once, so the new goal is one still to do', () => {
    const s = newState();
    s.goalIndex = forage;
    const next = goals[forage + 1]!;
    s.stats[next.stat] = next.target;
    for (const d of [5, 6, 7]) noteGoalDay(s, d);
    const gold = s.money;
    noteGoalDay(s, 8);
    expect(s.money).toBeGreaterThanOrEqual(gold + next.reward);
    expect(currentGoal(s)?.id).not.toBe(next.id);
  });

  it('any progress restarts the count', () => {
    const s = newState();
    s.goalIndex = forage;
    noteGoalDay(s, 5);
    noteGoalDay(s, 7);
    s.stats['foraged'] = 1;
    expect(noteGoalDay(s, 8)).toBeNull();
    expect(noteGoalDay(s, 10)).toBeNull();
    expect(noteGoalDay(s, 11)?.id).toBe(goals[forage]!.id);
  });

  it('the last open goal never waits, and a legend is never put up in its place', () => {
    const s = newState();
    s.goalIndex = goals.findIndex((g) => g.id === 'statue6');
    for (const d of [1, 5, 9]) noteGoalDay(s, d);
    expect(currentGoal(s)?.id).toBe('statue6'); // the only goal after it is the aside legend
  });

  it('not while the guided start runs; the morning says which goal waits', () => {
    const hook = hooksFor('end').find((h) => h.id === 'goals:stall')!;
    const s = newState();
    s.goalIndex = forage;
    s.stats['tut.on'] = 1;
    for (const day of [5, 6, 7, 8, 9]) {
      s.time.day = day;
      hook.run(s, { notes: [] } as never);
    }
    expect(currentGoal(s)?.id).toBe(goals[forage]!.id);
    s.stats['tut.off'] = 1;
    const notes: string[] = [];
    for (const day of [10, 11, 12, 13]) {
      s.time.day = day;
      hook.run(s, { notes } as never);
    }
    expect(notes).toEqual([
      `New goal: ${goals[forage + 1]!.text}. "${goals[forage]!.text}" can wait in Menu > Goal.`,
    ]);
  });
});
