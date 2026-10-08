import { projects } from '../../data';
import type { GameState } from '../../state/GameState';
import { isProjectDone, visibleProjects } from '../../systems/projects';
import { fmt } from './format';

/** The project sheet's height and list layout: rows from LIST_TOP, paging buttons above Close. */
export const PROJECT_SHEET_H = 250;
export const LIST_TOP = 34;
export const LIST_ROWS = 5;
export const LIST_NAV_FROM_BOTTOM = 52;

/** The list's two views: projects you can still fund (the statue always), and finished ones. */
export function projectLists(state: GameState): { open: string[]; finished: string[] } {
  const ids = visibleProjects(state);
  const finished = ids.filter((id) => isProjectDone(state, id) && !projects[id]?.repeat);
  return { open: ids.filter((id) => !finished.includes(id)), finished };
}
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
  if (!done) return `${fmt(given)}/${fmt(gold)}g`;
  const line = perkLine(perks);
  return line ? `Done: ${line}` : 'Done!';
}

/** Big gold in few characters: 4,500, 45k, 1.2M. */
export const kfmt = (n: number): string =>
  n < 10_000 ? fmt(n) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${(n / 1e6).toFixed(1)}M`;

/** A repeatable project's list line: "Level 2  1,200/9,000g" or "Level 3  12k/68k" (never "68kg"). */
export const repeatSub = (level: number, given: number, price: number): string => {
  const p = kfmt(price);
  return `Level ${level}  ${kfmt(given)}/${p}${/\d$/.test(p) ? 'g' : ''}`;
};

/** What a repeatable project's levels give so far: "+3%" for the statue. */
export function repeatNow(
  p: { perks: Record<string, number>; repeat?: { perkLevels: number } },
  level: number,
): string {
  const levels = Math.min(level, p.repeat?.perkLevels ?? 1);
  return Object.values(p.perks)
    .map((v) => `+${Math.round(v * levels * 100)}%`)
    .join(', ');
}

/** What a repeatable project's next level does once its perks have run out. */
export const GLORY_LINE = 'Each level now is just for glory.';

/** The line under the sheet title. */
export const PROJECTS_INTRO = 'Every finished one helps for good.';
