import { beforeEach, describe, expect, it, vi } from 'vitest';

// The native plugins only exist inside a Capacitor shell, so mock them and drive the bridge directly.
const handlers: Record<string, (e: unknown) => void> = {};
const mocks = vi.hoisted(() => ({
  isNative: true,
  addListener: vi.fn(),
  exitApp: vi.fn(() => Promise.resolve()),
  impact: vi.fn(() => Promise.resolve()),
  notification: vi.fn(() => Promise.resolve()),
  hide: vi.fn(() => Promise.resolve()),
  splashHide: vi.fn(() => Promise.resolve()),
  prefs: new Map<string, string>(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.isNative } }));
vi.mock('@capacitor/app', () => ({
  App: { addListener: mocks.addListener, exitApp: mocks.exitApp },
}));
vi.mock('@capacitor/haptics', () => ({
  Haptics: { impact: mocks.impact, notification: mocks.notification },
  ImpactStyle: { Light: 'LIGHT' },
  NotificationType: { Success: 'SUCCESS', Error: 'ERROR' },
}));
vi.mock('@capacitor/status-bar', () => ({ StatusBar: { hide: mocks.hide } }));
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: { hide: mocks.splashHide } }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: mocks.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => void mocks.prefs.set(key, value),
    remove: async ({ key }: { key: string }) => void mocks.prefs.delete(key),
  },
}));

import { haptic, registerHapticsDriver, setHapticsEnabled } from '../src/platform/haptics';
import { Lifecycle } from '../src/platform/lifecycle';
import { EXIT_WAIT_MS, hideSplash, initNative } from '../src/platform/native';
import { NativeStore } from '../src/platform/NativeStore';
import { MIGRATED_KEY, createSaveStore, migrateWebSave } from '../src/platform/store';
import { MemoryStore } from '../src/platform/SaveStore';
import { createInitialState } from '../src/state/GameState';
import { loadGame, saveGame } from '../src/systems/save';

beforeEach(() => {
  mocks.isNative = true;
  mocks.prefs.clear();
  for (const k of Object.keys(handlers)) delete handlers[k];
  mocks.addListener
    .mockReset()
    .mockImplementation(async (name: string, fn: (e: unknown) => void) => {
      handlers[name] = fn;
      return { remove: async () => undefined };
    });
  [mocks.exitApp, mocks.impact, mocks.notification, mocks.hide, mocks.splashHide].forEach((m) =>
    m.mockClear(),
  );
  setHapticsEnabled(true);
});

describe('initNative', () => {
  it('does nothing on the web', () => {
    mocks.isNative = false;
    initNative(new Lifecycle());
    expect(mocks.addListener).not.toHaveBeenCalled();
    expect(mocks.hide).not.toHaveBeenCalled();
  });

  it('feeds app state changes into the shared lifecycle', () => {
    const lc = new Lifecycle();
    const pause = vi.fn();
    const resume = vi.fn();
    lc.on('pause', pause);
    lc.on('resume', resume);
    initNative(lc);
    handlers['appStateChange']!({ isActive: false });
    expect(pause).toHaveBeenCalledTimes(1);
    handlers['appStateChange']!({ isActive: true });
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('routes the Android back button to the game, and asks before quitting when nothing used it', async () => {
    const lc = new Lifecycle();
    let answer = false;
    const confirmQuit = vi.fn(() => answer);
    const beforeExit = vi.fn(() => Promise.resolve());
    initNative(lc, { confirmQuit, beforeExit });
    // In game with a sheet open: the listener closes it and uses the press.
    const off = lc.on('back', () => true);
    handlers['backButton']!({ canGoBack: false });
    expect(confirmQuit).not.toHaveBeenCalled();
    off();
    // A listener that did not use the press (nothing open) still leads to the question.
    const off2 = lc.on('back', () => undefined);
    handlers['backButton']!({ canGoBack: false });
    expect(confirmQuit).toHaveBeenCalledTimes(1);
    off2();
    // "No" stays in the game.
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.exitApp).not.toHaveBeenCalled();
    expect(beforeExit).not.toHaveBeenCalled();
    // "Yes" saves first, then exits once.
    answer = true;
    handlers['backButton']!({ canGoBack: false });
    expect(beforeExit).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
    handlers['backButton']!({ canGoBack: false });
    await new Promise((r) => setTimeout(r, 0));
    expect(mocks.exitApp).toHaveBeenCalledTimes(1);
  });

  it('quits even when the last save never settles', async () => {
    vi.useFakeTimers();
    try {
      initNative(new Lifecycle(), {
        confirmQuit: () => true,
        beforeExit: () => new Promise(() => undefined),
      });
      handlers['backButton']!({ canGoBack: false });
      await vi.advanceTimersByTimeAsync(EXIT_WAIT_MS - 10);
      expect(mocks.exitApp).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(20);
      expect(mocks.exitApp).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('hides the status bar and registers the real haptic engine', () => {
    initNative(new Lifecycle());
    expect(mocks.hide).toHaveBeenCalled();
    haptic('tick');
    expect(mocks.impact).toHaveBeenCalledWith({ style: 'LIGHT' });
    haptic('success');
    expect(mocks.notification).toHaveBeenCalledWith({ type: 'SUCCESS' });
    haptic('error');
    expect(mocks.notification).toHaveBeenLastCalledWith({ type: 'ERROR' });
  });

  it('survives plugins that reject (unsupported hardware)', async () => {
    mocks.impact.mockImplementationOnce(() => Promise.reject(new Error('no taptic engine')));
    mocks.hide.mockImplementationOnce(() => Promise.reject(new Error('unsupported')));
    initNative(new Lifecycle());
    expect(() => haptic('tick')).not.toThrow();
    await new Promise((r) => setTimeout(r, 0)); // an unhandled rejection would fail the run
  });

  it('hideSplash only talks to the native splash on native', () => {
    hideSplash();
    expect(mocks.splashHide).toHaveBeenCalledTimes(1);
    mocks.isNative = false;
    hideSplash();
    expect(mocks.splashHide).toHaveBeenCalledTimes(1);
  });

  it('keeps haptics muted when the player turned vibration off', () => {
    initNative(new Lifecycle());
    setHapticsEnabled(false);
    haptic('tick');
    expect(mocks.impact).not.toHaveBeenCalled();
    registerHapticsDriver(() => undefined); // restore a neutral driver for other tests
  });
});

describe('native save store', () => {
  it('is chosen on native and round-trips a full game through Preferences', async () => {
    const store = createSaveStore(['farm.save']);
    expect(store.persistent).toBe(true);
    const state = createInitialState();
    state.money = 4321;
    await saveGame(store, state);
    const loaded = await loadGame(store);
    expect(loaded?.state.money).toBe(4321);
    expect(loaded?.fromBackup).toBe(false);
  });

  it('web builds do not use the native store', () => {
    mocks.isNative = false;
    expect(createSaveStore()).not.toBeInstanceOf(NativeStore);
  });

  it('writes through to Preferences', async () => {
    const store = createSaveStore([]);
    await store.write('k', 'v');
    expect(mocks.prefs.get('k')).toBe('v');
  });

  it('remove deletes the key', async () => {
    const store = new NativeStore();
    await store.write('k', 'v');
    expect(await store.read('k')).toBe('v');
    await store.remove('k');
    expect(await store.read('k')).toBeNull();
  });
});

describe('one-time migration of a WebView save', () => {
  it('copies the save keys once, never overwrites a native save, and keeps the web copy', async () => {
    const native = new MemoryStore();
    const web = new MemoryStore();
    await web.write('farm.save', 'WEB');
    await web.write('farm.save.bak', 'WEBBAK');
    await web.write('other', 'x');
    await native.write('farm.save.bak', 'NATIVEBAK');
    const copied = await migrateWebSave(native, web, ['farm.save', 'farm.save.bak', 'lang']);
    expect(copied).toEqual(['farm.save']);
    expect(await native.read('farm.save')).toBe('WEB');
    expect(await native.read('farm.save.bak')).toBe('NATIVEBAK');
    expect(await native.read('other')).toBeNull();
    expect(await web.read('farm.save')).toBe('WEB');
    expect(await native.read(MIGRATED_KEY)).toBe('1');
    // A second launch copies nothing, even if the web copy changed.
    await web.write('farm.save', 'WEB2');
    await native.remove('farm.save');
    expect(await migrateWebSave(native, web, ['farm.save'])).toEqual([]);
    expect(await native.read('farm.save')).toBeNull();
  });

  it('retries next launch when the WebView storage cannot be read, and never blocks saving', async () => {
    const native = new MemoryStore();
    const broken = {
      read: () => Promise.reject(new Error('blocked')),
      write: () => Promise.reject(new Error('blocked')),
      remove: () => Promise.reject(new Error('blocked')),
    };
    await expect(migrateWebSave(native, broken, ['farm.save'])).rejects.toThrow('blocked');
    expect(await native.read(MIGRATED_KEY)).toBeNull();
    // Through the real store the failure is swallowed: the game saves to Preferences regardless.
    const store = createSaveStore(['farm.save']);
    await store.write('farm.save', 'NEW');
    expect(mocks.prefs.get('farm.save')).toBe('NEW');
  });

  it('a fresh native install with an empty WebView marks itself migrated on first use', async () => {
    const store = createSaveStore(['farm.save']);
    expect(await store.read('farm.save')).toBeNull();
    expect(mocks.prefs.get(MIGRATED_KEY)).toBe('1');
  });
});
