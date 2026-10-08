import { fmt } from './format';
import { perkLine } from './perkText';

/** Gold steps for the Give buttons: small, medium, large. Each gives at most what is still needed. */
export const GIVE_STEPS = [100, 1000, 10000] as const;

/** One line under a project's name in the list. Pure so tests can prove it fits. */
export function projectSub(
  given: number,
  gold: number,
  done: boolean,
  perks: Record<string, number>,
): string {
  return done ? `Done: ${perkLine(perks)}` : `${fmt(given)}/${fmt(gold)}g`;
}

/** Big gold in few characters: 4,500, 45k, 1.2M. */
export const kfmt = (n: number): string =>
  n < 10_000 ? fmt(n) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${(n / 1e6).toFixed(1)}M`;

/** A repeatable project's list line: "Level 2  1,200/45kg". */
export const repeatSub = (level: number, given: number, price: number): string =>
  `Level ${level}  ${kfmt(given)}/${kfmt(price)}g`;

/** What a repeatable project's next level does once its perks have run out. */
export const GLORY_LINE = 'Each level now is just for glory.';

/** The line under the sheet title. */
export const PROJECTS_INTRO = 'Every finished one helps for good.';
