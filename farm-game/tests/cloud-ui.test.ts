/**
 * Cloud save's words fit where they are drawn, in both languages (ui/panels/cloudText.ts, CloudConflictPanel,
 * CloudTab, the title and Options), and read the way the player expects ("5 min ago", "1 h 30 min").
 */
import { afterEach, describe, expect, it } from 'vitest';
import { setLocale, t, type Locale } from '../src/i18n';
import { measureText, wrapText } from '../src/ui/fontMetrics';
import {
  agoText,
  cloudStatusLine,
  playedLine,
  playTimeText,
  saveLine,
} from '../src/ui/panels/cloudText';
import type { CloudState } from '../src/platform/cloudSave';
import type { SaveSummary } from '../src/systems/cloudRules';

afterEach(() => setLocale('en'));
const LOCALES: Locale[] = ['en', 'pt-BR'];
const NOW = 10_000_000_000;
const MIN = 60_000;

/** The widest save a card can show: winter 28 of year 10, a big purse, 99 h played, saved 30 days ago. */
const worst: SaveSummary = {
  day: 9999,
  year: 10,
  season: 'winter',
  dayOfSeason: 28,
  money: 9_999_999,
  playSec: 99 * 3600 + 59 * 60,
  savedAt: NOW - 30 * 24 * 60 * MIN,
};

describe('cloud save text', () => {
  it('says how long ago and how long played', () => {
    expect(agoText(NOW - 10_000, NOW)).toBe('just now');
    expect(agoText(NOW - 5 * MIN, NOW)).toBe('5 min ago');
    expect(agoText(NOW - 3 * 60 * MIN, NOW)).toBe('3 h ago');
    expect(agoText(NOW - 49 * 60 * MIN, NOW)).toBe('2 days ago');
    expect(playTimeText(12 * 60 + 5)).toBe('12 min');
    expect(playTimeText(5400)).toBe('1h 30m');
  });

  for (const loc of LOCALES)
    it(`fits in ${loc}`, () => {
      setLocale(loc);
      // the conflict dialog: card lines start 6 px into the 184 px card and stop at its 2 px rim
      for (const ago of [10_000, 5 * MIN, 59 * MIN, 23 * 60 * MIN, 30 * 24 * 60 * MIN]) {
        const line = playedLine({ ...worst, savedAt: NOW - ago }, NOW);
        expect(measureText(line), line).toBeLessThanOrEqual(184 - 8);
      }
      expect(measureText(saveLine(worst))).toBeLessThanOrEqual(184 - 8);
      expect(measureText(t('cloud.phone')) + 8 + measureText(t('cloud.ahead'))).toBeLessThanOrEqual(
        172,
      );
      for (const k of ['cloud.keepPhone', 'cloud.useCloud', 'cloud.later'] as const)
        expect(measureText(t(k)), k).toBeLessThanOrEqual(184 - 8 - 8);
      for (const k of ['cloud.conflictAhead', 'cloud.conflictDiverged'] as const)
        expect(wrapText(t(k), 184).length, k).toBeLessThanOrEqual(2);
      expect(measureText(t('cloud.conflictTitle'))).toBeLessThanOrEqual(184);
      // Options: the entry beside the language (a half button) and the status line above the rows
      for (const k of ['cloud.entrySignIn', 'cloud.entryOn'] as const)
        expect(measureText(t(k)), k).toBeLessThanOrEqual(92 - 8);
      const states: CloudState[] = [
        'off',
        'signedOut',
        'idle',
        'syncing',
        'synced',
        'pending',
        'conflict',
        'newer',
        'error',
      ];
      for (const state of states)
        for (const lastSync of [null, NOW - 59 * MIN, NOW - 30 * 24 * 60 * MIN]) {
          const line = cloudStatusLine({ state, account: 'Ana', lastSync }, NOW);
          expect(measureText(line), line).toBeLessThanOrEqual(184);
        }
      // the cloud page: its buttons and its one-row lines
      for (const k of ['cloud.syncNow', 'cloud.turnOff', 'cloud.choose'] as const)
        expect(measureText(t(k)), k).toBeLessThanOrEqual(92 - 8);
      expect(measureText(t('cloud.signIn'))).toBeLessThanOrEqual(184 - 8);
      expect(
        measureText(t('cloud.lastSynced', { ago: agoText(NOW - 59 * MIN, NOW) })),
      ).toBeLessThanOrEqual(184);
      // the page's text runs down from its top, far above its two button rows: four lines each is plenty
      for (const k of ['cloud.privacy', 'cloud.newer', 'cloud.off'] as const)
        expect(wrapText(t(k), 184).length, k).toBeLessThanOrEqual(4);
      // the title's buttons (150 px)
      for (const k of ['cloud.continueCloud', 'cloud.continuePhone'] as const)
        expect(measureText(t(k)), k).toBeLessThanOrEqual(150 - 8);
    });
});
