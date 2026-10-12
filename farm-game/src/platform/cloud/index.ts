import { Capacitor } from '@capacitor/core';
import type { CloudProvider } from '../cloudSave';
import { PlayGamesProvider } from './playGames';

/**
 * The cloud provider for where we run: Play Games Saved Games in the Android app, none elsewhere (the web build
 * and iOS play offline exactly as before; DECISIONS.md, "Cloud save"). Whether Play Games is configured is
 * asked later (`available()`), so this never fails.
 */
export function createCloudProvider(): CloudProvider | null {
  return Capacitor.getPlatform() === 'android' ? new PlayGamesProvider() : null;
}
