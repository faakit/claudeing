import { fish as fishTable, items } from '../data';
import type { BaitDef, FishDef } from '../data';
import type { GameState } from '../state/GameState';
import { toast } from './events';
import { addStat } from './goals';
import { derbyMaps, derbyScore, festivalToday, recordCatch } from './festivals';
import { addItem, countItem, removeItem, roomFor } from './inventory';
import { displayName } from './itemRef';
import { rollQuality } from './quality';
import { isWet } from './weather';
import { absoluteDay } from './time';
import { random } from './rng';
import { addXp, perk } from './skills';
import { t } from '../i18n';

/** Is this fish in the valley's water at all? The river's fish come back with the weir (`place`). */
export const fishOpen = (state: Pick<GameState, 'stats'>, f: FishDef): boolean =>
  f.place === undefined || (state.stats[`place.${f.place}`] ?? 0) >= 3;

/** Fish that can bite on `map` today. */
export function fishFor(state: GameState, map: string): FishDef[] {
  // Derby day: the organisers stock a big fish that bites whatever the weather.
  const today = festivalToday(state)?.def;
  const stocked = today?.stocked;
  const stockedMaps = today ? derbyMaps(state, today) : [];
  return fishTable.filter(
    (f) =>
      !(f.legend && state.stats[`legend.${f.item}`]) &&
      ((stocked?.fish === f.item && stockedMaps.includes(map)) ||
        (f.maps.includes(map) &&
          fishOpen(state, f) &&
          f.seasons.includes(state.time.season) &&
          (!f.weather ||
            (f.weather === 'rain' && isWet(state.weather)) ||
            f.weather === state.weather))),
  );
}

/** A bait's effect, or null when the item is not a bait. */
export const baitOf = (item: string | null | undefined): BaitDef | null =>
  (item && items[item]?.bait) || null;

/** Every bait item, plainest (lowest code) first. */
export const baitItems = (): string[] =>
  Object.keys(items)
    .filter((id) => items[id]?.bait)
    .sort((a, b) => baitOf(a)!.code - baitOf(b)!.code);

const baitByCode = (code: number): string | undefined =>
  baitItems().find((id) => baitOf(id)!.code === code);

/** The stat that remembers the bait last chosen (its `code`): one cast picks it, the next keeps it. */
export const BAIT_PICK = 'bait.pick';

/**
 * The bait the next cast uses: a bait in hand, else the one used last while some is left, else the plainest you
 * carry. Null: no bait at all, so the cast is refused (fishing needs bait; owner, bait round).
 */
export function currentBait(state: GameState): string | null {
  const held = state.inventory.slots[state.inventory.selected]?.item;
  if (baitOf(held)) return held!;
  return currentBaitOnRod(state);
}

/** Worms a new game starts with, and an old save is given once (fishing needs bait since the bait round). */
export const STARTER_BAIT = { item: 'worms', qty: 10 } as const;
/** This save knows that fishing needs bait (new games carry it; saves from before get their stack once). */
export const BAIT_ON = 'bait.on';

/**
 * Saves from before the bait round fished without bait, so they get the starter stack once (no version bump, the
 * M6/M7 pattern): in the bag, or, with a full bag, by Finn's letter (`bait.owed`). `bait.oldSave` sends his note.
 */
export function baitDefaults(state: GameState): GameState {
  if (state.stats[BAIT_ON]) return state;
  state.stats[BAIT_ON] = 1;
  state.stats['bait.oldSave'] = 1;
  if (roomFor(state, STARTER_BAIT.item, STARTER_BAIT.qty) >= STARTER_BAIT.qty)
    addItem(state, STARTER_BAIT.item, STARTER_BAIT.qty);
  else state.stats['bait.owed'] = 1;
  return state;
}

/**
 * The free bait: one tile in `WORM_ODDS` the hoe tills or the scythe clears turns up worms (one in half that on a
 * wet day), from day 3 (days 1 and 2 are the guided start, kept quiet: the onboarding gate). Decided by a hash of the running count, not the
 * RNG, so the sims' random paths do not move. Returns how many were found (and put in the bag, room allowing).
 */
export const WORM_ODDS = 6;
const DIG_STATS = ['tilled', 'cleared'] as const;
export function digWorms(state: GameState): number {
  let found = 0;
  for (const name of DIG_STATS) {
    const now = state.stats[name] ?? 0;
    const seenKey = `bait.seen.${name}`;
    const seen = state.stats[seenKey];
    state.stats[seenKey] = now;
    if (seen === undefined || now <= seen || absoluteDay(state) < 3) continue;
    const odds = isWet(state.weather) ? WORM_ODDS / 2 : WORM_ODDS;
    for (let n = seen + 1; n <= now; n++)
      if (
        (Math.imul(n, 2654435761) ^ (name === 'tilled' ? 0x5bd1e995 : 0x1b873593)) >>> 0 <
        0x100000000 / odds
      )
        found += 1;
  }
  if (found === 0) return 0;
  const room = Math.min(found, roomFor(state, STARTER_BAIT.item, found));
  if (room > 0) addItem(state, STARTER_BAIT.item, room);
  return room;
}

/**
 * The fishing sheet's one-tap switch: the next bait you carry (by code, wrapping round) becomes the one the next
 * cast uses, as if it had been cast last. Null when you carry fewer than two kinds (nothing to switch to).
 */
export function nextBait(state: GameState): string | null {
  const owned = baitItems().filter((id) => countItem(state, id) > 0);
  if (owned.length < 2) return null;
  const now = currentBaitOnRod(state);
  const next = owned[(owned.indexOf(now ?? '') + 1) % owned.length]!;
  state.stats[BAIT_PICK] = baitOf(next)!.code;
  return next;
}

/** The bait the rod would use (the remembered one, else the plainest), whatever is in hand. */
export function currentBaitOnRod(state: GameState): string | null {
  const picked = baitByCode(state.stats[BAIT_PICK] ?? 0);
  if (picked && countItem(state, picked) > 0) return picked;
  return baitItems().find((id) => countItem(state, id) > 0) ?? null;
}

/** Any bait in the bag at all. */
export const hasBait = (state: GameState): boolean => currentBait(state) !== null;

/** Take one bait for a cast and remember it as the bait to use next. False if none is carried. */
export function useBait(state: GameState, item: string): boolean {
  const def = baitOf(item);
  if (!def || !removeItem(state, item, 1)) return false;
  state.stats[BAIT_PICK] = def.code;
  return true;
}

/** A fish's weight in the draw with this bait: harder fish rise with `rare`, legends with `legend`. */
export function baitWeight(f: FishDef, bait: BaitDef | null): number {
  if (!bait) return f.weight;
  return f.legend ? f.weight * bait.legend : f.weight * (1 + bait.rare * f.difficulty * 3);
}

export function pickFish(
  state: GameState,
  map: string,
  bait: string | null = null,
): FishDef | null {
  const pool = fishFor(state, map);
  const b = baitOf(bait);
  // Storms stir the water: fish that only bite in wet weather bite far more often.
  const w = (f: FishDef) => baitWeight(f, b) * (state.weather === 'storm' && f.weather ? 3 : 1);
  const total = pool.reduce((n, f) => n + w(f), 0);
  if (total <= 0) return null;
  let r = random(state) * total;
  for (const f of pool) {
    r -= w(f);
    if (r < 0) return f;
  }
  return pool[pool.length - 1] ?? null;
}

/** Each fish's chance (0..1) on this map today with this bait, for the tests and the Book. */
export function fishOdds(state: GameState, map: string, bait: string | null): Map<string, number> {
  const pool = fishFor(state, map);
  const b = baitOf(bait);
  const w = (f: FishDef) => baitWeight(f, b) * (state.weather === 'storm' && f.weather ? 3 : 1);
  const total = pool.reduce((n, f) => n + w(f), 0);
  return new Map(pool.map((f) => [f.item, total > 0 ? w(f) / total : 0]));
}

/** Seconds until the fish bites: the bait's `wait` times the base wait, shorter with a better rod. */
export const biteDelay = (rnd: number, bait: string | null, rodTier = 0): number =>
  (1.2 + rnd * 2.2) * (baitOf(bait)?.wait ?? 1) * (1 - 0.12 * rodTier);

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

/** Size of the catch bar: wider with fishing level and some baits, narrower for tougher fish. */
export const reelSize = (state: GameState, difficulty: number, bait: string | null): number =>
  Math.min(
    0.6,
    Math.max(
      0.16,
      0.3 +
        perk(state, 'fishWindow') +
        state.upgrades.rod * 0.05 +
        (baitOf(bait)?.reel ?? 0) -
        difficulty * 0.12,
    ),
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

/** Pay out a fight: the fish (quality rolled, perfect catches and finer baits roll better), XP and stats. */
export function resolveCatch(
  state: GameState,
  fishId: string,
  outcome: CatchOutcome,
  bait: string | null = null,
): { ok: boolean; q: number } {
  const def = fishTable.find((f) => f.item === fishId);
  if (!def || !outcome.caught) {
    toast(t('fishing.gotAway'), 'warn');
    return { ok: false, q: 0 };
  }
  if (roomFor(state, fishId, 1) < 1) {
    toast(t('fishing.fullReleased'), 'warn');
    return { ok: false, q: 0 };
  }
  const q = rollQuality(state, (outcome.perfect ? 0.15 : 0) + (baitOf(bait)?.quality ?? 0));
  addItem(state, q > 0 ? { item: fishId, q } : fishId, 1);
  // The Fishing Derby counts the day's best catches; say so when this one improves the score.
  if (recordCatch(state, { item: fishId, q }))
    toast(
      t('fishing.derbyBest', { fish: displayName({ item: fishId, q }), score: derbyScore(state) }),
      'good',
    );
  addStat(state, 'caught');
  if (def.legend) {
    // A legend bites once a game: remember it, and make a fuss.
    state.stats[`legend.${fishId}`] = 1;
    addStat(state, 'legends');
    toast(t('fishing.legend', { fish: items[fishId]?.name ?? fishId }), 'good');
  }
  if (q > 0) addStat(state, 'qualityCaught');
  if (outcome.perfect) addStat(state, 'perfectCatch');
  addXp(
    state,
    'fishing',
    Math.round((items[fishId]?.sellPrice ?? 20) * 0.2 * (outcome.perfect ? 1.5 : 1)),
  );
  return { ok: true, q };
}
