import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceWorkerSource } from '../scripts/sw-plugin.mjs';
import { Analytics, analytics, sanitizeRecord, STORE_KEY } from '../src/platform/analytics';
import {
  createDevProvider,
  createFirebaseProvider,
  firebaseName,
  type DevProvider,
} from '../src/platform/analytics/providers';
import {
  addActiveDay,
  churn,
  cohortRetention,
  DAY_MS,
  installDay,
  localDay,
  retainedBy,
  retention,
} from '../src/platform/analytics/retention';
import { MILESTONES, SCHEMA, validateEvent } from '../src/platform/analytics/schema';
import { MemoryStore } from '../src/platform/SaveStore';
import {
  checkMilestones,
  chooseAnalytics,
  onGameEntered,
  onTutorialSkipped,
  onTutorialStep,
} from '../src/game/analyticsWiring';
import { guidedStepIds } from '../src/systems/tutorial';
import { tutorial } from '../src/data';
import { newState } from './helpers';
import { LOCALES, setLocale, t } from '../src/i18n';
import { measureText, wrapText } from '../src/ui/fontMetrics';
import { CONSENT_TEXT_W, letterLayout } from '../src/ui/titleLetter';

// ---------------------------------------------------------------- schema

describe('analytics schema', () => {
  const sample: Record<string, Record<string, string | number>> = {
    first_open: {},
    session_start: { n: 1, days_away: 0, last_game_day: 0 },
    session_end: { length_s: 42 },
    tutorial_step: { id: 'harvest', index: 0, skipped: 0 },
    tutorial_complete: { steps: 16, game_day: 2, skipped: 0 },
    tutorial_skip: { id: 'water', index: 3 },
    day_start: { game_day: 1 },
    settings_language: { lang: 'pt-BR' },
    ...Object.fromEntries(MILESTONES.map((m) => [m, { game_day: 5 }])),
  };

  it('every event in the schema has a valid sample, and the samples cover the schema exactly', () => {
    expect(Object.keys(sample).sort()).toEqual(Object.keys(SCHEMA).sort());
    for (const [name, params] of Object.entries(sample))
      expect(validateEvent(name, { ...params, install_day: 0 }), name).toBeNull();
  });

  it('the minimal set: the brief names every one of these', () => {
    expect(Object.keys(SCHEMA)).toEqual(
      expect.arrayContaining([
        'first_open',
        'tutorial_step',
        'tutorial_complete',
        'day_start',
        'session_start',
        'session_end',
        'settings_language',
        'first_harvest',
        'first_sale',
        'first_green',
        'spring_opened',
        'weir_opened',
        'senna_home',
        'first_fish',
        'first_board_quest',
      ]),
    );
  });

  it('refuses unknown events, missing, extra or mistyped params, and any free text', () => {
    const ok = { id: 'harvest', index: 0, skipped: 0, install_day: 0 };
    expect(validateEvent('tutorial_step', ok)).toBeNull();
    expect(validateEvent('purchase', { install_day: 0 })).toMatch(/unknown event/);
    expect(validateEvent('tutorial_step', { id: 'harvest', skipped: 0, install_day: 0 })).toMatch(
      /missing/,
    );
    expect(validateEvent('tutorial_step', { ...ok })).toBeNull();
    expect(validateEvent('tutorial_step', { ...ok, name: 'Andre' })).toMatch(/unexpected/);
    expect(validateEvent('tutorial_step', { id: 'harvest', index: 0, skipped: 0 })).toMatch(
      /install_day/,
    );
    for (const bad of [-1, 1.5, Number.NaN, 1e9, '3'])
      expect(validateEvent('tutorial_step', { ...ok, index: bad }), String(bad)).toMatch(
        /bad value/,
      );
    for (const text of [
      'hello world',
      'me@example.com',
      '192.168.0.1',
      'a'.repeat(25),
      '',
      '3abc',
      'Ação',
    ])
      expect(validateEvent('tutorial_step', { ...ok, id: text }), text).toMatch(/bad value/);
    expect(validateEvent('settings_language', { lang: 'fr', install_day: 0 })).toMatch(/bad value/);
  });

  it('every guided step id is a valid id parameter', () => {
    for (const id of guidedStepIds())
      expect(
        validateEvent('tutorial_step', { id, index: 0, skipped: 0, install_day: 0 }),
        id,
      ).toBeNull();
  });
});

// ---------------------------------------------------------------- retention maths

describe('retention and churn maths', () => {
  // 2026-10-12 00:00 UTC
  const T = Date.UTC(2026, 9, 12);
  const H = 3_600_000;

  it('days are local calendar days: the same instant is a different day east and west of UTC', () => {
    const utc = localDay(T + 2 * H, 0);
    // Brazil (UTC-3, offset +180): 02:00 UTC is 23:00 the evening before
    expect(localDay(T + 2 * H, 180)).toBe(utc - 1);
    // Tokyo (UTC+9, offset -540): 16:00 UTC is 01:00 the next day
    expect(localDay(T + 16 * H, -540)).toBe(utc + 1);
  });

  it('23:59 and 00:01 local are different days; 00:01 and 23:59 the same day are one', () => {
    const off = 180; // UTC-3
    const midnight = T + 3 * H; // 00:00 local on Oct 12
    expect(localDay(midnight - 60_000, off)).toBe(localDay(midnight, off) - 1);
    expect(localDay(midnight + 60_000, off)).toBe(localDay(midnight + DAY_MS - 60_000, off));
  });

  it('a DST change neither skips nor repeats a day', () => {
    // Europe/London, spring forward: offset 0 before, -60 after. Each local midnight starts the next day.
    const before = Date.UTC(2026, 2, 28, 12); // Sat 28 Mar noon, GMT
    const after = Date.UTC(2026, 2, 29, 12); // Sun 29 Mar noon, BST
    const afterNext = Date.UTC(2026, 2, 30, 12);
    const d0 = localDay(before, 0);
    expect(localDay(after, -60)).toBe(d0 + 1);
    expect(localDay(afterNext, -60)).toBe(d0 + 2);
    // 00:30 BST on the 30th is 23:30 UTC on the 29th: still the 30th locally
    expect(localDay(Date.UTC(2026, 2, 29, 23, 30), -60)).toBe(d0 + 2);
    // with the default (the machine's own zone) it is a whole number
    expect(Number.isInteger(localDay(before))).toBe(true);
  });

  it('install day counts whole local days and never goes negative', () => {
    expect(installDay(100, 100)).toBe(0);
    expect(installDay(107, 100)).toBe(7);
    expect(installDay(99, 100)).toBe(0); // a clock set back
  });

  it('D1/D7/D30 are exact-day retention; retainedBy is the looser "that day or later"', () => {
    expect(retention([0])).toEqual({ d1: false, d7: false, d30: false });
    expect(retention([0, 1, 7])).toEqual({ d1: true, d7: true, d30: false });
    expect(retention([0, 2, 8, 30])).toEqual({ d1: false, d7: false, d30: true });
    expect(retainedBy([0, 8], 7)).toBe(true);
    expect(retainedBy([0, 6], 7)).toBe(false);
  });

  it('active days stay unique and sorted, and the earliest are kept at the cap', () => {
    let a: number[] = [];
    for (const d of [3, 0, 3, 1, 2]) a = addActiveDay(a, d);
    expect(a).toEqual([0, 1, 2, 3]);
    expect(addActiveDay([0, 1, 2], 9, 3)).toEqual([0, 1, 2]);
  });

  it('cohort retention only counts installs old enough', () => {
    const installs = [
      { active: [0, 1], age: 10 },
      { active: [0], age: 10 },
      { active: [0, 1, 7], age: 8 },
      { active: [0], age: 0 }, // installed today: not in D1 yet
    ];
    expect(cohortRetention(installs, 1)).toBeCloseTo(2 / 3);
    expect(cohortRetention(installs, 7)).toBeCloseTo(1 / 3);
    expect(cohortRetention(installs, 30)).toBeNull();
  });

  it('churn: away 7 local days or more, with the last game day and install day seen as its day', () => {
    const installedOn = 1000;
    const last = { day: 1004, gameDay: 9 };
    expect(churn(last, installedOn, 1010)).toEqual({
      churned: false,
      daysAway: 6,
      lastInstallDay: 4,
      lastGameDay: 9,
    });
    expect(churn(last, installedOn, 1011).churned).toBe(true);
    expect(churn(last, installedOn, 1003).daysAway).toBe(0); // clock set back
  });
});

// ---------------------------------------------------------------- the layer

interface Harness {
  a: Analytics;
  dev: DevProvider;
  store: MemoryStore;
  clock: { t: number };
}

const DAY0 = Date.UTC(2026, 9, 12, 12);
const MIN = 60_000;

function harness(opts: { ask?: boolean; store?: MemoryStore; t?: number } = {}): Harness {
  const clock = { t: opts.t ?? DAY0 };
  const dev = createDevProvider({ quiet: true });
  const store = opts.store ?? new MemoryStore();
  const a = new Analytics();
  void a.start({
    provider: dev,
    store,
    askConsent: opts.ask ?? false,
    now: () => clock.t,
    dayOf: (ms) => localDay(ms, 0),
  });
  return { a, dev, store, clock };
}

const names = (dev: DevProvider) => dev.log.map((e) => e.name);

describe('the analytics layer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does nothing at all until started: no record, no queue, no storage', async () => {
    const a = new Analytics();
    a.track('day_start', { game_day: 1 });
    expect(a.trackOnce('k', 'first_open', {})).toBe(false);
    a.pause();
    a.resume();
    a.setConsent(true);
    await a.flush();
    expect(a.enabled).toBe(false);
    expect(a.summary()).toBeNull();
    expect(a.record()).toBeNull();
    expect(analytics.enabled).toBe(false); // the game's own layer is off in tests (no config)
  });

  it('a first launch queues first_open then session_start, and delivers them in one batch later', async () => {
    const { a, dev } = harness();
    await a.ready();
    expect(names(dev)).toEqual([]); // batched, not sent at once
    await vi.advanceTimersByTimeAsync(10_000);
    expect(names(dev)).toEqual(['first_open', 'session_start']);
    expect(dev.log[1]!.params).toEqual({ n: 1, days_away: 0, last_game_day: 0, install_day: 0 });
    expect(dev.log[0]!.iid).toMatch(/^[0-9a-f]{32}$/);
    expect(dev.log[0]!.sid).toMatch(/^[0-9a-f]{16}$/);
    expect(dev.log.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('events tracked before the record loads keep their order', async () => {
    const { a, dev } = harness();
    a.track('day_start', { game_day: 1 });
    await a.ready();
    await a.flush();
    expect(names(dev)).toEqual(['first_open', 'session_start', 'day_start']);
  });

  it('a full batch is delivered at once, without waiting for the timer', async () => {
    const { a, dev } = harness();
    await a.ready();
    for (let i = 0; i < 18; i++) a.track('day_start', { game_day: i + 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(dev.log.length).toBe(20);
  });

  it('with consent to ask: nothing leaves until a yes, then everything queued goes, in order', async () => {
    const { a, dev, clock } = harness({ ask: true });
    await a.ready();
    expect(a.needsConsent).toBe(true);
    clock.t += 60_000;
    a.track('day_start', { game_day: 1 });
    await vi.advanceTimersByTimeAsync(60_000);
    await a.flush();
    a.pause();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(dev.log).toEqual([]);
    expect(dev.enabled).toBe(false);
    a.resume();
    a.setConsent(true);
    expect(a.needsConsent).toBe(false);
    expect(dev.enabled).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(names(dev)).toEqual(['first_open', 'session_start', 'day_start', 'session_end']);
  });

  it('a no empties the queue, tells the provider, and records nothing more', async () => {
    const { a, dev, store } = harness({ ask: true });
    await a.ready();
    a.track('day_start', { game_day: 1 });
    a.setConsent(false);
    expect(a.record()!.queue).toEqual([]);
    a.track('day_start', { game_day: 2 });
    a.trackOnce('first_harvest', 'first_harvest', { game_day: 2 });
    a.pause();
    a.resume();
    await vi.advanceTimersByTimeAsync(60 * MIN);
    await a.settled();
    expect(dev.log).toEqual([]);
    expect(a.record()!.queue).toEqual([]);
    const stored = JSON.parse((await store.read(STORE_KEY))!);
    expect(stored.consent).toBe('denied');
    expect(stored.queue).toEqual([]);
  });

  it('opting out mid-session drops what was queued; opting back in starts a session again', async () => {
    const { a, dev } = harness();
    await a.ready();
    await a.flush();
    dev.clear();
    a.track('day_start', { game_day: 3 });
    a.setConsent(false);
    expect(dev.enabled).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(dev.log).toEqual([]);
    a.setConsent(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(names(dev)).toEqual(['session_start']);
    expect(dev.log[0]!.params['n']).toBe(2);
  });

  it('offline: a failed send keeps the batch, and a later retry delivers it once, in order', async () => {
    const { a, dev } = harness();
    await a.ready();
    dev.offline = true;
    a.track('day_start', { game_day: 1 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(a.record()!.queue.length).toBe(3);
    expect(a.summary()!.lastError).toMatch(/offline/);
    a.track('day_start', { game_day: 2 });
    dev.offline = false;
    await vi.advanceTimersByTimeAsync(5 * MIN);
    expect(names(dev)).toEqual(['first_open', 'session_start', 'day_start', 'day_start']);
    expect(a.record()!.queue).toEqual([]);
  });

  it('the queue survives a restart (stored on pause) and the next launch is session 2, not a first open', async () => {
    const store = new MemoryStore();
    const one = harness({ store, ask: true });
    await one.a.ready();
    one.a.track('day_start', { game_day: 4 });
    one.a.noteGameDay(4);
    one.clock.t += 60_000;
    one.a.pause();
    await one.a.settled();
    const two = harness({ store, ask: true, t: DAY0 + 3 * DAY_MS });
    await two.a.ready();
    expect(two.a.needsConsent).toBe(true);
    two.a.setConsent(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(names(two.dev)).toEqual([
      'first_open',
      'session_start',
      'day_start',
      'session_end',
      'session_start',
    ]);
    const s2 = two.dev.log[4]!.params;
    expect(s2).toEqual({ n: 2, days_away: 3, last_game_day: 4, install_day: 3 });
    expect(two.a.summary()!.active).toEqual([0, 3]);
    expect(two.dev.log[0]!.iid).toBe(two.dev.log[4]!.iid);
  });

  it('sessions: back within 30 minutes carries on; after 30 minutes away a new one starts', async () => {
    const { a, dev, clock } = harness();
    await a.ready();
    clock.t += 5 * MIN;
    a.pause();
    clock.t += 29 * MIN;
    a.resume();
    clock.t += 2 * MIN;
    a.pause();
    clock.t += 30 * MIN;
    a.resume();
    await a.flush();
    expect(names(dev)).toEqual([
      'first_open',
      'session_start',
      'session_end',
      'session_end',
      'session_start',
    ]);
    expect(dev.log[2]!.params['length_s']).toBe(300);
    expect(dev.log[3]!.params['length_s']).toBe(120);
    expect(dev.log[4]!.params['n']).toBe(2);
  });

  it('a blink in the foreground (under a second) sends no session_end', async () => {
    const { a, dev, clock } = harness();
    await a.ready();
    clock.t += 400;
    a.pause();
    a.resume();
    clock.t += 1500;
    a.pause();
    await a.flush();
    expect(names(dev)).toEqual(['first_open', 'session_start', 'session_end']);
    expect(dev.log[2]!.params['length_s']).toBe(2);
  });

  it('D1 and churn from real launches: active days follow the local calendar', async () => {
    const store = new MemoryStore();
    const one = harness({ store });
    await one.a.ready();
    one.a.noteGameDay(1);
    one.a.pause();
    await one.a.settled();
    // the next day, a minute after midnight UTC
    const next = Date.UTC(2026, 9, 13, 0, 1);
    const two = harness({ store, t: next });
    await two.a.ready();
    expect(two.a.summary()!.retention).toEqual({ d1: true, d7: false, d30: false });
    two.clock.t = next + 9 * DAY_MS;
    const c = two.a.summary()!.churn;
    expect(c).toEqual({ churned: true, daysAway: 9, lastInstallDay: 1, lastGameDay: 1 });
  });

  it('once keys: an event is sent the first time only, and markSent uses a key silently', async () => {
    const { a, dev } = harness();
    await a.ready();
    expect(a.trackOnce('first_fish', 'first_fish', { game_day: 3 })).toBe(true);
    expect(a.trackOnce('first_fish', 'first_fish', { game_day: 4 })).toBe(false);
    expect(a.markSent('first_green')).toBe(true);
    expect(a.trackOnce('first_green', 'first_green', { game_day: 5 })).toBe(false);
    await a.flush();
    expect(names(dev).filter((n) => n.startsWith('first_'))).toEqual(['first_open', 'first_fish']);
  });

  it('an event off the schema is dropped and counted, never queued', async () => {
    const { a } = harness();
    await a.ready();
    const before = a.record()!.queue.length;
    // @ts-expect-error: not in the schema
    a.track('player_name', { name: 'Andre' });
    a.track('tutorial_step', { id: 'not an id', index: 0, skipped: 0 });
    expect(a.record()!.queue.length).toBe(before);
    expect(a.rejected).toBe(2);
  });

  it('the queue is capped: the oldest go first', async () => {
    const clock = { t: DAY0 };
    const dev = createDevProvider({ quiet: true });
    const a = new Analytics();
    await a.start({
      provider: dev,
      store: new MemoryStore(),
      askConsent: true,
      maxQueue: 5,
      now: () => clock.t,
    });
    for (let i = 0; i < 10; i++) a.track('day_start', { game_day: i + 1 });
    const q = a.record()!.queue;
    expect(q.length).toBe(5);
    expect(q.map((e) => e.params['game_day'])).toEqual([6, 7, 8, 9, 10]);
    expect(a.dropped).toBe(7);
  });

  it('a damaged record is replaced by a new install; a stored queue is re-validated', () => {
    expect(sanitizeRecord(null)).toBeNull();
    expect(sanitizeRecord({ v: 2 })).toBeNull();
    expect(sanitizeRecord({ v: 1, id: 'nope', installedAt: 1, installedOn: 1 })).toBeNull();
    const r = sanitizeRecord({
      v: 1,
      id: 'a'.repeat(32),
      installedAt: 5,
      installedOn: 7,
      consent: 'maybe',
      queue: [
        {
          name: 'day_start',
          params: { game_day: 1, install_day: 0 },
          t: 1,
          sid: 's',
          iid: 'i',
          seq: 1,
        },
        {
          name: 'day_start',
          params: { game_day: 'x', install_day: 0 },
          t: 1,
          sid: 's',
          iid: 'i',
          seq: 2,
        },
        'junk',
      ],
    })!;
    expect(r.consent).toBe('unknown');
    expect(r.queue.map((e) => e.seq)).toEqual([1]);
    expect(r.last).toEqual({ day: 7, gameDay: 0 });
  });

  it('a damaged stored value starts a new install instead of failing', async () => {
    const store = new MemoryStore();
    await store.write(STORE_KEY, '{not json');
    const { a } = harness({ store });
    await a.ready();
    expect(a.summary()!.sessions).toBe(1);
  });

  it('track is cheap: 10,000 events queue in well under 0.1 ms each', async () => {
    const a = new Analytics();
    await a.start({
      provider: createDevProvider({ quiet: true }),
      store: new MemoryStore(),
      askConsent: true,
      maxQueue: 20_000,
    });
    const t0 = performance.now();
    for (let i = 0; i < 10_000; i++) a.track('day_start', { game_day: i });
    const per = (performance.now() - t0) / 10_000;
    expect(per).toBeLessThan(0.1);
  });
});

// ---------------------------------------------------------------- providers

describe('providers', () => {
  it('Firebase: reserved names get the ta_ prefix; our own names pass', () => {
    expect(firebaseName('first_open')).toBe('ta_first_open');
    expect(firebaseName('session_start')).toBe('ta_session_start');
    expect(firebaseName('tutorial_step')).toBe('tutorial_step');
    for (const name of Object.keys(SCHEMA)) {
      const n = firebaseName(name);
      expect(n.length, n).toBeLessThanOrEqual(40);
      expect(n).toMatch(/^[a-zA-Z][a-zA-Z0-9_]*$/);
    }
  });

  it('Firebase: on grants analytics storage only, off resets the SDK data; events go out in order', async () => {
    const calls: string[] = [];
    const plugin = {
      logEvent: async (o: { name: string }) => void calls.push(`log ${o.name}`),
      setEnabled: async (o: { enabled: boolean }) => void calls.push(`enabled ${o.enabled}`),
      setConsent: async (o: { type: string; status: string }) =>
        void calls.push(`${o.type} ${o.status}`),
      resetAnalyticsData: async () => void calls.push('reset'),
    };
    const p = createFirebaseProvider(plugin);
    await p.setEnabled(true);
    expect(calls).toEqual([
      'ANALYTICS_STORAGE GRANTED',
      'AD_STORAGE DENIED',
      'AD_USER_DATA DENIED',
      'AD_PERSONALIZATION DENIED',
      'enabled true',
    ]);
    calls.length = 0;
    const e = (name: 'first_open' | 'day_start', seq: number) => ({
      name,
      params: { install_day: 0 },
      t: 0,
      sid: 's',
      iid: 'i',
      seq,
    });
    await p.send([e('first_open', 1), e('day_start', 2)]);
    expect(calls).toEqual(['log ta_first_open', 'log day_start']);
    calls.length = 0;
    await p.setEnabled(false);
    expect(calls).toEqual(['ANALYTICS_STORAGE DENIED', 'enabled false', 'reset']);
  });
});

// ---------------------------------------------------------------- wiring

describe('analytics wiring', () => {
  it('no config means no provider; dev only on debug pages; Firebase only natively and never in a sandbox', () => {
    const prod = { DEV: false };
    expect(chooseAnalytics(prod, '', false).provider).toBe('noop');
    expect(chooseAnalytics(prod, '?analytics=dev', false).provider).toBe('noop'); // not a debug page
    expect(chooseAnalytics(prod, '?debug&analytics=dev', false)).toEqual({
      provider: 'dev',
      askConsent: false,
      sandbox: false,
    });
    expect(chooseAnalytics(prod, '?debug&analytics=dev&consent=ask', false).askConsent).toBe(true);
    expect(chooseAnalytics(prod, '?debug', false).provider).toBe('noop');
    expect(chooseAnalytics({ DEV: true }, '', false).provider).toBe('dev');
    expect(chooseAnalytics({ DEV: true }, '?analytics=0', false).provider).toBe('noop');
    const fb = { DEV: false, VITE_ANALYTICS: 'firebase' };
    expect(chooseAnalytics(fb, '', false).provider).toBe('noop'); // the web, or no plugin
    expect(chooseAnalytics(fb, '', true)).toEqual({
      provider: 'firebase',
      askConsent: true,
      sandbox: false,
    });
    expect(chooseAnalytics(fb, '?debug&scenario=ripe-plot', true).provider).toBe('noop');
    expect(chooseAnalytics(fb, '?analytics=0', true).provider).toBe('noop');
  });

  describe('with the game layer started (dev provider)', () => {
    let dev: DevProvider;
    beforeEach(async () => {
      analytics.reset();
      dev = createDevProvider({ quiet: true });
      await analytics.start({ provider: dev, store: new MemoryStore(), askConsent: false });
    });
    afterEach(() => analytics.reset());
    const sent = async () => {
      await analytics.flush();
      return dev.log.map((e): { name: string } & Record<string, string | number> => ({
        name: e.name,
        ...e.params,
      }));
    };

    it('the guided steps report once each, in funnel order, then the completion once', async () => {
      const s = newState();
      onGameEntered(s);
      const ids = guidedStepIds();
      expect(ids.length).toBe(tutorial.steps.filter((st) => st.track !== 'intro').length);
      for (const id of ids) {
        s.stats[`tut.${id}`] = 1;
        onTutorialStep(s, id);
        onTutorialStep(s, id); // a second report of the same step (a replay) is not news
      }
      onTutorialStep(s, 'forage'); // an intro: not in the funnel
      const ev = (await sent()).filter((e) => e.name.startsWith('tutorial_'));
      expect(ev.map((e) => e.name)).toEqual([
        ...ids.map(() => 'tutorial_step'),
        'tutorial_complete',
      ]);
      expect(ev.slice(0, -1).map((e) => e['index'])).toEqual(ids.map((_, i) => i));
      expect(ev.slice(0, -1).map((e) => e['id'])).toEqual(ids);
      expect(ev.at(-1)).toMatchObject({ steps: ids.length, game_day: 1, skipped: 0 });
      expect(ev.slice(0, -1).every((e) => e['skipped'] === 0)).toBe(true);
    });

    it('a skip reports where the player was, once', async () => {
      const s = newState();
      s.stats['tut.harvest'] = 1;
      s.stats['tut.seeds'] = 1;
      onTutorialSkipped(s);
      onTutorialSkipped(s);
      const ev = (await sent()).filter((e) => e.name === 'tutorial_skip');
      expect(ev).toEqual([{ name: 'tutorial_skip', id: 'plant', index: 2, install_day: 0 }]);
    });

    it('a step skipped after a stall is flagged, and the completion counts the skips', async () => {
      const s = newState();
      onGameEntered(s);
      const ids = guidedStepIds();
      for (const id of ids) {
        s.stats[`tut.${id}`] = 1;
        onTutorialStep(s, id, id === 'water');
      }
      const ev = (await sent()).filter((e) => e.name.startsWith('tutorial_'));
      expect(
        ev.filter((e) => e.name === 'tutorial_step' && e['skipped'] === 1).map((e) => e['id']),
      ).toEqual(['water']);
      expect(ev.at(-1)).toMatchObject({ name: 'tutorial_complete', skipped: 1 });
    });

    it('milestones fire once each when reached, with the game day', async () => {
      const s = newState();
      onGameEntered(s);
      checkMilestones(s);
      s.stats['harvested'] = 1;
      checkMilestones(s);
      checkMilestones(s);
      s.stats['earned'] = 30;
      s.stats['caught'] = 1;
      s.stats['ordersDone'] = 1;
      s.stats['valley.farmGreen'] = 1;
      s.stats['place.spring'] = 2; // funded, not open yet
      checkMilestones(s);
      s.stats['place.spring'] = 3;
      s.stats['place.weir'] = 3;
      s.stats['arrived.marls'] = 40;
      checkMilestones(s);
      const ev = (await sent())
        .map((e) => e.name)
        .filter((n) => (MILESTONES as readonly string[]).includes(n));
      expect(ev).toEqual([
        'first_harvest',
        'first_sale',
        'first_green',
        'first_fish',
        'first_board_quest',
        'spring_opened',
        'weir_opened',
        'senna_home',
      ]);
    });

    it('an old save loaded for the first time reports none of what it had already done', async () => {
      const s = newState();
      s.time.day = 12;
      s.goalIndex = 6;
      s.stats['harvested'] = 40;
      s.stats['place.weir'] = 3;
      s.stats['tut.on'] = 1;
      for (const id of guidedStepIds()) s.stats[`tut.${id}`] = 1;
      onGameEntered(s);
      checkMilestones(s);
      onTutorialStep(s, 'town');
      s.stats['caught'] = 1;
      checkMilestones(s);
      const ev = (await sent()).map((e) => e.name);
      expect(ev).toEqual(['first_open', 'session_start', 'day_start', 'first_fish']);
    });

    it('day_start: on entering a game, not again for the same day, and on every new morning', async () => {
      const s = newState();
      onGameEntered(s); // a new game: day 1
      onGameEntered({ ...s, goalIndex: 1 }); // Continue on the same day
      const days = (await sent()).filter((e) => e.name === 'day_start').map((e) => e['game_day']);
      expect(days).toEqual([1]);
    });
  });
});

// ---------------------------------------------------------------- text fit (both languages)

describe('analytics text fits', () => {
  afterEach(() => setLocale('en'));
  it("the title question and its two buttons fit under Rosa's letter, and the Options switch fits its button", () => {
    for (const l of LOCALES) {
      setLocale(l);
      const rows = wrapText(t('privacy.ask'), CONSENT_TEXT_W);
      expect(rows.length, l).toBeLessThanOrEqual(4);
      for (const r of rows)
        expect(measureText(r), `${l}: ${r}`).toBeLessThanOrEqual(CONSENT_TEXT_W);
      // the text, a 6 px gap and the 30 px buttons end above the build label (y 390)
      expect(letterLayout().buttonY + rows.length * 11 + 6 + 30, l).toBeLessThanOrEqual(386);
      for (const k of ['privacy.yes', 'privacy.no'] as const)
        expect(measureText(t(k)), `${l}: ${k}`).toBeLessThanOrEqual(80);
      for (const on of ['common.on', 'common.off'] as const)
        expect(measureText(t('privacy.toggle', { state: t(on) })), l).toBeLessThanOrEqual(86);
    }
  });
});

// ---------------------------------------------------------------- the privacy policy page

describe('the privacy policy page (public/privacy.html)', () => {
  const html = readFileSync('public/privacy.html', 'utf8');
  it('has English and Portuguese, the owner placeholders, and each feature scoped to the builds that have it', () => {
    expect(html).toMatch(/<section lang="en">/);
    expect(html).toMatch(/<section lang="pt-BR" id="pt-BR">/);
    expect(html).toContain('CONTACT_EMAIL');
    expect(html).toContain('EFFECTIVE_DATE');
    expect(html).toMatch(
      /Only in Android builds with Google Analytics for Firebase, and only if you agree/,
    );
    expect(html).toMatch(/Only in Android builds with Google Play Games cloud save/);
    expect(html).toMatch(/collect no data at all/);
    expect(html.toLowerCase()).not.toMatch(/anonymous|anônim/);
  });
  it('is precached by the service worker (it is under public/)', () => {
    expect(serviceWorkerSource([], 'public')).toContain('privacy.html');
  });
});
