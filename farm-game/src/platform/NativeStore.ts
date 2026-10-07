import { Preferences } from '@capacitor/preferences';
import type { SaveStore } from './SaveStore';

/**
 * Saves in the native key-value store (SharedPreferences / UserDefaults). Unlike IndexedDB inside a
 * WebView it is never evicted by the OS under storage pressure, and Android auto-backup includes it.
 */
export class NativeStore implements SaveStore {
  readonly persistent = true;

  async read(key: string): Promise<string | null> {
    return (await Preferences.get({ key })).value;
  }

  async write(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async remove(key: string): Promise<void> {
    await Preferences.remove({ key });
  }
}
