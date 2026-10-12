/**
 * Cloud save, the game's side (implements `CloudSave`, platform/cloudSave.ts). It keeps the cloud in step with
 * the local save, never the other way round without the player:
 *
 *  - The local save stays the source of truth. A sync uploads exactly the JSON stored under SAVE_KEY.
 *  - A sync first reads the cloud. Behind, empty or unreadable: upload. Further along or diverged: stop and ask
 *    (state `conflict`, a `cloudConflict` event). From a newer game version: never touched (state `newer`).
 *  - Syncs run on sleep (debounced), app pause (at once), resume, coming back online, sign-in and "Sync now".
 *    Offline or failed uploads are queued (`pending`, persisted) and retried with backoff.
 *  - Its own bookkeeping goes through the SaveStore (key `farm.cloud`), like the save itself.
 *
 * With no provider, or a provider that is not configured, every call is a no-op and the status `unavailable`.
 */
import type { SaveStore } from '../platform/SaveStore';
import {
  CloudError,
  type CloudConflict,
  type CloudMeta,
  type CloudProvider,
  type CloudSave,
  type CloudState,
  type CloudStatus,
  type SyncReason,
} from '../platform/cloudSave';
import type { GameState } from '../state/GameState';
import {
  compareSaves,
  decideSync,
  progressValue,
  readBlob,
  summarize,
  type SaveSummary,
} from '../systems/cloudRules';
import { SAVE_KEY, saveGame } from '../systems/save';

export const CLOUD_BOOK_KEY = 'farm.cloud';
/** The cloud save the player chose to replace ("Keep this phone's"), kept on the phone just in case. */
export const CLOUD_PREV_KEY = 'farm.save.cloudPrev';

/** Waits before retrying a queued upload (ms); the last repeats. */
export const RETRY_MS = [15_000, 30_000, 60_000, 120_000, 300_000];
/** Sleep and resume syncs wait this long for the burst of saves around them to settle. */
export const DEBOUNCE_MS = 2_000;
/** The title never waits longer than this for the cloud. */
export const TITLE_TIMEOUT_MS = 6_000;

interface Book {
  lastSync: number | null;
  pending: boolean;
  off: boolean;
  /** The write time of the cloud save the player chose to replace, until the replacement is up. */
  approved: number | null;
}
const freshBook = (): Book => ({ lastSync: null, pending: false, off: false, approved: null });

export interface Timers {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}
const realTimers: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export interface CloudSyncDeps {
  store: SaveStore;
  provider: CloudProvider | null;
  /** Resolves once every local save asked for so far is written (game/persistence.ts). */
  afterSaves?: () => Promise<unknown>;
  now?: () => number;
  timers?: Timers;
  debounceMs?: number;
  /** The line a provider shows next to the save (Play Games' list). */
  describe?: (s: SaveSummary) => string;
  /** Called when a sync finds a conflict the player must settle (the UI opens the dialog). */
  onConflict?: (c: CloudConflict) => void;
}

/** States in which a sync may run. */
const ACTIVE: readonly CloudState[] = ['idle', 'syncing', 'synced', 'pending', 'error'];

const withTimeout = <T>(p: Promise<T>, ms: number, timers: Timers): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const h = timers.set(() => reject(new CloudError('offline', 'timeout')), ms);
    p.then(
      (v) => (timers.clear(h), resolve(v)),
      (e: unknown) => (timers.clear(h), reject(e)),
    );
  });

export class CloudSync implements CloudSave {
  status: CloudStatus = { state: 'unavailable', account: null, lastSync: null };
  conflict: CloudConflict | null = null;
  /** The conflict came from the title's look (`load`), not from a sync of the save being played. */
  private offered = false;
  /** Bumped when a game starts, so a title look still in flight never records its offer afterwards. */
  private offerGen = 0;
  private provider: CloudProvider | null;
  private readonly store: SaveStore;
  private readonly deps: CloudSyncDeps;
  private readonly timers: Timers;
  private readonly now: () => number;
  private book: Book = freshBook();
  private inited: Promise<void> | null = null;
  private readonly listeners = new Set<() => void>();
  private debounce: unknown = null;
  private retry: unknown = null;
  private retryStep = 0;
  private running: Promise<void> | null = null;
  private again = false;
  /** Bumped by `setProvider`, so a call still running for the old provider changes nothing. */
  private gen = 0;

  constructor(deps: CloudSyncDeps) {
    this.deps = deps;
    this.store = deps.store;
    this.provider = deps.provider;
    this.timers = deps.timers ?? realTimers;
    this.now = deps.now ?? Date.now;
  }

  /** Swap the provider (dev scenarios use the fake). Forgets everything about the old one. */
  setProvider(p: CloudProvider | null): Promise<void> {
    this.gen++;
    this.clearTimers();
    this.provider = p;
    this.conflict = null;
    this.book = freshBook();
    this.status = { state: 'unavailable', account: null, lastSync: null };
    this.inited = null;
    this.running = null;
    return this.init();
  }

  get currentProvider(): CloudProvider | null {
    return this.provider;
  }

  /** Is a sync possible now (signed in, not off, nothing blocking)? */
  get active(): boolean {
    return ACTIVE.includes(this.status.state);
  }

  /** Is cloud save something this device can use at all (the UI shows nothing when not)? */
  get usable(): boolean {
    return this.status.state !== 'unavailable';
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private changed(): void {
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch (err) {
        console.error('cloud listener failed', err);
      }
    }
  }

  private set(state: CloudState, account: string | null = this.status.account): void {
    this.status = { state, account, lastSync: this.book.lastSync };
    this.changed();
  }

  private async writeBook(): Promise<void> {
    try {
      await this.store.write(CLOUD_BOOK_KEY, JSON.stringify(this.book));
    } catch {
      /* bookkeeping is best effort: the next sync recomputes everything from the saves */
    }
  }

  private async readBook(): Promise<Book> {
    try {
      const raw = JSON.parse(
        (await this.store.read(CLOUD_BOOK_KEY)) ?? 'null',
      ) as Partial<Book> | null;
      const num = (v: unknown): number | null =>
        typeof v === 'number' && Number.isFinite(v) ? v : null;
      return {
        lastSync: num(raw?.lastSync),
        pending: raw?.pending === true,
        off: raw?.off === true,
        approved: num(raw?.approved),
      };
    } catch {
      return freshBook();
    }
  }

  /** Find out whether the provider is usable and who is signed in. Idempotent; never throws. */
  init(): Promise<void> {
    this.inited ??= (async () => {
      const gen = this.gen;
      const p = this.provider;
      if (!p) return;
      let ok: boolean;
      try {
        ok = await p.available();
      } catch {
        ok = false;
      }
      if (gen !== this.gen || !ok) return;
      this.book = await this.readBook();
      if (gen !== this.gen) return;
      if (this.book.off) return this.set('off', null);
      let account: string | null;
      try {
        account = await p.account();
      } catch {
        account = null;
      }
      if (gen !== this.gen) return;
      if (account === null) return this.set('signedOut', null);
      this.set(this.book.pending ? 'pending' : 'idle', account);
      if (this.book.pending) this.scheduleRetry();
    })();
    return this.inited;
  }

  async signIn(): Promise<boolean> {
    await this.init();
    const p = this.provider;
    if (!p || this.status.state === 'unavailable') return false;
    const gen = this.gen;
    this.book.off = false;
    await this.writeBook();
    this.set('signingIn', null);
    let account: string | null;
    try {
      account = (await p.account()) ?? (await p.signIn());
    } catch (e) {
      if (gen === this.gen)
        this.set(
          e instanceof CloudError && e.kind === 'unavailable' ? 'unavailable' : 'signedOut',
          null,
        );
      return false;
    }
    if (gen !== this.gen) return false;
    if (account === null) {
      this.set('signedOut', null);
      return false;
    }
    this.set('idle', account);
    await this.save('signIn');
    return true;
  }

  /** Stop syncing on this phone (and sign out where the provider can). The local save is untouched. */
  async signOut(): Promise<void> {
    await this.init();
    if (!this.provider || this.status.state === 'unavailable') return;
    this.clearTimers();
    this.book = { ...this.book, off: true, pending: false, approved: null };
    this.conflict = null;
    await this.writeBook();
    try {
      await this.provider.signOut();
    } catch {
      /* the switch is ours: it holds even if the provider could not sign out */
    }
    this.set('off', null);
  }

  /**
   * For the title: the cloud save, when it is one to offer instead of this phone's (further along, diverged, or
   * there is no local save). Also records the conflict, so a sync never overwrites it before the player chose.
   */
  async load(local: GameState | null): Promise<CloudConflict | null> {
    const og = this.offerGen;
    await this.init();
    const p = this.provider;
    if (!p || !this.active) return this.conflict;
    const gen = this.gen;
    let text: string | null;
    try {
      text = (await withTimeout(p.load(), TITLE_TIMEOUT_MS, this.timers))?.data ?? null;
    } catch (e) {
      if (gen === this.gen) await this.failed(e);
      return null;
    }
    if (gen !== this.gen) return null;
    const read = readBlob(text);
    if (read.kind === 'newer') {
      this.set('newer');
      return null;
    }
    if (read.kind !== 'ok') return null;
    const mine = local ? summarize(local) : null;
    const verdict = compareSaves(mine, read.summary);
    if (verdict === 'same') {
      await this.synced();
      return null;
    }
    if (verdict !== 'cloud' && verdict !== 'conflict') return null;
    if (this.book.approved !== null && this.book.approved === read.summary.savedAt) return null;
    if (og !== this.offerGen) return null; // a game started meanwhile
    this.conflict = { verdict, local: mine, cloud: read.summary, cloudState: read.state };
    this.offered = true;
    this.set('conflict');
    return this.conflict;
  }

  /**
   * A game started without taking the title's offer (New Game, or this phone's save after all): the offer was
   * about the title's save, so forget it. The next sync compares the save actually being played and asks again
   * if the cloud is still further along, so nothing is ever overwritten silently.
   */
  forgetOffer(): void {
    this.offerGen++;
    if (!this.conflict || !this.offered) return;
    this.conflict = null;
    this.offered = false;
    this.set('idle');
  }

  /** Ask for a sync. `pause`, `manual` and `signIn` run at once; the rest wait `debounceMs` for things to settle. */
  save(reason: SyncReason): Promise<void> {
    if (this.debounce !== null) {
      this.timers.clear(this.debounce);
      this.debounce = null;
    }
    if (reason === 'pause' || reason === 'manual' || reason === 'signIn' || reason === 'retry')
      return this.run();
    this.debounce = this.timers.set(() => {
      this.debounce = null;
      void this.run();
    }, this.deps.debounceMs ?? DEBOUNCE_MS);
    return Promise.resolve();
  }

  /** Runs syncs one at a time; a request during one runs once more after it. */
  private run(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    const gen = this.gen;
    const job = (async () => {
      do {
        this.again = false;
        await this.syncOnce(gen);
      } while (this.again && gen === this.gen);
    })().finally(() => {
      if (this.running === job) this.running = null;
    });
    this.running = job;
    return job;
  }

  private async syncOnce(gen: number): Promise<void> {
    await this.init();
    const p = this.provider;
    if (!p || gen !== this.gen || !this.active || this.conflict) return;
    await this.deps.afterSaves?.();
    const text = await this.store.read(SAVE_KEY).catch(() => null);
    const local = readBlob(text);
    if (local.kind !== 'ok' || !text || gen !== this.gen) return;
    this.set('syncing');
    try {
      const blob = await p.load();
      if (gen !== this.gen) return;
      const cloud = readBlob(blob?.data);
      const d = decideSync(local.summary, cloud, this.book.approved);
      if (d.action === 'blocked') return this.set('newer');
      if (d.action === 'same') return await this.synced();
      if (d.action === 'ask' && cloud.kind === 'ok') {
        this.offered = false;
        this.conflict = {
          verdict: d.verdict === 'conflict' ? 'conflict' : 'cloud',
          local: local.summary,
          cloud: cloud.summary,
          cloudState: cloud.state,
        };
        this.set('conflict');
        this.deps.onConflict?.(this.conflict);
        return;
      }
      // Replacing a cloud save the player chose to give up: keep it on the phone, just in case.
      if (blob && cloud.kind === 'ok' && d.verdict !== 'local')
        await this.store.write(CLOUD_PREV_KEY, blob.data).catch(() => undefined);
      await p.save(text, this.meta(local.summary));
      if (gen !== this.gen) return;
      this.book.approved = null;
      await this.synced();
    } catch (e) {
      if (gen === this.gen) await this.failed(e);
    }
  }

  private meta(s: SaveSummary): CloudMeta {
    return {
      description: this.deps.describe?.(s) ?? `Day ${s.day}`, // i18n-ok: the fallback (tests); the game passes t()
      playedTimeMs: s.playSec * 1000,
      progress: progressValue(s),
    };
  }

  private async synced(): Promise<void> {
    this.book.pending = false;
    this.book.lastSync = this.now();
    this.retryStep = 0;
    if (this.retry !== null) {
      this.timers.clear(this.retry);
      this.retry = null;
    }
    await this.writeBook();
    this.set('synced');
  }

  private async failed(e: unknown): Promise<void> {
    const kind = e instanceof CloudError ? e.kind : 'failed';
    if (kind === 'signedOut') {
      this.set('signedOut', null);
      return;
    }
    if (kind === 'unavailable') {
      this.set('unavailable', null);
      return;
    }
    this.book.pending = true;
    await this.writeBook();
    this.set(kind === 'offline' ? 'pending' : 'error');
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retry !== null) return;
    const ms = RETRY_MS[Math.min(this.retryStep, RETRY_MS.length - 1)]!;
    this.retryStep++;
    this.retry = this.timers.set(() => {
      this.retry = null;
      void this.save('retry');
    }, ms);
  }

  private clearTimers(): void {
    for (const h of [this.debounce, this.retry]) if (h !== null) this.timers.clear(h);
    this.debounce = null;
    this.retry = null;
    this.retryStep = 0;
  }

  /**
   * The player chose. "local": this phone's save replaces the cloud's (uploaded now, or queued). "cloud": the
   * cloud's save becomes this phone's (written locally, the old one kept as the backup) and is returned to start.
   */
  async resolve(choice: 'local' | 'cloud'): Promise<GameState | null> {
    const c = this.conflict;
    if (!c) return null;
    this.conflict = null;
    this.offered = false;
    if (choice === 'local') {
      this.book.approved = c.cloud.savedAt;
      await this.writeBook();
      this.set('idle');
      await this.save('manual');
      return null;
    }
    this.book.approved = null;
    await saveGame(this.store, c.cloudState);
    await this.synced();
    return c.cloudState;
  }
}
