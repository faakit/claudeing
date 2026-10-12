/**
 * Connects the game to the analytics layer (platform/analytics): picks the provider from the config, then turns game
 * moments into the schema's events. No config: nothing starts, nothing is stored, and the game runs exactly as
 * without analytics.
 *
 * Config (DECISIONS.md, agents/PUBLISHING.md):
 * - `VITE_ANALYTICS=firebase` in the gitignored `farm-game/.env.local` makes an Android build use Firebase, once the
 *   owner has added `google-services.json` and the plugin. On the web it stays off.
 * - `?analytics=dev` on a debug page (`?debug`, `npm run dev`) uses the dev provider: events in the DEV tab and on
 *   `window.__farm.analytics`, never sent anywhere. `npm run dev` uses it by default; `?analytics=0` turns it off.
 * - `&consent=ask` makes the dev provider ask on the title as the production one does.
 *
 * Every hook here runs on an event (a day, a stat change, a step), never per frame.
 */
import { analytics, type Milestone } from '../platform/analytics';
import {
  createDevProvider,
  createFirebaseProvider,
  firebaseAvailable,
  type DevProvider,
} from '../platform/analytics/providers';
import { MILESTONES, LANGS } from '../platform/analytics/schema';
import { lifecycle } from '../platform/lifecycle';
import { MemoryStore } from '../platform/SaveStore';
import type { GameState } from '../state/GameState';
import { getState } from '../state/store';
import { runtime } from '../state/runtime';
import { gameEvents } from '../systems/events';
import { registerStatWatcher, stat } from '../systems/goals';
import { villagerHome } from '../systems/houses';
import { absoluteDay } from '../systems/time';
import { guidedStepIds, guidedTracksDone, isFreshGame, stepDone } from '../systems/tutorial';
import { FARM_GREEN, placeStat } from '../systems/valley';
import { saveStore } from './persistence';

export interface AnalyticsChoice {
  provider: 'noop' | 'dev' | 'firebase';
  /** Ask on the title before anything is sent. */
  askConsent: boolean;
  /** A scenario page: the record lives in memory, like its saves. */
  sandbox: boolean;
}

/** Which provider this page uses (pure: the build's env, the URL's query, and whether the native plugin exists). */
export function chooseAnalytics(
  env: { DEV: boolean; VITE_ANALYTICS?: string },
  search: string,
  firebaseOk: boolean,
): AnalyticsChoice {
  const q = new URLSearchParams(search);
  const sandbox = q.has('scenario');
  const debug = env.DEV || q.has('debug');
  const want = q.get('analytics');
  const ask = q.get('consent') === 'ask';
  const off: AnalyticsChoice = { provider: 'noop', askConsent: false, sandbox };
  if (want === '0' || want === 'off') return off;
  if (debug && (want === 'dev' || env.DEV)) return { provider: 'dev', askConsent: ask, sandbox };
  // A sandbox (scenario) page never reports to a real backend.
  if (env.VITE_ANALYTICS === 'firebase' && firebaseOk && !sandbox)
    return { provider: 'firebase', askConsent: true, sandbox };
  return off;
}

/** How each milestone is read from the save (stats only: no save change). */
export const MILESTONE_TEST: Record<Milestone, (s: GameState) => boolean> = {
  first_harvest: (s) => stat(s, 'harvested') > 0,
  first_sale: (s) => stat(s, 'earned') > 0,
  first_green: (s) => stat(s, FARM_GREEN) > 0,
  spring_opened: (s) => stat(s, placeStat('spring')) >= 3,
  weir_opened: (s) => stat(s, placeStat('weir')) >= 3,
  senna_home: (s) => villagerHome(s, 'senna'),
  first_fish: (s) => stat(s, 'caught') > 0,
  first_board_quest: (s) => stat(s, 'ordersDone') > 0,
};

const TUT_COMPLETE = 'tut.complete';
const TUT_SKIP = 'tut.skip';
const tutKey = (id: string): string => `tut.${id}`;

/**
 * Report milestones reached since the last look. `baseline`: an old save just loaded, so the ones it already has
 * are used up without being sent (they happened before analytics, or while it was off).
 */
export function checkMilestones(s: GameState, baseline = false): void {
  for (const m of MILESTONES) {
    if (analytics.hasSent(m) || !MILESTONE_TEST[m](s)) continue;
    if (baseline) analytics.markSent(m);
    else analytics.trackOnce(m, m, { game_day: absoluteDay(s) });
  }
}

/** A guided step finished: its funnel event, and the completion once every guided step is done. */
export function onTutorialStep(s: GameState, id: string): void {
  const ids = guidedStepIds();
  const index = ids.indexOf(id);
  if (index < 0) return; // a one-off intro, not part of the funnel
  analytics.trackOnce(tutKey(id), 'tutorial_step', { id, index });
  if (guidedTracksDone(s))
    analytics.trackOnce(TUT_COMPLETE, 'tutorial_complete', {
      steps: ids.length,
      game_day: absoluteDay(s),
    });
}

/** The player skipped the guide: where (the first guided step not done). */
export function onTutorialSkipped(s: GameState): void {
  const ids = guidedStepIds();
  const index = ids.findIndex((id) => !stepDone(s, id));
  if (index < 0) return;
  analytics.trackOnce(TUT_SKIP, 'tutorial_skip', { id: ids[index]!, index });
}

/** A game was entered (New Game, Continue, a scenario). */
export function onGameEntered(s: GameState): void {
  const fresh = isFreshGame(s);
  if (!fresh) {
    // An old save: what it had already done before analytics ran is not news.
    checkMilestones(s, true);
    for (const id of guidedStepIds()) if (stepDone(s, id)) analytics.markSent(tutKey(id));
    if (guidedTracksDone(s)) analytics.markSent(TUT_COMPLETE);
  }
  const day = absoluteDay(s);
  if (fresh || analytics.record()?.last.gameDay !== day)
    analytics.track('day_start', { game_day: day });
  analytics.noteGameDay(day);
}

let devProvider: DevProvider | null = null;
let wired = false;

/** Start analytics if this build and page have a provider. Call once at startup (main.ts). */
export function wireAnalytics(): void {
  if (wired) return;
  wired = true;
  const choice = chooseAnalytics(
    {
      DEV: import.meta.env.DEV,
      VITE_ANALYTICS: import.meta.env.VITE_ANALYTICS as string | undefined,
    },
    globalThis.location?.search ?? '',
    firebaseAvailable(),
  );
  if (choice.provider === 'noop') return;
  if (choice.provider === 'dev') devProvider = createDevProvider();
  const provider = devProvider ?? createFirebaseProvider();
  void analytics.start({
    provider,
    store: choice.sandbox ? new MemoryStore() : saveStore,
    askConsent: choice.askConsent,
  });

  lifecycle.on('pause', () => analytics.pause());
  lifecycle.on('resume', () => analytics.resume());
  gameEvents.on('gameEntered', () => onGameEntered(getState()));
  gameEvents.on('daySummary', () => {
    const s = getState();
    const day = absoluteDay(s);
    analytics.track('day_start', { game_day: day });
    analytics.noteGameDay(day);
    checkMilestones(s);
  });
  gameEvents.on('tutorialStep', ({ id }) => onTutorialStep(getState(), id));
  gameEvents.on('tutorialSkipped', () => onTutorialSkipped(getState()));
  gameEvents.on('languageChosen', ({ lang }) => {
    if ((LANGS as readonly string[]).includes(lang))
      analytics.track('settings_language', { lang: lang as (typeof LANGS)[number] });
  });
  // Stats move on harvests, sales, catches and orders: a handful of lookups, and none once all are sent.
  registerStatWatcher('analytics', (s) => {
    if (runtime.inGame) checkMilestones(s);
  });
}

/** `window.__farm.analytics` on debug pages: read the layer and the dev provider's log. */
export const analyticsDebug = {
  get provider(): string {
    return analytics.providerId;
  },
  get consent(): string {
    return analytics.consent;
  },
  summary: () => analytics.summary(),
  /** Events the dev provider received (delivered), oldest first. */
  log: () =>
    devProvider?.log.map((e) => ({ name: e.name, params: { ...e.params }, seq: e.seq })) ?? [],
  /** Events waiting in the queue. */
  queue: () =>
    analytics.record()?.queue.map((e) => ({ name: e.name, params: { ...e.params } })) ?? [],
  flush: () => analytics.flush(),
  setConsent: (granted: boolean) => analytics.setConsent(granted),
  /** The dev provider (offline switch, clear), or null. */
  dev: () => devProvider,
};
