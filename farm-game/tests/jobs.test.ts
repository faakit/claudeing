import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { goals, jobs as jobDefs } from '../src/data';
import { endDay } from '../src/systems/day';
import { addStat } from '../src/systems/goals';
import { shipItem, unshipItem } from '../src/systems/economy';
import { addItem } from '../src/systems/inventory';
import { giveGift } from '../src/systems/friendship';
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
    expect(sum.notes?.filter((n) => n.startsWith('New jobs from '))).toHaveLength(1);
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

describe('jobs are always doable (critique 4)', () => {
  it('no weeds, no weed job; no ripe crops, no harvest job', () => {
    const s = newState();
    s.stats['harvested'] = 5;
    s.farm.weeds = {};
    const ids = jobCandidates(s).map((j) => j.id);
    expect(ids).not.toContain('weeds');
    expect(ids).not.toContain('harvest');
    s.farm.weeds = { '10,17': true, '11,17': true };
    expect(jobCandidates(s).map((j) => j.id)).toContain('weeds');
  });

  it('a request job is posted only if you hold some of what the board wants', () => {
    const s = newState();
    s.time.day = 4;
    s.orders = {
      day: 4,
      list: [{ id: 1, item: 'parsnip|0|', qty: 5, reward: 100, xp: 4, done: false }],
    };
    expect(jobCandidates(s).map((j) => j.id)).not.toContain('order');
    addItem(s, 'parsnip', 1);
    expect(jobCandidates(s).map((j) => j.id)).toContain('order');
  });

  it('a shipping job pays at night for goods that stayed in the bin, not for a ship-and-take-back', () => {
    const s = newState();
    s.stats['harvested'] = 1;
    addItem(s, 'parsnip', 20);
    s.jobs = {
      day: 1,
      list: [
        { id: 'ship', giver: 'mara', stat: 'shipped', base: 0, n: 10, reward: 40, done: false },
      ],
    };
    shipItem(s, 'parsnip', 10);
    expect(s.jobs.list[0]!.done).toBe(false); // not on the spot
    unshipItem(s, 'parsnip', 10);
    sleep(s);
    expect(s.stats['jobsDone'] ?? 0).toBe(0);
    s.jobs = {
      day: s.jobs.day,
      list: [
        {
          id: 'ship',
          giver: 'mara',
          stat: 'shipped',
          base: s.stats['shipped'] ?? 0,
          n: 10,
          reward: 40,
          done: false,
        },
      ],
    };
    shipItem(s, 'parsnip', 10);
    const money = s.money;
    sleep(s);
    expect(s.stats['jobsDone']).toBe(1);
    expect(s.money).toBeGreaterThan(money + 40);
  });

  it('the gift job needs a gift they like, not a stone', () => {
    const s = newState();
    s.jobs = {
      day: 1,
      list: [
        { id: 'gift', giver: 'rosa', stat: 'likedGifts', base: 0, n: 1, reward: 35, done: false },
      ],
    };
    addItem(s, 'stone', 1);
    giveGift(s, 'rosa', { item: 'stone' });
    expect(s.jobs.list[0]!.done).toBe(false);
    s.friends['rosa']!.giftedDay = 0;
    addItem(s, 'pumpkin', 1);
    giveGift(s, 'rosa', { item: 'pumpkin' });
    expect(s.jobs.list[0]!.done).toBe(true);
  });

  it('labels use the right plural', () => {
    const job = {
      id: 'machines',
      giver: 'mara',
      stat: 'jarsLoaded',
      base: 0,
      n: 1,
      reward: 1,
      done: false,
    };
    expect(jobLabel(job)).toBe('Mara: load 1 machine');
    expect(jobLabel({ ...job, n: 2 })).toBe('Mara: load 2 machines');
  });
});
