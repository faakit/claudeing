import { game, jobs as jobDefs, npcs } from '../data';
import { isMature } from './farming';
import { isShippable } from './economy';
import { haveFor } from './orders';
import type { JobDef } from '../data';
import type { GameState, Job } from '../state/GameState';
import { gameEvents, toast } from './events';
import { addStat, stat } from './goals';
import { befriend } from './friendship';
import { random } from './rng';
import { absoluteDay } from './time';
import { fmtGold, t } from '../i18n';

/** Jobs posted each morning. */
export const JOBS_PER_DAY = 3;
/** Friendship the asking villager gives for a finished job (a daily chat is 10). */
export const JOB_FRIENDSHIP = 15;
/** No jobs on the very first day: the goal chain teaches the basics first. */
export const FIRST_JOB_DAY = 2;

const defOf = (id: string): JobDef | undefined => jobDefs.find((j) => j.id === id);

/**
 * How many a job could ask for today, given the world. A job whose minimum is above this is not posted, so
 * nobody hunts for weeds that do not exist.
 */
export const JOB_CHECKS: Record<NonNullable<JobDef['check']>, (state: GameState) => number> = {
  weeds: (s) => Object.keys(s.farm.weeds).length,
  ripe: (s) => Object.values(s.farm.tiles).filter((t) => t.crop && isMature(t.crop)).length,
  goods: (s) =>
    JOB_CHECKS.ripe(s) +
    s.inventory.slots.reduce((n, st) => (st && isShippable(st) ? n + st.qty : n), 0),
  order: (s) => (s.orders.list.some((o) => !o.done && haveFor(s, o) > 0) ? 1 : 0),
};

const limitOf = (state: GameState, def: JobDef): number =>
  def.check ? JOB_CHECKS[def.check](state) : Infinity;

/** Jobs that make sense today: their unlock stat is reached. */
export const jobCandidates = (state: GameState): JobDef[] =>
  jobDefs.filter(
    (j) =>
      (!j.requires || stat(state, j.requires.stat) >= j.requires.min) &&
      limitOf(state, j) >= j.qty[0],
  );

/** Gold for a job of `n`, growing a little each year so it stays worth a look. */
export const jobReward = (def: JobDef, n: number, year: number): number =>
  Math.round((def.base + def.perUnit * n) * (1 + 0.25 * (year - 1)));

/** Pay multiplier for jobs posted on absolute `day` (the settling-in days before the first harvest). */
export function welcomeFactor(day: number): number {
  const w = game.welcomeJobs;
  return w && day >= w.from && day <= w.to ? w.factor : 1;
}

/** The Goal tab's jobs header; on the settling-in days it says the pay is raised. */
export const welcomeJobsHeader = (factor: number): string =>
  factor === 2
    ? t('jobs.headerDouble')
    : factor > 1
      ? t('jobs.headerFactor', { factor })
      : t('jobs.header');

/** Pick today's jobs: any intro job for today first, then a weighted draw without repeats. */
export function generateJobs(state: GameState): Job[] {
  const day = absoluteDay(state);
  if (day < FIRST_JOB_DAY) return [];
  const pool = jobCandidates(state);
  const picked: JobDef[] = pool.filter((j) => j.introDay === day);
  let rest = pool.filter((j) => !picked.includes(j));
  while (picked.length < JOBS_PER_DAY && rest.length > 0) {
    const total = rest.reduce((n, j) => n + j.weight, 0);
    let r = random(state) * total;
    const next = rest.find((j) => (r -= j.weight) < 0) ?? (rest[rest.length - 1] as JobDef);
    picked.push(next);
    rest = rest.filter((j) => j !== next);
  }
  return picked.slice(0, JOBS_PER_DAY).map((def) => {
    const [lo] = def.qty;
    const hi = Math.min(def.qty[1], limitOf(state, def));
    const n = lo + Math.floor(random(state) * (hi - lo + 1));
    return {
      id: def.id,
      giver: def.giver,
      stat: def.stat,
      base: stat(state, def.stat),
      n,
      reward: jobReward(def, n, state.time.year) * welcomeFactor(day),
      done: false,
    };
  });
}

/*
 * The town board (owner, bait round): the morning's jobs are posted on the board in town, not handed out from
 * nowhere. A job counts only once you take it there (its `base` is set at the taking), and a finished job is turned
 * in at the board; one you never come back for is paid by post at night, so nothing is lost by waiting (pillar 5).
 * Which jobs are taken is a bitmask stat for the jobs' day (`jobs.taken`, `jobs.takenDay`), so no save change.
 */
export const JOBS_TAKEN = 'jobs.taken';
export const JOBS_TAKEN_DAY = 'jobs.takenDay';
/** Jobs already announced as done today (one "turn it in" toast each). */
const JOBS_TOLD = 'jobs.told';
/** This save knows the job board (new games carry it; a save from before has today's jobs taken for it once). */
export const JOBS_BOARD_ON = 'jobs.boardOn';

const isToday = (state: GameState): boolean => state.jobs.day === absoluteDay(state);
const bits = (state: GameState, key: string): number =>
  state.stats[JOBS_TAKEN_DAY] === state.jobs.day ? (state.stats[key] ?? 0) : 0;
const indexOf = (state: GameState, job: Job): number => state.jobs.list.indexOf(job);

/** Was this job of today's taken at the board? */
export const isTaken = (state: GameState, job: Job): boolean => {
  const i = indexOf(state, job);
  return i >= 0 && (bits(state, JOBS_TAKEN) & (1 << i)) !== 0;
};

function setBit(state: GameState, key: string, i: number): void {
  if (state.stats[JOBS_TAKEN_DAY] !== state.jobs.day) {
    state.stats[JOBS_TAKEN_DAY] = state.jobs.day;
    state.stats[JOBS_TAKEN] = 0;
    state.stats[JOBS_TOLD] = 0;
  }
  state.stats[key] = (state.stats[key] ?? 0) | (1 << i);
}

/** How far along a job is today (0..n). A job not taken yet has not started. */
export const jobProgress = (state: GameState, job: Job): number =>
  job.done
    ? job.n
    : isTaken(state, job)
      ? Math.max(0, Math.min(job.n, stat(state, job.stat) - job.base))
      : 0;

/** "catch 2 fish": what the job asks, without who asks (the board's row title). */
export const jobText = (job: Job): string =>
  (defOf(job.id)?.text ?? job.id)
    .replace('{n}', String(job.n))
    .replace('{s}', job.n === 1 ? '' : 's');

/** Who posted it ("Finn"). */
export const jobGiver = (job: Job): string => npcs[job.giver]?.name ?? job.giver;

/** "Finn: catch 2 fish". */
export const jobLabel = (job: Job): string => `${jobGiver(job)}: ${jobText(job)}`;

/**
 * Jobs counted at the night's payout instead of when turned in: what is shipped can be taken back out of the
 * bin until then, so a shipping job pays only for goods that really sold.
 */
export const PAID_AT_PAYOUT = new Set(['shipped']);

/** Today's job, taken, counted far enough and not paid yet: turn it in at the board (or wait for the post). */
export const jobReady = (state: GameState, job: Job): boolean =>
  isToday(state) && !job.done && isTaken(state, job) && jobProgress(state, job) >= job.n;

/** Take a job off the board: it counts from now. False when it is not today's, already taken or paid. */
export function takeJob(state: GameState, index: number): boolean {
  const job = state.jobs.list[index];
  if (!job || !isToday(state) || job.done || isTaken(state, job)) return false;
  job.base = stat(state, job.stat);
  setBit(state, JOBS_TAKEN, index);
  addStat(state, 'jobsTaken');
  return true;
}

function pay(state: GameState, job: Job): void {
  job.done = true;
  state.money += job.reward;
  state.stats['earned'] = stat(state, 'earned') + job.reward;
  gameEvents.emit('moneyChanged', { delta: job.reward });
  befriend(state, job.giver, JOB_FRIENDSHIP);
  addStat(state, 'jobsDone');
}

/** Turn a finished job in at the board: its gold and the asker's thanks. False if it is not ready. */
export function turnInJob(state: GameState, index: number): boolean {
  const job = state.jobs.list[index];
  if (!job || PAID_AT_PAYOUT.has(job.stat) || !jobReady(state, job)) return false;
  pay(state, job);
  toast(t('jobs.done', { job: jobLabel(job), gold: fmtGold(job.reward) }), 'good');
  return true;
}

/**
 * Runs whenever stats change: a taken job that just got far enough says once to turn it in at the board. At the
 * night's payout (`atPayout`), every finished job not turned in is paid by post (shipping jobs only then).
 * Returns the gold paid by post.
 */
export function checkJobs(state: GameState, atPayout = false): number {
  if (!isToday(state)) return 0; // yesterday's jobs never pay late
  let posted = 0;
  state.jobs.list.forEach((job, i) => {
    if (!jobReady(state, job)) return;
    if (atPayout) {
      pay(state, job);
      posted += job.reward;
      return;
    }
    if (PAID_AT_PAYOUT.has(job.stat) || bits(state, JOBS_TOLD) & (1 << i)) return;
    setBit(state, JOBS_TOLD, i);
    toast(t('jobs.ready', { job: jobLabel(job) }), 'good');
  });
  return posted;
}

/** Today's jobs not paid yet (taken or still on the board). */
export const openJobs = (state: GameState): Job[] =>
  isToday(state) ? state.jobs.list.filter((j) => !j.done) : [];

/** Today's jobs still on the board, not taken. */
export const postedJobs = (state: GameState): Job[] =>
  openJobs(state).filter((j) => !isTaken(state, j));

/** A save from before the board: today's jobs count as taken (it was counting them already), once. */
export function jobsDefaults(state: GameState): GameState {
  if (state.stats[JOBS_BOARD_ON]) return state;
  state.stats[JOBS_BOARD_ON] = 1;
  if (state.jobs.list.length > 0) {
    state.stats[JOBS_TAKEN_DAY] = state.jobs.day;
    state.stats[JOBS_TAKEN] = (1 << state.jobs.list.length) - 1;
  }
  return state;
}
