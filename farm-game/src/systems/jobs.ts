import { jobs as jobDefs, npcs } from '../data';
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
      reward: jobReward(def, n, state.time.year),
      done: false,
    };
  });
}

/** How far along a job is today (0..n). */
export const jobProgress = (state: GameState, job: Job): number =>
  job.done ? job.n : Math.max(0, Math.min(job.n, stat(state, job.stat) - job.base));

/** "Finn: catch 2 fish". */
export function jobLabel(job: Job): string {
  const name = npcs[job.giver]?.name ?? job.giver;
  const text = (defOf(job.id)?.text ?? job.id)
    .replace('{n}', String(job.n))
    .replace('{s}', job.n === 1 ? '' : 's');
  return `${name}: ${text}`;
}

/**
 * Jobs counted at the night's payout instead of on the spot: what is shipped can be taken back out of the
 * bin until then, so a shipping job pays only for goods that really sold.
 */
export const PAID_AT_PAYOUT = new Set(['shipped']);

/** Pay out every job whose stat has moved far enough today. Runs whenever stats change. */
export function checkJobs(state: GameState, atPayout = false): void {
  if (state.jobs.day !== absoluteDay(state)) return; // yesterday's jobs never pay late
  for (const job of state.jobs.list) {
    if (job.done || jobProgress(state, job) < job.n) continue;
    if (PAID_AT_PAYOUT.has(job.stat) !== atPayout) continue;
    job.done = true;
    state.money += job.reward;
    state.stats['earned'] = stat(state, 'earned') + job.reward;
    gameEvents.emit('moneyChanged', { delta: job.reward });
    befriend(state, job.giver, JOB_FRIENDSHIP);
    toast(`Job done! ${jobLabel(job)} +${job.reward}g`, 'good');
    addStat(state, 'jobsDone');
  }
}

export const openJobs = (state: GameState): Job[] =>
  state.jobs.day === absoluteDay(state) ? state.jobs.list.filter((j) => !j.done) : [];
