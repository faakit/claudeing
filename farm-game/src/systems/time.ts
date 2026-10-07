import { MS_PER_GAME_MINUTE } from '../config';
import { game } from '../data';
import type { GameState, Season } from '../state/GameState';
import { SEASONS } from '../state/GameState';

/**
 * Advance the clock by real elapsed ms. Never reads the wall clock, so changing the
 * phone's time can't affect the game. Returns true when the day hit its end (02:00).
 */
export function tickTime(state: GameState, dtMs: number): { passOut: boolean } {
  const t = state.time;
  if (t.minutes >= game.dayEndMinutes) return { passOut: true };
  t.acc += dtMs;
  while (t.acc >= MS_PER_GAME_MINUTE) {
    t.acc -= MS_PER_GAME_MINUTE;
    t.minutes += 1;
    if (t.minutes >= game.dayEndMinutes) {
      t.minutes = game.dayEndMinutes;
      t.acc = 0;
      return { passOut: true };
    }
  }
  return { passOut: false };
}

/** Roll the calendar forward one day. Returns true if the season changed. */
export function advanceCalendar(state: GameState): boolean {
  const t = state.time;
  t.day += 1;
  t.minutes = game.dayStartMinutes;
  t.acc = 0;
  if (t.day <= game.seasonLength) return false;
  t.day = 1;
  const next = (SEASONS.indexOf(t.season) + 1) % SEASONS.length;
  t.season = SEASONS[next] as Season;
  if (next === 0) t.year += 1;
  return true;
}

/** "6:00 AM" style, wrapping past midnight (1500 -> "1:00 AM"). */
export function formatClock(minutes: number): string {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`;
}

export const seasonLabel = (s: Season): string => s.charAt(0).toUpperCase() + s.slice(1);

/** A day number that keeps rising across seasons and years (1 = the first day). */
export const absoluteDay = (state: GameState): number => {
  const t = state.time;
  return ((t.year - 1) * SEASONS.length + SEASONS.indexOf(t.season)) * game.seasonLength + t.day;
};
