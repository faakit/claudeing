import { Capacitor } from '@capacitor/core';
import { NativeStore } from './NativeStore';
import type { SaveStore } from './SaveStore';
import { createWebStore } from './webStore';

/** The right storage for where we are running: native key-value store in the apps, IndexedDB on the web. */
export function createSaveStore(): SaveStore & { readonly persistent: boolean } {
  return Capacitor.isNativePlatform() ? new NativeStore() : createWebStore();
}
