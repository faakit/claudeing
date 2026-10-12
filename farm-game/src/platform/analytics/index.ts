/**
 * The analytics layer, provider-agnostic: typed events (`schema.ts`), a random install id and session id, consent,
 * batching and an offline queue. Providers (`providers.ts`) only deliver batches.
 *
 * It never blocks or slows the game. `track` validates and pushes onto an array (microseconds); delivery runs on a
 * timer (every `batchMs`, or at once for a full batch), and when the app goes to the background. Nothing runs per
 * frame. The record (ids, consent, the queue) is one JSON value under its own key in the save store, written after
 * a delivery, on pause and on a consent change, never in the save itself.
 *
 * Until `start` is called (game/analyticsWiring.ts calls it only when a provider is configured), every call is a
 * no-op: no record, no storage, no timers.
 *
 * Consent: `unknown` (asked on the title: nothing is sent meanwhile, events wait in the local queue), `granted`, or
 * `denied` (nothing is recorded or sent; the queue is emptied and the provider told to forget). The dev provider
 * starts `granted` unless the page asks (`?consent=ask`).
 */
import { noopProvider, type AnalyticsProvider } from './providers';
import {
  addActiveDay,
  churn,
  installDay,
  localDay,
  retention,
  type Churn,
  type RetentionFlags,
} from './retention';
import { validateEvent, type Envelope, type EventName, type EventParams } from './schema';

export type Consent = 'unknown' | 'granted' | 'denied';

/** What the layer keeps on the device (`analytics` key in the save store). */
export interface AnalyticsRecord {
  v: 1;
  /** Random install id (128 bits, hex). */
  id: string;
  /** Epoch ms of the first launch. */
  installedAt: number;
  /** The local day of the first launch (retention.ts). */
  installedOn: number;
  consent: Consent;
  /** Sessions started on this install. */
  sessions: number;
  /** Install days with a session (ascending). */
  active: number[];
  /** The last local day and game day seen (for churn). */
  last: { day: number; gameDay: number };
  /** Once-per-install keys already used (first_open, each tutorial step, each milestone). */
  sent: string[];
  /** Events not delivered yet (waiting for consent, a batch, or the network). */
  queue: Envelope[];
  /** The last event sequence number. */
  seq: number;
}

/** The storage the record lives in (the save store; a MemoryStore in tests and scenario sandboxes). */
export interface KeyStore {
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

export interface AnalyticsOptions {
  provider: AnalyticsProvider;
  store: KeyStore;
  /** Must the player answer before anything is sent? Production providers: yes. */
  askConsent: boolean;
  now?: () => number;
  /** The local day of an instant (retention.ts `localDay`). */
  dayOf?: (ms: number) => number;
  /** Delivery runs this long after the first queued event (default 10 s). */
  batchMs?: number;
  /** Events per delivery; a full batch is delivered at once (default 20). */
  maxBatch?: number;
  /** Queue cap: the oldest are dropped past it (default 500). */
  maxQueue?: number;
  /** Back from the background after this long starts a new session (default 30 min, as Firebase). */
  sessionGapMs?: number;
}

export const STORE_KEY = 'analytics';
const MAX_BACKOFF_MS = 5 * 60_000;

/** `bytes` random bytes as hex (Web Crypto; Math.random only where it is missing). */
export function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  const c = globalThis.crypto as Crypto | undefined;
  if (c?.getRandomValues) c.getRandomValues(a);
  else for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** A stored record, or null if it is missing or damaged (then a new install record is made). */
export function sanitizeRecord(raw: unknown): AnalyticsRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r['v'] !== 1 || typeof r['id'] !== 'string' || !/^[0-9a-f]{32}$/.test(r['id'])) return null;
  if (!isInt(r['installedAt']) || !isInt(r['installedOn'])) return null;
  const consent: Consent = ['unknown', 'granted', 'denied'].includes(r['consent'] as string)
    ? (r['consent'] as Consent)
    : 'unknown';
  const last = (r['last'] ?? {}) as Record<string, unknown>;
  const queue = Array.isArray(r['queue'])
    ? (r['queue'] as Envelope[]).filter(
        (e) =>
          e &&
          typeof e === 'object' &&
          isInt(e.seq) &&
          isInt(e.t) &&
          typeof e.sid === 'string' &&
          typeof e.iid === 'string' &&
          !!e.params &&
          validateEvent(e.name, e.params) === null,
      )
    : [];
  return {
    v: 1,
    id: r['id'],
    installedAt: r['installedAt'],
    installedOn: r['installedOn'],
    consent,
    sessions: isInt(r['sessions']) ? r['sessions'] : 0,
    active: Array.isArray(r['active'])
      ? (r['active'] as unknown[]).filter(isInt).sort((a, b) => a - b)
      : [],
    last: {
      day: isInt(last['day']) ? last['day'] : r['installedOn'],
      gameDay: isInt(last['gameDay']) ? last['gameDay'] : 0,
    },
    sent: Array.isArray(r['sent'])
      ? ((r['sent'] as unknown[]).filter((k) => typeof k === 'string') as string[])
      : [],
    queue: consent === 'denied' ? [] : queue,
    seq: isInt(r['seq']) ? r['seq'] : 0,
  };
}

export interface AnalyticsSummary {
  provider: string;
  consent: Consent;
  installId: string;
  installDay: number;
  sessions: number;
  active: number[];
  retention: RetentionFlags;
  churn: Churn;
  queued: number;
  dropped: number;
  rejected: number;
  lastError: string | null;
}

export class Analytics {
  private opts: Required<AnalyticsOptions> | null = null;
  private rec: AnalyticsRecord | null = null;
  private early: (() => void)[] = [];
  private sentSet = new Set<string>();
  private readyPromise: Promise<void> = Promise.resolve();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing: Promise<void> | null = null;
  private fails = 0;
  private writing: Promise<unknown> = Promise.resolve();
  private sid = '';
  private fgStart = 0;
  private pausedAt: number | null = null;
  /** Events that failed the schema (a bug: they are dropped, never sent). */
  rejected = 0;
  /** Events dropped from a full queue. */
  dropped = 0;
  lastError: string | null = null;

  /** Started with a provider (false: every call is a no-op). */
  get enabled(): boolean {
    return this.opts !== null;
  }

  get providerId(): string {
    return this.opts?.provider.id ?? 'noop';
  }

  get provider(): AnalyticsProvider {
    return this.opts?.provider ?? noopProvider;
  }

  /** Resolves once the record is loaded (at once when never started). */
  ready(): Promise<void> {
    return this.readyPromise;
  }

  get consent(): Consent {
    return this.rec?.consent ?? 'unknown';
  }

  /** The title must ask before the game starts: a provider that needs consent, and no answer yet. */
  get needsConsent(): boolean {
    return !!this.opts?.askConsent && !!this.rec && this.rec.consent === 'unknown';
  }

  /** Load (or create) the install record and start the session. Call once. */
  start(options: AnalyticsOptions): Promise<void> {
    if (this.opts) return this.readyPromise;
    this.opts = {
      now: () => Date.now(),
      dayOf: (ms) => localDay(ms),
      batchMs: 10_000,
      maxBatch: 20,
      maxQueue: 500,
      sessionGapMs: 30 * 60_000,
      ...options,
    };
    const o = this.opts;
    this.readyPromise = o.store
      .read(STORE_KEY)
      .catch(() => null)
      .then((raw) => {
        let rec: AnalyticsRecord | null;
        try {
          rec = raw ? sanitizeRecord(JSON.parse(raw)) : null;
        } catch {
          rec = null;
        }
        const now = o.now();
        const fresh = !rec;
        this.rec = rec ?? {
          v: 1,
          id: randomHex(16),
          installedAt: now,
          installedOn: o.dayOf(now),
          consent: o.askConsent ? 'unknown' : 'granted',
          sessions: 0,
          active: [],
          last: { day: o.dayOf(now), gameDay: 0 },
          sent: [],
          queue: [],
          seq: 0,
        };
        this.sentSet = new Set(this.rec.sent);
        // The first launch's first_open belongs to the session it opens.
        this.sid = randomHex(8);
        if (fresh) this.trackOnce('first_open', 'first_open', {});
        this.startSession(now, false);
        for (const fn of this.early.splice(0)) fn();
        if (this.rec.consent === 'granted') void o.provider.setEnabled(true).catch(() => undefined);
        this.schedule();
        this.persist();
      });
    return this.readyPromise;
  }

  /** Queue one event (validated against the schema). Cheap: no I/O here. */
  track<N extends EventName>(name: N, params: EventParams<N>): void {
    const o = this.opts;
    if (!o) return;
    const rec = this.rec;
    if (!rec) {
      this.early.push(() => this.track(name, params));
      return;
    }
    if (rec.consent === 'denied') return;
    const full: Record<string, string | number> = {
      ...(params as Record<string, string | number>),
      install_day: installDay(o.dayOf(o.now()), rec.installedOn),
    };
    const why = validateEvent(name, full);
    if (why) {
      this.rejected++;
      this.lastError = why;
      if (import.meta.env?.DEV) console.warn(`[analytics] dropped: ${why}`);
      return;
    }
    rec.queue.push({ name, params: full, t: o.now(), sid: this.sid, iid: rec.id, seq: ++rec.seq });
    if (rec.queue.length > o.maxQueue) {
      this.dropped += rec.queue.length - o.maxQueue;
      rec.queue.splice(0, rec.queue.length - o.maxQueue);
    }
    this.schedule(rec.queue.length >= o.maxBatch ? 0 : o.batchMs);
  }

  /** Track an event the first time `key` is used on this install; false (and nothing queued) after that. */
  trackOnce<N extends EventName>(key: string, name: N, params: EventParams<N>): boolean {
    if (!this.opts) return false;
    if (!this.rec) {
      this.early.push(() => this.trackOnce(key, name, params));
      return true;
    }
    if (!this.markSent(key)) return false;
    this.track(name, params);
    return true;
  }

  /** Use up a once key without sending (a milestone an old save had already passed). False if already used. */
  markSent(key: string): boolean {
    if (!this.rec) {
      if (this.opts) this.early.push(() => this.markSent(key));
      return false;
    }
    if (this.sentSet.has(key)) return false;
    this.sentSet.add(key);
    this.rec.sent.push(key);
    return true;
  }

  hasSent(key: string): boolean {
    return this.sentSet.has(key);
  }

  /** The game day being played now (for churn: the last game day seen). */
  noteGameDay(gameDay: number): void {
    if (!this.opts) return;
    if (!this.rec) {
      this.early.push(() => this.noteGameDay(gameDay));
      return;
    }
    if (this.rec.consent === 'denied') return;
    this.rec.last.gameDay = gameDay;
    this.seen(this.opts.now());
  }

  /** The player answered the consent question, or flipped the switch in Options. */
  setConsent(granted: boolean): void {
    const o = this.opts;
    const rec = this.rec;
    if (!o || !rec) return;
    const was = rec.consent;
    rec.consent = granted ? 'granted' : 'denied';
    if (!granted) {
      rec.queue = [];
      this.clearTimer();
      if (was !== 'denied') void o.provider.setEnabled(false).catch(() => undefined);
    } else if (was !== 'granted') {
      void o.provider.setEnabled(true).catch(() => undefined);
      // Back from an opt-out: this session was never recorded, so it starts now.
      if (was === 'denied') this.startSession(o.now());
      this.schedule(0);
    }
    this.persist();
  }

  /** The app went to the background: end the foreground stretch, deliver what is queued and store the record. */
  pause(): void {
    const o = this.opts;
    if (!o || !this.rec || this.pausedAt !== null) return;
    const now = o.now();
    const length = Math.round((now - this.fgStart) / 1000);
    // A blink of foreground (a notification shade, a flapping visibility event) is not a stretch of play.
    if (length >= 1) this.track('session_end', { length_s: length });
    this.pausedAt = now;
    void this.flush();
    this.persist();
  }

  /** Back in the foreground: a new session after `sessionGapMs` away, else the same one carries on. */
  resume(): void {
    const o = this.opts;
    if (!o || !this.rec || this.pausedAt === null) return;
    const now = o.now();
    const away = now - this.pausedAt;
    this.pausedAt = null;
    if (away >= o.sessionGapMs) this.startSession(now);
    else {
      this.fgStart = now;
      this.seen(now);
    }
  }

  /** Deliver the queue now (when consent allows), in batches, oldest first. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    const o = this.opts;
    const rec = this.rec;
    if (!o || !rec || rec.consent !== 'granted' || !rec.queue.length) return Promise.resolve();
    this.clearTimer();
    const run = async (): Promise<void> => {
      let retry = false;
      try {
        while (rec.consent === 'granted' && rec.queue.length) {
          const batch = rec.queue.slice(0, o.maxBatch);
          await o.provider.send(batch);
          const last = batch[batch.length - 1]!.seq;
          rec.queue = rec.queue.filter((e) => e.seq > last);
          this.fails = 0;
        }
      } catch (err) {
        this.fails++;
        this.lastError = String(err);
        retry = true;
      }
      this.flushing = null;
      this.persist();
      // Offline or refused: the batch stays queued and is tried again later, backing off up to 5 minutes.
      if (retry) this.schedule(Math.min(MAX_BACKOFF_MS, o.batchMs * 2 ** this.fails));
    };
    this.flushing = run();
    return this.flushing;
  }

  /** What the DEV tab shows. */
  summary(): AnalyticsSummary | null {
    const o = this.opts;
    const rec = this.rec;
    if (!o || !rec) return null;
    const today = o.dayOf(o.now());
    return {
      provider: o.provider.id,
      consent: rec.consent,
      installId: rec.id,
      installDay: installDay(today, rec.installedOn),
      sessions: rec.sessions,
      active: [...rec.active],
      retention: retention(rec.active),
      churn: churn(rec.last, rec.installedOn, today),
      queued: rec.queue.length,
      dropped: this.dropped,
      rejected: this.rejected,
      lastError: this.lastError,
    };
  }

  /** The record as stored (tests and the DEV tab). */
  record(): Readonly<AnalyticsRecord> | null {
    return this.rec;
  }

  /** Stop and forget everything in memory (tests). */
  reset(): void {
    this.clearTimer();
    this.opts = null;
    this.rec = null;
    this.early = [];
    this.sentSet = new Set();
    this.readyPromise = Promise.resolve();
    this.flushing = null;
    this.fails = 0;
    this.pausedAt = null;
    this.rejected = 0;
    this.dropped = 0;
    this.lastError = null;
  }

  /** Resolves once every queued write has reached the store (tests). */
  settled(): Promise<void> {
    return Promise.all([this.flushing, this.writing]).then(() => undefined);
  }

  // ---------------------------------------------------------------- internals

  private startSession(now: number, newId = true): void {
    const rec = this.rec!;
    if (newId) this.sid = randomHex(8);
    this.fgStart = now;
    if (rec.consent === 'denied') return;
    const today = this.opts!.dayOf(now);
    rec.sessions++;
    const daysAway = rec.sessions > 1 ? Math.max(0, today - rec.last.day) : 0;
    this.seen(now);
    this.track('session_start', {
      n: rec.sessions,
      days_away: daysAway,
      last_game_day: rec.last.gameDay,
    });
  }

  /** The install was seen now: today is an active day and the last day seen. */
  private seen(now: number): void {
    const rec = this.rec!;
    const today = this.opts!.dayOf(now);
    rec.active = addActiveDay(rec.active, installDay(today, rec.installedOn));
    rec.last.day = Math.max(rec.last.day, today);
  }

  private schedule(ms = this.opts?.batchMs ?? 10_000): void {
    const rec = this.rec;
    if (!rec || rec.consent !== 'granted' || !rec.queue.length || this.flushing) return;
    if (this.timer !== null) {
      if (ms > 0 || this.fails > 0) return; // a delivery (or an offline retry) is already due
      this.clearTimer();
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private persist(): void {
    const o = this.opts;
    const rec = this.rec;
    if (!o || !rec) return;
    const json = JSON.stringify(rec);
    this.writing = this.writing.then(() => o.store.write(STORE_KEY, json)).catch(() => undefined);
  }
}

/** The one analytics layer the game uses. */
export const analytics = new Analytics();

export { MILESTONES, SCHEMA, validateEvent } from './schema';
export type { Envelope, EventName, EventParams, Milestone } from './schema';
export type { AnalyticsProvider, DevProvider, ProviderId } from './providers';
