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
  jobGiver,
  jobLabel,
  jobText,
  jobProgress,
  jobReady,
  jobReward,
  JOBS_BOARD_ON,
  openJobs,
  postedJobs,
  takeJob,
  turnInJob,
} from '../src/systems/jobs';
import { boardStartPage } from '../src/ui/panels/boardStart';
import { rowLayout } from '../src/ui/layout';
import { setLocale, t } from '../src/i18n';
import { afterEach } from 'vitest';
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

  it('a job counts from when it is taken at the board, and is paid once when turned in there', () => {
    const s = newState();
    s.stats['caught'] = 7; // lifetime catches before today do not count
    sleep(s);
    const i = s.jobs.list.findIndex((j) => j.id === 'fish');
    const job = s.jobs.list[i]!;
    addStat(s, 'caught', 5); // before taking it: nothing counts
    expect(jobProgress(s, job)).toBe(0);
    expect(postedJobs(s)).toContain(job);
    expect(takeJob(s, i)).toBe(true);
    expect(takeJob(s, i)).toBe(false); // once
    expect(postedJobs(s)).not.toContain(job);
    expect(jobProgress(s, job)).toBe(0);
    const money = s.money;
    for (let k = 0; k < job.n; k++) addStat(s, 'caught');
    // finished, not paid: it waits to be turned in
    expect(jobReady(s, job)).toBe(true);
    expect(job.done).toBe(false);
    expect(s.money).toBe(money);
    expect(turnInJob(s, i)).toBe(true);
    expect(job.done).toBe(true);
    expect(s.money).toBe(money + job.reward);
    expect(pointsOf(s, 'finn')).toBe(JOB_FRIENDSHIP);
    expect(s.stats['jobsDone']).toBe(1);
    expect(turnInJob(s, i)).toBe(false);
    addStat(s, 'caught');
    checkJobs(s);
    expect(s.money).toBe(money + job.reward);
    expect(openJobs(s)).not.toContain(job);
  });

  it('turning in an unfinished job, or one never taken, changes nothing', () => {
    const s = newState();
    sleep(s);
    const before = JSON.stringify(s);
    expect(turnInJob(s, 0)).toBe(false);
    expect(turnInJob(s, 9)).toBe(false);
    expect(JSON.stringify(s)).toBe(before);
    takeJob(s, 0);
    const taken = JSON.stringify(s);
    expect(turnInJob(s, 0)).toBe(false);
    expect(JSON.stringify(s)).toBe(taken);
  });

  it('a finished job never turned in is paid by post at night: nothing is lost by waiting', () => {
    const s = newState();
    sleep(s);
    const i = s.jobs.list.findIndex((j) => j.id === 'fish');
    const job = s.jobs.list[i]!;
    takeJob(s, i);
    addStat(s, 'caught', job.n);
    const money = s.money;
    const sum = sleep(s);
    expect(s.stats['jobsDone']).toBe(1);
    expect(pointsOf(s, 'finn')).toBeGreaterThanOrEqual(JOB_FRIENDSHIP);
    expect(s.money).toBeGreaterThanOrEqual(money + job.reward);
    expect(sum.notes?.some((n) => n.startsWith('Jobs not turned in, paid by post'))).toBe(true);
  });

  it('a job left on the board pays nothing, whatever you did', () => {
    const s = newState();
    sleep(s);
    const job = s.jobs.list.find((j) => j.id === 'fish')!;
    addStat(s, 'caught', 9);
    sleep(s);
    expect(job.done).toBe(false);
    expect(s.stats['jobsDone'] ?? 0).toBe(0);
  });

  it('the board opens on Jobs while one waits to be taken or turned in, else on Requests', () => {
    const s = newState();
    expect(boardStartPage(s)).toBe('requests'); // day 1: no jobs
    sleep(s);
    expect(boardStartPage(s)).toBe('jobs');
    s.jobs.list.forEach((_, i) => takeJob(s, i));
    expect(boardStartPage(s)).toBe('requests');
    const i = s.jobs.list.findIndex((j) => j.id === 'fish');
    addStat(s, 'caught', s.jobs.list[i]!.n);
    expect(boardStartPage(s)).toBe('jobs');
    turnInJob(s, i);
    expect(boardStartPage(s)).toBe('requests');
  });

  it('old saves: the jobs of the day they were saved on stay counted (taken for them), once', () => {
    const s = newState();
    sleep(s);
    const raw = JSON.parse(JSON.stringify(s)) as { stats: Record<string, number> };
    delete raw.stats[JOBS_BOARD_ON];
    const m = migrate(raw);
    expect(postedJobs(m)).toEqual([]);
    expect(m.stats[JOBS_BOARD_ON]).toBe(1);
    // the next morning's jobs are on the board like anyone's
    sleep(m);
    expect(postedJobs(m)).toHaveLength(JOBS_PER_DAY);
    // a new game is not given that
    const fresh = migrate(JSON.parse(JSON.stringify(newState())));
    sleep(fresh);
    expect(postedJobs(fresh)).toHaveLength(JOBS_PER_DAY);
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
    takeJob(s, 0);
    shipItem(s, 'parsnip', 10);
    expect(s.jobs.list[0]!.done).toBe(false); // not on the spot
    expect(turnInJob(s, 0)).toBe(false); // nor turned in: it pays for what stays in the bin
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
    takeJob(s, 0);
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
    takeJob(s, 0);
    addItem(s, 'stone', 1);
    giveGift(s, 'rosa', { item: 'stone' });
    expect(jobReady(s, s.jobs.list[0]!)).toBe(false);
    s.friends['rosa']!.giftedDay = 0;
    addItem(s, 'pumpkin', 1);
    giveGift(s, 'rosa', { item: 'pumpkin' });
    expect(jobReady(s, s.jobs.list[0]!)).toBe(true);
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

describe('the town board text fits in both languages', () => {
  afterEach(() => setLocale('en'));
  it.each(['en', 'pt-BR'] as const)('%s: every job row and the page tabs fit', (lang) => {
    setLocale(lang);
    const room = rowLayout(200, [44], false).maxText;
    for (const j of jobDefs) {
      const n = j.qty[1];
      const job = { id: j.id, giver: j.giver, stat: j.stat, base: 0, n, reward: 0, done: false };
      const gold = `${jobReward(j, n, 3)}g`; // year 3: a three-digit reward
      expect(measureText(jobText(job)), jobText(job)).toBeLessThanOrEqual(room);
      for (const what of [
        t('board.jobOffer', { gold }),
        t('board.jobDoing', { have: n, n, gold }),
        t('board.jobReady', { gold }),
        t('board.jobTonight', { gold }),
        t('board.thanks'),
      ]) {
        const sub = t('board.jobSub', { who: jobGiver(job), what });
        expect(measureText(sub), sub).toBeLessThanOrEqual(room);
      }
    }
    for (const tab of [t('board.tabJobs', { n: 3 }), t('board.tabRequests', { n: 4 })])
      expect(measureText(tab), tab).toBeLessThanOrEqual(80);
    for (const b of [t('board.take'), t('board.turnIn')])
      expect(measureText(b), b).toBeLessThanOrEqual(42); // a 44 px button, 1 px each side
  });
});
