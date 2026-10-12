import { Capacitor } from '@capacitor/core';
import { NativeStore } from './NativeStore';
import type { SaveStore } from './SaveStore';
import { createWebStore } from './webStore';

/** Set in the native store once the WebView's own storage has been copied over (or found empty). */
export const MIGRATED_KEY = 'native.migrated';

/**
 * Copy `keys` from the WebView's storage (`web`) into the native store, once per install. A key the native store
 * already holds is never overwritten, and the WebView copy is left in place (nothing is deleted). Returns the keys
 * copied. A safety net: native builds have saved to Preferences since M8, so normally there is nothing to copy. The
 * web store falls back from IndexedDB to localStorage to memory, so an unreadable WebView storage reads as empty and
 * the marker is still written; only a `web` that throws leaves it unwritten (the next launch tries again).
 */
export async function migrateWebSave(
  native: SaveStore,
  web: SaveStore,
  keys: readonly string[],
): Promise<string[]> {
  if ((await native.read(MIGRATED_KEY)) !== null) return [];
  const copied: string[] = [];
  for (const key of keys) {
    if ((await native.read(key)) !== null) continue;
    const value = await web.read(key);
    if (value === null) continue;
    await native.write(key, value);
    copied.push(key);
  }
  await native.write(MIGRATED_KEY, '1');
  return copied;
}

/** A native store whose first use waits for the one-time migration from the WebView's storage. */
class MigratingNativeStore implements SaveStore {
  readonly persistent = true;
  private ready: Promise<unknown> | null = null;

  constructor(
    private readonly native: SaveStore,
    private readonly web: () => SaveStore,
    private readonly keys: readonly string[],
  ) {}

  private migrated(): Promise<unknown> {
    // A failed migration must never block saving: the game carries on with the native store.
    this.ready ??= migrateWebSave(this.native, this.web(), this.keys).catch(() => undefined);
    return this.ready;
  }

  async read(key: string): Promise<string | null> {
    await this.migrated();
    return this.native.read(key);
  }
  async write(key: string, value: string): Promise<void> {
    await this.migrated();
    return this.native.write(key, value);
  }
  async remove(key: string): Promise<void> {
    await this.migrated();
    return this.native.remove(key);
  }
}

/**
 * The right storage for where we are running: the native key-value store in the apps (after copying over, once,
 * any save the WebView held under `migrateKeys`), IndexedDB on the web.
 */
export function createSaveStore(
  migrateKeys: readonly string[] = [],
): SaveStore & { readonly persistent: boolean } {
  if (!Capacitor.isNativePlatform()) return createWebStore();
  return new MigratingNativeStore(new NativeStore(), createWebStore, migrateKeys);
}
