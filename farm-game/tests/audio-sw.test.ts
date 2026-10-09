import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { afterAll, describe, expect, it } from 'vitest';
import { serviceWorkerSource } from '../scripts/sw-plugin.mjs';

/**
 * The generated service worker keeps audio in its own cache, one entry per file version, so a
 * release re-downloads only the audio files that changed (critic finding F25). Runs the emitted
 * sw.js in a sandbox with fake Cache Storage and fetch.
 */
const SCOPE = 'https://farm.test/game/';

type Res = { ok: boolean; status: number; body: string; clone(): Res };
const response = (body: string): Res => ({ ok: true, status: 200, body, clone: () => response(body) });

class FakeCache {
  entries = new Map<string, Res>();
  constructor(private fetchFn: (u: string) => Promise<Res>) {}
  async keys() {
    return [...this.entries.keys()].map((url) => ({ url }));
  }
  async put(key: string | { url: string }, res: Res) {
    this.entries.set(typeof key === 'string' ? key : key.url, res);
  }
  async match(key: string | { url: string }) {
    return this.entries.get(typeof key === 'string' ? key : key.url);
  }
  async delete(key: { url: string }) {
    return this.entries.delete(key.url);
  }
  async addAll(urls: string[]) {
    for (const u of urls) this.entries.set(new URL(u, SCOPE).href, await this.fetchFn(new URL(u, SCOPE).href));
  }
}

/** Cache Storage shared across service-worker versions, like a real browser profile. */
function makeBrowser(files: Record<string, string>) {
  const fetched: string[] = [];
  const fetchFn = async (u: string) => {
    fetched.push(u);
    const path = new URL(u).pathname.replace('/game/', '');
    return response(files[path] ?? `page:${path}`);
  };
  const store = new Map<string, FakeCache>();
  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new FakeCache(fetchFn));
      return store.get(name)!;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
    match: async (req: { url: string }) => {
      for (const c of store.values()) {
        const hit = await c.match(req.url.split('?')[0]!);
        if (hit) return hit;
      }
      return undefined;
    },
  };
  return { fetched, store, caches, fetchFn };
}

function boot(source: string, browser: ReturnType<typeof makeBrowser>) {
  const handlers: Record<string, (e: unknown) => void> = {};
  const self = {
    registration: { scope: SCOPE },
    location: { origin: 'https://farm.test' },
    addEventListener: (t: string, fn: (e: unknown) => void) => (handlers[t] = fn),
    skipWaiting: async () => undefined,
    clients: { claim: async () => undefined },
  };
  runInNewContext(source, { self, caches: browser.caches, fetch: browser.fetchFn, URL, Response: {}, Promise, Set, Object });
  const fire = async (type: string, extra: Record<string, unknown> = {}) => {
    let p: Promise<unknown> = Promise.resolve();
    handlers[type]!({ ...extra, waitUntil: (x: Promise<unknown>) => (p = x), respondWith: (x: Promise<unknown>) => (p = x) });
    return p;
  };
  return { fire };
}

describe('service worker audio cache', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sw-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  const write = (f: string, body: string) => {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), body);
  };
  const files: Record<string, string> = {
    'assets/audio/sfx/a.mp3': 'A1',
    'assets/audio/sfx/b.mp3': 'B1',
    'assets/audio/inst/c.mp3': 'C1',
    'assets/ui.png': 'PNG',
  };
  for (const [f, b] of Object.entries(files)) write(f, b);

  it('downloads only new or changed audio files on an update and prunes the old versions', async () => {
    const browser = makeBrowser(files);
    const v1 = serviceWorkerSource(['index.js'], dir);
    expect(v1).not.toContain('"./assets/audio/'); // audio is not in the versioned precache
    const sw1 = boot(v1, browser);
    await sw1.fire('install');
    await sw1.fire('activate');
    const audioFetches = () => browser.fetched.filter((u) => u.includes('/assets/audio/'));
    expect(audioFetches()).toHaveLength(3);

    // A release that changes one sound and adds one.
    files['assets/audio/sfx/b.mp3'] = 'B2';
    files['assets/audio/sfx/d.mp3'] = 'D1';
    write('assets/audio/sfx/b.mp3', 'B2');
    write('assets/audio/sfx/d.mp3', 'D1');
    const v2 = serviceWorkerSource(['index.js'], dir);
    browser.fetched.length = 0;
    const sw2 = boot(v2, browser);
    await sw2.fire('install');
    expect(audioFetches().map((u) => u.replace(SCOPE, '')).sort()).toEqual(['assets/audio/sfx/b.mp3', 'assets/audio/sfx/d.mp3']);
    await sw2.fire('activate');
    const audio = browser.store.get('tiny-acre-audio')!;
    expect(audio.entries.size).toBe(4); // a, b (new version only), c, d
    expect([...audio.entries.values()].map((r) => r.body).sort()).toEqual(['A1', 'B2', 'C1', 'D1']);

    // Requests are served from the audio cache, with no network.
    browser.fetched.length = 0;
    const res = (await sw2.fire('fetch', {
      request: { method: 'GET', url: `${SCOPE}assets/audio/sfx/b.mp3`, mode: 'cors' },
    })) as Res;
    expect(res.body).toBe('B2');
    expect(browser.fetched).toHaveLength(0);
    // Only one main cache survives besides the audio cache.
    expect([...browser.store.keys()].filter((k) => k !== 'tiny-acre-audio')).toHaveLength(1);
  });
});
