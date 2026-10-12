import { projects } from '../../data';
import type { GameState } from '../../state/GameState';
import { isProjectDone, visibleProjects } from '../../systems/projects';
import { fmt } from './format';
import { measureText } from '../fontMetrics';
import { fmtGold, getLocale, goldText, t } from '../../i18n';

/** The project sheet's height and list layout: rows from LIST_TOP, paging buttons above Close. */
export const PROJECT_SHEET_H = 250;

/**
 * A fund's goods line, with where the good comes from while it is short ("Stone 3/20 (have 2): rocks in the
 * mine"), when that fits the sheet; else the plain line. Every ask says where its goods come from (owner).
 */
export function needLine(label: string, source: string | undefined, short: boolean): string {
  if (!short || !source) return label;
  const full = t('project.needFrom', { line: label, source });
  return measureText(full) <= 184 ? full : label;
}
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
  if (!done) return `${fmt(given)}/${fmtGold(gold)}`;
  const line = perkLine(perks);
  return line ? t('project.doneLine', { line }) : t('project.doneShort');
}

/** Big gold in few characters: 4,500, 45k, 1.2M. */
export const kfmt = (n: number): string =>
  n < 10_000 ? fmt(n) : n < 1_000_000 ? `${Math.round(n / 1000)}k` : `${fmtNumDecimal(n / 1e6)}M`;

/** A repeatable project's list line: "Level 2  1,200/9,000g" or "Level 3  12k/68k" (never "68kg"). */
export const repeatSub = (level: number, given: number, price: number): string => {
  const p = kfmt(price);
  const amount = /\d$/.test(p) ? goldText(p) : p;
  return t('project.levelSub', { level, given: kfmt(given), price: amount });
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
export const gloryLine = (): string => t('project.glory');

/** The line under the sheet title. */
export const projectsIntro = (): string => t('project.intro');

/** One decimal in the current language's style (1.2 or 1,2). */
const fmtNumDecimal = (n: number): string =>
  n.toLocaleString(getLocale() === 'en' ? 'en-US' : getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
