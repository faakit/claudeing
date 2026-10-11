import { t, type Key } from '../../i18n';
import type { Season } from '../../state/GameState';

/** One morning tip: its dictionary key, the seasons it shows in (all when absent) and its text, now. */
interface SummaryTip {
  key: Key;
  seasons?: Season[];
  readonly text: string;
}
const tip = (key: Key, seasons?: Season[]): SummaryTip => ({
  key,
  ...(seasons ? { seasons } : {}),
  get text(): string {
    return t(key);
  },
});

/** Morning tips. A tip with `seasons` only shows then, so nobody reads about winter on Spring 1. */
export const SUMMARY_TIPS: SummaryTip[] = [
  tip('summaryTips.water'),
  tip('summaryTips.season'),
  tip('summaryTips.corn', ['spring', 'summer']),
  tip('summaryTips.kale', ['fall', 'winter']),
  tip('summaryTips.paint'),
  tip('summaryTips.can'),
  tip('summaryTips.passOut'),
  tip('summaryTips.weeds'),
  tip('summaryTips.wither'),
  tip('summaryTips.bin'),
  tip('summaryTips.jobs'),
];

/** Today's tip: rotates by day, skipping tips for other seasons. */
export function summaryTip(season: Season, day: number, year: number): string {
  const pool = SUMMARY_TIPS.filter((x) => !x.seasons || x.seasons.includes(season));
  return pool[(day + year) % pool.length]?.text ?? '';
}
