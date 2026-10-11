import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, goals, jobs as jobDefs } from '../src/data';
import { asideGoals, checkGoals, currentGoal, goalsDone, recentGoals } from '../src/systems/goals';
import { generateJobs, jobReward, welcomeFactor, welcomeJobsHeader } from '../src/systems/jobs';
import { hooksFor } from '../src/systems/dayHooks';
import { sanitize } from '../src/systems/save';
import { measureText } from '../src/ui/fontMetrics';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

/** Run just the jobs morning hook and return its notes. */
const jobsNote = (s: GameState): string | undefined => {
  const notes: string[] = [];
  hooksFor('morning')
    .find((h) => h.id === 'jobs:post')!
    .run(s, { notes } as never);
  return notes.find((n) => n.startsWith('New jobs'));
};

const at = (id: string): number => goals.findIndex((g) => g.id === id);
const onGoal = (id: string): GameState => {
  const s = newState();
  s.goalIndex = at(id);
  return s;
};

describe('owner default (round 4): the goal chain never waits behind a legendary fish', () => {
  it('the legend goals are the only aside goals, and they sit where they were (append-only index)', () => {
    expect(goals.filter((g) => g.aside).map((g) => g.id)).toEqual(['legend1', 'legend4']);
    expect(at('legend1')).toBe(54);
    expect(at('legend4')).toBe(goals.length - 1);
  });

  it('on the legend goal, the next goal is current and the legend is listed as also open', () => {
    const s = onGoal('legend1');
    expect(currentGoal(s)?.id).toBe('board1');
    expect(asideGoals(s).map((g) => g.id)).toEqual(['legend1']);
  });

  it('a later goal completes and pays while the legend stays open; the index waits, nothing is lost', () => {
    const s = onGoal('legend1');
    const gold = s.money;
    s.stats['boardWins'] = 1;
    checkGoals(s);
    expect(s.money).toBe(gold + goals[at('board1')]!.reward);
    expect(s.goalIndex).toBe(at('legend1'));
    expect(currentGoal(s)?.id).toBe('fest1');
    expect(goalsDone(s)).toBe(at('legend1') + 1);
    expect(recentGoals(s, 1).map((g) => g.id)).toEqual(['board1']);
    // Survives a save: the marker is a stat.
    expect(currentGoal(sanitize(JSON.parse(JSON.stringify(s))))?.id).toBe('fest1');
  });

  it('catching the legend later pays it and moves the index past every goal already done', () => {
    const s = onGoal('legend1');
    s.stats['boardWins'] = 1;
    checkGoals(s);
    const gold = s.money;
    s.stats['legends'] = 1;
    checkGoals(s);
    expect(s.money).toBe(gold + goals[at('legend1')]!.reward);
    expect(s.goalIndex).toBe(at('fest1'));
    expect(s.stats['goal.board1']).toBeUndefined(); // the marker is cleaned up
    expect(asideGoals(s)).toEqual([]);
  });

  it('goals beyond the current one never complete early', () => {
    const s = onGoal('legend1');
    s.stats['projectLevels'] = 6; // the statue goals are later in the chain
    checkGoals(s);
    expect(currentGoal(s)?.id).toBe('board1');
    expect(s.stats['goal.statue6']).toBeUndefined();
  });

  it('a cascade still completes everything already met, in order', () => {
    const s = onGoal('legend1');
    Object.assign(s.stats, { boardWins: 4, festivalWins: 1, projectLevels: 6 });
    checkGoals(s);
    // board1, fest1, board4 and statue6 are done; legend1 and legend4 stay open.
    expect(goalsDone(s)).toBe(goals.length - 2);
    expect(currentGoal(s)?.id).toBe('legend1'); // nothing else left: the legend is shown
    expect(asideGoals(s)).toEqual([]);
    s.stats['legends'] = 4;
    checkGoals(s);
    expect(s.goalIndex).toBe(goals.length);
    expect(currentGoal(s)).toBeNull();
  });

  it('the early chain is unchanged: strictly one at a time', () => {
    const s = newState();
    expect(currentGoal(s)?.id).toBe(goals[0]!.id);
    s.stats[goals[2]!.stat] = goals[2]!.target; // a later early goal met first waits its turn
    checkGoals(s);
    if (goals[2]!.stat !== goals[0]!.stat && goals[2]!.stat !== goals[1]!.stat)
      expect(s.goalIndex).toBe(0);
  });

  it('the Also open row fits beside its progress', () => {
    for (const g of goals.filter((x) => x.aside))
      expect(measureText(g.text) + measureText(`${g.target}/${g.target}`) + 6).toBeLessThanOrEqual(
        184,
      );
  });
});

describe('owner default (round 4): settling-in pay on days 3 and 4', () => {
  it('jobs posted on days 3 and 4 pay double; day 2 and day 5 pay the usual', () => {
    expect(game.welcomeJobs).toEqual({ from: 3, to: 4, factor: 2 });
    expect([1, 2, 3, 4, 5, 30].map(welcomeFactor)).toEqual([1, 1, 2, 2, 1, 1]);
    for (const day of [2, 3, 4, 5]) {
      const s = newState();
      s.time.day = day;
      for (const job of generateJobs(s)) {
        const def = jobDefs.find((j) => j.id === job.id)!;
        expect(job.reward).toBe(jobReward(def, job.n, 1) * welcomeFactor(day));
      }
    }
  });

  it('the morning note and the Goal tab header say so, and fit', () => {
    const s = newState();
    s.time.day = 3;
    expect(jobsNote(s)).toMatch(/double pay while you settle in/);
    s.time.day = 5;
    expect(jobsNote(s)).not.toMatch(/double/);
    expect(welcomeJobsHeader(2)).toBe("TODAY'S JOBS: DOUBLE PAY");
    expect(welcomeJobsHeader(1)).toBe("TODAY'S JOBS");
    expect(measureText(welcomeJobsHeader(2))).toBeLessThanOrEqual(184);
  });
});
