/**
 * Play Games Services v2 Saved Games (Android), through the app's own thin native plugin `PlayGamesSaves`
 * (android/app/src/main/java/app/tinyacre/farm/plugins/PlayGamesSavesPlugin.java, in the Android lane). One
 * snapshot named "farm" holds the save's JSON.
 *
 * Sign-in is Play Games' automatic sign-in (a Google account under the hood); `signIn()` is its manual retry.
 * Play Games v2 has no sign-out: turning cloud save off is the game's own switch (`game/cloudSync.ts`).
 * Without a configured Play Games project id the plugin reports itself unavailable and nothing here runs.
 */
import { registerPlugin } from '@capacitor/core';
import { CloudError, type CloudBlob, type CloudMeta, type CloudProvider } from '../cloudSave';

interface PlayGamesSavesPlugin {
  available(): Promise<{ available: boolean }>;
  status(): Promise<{ signedIn: boolean; player?: string }>;
  signIn(): Promise<{ signedIn: boolean; player?: string }>;
  load(o: { name: string }): Promise<{ data: string | null; modified: number }>;
  save(o: {
    name: string;
    data: string;
    description: string;
    playedTimeMillis: number;
    progressValue: number;
  }): Promise<{ modified: number }>;
}

const SNAPSHOT = 'farm';

const kindOf = (e: unknown): CloudError['kind'] => {
  const code = (e as { code?: unknown } | null)?.code;
  if (code === 'OFFLINE') return 'offline';
  if (code === 'SIGNED_OUT') return 'signedOut';
  if (code === 'UNAVAILABLE' || code === 'UNIMPLEMENTED') return 'unavailable';
  return 'failed';
};

export class PlayGamesProvider implements CloudProvider {
  readonly id = 'play-games';
  private readonly plugin = registerPlugin<PlayGamesSavesPlugin>('PlayGamesSaves');

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e) {
      throw new CloudError(kindOf(e), String((e as Error)?.message ?? e));
    }
  }

  async available(): Promise<boolean> {
    try {
      return (await this.plugin.available()).available === true;
    } catch {
      return false; // the plugin is not in this build (UNIMPLEMENTED)
    }
  }

  async account(): Promise<string | null> {
    try {
      const r = await this.plugin.status();
      return r.signedIn ? (r.player ?? '') : null;
    } catch {
      return null;
    }
  }

  async signIn(): Promise<string | null> {
    const r = await this.run(() => this.plugin.signIn());
    return r.signedIn ? (r.player ?? '') : null;
  }

  async signOut(): Promise<void> {
    /* Play Games v2 has no sign-out; the game stops syncing instead */
  }

  async load(): Promise<CloudBlob | null> {
    const r = await this.run(() => this.plugin.load({ name: SNAPSHOT }));
    return r.data ? { data: r.data, modified: r.modified } : null;
  }

  async save(data: string, meta: CloudMeta): Promise<number> {
    const r = await this.run(() =>
      this.plugin.save({
        name: SNAPSHOT,
        data,
        description: meta.description,
        playedTimeMillis: meta.playedTimeMs,
        progressValue: meta.progress,
      }),
    );
    return r.modified;
  }
}
