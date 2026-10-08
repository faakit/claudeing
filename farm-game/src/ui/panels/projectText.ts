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

/** The line under the sheet title. */
export const PROJECTS_INTRO = 'Every finished one helps for good.';
