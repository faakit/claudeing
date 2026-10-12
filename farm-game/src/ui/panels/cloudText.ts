/** Cloud save's words (Options, the cloud page, the conflict dialog, the title). Pure: tests measure them. */
import type { CloudStatus } from '../../platform/cloudSave';
import type { SaveSummary } from '../../systems/cloudRules';
import { seasonLabel } from '../../systems/time';
import { fmtGold, t } from '../../i18n';

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function agoText(ms: number, now: number): string {
  const min = Math.floor(Math.max(0, now - ms) / 60_000);
  if (min < 1) return t('cloud.justNow');
  if (min < 60) return t('cloud.minutesAgo', { count: min });
  const h = Math.floor(min / 60);
  if (h < 24) return t('cloud.hoursAgo', { count: h });
  return t('cloud.daysAgo', { count: Math.floor(h / 24) });
}

/** "3 h 20 min", "12 min". */
export function playTimeText(sec: number): string {
  const m = Math.floor(sec / 60);
  return m >= 60
    ? t('cloud.playHours', { h: Math.floor(m / 60), m: m % 60 })
    : t('cloud.playMinutes', { m });
}

/** The one status line Options shows above its rows. */
export function cloudStatusLine(s: CloudStatus, now: number): string {
  switch (s.state) {
    case 'off':
      return t('cloud.lineOff');
    case 'signedOut':
    case 'signingIn':
      return t('cloud.lineSignedOut');
    case 'syncing':
      return t('cloud.lineSyncing');
    case 'pending':
      return t('cloud.linePending');
    case 'conflict':
      return t('cloud.lineConflict');
    case 'newer':
      return t('cloud.lineNewer');
    case 'error':
      return t('cloud.lineError');
    default:
      return s.lastSync !== null
        ? t('cloud.lineSynced', { ago: agoText(s.lastSync, now) })
        : t('cloud.lineIdle');
  }
}

/** A save's first card line: "Spring 12, year 1  1,234g" (the title's save line). */
export function saveLine(s: SaveSummary): string {
  return t('title.saveLine', {
    season: seasonLabel(s.season),
    day: s.dayOfSeason,
    year: s.year,
    gold: fmtGold(s.money),
  });
}

/** A save's second card line: "Played 3 h 20 min, saved 5 min ago". */
export function playedLine(s: SaveSummary, now: number): string {
  return t('cloud.played', {
    time: playTimeText(s.playSec),
    ago: s.savedAt > 0 ? agoText(s.savedAt, now) : '-',
  });
}
