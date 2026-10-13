/**
 * Retention and churn maths, pure (no clock, no storage), so the tests can pin every day boundary.
 *
 * Days are the player's local calendar days: 23:59 and 00:01 are different days wherever the phone is, and a DST
 * change never makes a day vanish or repeat. A day is an integer (days since 1970-01-01 in local time). The
 * install day is the local day of the first launch; `install_day` (sent with every event) is today minus that.
 *
 * - Dn retention (n = 1, 7, 30): the install was active (a session started, or the app came back) on install day n
 *   exactly. That is Firebase's own "day n" retention. `retainedBy(n)` is the looser "active on day n or later".
 * - Day of churn: an install is churned once it has been away `CHURN_DAYS` (7) local days or more. Its day of churn
 *   is the last game day and the last install day it was seen on.
 */
export const DAY_MS = 86_400_000;
/** Days away after which an install counts as churned. */
export const CHURN_DAYS = 7;
/** The retention days the funnel reports. */
export const RETENTION_DAYS = [1, 7, 30] as const;

/**
 * The local calendar day of an instant: whole days since the epoch in local time. `offsetMin` is the UTC offset as
 * `Date#getTimezoneOffset` gives it (minutes, positive west of Greenwich), at that instant, so DST is handled.
 */
export function localDay(ms: number, offsetMin: number = new Date(ms).getTimezoneOffset()): number {
  return Math.floor((ms - offsetMin * 60_000) / DAY_MS);
}

/** Whole local days since the install day (never negative: a clock set back counts as day 0). */
export const installDay = (today: number, installedOn: number): number =>
  Math.max(0, today - installedOn);

/** Add an install day to a sorted list of active days (unique, ascending, at most `cap` kept: the earliest). */
export function addActiveDay(active: number[], day: number, cap = 400): number[] {
  if (active.includes(day)) return active;
  const out = [...active, day].sort((a, b) => a - b);
  return out.length > cap ? out.slice(0, cap) : out;
}

/** Was the install active on install day `n` exactly (classic Dn retention)? */
export const retainedOn = (active: readonly number[], n: number): boolean => active.includes(n);

/** Was the install active on install day `n` or any later day ("unbounded" retention)? */
export const retainedBy = (active: readonly number[], n: number): boolean =>
  active.some((d) => d >= n);

export interface RetentionFlags {
  d1: boolean;
  d7: boolean;
  d30: boolean;
}

/** D1, D7 and D30 (exact-day) for one install. */
export const retention = (active: readonly number[]): RetentionFlags => ({
  d1: retainedOn(active, 1),
  d7: retainedOn(active, 7),
  d30: retainedOn(active, 30),
});

/**
 * A cohort's Dn retention: of the installs at least `n` days old today, the share active on day `n`. Null when no
 * install is old enough yet (a share of nobody).
 */
export function cohortRetention(
  installs: readonly { active: readonly number[]; age: number }[],
  n: number,
): number | null {
  const eligible = installs.filter((i) => i.age >= n);
  if (!eligible.length) return null;
  return eligible.filter((i) => retainedOn(i.active, n)).length / eligible.length;
}

export interface Churn {
  /** Away `CHURN_DAYS` or more. */
  churned: boolean;
  /** Local days since it was last seen. */
  daysAway: number;
  /** The install day it was last seen on (its day of churn, in real days). */
  lastInstallDay: number;
  /** The last game day it played (its day of churn, in game days; 0 if it never entered a game). */
  lastGameDay: number;
}

/** Churn for one install, from the last local day and game day seen. */
export function churn(
  last: { day: number; gameDay: number },
  installedOn: number,
  today: number,
  threshold = CHURN_DAYS,
): Churn {
  const daysAway = Math.max(0, today - last.day);
  return {
    churned: daysAway >= threshold,
    daysAway,
    lastInstallDay: installDay(last.day, installedOn),
    lastGameDay: last.gameDay,
  };
}
