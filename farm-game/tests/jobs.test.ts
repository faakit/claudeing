import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { goals, jobs as jobDefs } from '../src/data';
import { endDay } from '../src/systems/day';
import { addStat } from '../src/systems/goals';
import { pointsOf } from '../src/systems/friendship';
import {
  checkJobs,
  generateJobs,
  JOB_FRIENDSHIP,
  JOBS_PER_DAY,
  jobCandidates,
  jobLabel,
  jobProgress,
  jobReward,
  openJobs,
} from '../src/systems/jobs';
import { migrate } from '../src/systems/save';
import { measureText } from '../src/ui/fontMetrics';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

describe('daily jobs', () => {
  it('none on day 1; three from day 2, with the fishing job pointing at the rod first', () => {
    const s = newState();
    expect(generateJobs(s)).toEqual([]);
    const sum = sleep(s);
    expect(s.jobs.list).toHaveLength(JOBS_PER_DAY);
    expect(s.jobs.list[0]?.id).toBe('fish');
    expect(sum.notes?.filter((n) => n.startsWith('Job: '))).toHaveLength(JOBS_PER_DAY);
    sleep(s);
    expect(s.jobs.list.map((j) => j.id)).toContain('mine');
  });

  it('jobs of a day are all different', () => {
    const s = newState();
    for (let d = 0; d < 20; d++) {
      sleep(s);
      const ids = s.jobs.list.map((j) => j.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('locked jobs wait for their unlock (no animal goods before an animal)', () => {
    const s = newState();
    expect(jobCandidates(s).map((j) => j.id)).not.toContain('collect');
    s.stats['animalsAdded'] = 1;
    expect(jobCandidates(s).map((j) => j.id)).toContain('collect');
  });

  it('only what happens after posting counts, and a finished job pays gold and friendship once', () => {
    const s = newState();
    s.stats['caught'] = 7; // lifetime catches before today do not count
    sleep(s);
    const job = s.jobs.list.find((j) => j.id === 'fish')!;
    expect(jobProgress(s, job)).toBe(0);
    const money = s.money;
    for (let i = 0; i < job.n - 1; i++) addStat(s, 'caught');
    expect(job.done).toBe(false);
    addStat(s, 'caught');
    expect(job.done).toBe(true);
    expect(s.money).toBe(money + job.reward);
    expect(pointsOf(s, 'finn')).toBe(JOB_FRIENDSHIP);
    expect(s.stats['jobsDone']).toBe(1);
    addStat(s, 'caught');
    checkJobs(s);
    expect(s.money).toBe(money + job.reward);
    expect(openJobs(s)).not.toContain(job);
  });

  it("yesterday's unfinished jobs are replaced and never pay late", () => {
    const s = newState();
    sleep(s);
    const old = s.jobs.list[0]!;
    s.jobs.day -= 1; // pretend the day turned without a new board
    s.stats[old.stat] = (s.stats[old.stat] ?? 0) + 99;
    checkJobs(s);
    expect(old.done).toBe(false);
    expect(openJobs(s)).toEqual([]);
  });

  it('rewards stay small: three jobs never pay more than a few hundred gold', () => {
    for (const j of jobDefs) expect(jobReward(j, j.qty[1], 1), j.id).toBeLessThanOrEqual(120);
    const worst = jobDefs
      .map((j) => jobReward(j, j.qty[1], 1))
      .sort((a, b) => b - a)
      .slice(0, JOBS_PER_DAY)
      .reduce((a, b) => a + b, 0);
    expect(worst).toBeLessThan(300);
  });

  it('labels fit the Goal tab next to their progress and reward', () => {
    for (const j of jobDefs) {
      const label = jobLabel({
        id: j.id,
        giver: j.giver,
        stat: j.stat,
        base: 0,
        n: j.qty[1],
        reward: 0,
        done: false,
      });
      const right = `${j.qty[1]}/${j.qty[1]} +${jobReward(j, j.qty[1], 9)}g`;
      expect(measureText(label) + measureText(right) + 6, label).toBeLessThanOrEqual(184);
    }
  });

  it('jobs survive a save; v9 saves migrate with no jobs and keep their goal', () => {
    const s = newState();
    sleep(s);
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.jobs).toEqual(s.jobs);
    const v9 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v9['version'] = 9;
    delete v9['jobs'];
    v9['goalIndex'] = 6; // "harvest" in the v9 chain
    const m = migrate(v9);
    expect(m.jobs).toEqual({ day: 0, list: [] });
    expect(goals[m.goalIndex]?.id).toBe('harvest');
  });
});
