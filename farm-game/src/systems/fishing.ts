import { fish as fishTable, items } from '../data';
import type { FishDef } from '../data';
import type { GameState } from '../state/GameState';
import { toast } from './events';
import { addStat } from './goals';
import { addItem, countItem, removeItem, roomFor } from './inventory';
import { rollQuality } from './quality';
import { random } from './rng';
import { addXp, perk } from './skills';

/** Fish that can bite on `map` today. */
export function fishFor(state: GameState, map: string): FishDef[] {
  return fishTable.filter(
    (f) =>
      f.maps.includes(map) &&
      f.seasons.includes(state.time.season) &&
      (!f.weather || f.weather === state.weather),
  );
}

export function pickFish(state: GameState, map: string): FishDef | null {
  const pool = fishFor(state, map);
  const total = pool.reduce((n, f) => n + f.weight, 0);
  if (total <= 0) return null;
  let r = random(state) * total;
  for (const f of pool) {
    r -= f.weight;
    if (r < 0) return f;
  }
  return pool[pool.length - 1] ?? null;
}

export const hasBait = (state: GameState): boolean => countItem(state, 'bait') > 0;

/** Seconds until the fish bites. Bait halves the wait. */
export const biteDelay = (rnd: number, bait: boolean): number =>
  (1.2 + rnd * 2.2) * (bait ? 0.55 : 1);

/** The window (s) in which a tap hooks the fish. */
export const HOOK_WINDOW = 1.5;

export interface Reel {
  /** All positions are 0 (bottom) .. 1 (top). */
  bar: number;
  barVel: number;
  size: number;
  fish: number;
  target: number;
  retarget: number;
  progress: number;
  elapsed: number;
  difficulty: number;
  /** Time the fish spent inside the bar (for the "perfect" bonus). */
  inside: number;
  result: null | 'caught' | 'lost';
}

export const REEL_TIMEOUT = 24;

/** Size of the catch bar: wider with fishing level and bait, narrower for tougher fish. */
export const reelSize = (state: GameState, difficulty: number, bait: boolean): number =>
  Math.min(
    0.6,
    Math.max(0.16, 0.3 + perk(state, 'fishWindow') + (bait ? 0.06 : 0) - difficulty * 0.12),
  );

export function newReel(size: number, difficulty: number): Reel {
  return {
    bar: 0.1,
    barVel: 0,
    size,
    fish: 0.5,
    target: 0.5,
    retarget: 0.4,
    progress: 0.3,
    elapsed: 0,
    difficulty,
    inside: 0,
    result: null,
  };
}

/**
 * Advance the reel. One-thumb: hold to rise, release to sink. The fish darts around; keep it in the
 * bar to fill the meter, lose it and the meter drains. `rnd` supplies randomness so tests are exact.
 */
export function stepReel(r: Reel, dt: number, holding: boolean, rnd: () => number): void {
  if (r.result) return;
  r.elapsed += dt;
  r.barVel += (holding ? 2.8 : -2.4) * dt;
  r.barVel = Math.max(-1.1, Math.min(1.1, r.barVel));
  r.bar += r.barVel * dt;
  if (r.bar < 0) {
    r.bar = 0;
    r.barVel = Math.max(0, r.barVel * -0.3);
  }
  if (r.bar > 1 - r.size) {
    r.bar = 1 - r.size;
    r.barVel = Math.min(0, r.barVel * -0.3);
  }
  r.retarget -= dt;
  if (r.retarget <= 0) {
    r.retarget = 0.5 + rnd() * (1.1 - r.difficulty * 0.5);
    const jump = 0.2 + r.difficulty * 0.55;
    r.target = Math.max(0.04, Math.min(0.96, r.fish + (rnd() * 2 - 1) * jump));
  }
  const speed = 0.25 + r.difficulty * 0.6;
  const dx = r.target - r.fish;
  r.fish += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
  const inBar = r.fish >= r.bar && r.fish <= r.bar + r.size;
  if (inBar) r.inside += dt;
  r.progress += (inBar ? 0.3 : -(0.12 + r.difficulty * 0.1)) * dt;
  r.progress = Math.min(1, r.progress);
  if (r.progress >= 1) r.result = 'caught';
  else if (r.progress <= 0 || r.elapsed > REEL_TIMEOUT) r.result = 'lost';
}

export interface CatchOutcome {
  caught: boolean;
  /** Fish stayed in the bar nearly the whole fight. */
  perfect: boolean;
}

/** Fraction of the fight in the bar needed for a perfect catch. */
export const PERFECT_RATIO = 0.8;

export const outcomeOf = (r: Reel): CatchOutcome => ({
  caught: r.result === 'caught',
  perfect: r.result === 'caught' && r.elapsed > 0 && r.inside / r.elapsed >= PERFECT_RATIO,
});

/** Pay out a fight: the fish (quality rolled, perfect catches roll better), XP and stats. */
export function resolveCatch(
  state: GameState,
  fishId: string,
  outcome: CatchOutcome,
): { ok: boolean; q: number } {
  const def = fishTable.find((f) => f.item === fishId);
  if (!def || !outcome.caught) {
    toast('It got away...', 'warn');
    return { ok: false, q: 0 };
  }
  if (roomFor(state, fishId, 1) < 1) {
    toast('Inventory full! Released it.', 'warn');
    return { ok: false, q: 0 };
  }
  const q = rollQuality(state, outcome.perfect ? 0.15 : 0);
  addItem(state, q > 0 ? { item: fishId, q } : fishId, 1);
  addStat(state, 'caught');
  if (q > 0) addStat(state, 'qualityCaught');
  if (outcome.perfect) addStat(state, 'perfectCatch');
  addXp(
    state,
    'fishing',
    Math.round((items[fishId]?.sellPrice ?? 20) * 0.2 * (outcome.perfect ? 1.5 : 1)),
  );
  return { ok: true, q };
}

export function useBait(state: GameState): boolean {
  return removeItem(state, 'bait', 1);
}
