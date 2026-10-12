/**
 * Cloud save (DECISIONS.md, "Cloud save"): the conflict rules (systems/cloudRules.ts) and the sync
 * (game/cloudSync.ts) against the fake provider: local ahead, cloud ahead, equal, corrupt cloud blob, newer
 * game version, offline queueing, sign-in and out, and no provider at all.
 */
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/platform/SaveStore';
import { FakeCloudProvider } from '../src/platform/cloud/fake';
import type { CloudProvider } from '../src/platform/cloudSave';
import { createInitialState, STATE_VERSION, type GameState } from '../src/state/GameState';
import {
  compareSaves,
  decideSync,
  PLAY_STAT,
  readBlob,
  SAVED_AT_STAT,
  summarize,
  type SaveSummary,
} from '../src/systems/cloudRules';
import { BACKUP_KEY, SAVE_KEY, saveGame } from '../src/systems/save';
import {
  CLOUD_BOOK_KEY,
  CLOUD_PREV_KEY,
  CloudSync,
  RETRY_MS,
  type Timers,
} from '../src/game/cloudSync';

const sum = (day: number, playSec: number, savedAt = 1000, money = 100): SaveSummary => ({
  day,
  year: 1,
  season: 'spring',
  dayOfSeason: day,
  money,
  playSec,
  savedAt,
});

/** A save on `day` of spring, with `play` seconds played, written at `at`. */
function farm(day: number, play: number, at: number, money = 500): GameState {
  const s = createInitialState();
  s.time.day = day;
  s.money = money;
  s.stats[PLAY_STAT] = play;
  s.stats[SAVED_AT_STAT] = at;
  return s;
}
const json = (s: GameState) => JSON.stringify(s);

/** Timers the test runs by hand. */
class ManualTimers implements Timers {
  private next = 1;
  readonly pending = new Map<number, { fn: () => void; ms: number }>();
  set(fn: () => void, ms: number): unknown {
    const id = this.next++;
    this.pending.set(id, { fn, ms });
    return id;
  }
  clear(h: unknown): void {
    this.pending.delete(h as number);
  }
  /** Run every timer of at least `ms` (or all), as if that time passed. */
  fire(ms = Infinity): number {
    const due = [...this.pending].filter(([, t]) => t.ms <= ms);
    for (const [id, t] of due) {
      this.pending.delete(id);
      t.fn();
    }
    return due.length;
  }
  delays(): number[] {
    return [...this.pending.values()].map((t) => t.ms);
  }
}

async function setup(
  o: {
    local?: GameState | null;
    cloud?: string | null;
    account?: string | null;
    offline?: boolean;
  } = {},
) {
  const store = new MemoryStore();
  if (o.local) await saveGame(store, o.local);
  const fake = new FakeCloudProvider({
    account: o.account === undefined ? 'Ana' : o.account,
    data: o.cloud ?? null,
    offline: o.offline ?? false,
  });
  const timers = new ManualTimers();
  const conflicts: unknown[] = [];
  const sync = new CloudSync({
    store,
    provider: fake,
    timers,
    now: () => 42_000,
    onConflict: (c) => conflicts.push(c),
  });
  await sync.init();
  return { store, fake, timers, sync, conflicts };
}
/** Let every promise the sync started settle (its timers are manual, so real ones are free to use here). */
const flush = () => new Promise((r) => setTimeout(r, 5));

describe('cloud rules: which save is further along', () => {
  it('ahead on the day and not behind on play time is further along', () => {
    expect(compareSaves(sum(10, 600), sum(8, 500))).toBe('local');
    expect(compareSaves(sum(8, 500), sum(10, 600))).toBe('cloud');
    expect(compareSaves(sum(10, 500), sum(8, 500))).toBe('local');
  });

  it('the same day: more play time is further along', () => {
    expect(compareSaves(sum(5, 900), sum(5, 600))).toBe('local');
    expect(compareSaves(sum(5, 600), sum(5, 900))).toBe('cloud');
  });

  it('the day says one thing and play time the other: a conflict (two phones played)', () => {
    expect(compareSaves(sum(12, 300), sum(9, 900))).toBe('conflict');
    expect(compareSaves(sum(9, 900), sum(12, 300))).toBe('conflict');
  });

  it('equal progress: the same write is the same save; otherwise the newer write', () => {
    expect(compareSaves(sum(5, 600, 1000), sum(5, 600, 1000))).toBe('same');
    expect(compareSaves(sum(5, 600, 2000), sum(5, 600, 1000))).toBe('local');
    expect(compareSaves(sum(5, 600, 1000), sum(5, 600, 2000))).toBe('cloud');
  });

  it('old saves without play time are told apart by the day', () => {
    expect(compareSaves(sum(20, 0, 0), sum(5, 0, 0))).toBe('local');
    expect(compareSaves(sum(20, 0, 0), sum(5, 300, 9))).toBe('conflict');
  });

  it('only one side has a save', () => {
    expect(compareSaves(null, null)).toBe('none');
    expect(compareSaves(sum(3, 1), null)).toBe('local');
    expect(compareSaves(null, sum(3, 1))).toBe('cloud');
  });

  it('a further-along cloud save is never uploaded over without the player', () => {
    const cloud = readBlob(json(farm(20, 5000, 9)));
    expect(decideSync(sum(10, 100), cloud).action).toBe('ask');
    expect(decideSync(sum(25, 100), cloud).action).toBe('ask'); // diverged
    expect(decideSync(sum(25, 6000), cloud).action).toBe('upload');
    // only the exact cloud save the player gave up may be replaced
    expect(decideSync(sum(10, 100), cloud, 9).action).toBe('upload');
    expect(decideSync(sum(10, 100), cloud, 8).action).toBe('ask');
  });

  it('reads a cloud blob: usable, empty, corrupt, or from a newer version (never overwritten)', () => {
    expect(readBlob(null).kind).toBe('empty');
    expect(readBlob('{not json').kind).toBe('corrupt');
    expect(readBlob('{"version":3}').kind).toBe('corrupt');
    const newer = readBlob(JSON.stringify({ ...farm(1, 0, 0), version: STATE_VERSION + 1 }));
    expect(newer.kind).toBe('newer');
    expect(decideSync(sum(1, 1), newer).action).toBe('blocked');
    expect(decideSync(sum(1, 1), readBlob('garbage')).action).toBe('upload');
    const ok = readBlob(json(farm(7, 120, 55, 900)));
    expect(ok.kind === 'ok' && ok.summary).toMatchObject({
      day: 7,
      playSec: 120,
      savedAt: 55,
      money: 900,
    });
  });

  it('a save summary reads the absolute day across seasons and years', () => {
    const s = farm(3, 0, 0);
    s.time.season = 'summer';
    s.time.year = 2;
    expect(summarize(s).day).toBeGreaterThan(summarize(farm(28, 0, 0)).day);
  });
});

describe('cloud sync against the fake provider', () => {
  it('no provider: unavailable, nothing runs, the local save is untouched', async () => {
    const store = new MemoryStore();
    await saveGame(store, farm(3, 10, 5));
    const before = store.data.get(SAVE_KEY);
    const sync = new CloudSync({ store, provider: null, timers: new ManualTimers() });
    await sync.init();
    expect(sync.status.state).toBe('unavailable');
    expect(sync.usable).toBe(false);
    await sync.save('pause');
    expect(await sync.load(farm(3, 10, 5))).toBeNull();
    expect(await sync.signIn()).toBe(false);
    expect(store.data.get(SAVE_KEY)).toBe(before);
    expect(store.data.has(CLOUD_BOOK_KEY)).toBe(false);
  });

  it('a provider that is not configured is the same as none', async () => {
    const unconfigured: CloudProvider = {
      id: 'x',
      available: async () => false,
      account: async () => {
        throw new Error('must not be called');
      },
      signIn: async () => null,
      signOut: async () => undefined,
      load: async () => {
        throw new Error('must not be called');
      },
      save: async () => {
        throw new Error('must not be called');
      },
    };
    const sync = new CloudSync({ store: new MemoryStore(), provider: unconfigured });
    await sync.init();
    await sync.save('manual');
    expect(sync.status.state).toBe('unavailable');
  });

  it('local ahead: the local save goes up as it is stored, with its metadata', async () => {
    const local = farm(10, 900, 2000);
    const { fake, sync, store } = await setup({ local, cloud: json(farm(4, 300, 1000)) });
    expect(sync.status).toMatchObject({ state: 'idle', account: 'Ana' });
    await sync.save('manual');
    expect(fake.data).toBe(store.data.get(SAVE_KEY));
    expect(fake.lastMeta?.playedTimeMs).toBe(900_000);
    expect(sync.status).toMatchObject({ state: 'synced', lastSync: 42_000 });
  });

  it('cloud ahead: nothing is uploaded; the player is asked', async () => {
    const cloudText = json(farm(20, 5000, 3000));
    const { fake, sync, conflicts } = await setup({ local: farm(10, 900, 2000), cloud: cloudText });
    await sync.save('manual');
    expect(fake.data).toBe(cloudText);
    expect(fake.calls).not.toContain('save');
    expect(sync.status.state).toBe('conflict');
    expect(conflicts).toHaveLength(1);
    expect(sync.conflict).toMatchObject({
      verdict: 'cloud',
      local: { day: 10 },
      cloud: { day: 20, playSec: 5000 },
    });
    // later syncs keep waiting for the choice
    await sync.save('pause');
    expect(fake.calls.filter((c) => c === 'save')).toHaveLength(0);
  });

  it('diverged saves are a conflict too', async () => {
    const { sync } = await setup({ local: farm(15, 300, 2000), cloud: json(farm(9, 4000, 3000)) });
    await sync.save('manual');
    expect(sync.conflict?.verdict).toBe('conflict');
  });

  it('equal: nothing is uploaded, and the phone counts as synced', async () => {
    const local = farm(6, 400, 2000);
    const { fake, sync } = await setup({ local, cloud: json(local) });
    await sync.save('manual');
    expect(fake.calls).not.toContain('save');
    expect(sync.status.state).toBe('synced');
  });

  it('a corrupt cloud blob is replaced by the local save', async () => {
    const { fake, sync, store } = await setup({ local: farm(2, 50, 2000), cloud: '{"broken' });
    await sync.save('manual');
    expect(fake.data).toBe(store.data.get(SAVE_KEY));
    expect(sync.status.state).toBe('synced');
  });

  it('a cloud save from a newer game version is never overwritten', async () => {
    const newer = JSON.stringify({ ...farm(1, 0, 0), version: STATE_VERSION + 1 });
    const { fake, sync } = await setup({ local: farm(30, 9000, 2000), cloud: newer });
    await sync.save('manual');
    expect(fake.data).toBe(newer);
    expect(sync.status.state).toBe('newer');
  });

  it('offline: the upload is queued (kept across a restart) and retried with backoff until it goes up', async () => {
    const { fake, sync, store, timers } = await setup({ local: farm(5, 100, 2000), offline: true });
    await sync.save('pause');
    expect(sync.status.state).toBe('pending');
    expect(JSON.parse(store.data.get(CLOUD_BOOK_KEY)!).pending).toBe(true);
    expect(timers.delays()).toEqual([RETRY_MS[0]]);
    timers.fire();
    await flush();
    expect(sync.status.state).toBe('pending');
    expect(timers.delays()).toEqual([RETRY_MS[1]]);
    // a restart remembers the queue
    const again = new CloudSync({ store, provider: fake, timers: new ManualTimers() });
    await again.init();
    expect(again.status.state).toBe('pending');
    // back online: the retry uploads the save as it is stored now
    fake.offline = false;
    await saveGame(store, farm(6, 200, 3000));
    timers.fire();
    await flush();
    expect(sync.status.state).toBe('synced');
    expect(fake.data).toBe(store.data.get(SAVE_KEY));
    expect(JSON.parse(store.data.get(CLOUD_BOOK_KEY)!).pending).toBe(false);
  });

  it('sleep syncs wait for the burst of saves to settle, then run once', async () => {
    const { fake, sync, timers } = await setup({ local: farm(5, 100, 2000) });
    await sync.save('sleep');
    await sync.save('sleep');
    await sync.save('resume');
    expect(fake.calls).not.toContain('load');
    expect(timers.fire()).toBe(1);
    await flush();
    expect(fake.calls.filter((c) => c === 'save')).toHaveLength(1);
  });

  it('waits for queued local saves before reading the save to upload', async () => {
    const store = new MemoryStore();
    const fake = new FakeCloudProvider({ account: 'Ana' });
    let release!: () => void;
    const writing = new Promise<void>((r) => (release = r));
    const sync = new CloudSync({
      store,
      provider: fake,
      afterSaves: () => writing,
      timers: new ManualTimers(),
    });
    await sync.init();
    const run = sync.save('pause');
    await saveGame(store, farm(9, 50, 777));
    release();
    await run;
    expect(readBlob(fake.data).kind === 'ok' && readBlob(fake.data)).toMatchObject({
      summary: { savedAt: 777 },
    });
  });

  it("keep this phone's: the local save replaces the cloud's, which is kept on the phone", async () => {
    const cloudText = json(farm(20, 5000, 3000));
    const { fake, sync, store } = await setup({ local: farm(10, 900, 2000), cloud: cloudText });
    await sync.save('manual');
    expect(await sync.resolve('local')).toBeNull();
    expect(fake.data).toBe(store.data.get(SAVE_KEY));
    expect(store.data.get(CLOUD_PREV_KEY)).toBe(cloudText);
    expect(sync.status.state).toBe('synced');
    expect(sync.conflict).toBeNull();
  });

  it("keep this phone's while offline: the replacement stays approved until it goes up", async () => {
    const { fake, sync, timers } = await setup({
      local: farm(10, 900, 2000),
      cloud: json(farm(20, 5000, 3000)),
    });
    await sync.save('manual');
    fake.offline = true;
    await sync.resolve('local');
    expect(sync.status.state).toBe('pending');
    fake.offline = false;
    timers.fire();
    await flush();
    expect(sync.status.state).toBe('synced');
    expect(readBlob(fake.data).kind === 'ok' && readBlob(fake.data)).toMatchObject({
      summary: { day: 10 },
    });
  });

  it("use the cloud save: it becomes this phone's save, the old one stays as the backup", async () => {
    const local = farm(10, 900, 2000);
    const { sync, store } = await setup({ local, cloud: json(farm(20, 5000, 3000)) });
    await sync.save('manual');
    const s = await sync.resolve('cloud');
    expect(s?.time.day).toBe(20);
    expect(
      readBlob(store.data.get(SAVE_KEY)).kind === 'ok' && readBlob(store.data.get(SAVE_KEY)),
    ).toMatchObject({ summary: { day: 20 } });
    expect(
      readBlob(store.data.get(BACKUP_KEY)).kind === 'ok' && readBlob(store.data.get(BACKUP_KEY)),
    ).toMatchObject({ summary: { day: 10 } });
    expect(sync.status.state).toBe('synced');
  });

  it('the title is offered a cloud save that is further along, or the only one', async () => {
    const { sync } = await setup({ cloud: json(farm(20, 5000, 3000)) });
    const offer = await sync.load(null);
    expect(offer).toMatchObject({ verdict: 'cloud', local: null, cloud: { day: 20 } });
    const behind = await setup({ local: farm(25, 9000, 4000), cloud: json(farm(20, 5000, 3000)) });
    expect(await behind.sync.load(farm(25, 9000, 4000))).toBeNull();
    const corrupt = await setup({ cloud: 'nope' });
    expect(await corrupt.sync.load(null)).toBeNull();
    const offline = await setup({ cloud: json(farm(20, 5000, 3000)), offline: true });
    expect(await offline.sync.load(null)).toBeNull();
    expect(offline.sync.status.state).toBe('pending');
  });

  it('signed out: no sync; signing in syncs at once', async () => {
    const { fake, sync } = await setup({ local: farm(5, 100, 2000), account: null });
    expect(sync.status.state).toBe('signedOut');
    await sync.save('pause');
    expect(fake.calls).not.toContain('load');
    expect(await sync.signIn()).toBe(true);
    expect(sync.status).toMatchObject({ state: 'synced', account: 'Farmer' });
    expect(fake.data).not.toBeNull();
  });

  it('a declined sign-in leaves everything as it was', async () => {
    const { fake, sync } = await setup({ local: farm(5, 100, 2000), account: null });
    fake.declineSignIn = true;
    expect(await sync.signIn()).toBe(false);
    expect(sync.status.state).toBe('signedOut');
    expect(fake.data).toBeNull();
  });

  it('turning cloud save off stops syncing and is remembered; the local save is untouched', async () => {
    const { fake, sync, store } = await setup({ local: farm(5, 100, 2000) });
    const before = store.data.get(SAVE_KEY);
    await sync.signOut();
    expect(sync.status).toMatchObject({ state: 'off', account: null });
    await sync.save('manual');
    expect(fake.calls).not.toContain('save');
    const again = new CloudSync({ store, provider: new FakeCloudProvider({ account: 'Ana' }) });
    await again.init();
    expect(again.status.state).toBe('off');
    expect(store.data.get(SAVE_KEY)).toBe(before);
  });

  it('a failed call is an error, retried like a queued upload', async () => {
    const { fake, sync, timers } = await setup({ local: farm(5, 100, 2000) });
    fake.failNext = 'failed';
    await sync.save('manual');
    expect(sync.status.state).toBe('error');
    timers.fire();
    await flush();
    expect(sync.status.state).toBe('synced');
  });

  it('the provider signing the player out mid-session stops syncing', async () => {
    const { fake, sync } = await setup({ local: farm(5, 100, 2000) });
    fake.user = null;
    await sync.save('manual');
    expect(sync.status).toMatchObject({ state: 'signedOut', account: null });
  });

  it('an offer the title made and the player passed by is forgotten; the next sync asks about the real save', async () => {
    const cloudText = json(farm(20, 5000, 3000));
    const { sync, fake, store, conflicts } = await setup({ cloud: cloudText });
    expect(await sync.load(null)).not.toBeNull();
    // New Game instead: the game starts, then its first sleep saves day 1 and syncs
    sync.forgetOffer();
    expect(sync.conflict).toBeNull();
    await saveGame(store, farm(1, 60, 5000));
    await sync.save('manual');
    expect(fake.data).toBe(cloudText);
    expect(conflicts).toHaveLength(1);
    expect(sync.conflict?.local?.day).toBe(1);
  });

  it('a title look still in flight when a game starts records nothing', async () => {
    const { sync } = await setup({ cloud: json(farm(20, 5000, 3000)) });
    const looking = sync.load(null);
    sync.forgetOffer();
    expect(await looking).toBeNull();
    expect(sync.conflict).toBeNull();
  });

  it('a sign-in that finished after launch is picked up when the app comes back', async () => {
    const { fake, sync } = await setup({ local: farm(5, 100, 2000), account: null });
    expect(sync.status.state).toBe('signedOut');
    fake.user = 'Ana';
    await sync.save('resume');
    expect(sync.status).toMatchObject({ state: 'synced', account: 'Ana' });
  });

  it('a phone the player turned off stays off on resume', async () => {
    const { fake, sync } = await setup({ local: farm(5, 100, 2000) });
    await sync.signOut();
    fake.user = 'Ana';
    await sync.save('resume');
    expect(sync.status.state).toBe('off');
  });

  it("use the cloud save: this phone's farm is kept in its own slot, past any number of later saves", async () => {
    const local = farm(10, 900, 2000);
    const { sync, store } = await setup({ local, cloud: json(farm(20, 5000, 3000)) });
    const before = store.data.get(SAVE_KEY);
    await sync.save('manual');
    await sync.resolve('cloud');
    for (let i = 0; i < 3; i++) await saveGame(store, farm(21 + i, 6000, 4000 + i));
    expect(store.data.get(LOCAL_PREV_KEY)).toBe(before);
  });

  it('a corrupt cloud blob is kept on the phone before it is replaced', async () => {
    const { store, sync } = await setup({ local: farm(2, 50, 2000), cloud: '{"broken' });
    await sync.save('manual');
    expect(store.data.get(CLOUD_PREV_KEY)).toBe('{"broken');
  });
});
