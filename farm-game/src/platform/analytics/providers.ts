/**
 * Where analytics events go. The layer (`index.ts`) owns ids, consent, batching and the offline queue; a provider only
 * delivers a batch and switches its own collection on or off.
 *
 * - `noop`: the default. With no config the game never even starts the layer (game/analyticsWiring.ts).
 * - `dev`: keeps events in memory for the DEV tab and the e2e checks, and logs them to the console. Nothing leaves
 *   the device.
 * - `firebase`: Google Analytics for Firebase on Android, through the native `@capacitor-firebase/analytics` plugin
 *   (called via `registerPlugin`, so the web bundle carries no Firebase code).
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Envelope } from './schema';

export type ProviderId = 'noop' | 'dev' | 'firebase';

export interface AnalyticsProvider {
  readonly id: ProviderId;
  /** Deliver one batch, in order. Rejects when it couldn't: the batch stays queued and is retried later. */
  send(batch: readonly Envelope[]): Promise<void>;
  /** Collection on (consent given) or off (declined, or opted out: the provider forgets what it holds). */
  setEnabled(on: boolean): Promise<void>;
}

export const noopProvider: AnalyticsProvider = {
  id: 'noop',
  send: () => Promise.resolve(),
  setEnabled: () => Promise.resolve(),
};

/** The dev provider: an in-memory log the DEV tab shows, with a switch to act offline. */
export interface DevProvider extends AnalyticsProvider {
  readonly id: 'dev';
  /** Everything delivered, oldest first (at most `cap`). */
  readonly log: Envelope[];
  /** While true, every send fails (to see the offline queue at work). */
  offline: boolean;
  enabled: boolean;
  clear(): void;
}

export function createDevProvider(opts: { cap?: number; quiet?: boolean } = {}): DevProvider {
  const cap = opts.cap ?? 1000;
  const p: DevProvider = {
    id: 'dev',
    log: [],
    offline: false,
    enabled: false,
    send(batch) {
      if (p.offline) return Promise.reject(new Error('offline (dev provider)'));
      for (const e of batch) {
        p.log.push(e);
        if (!opts.quiet) console.debug('[analytics]', e.name, e.params);
      }
      if (p.log.length > cap) p.log.splice(0, p.log.length - cap);
      return Promise.resolve();
    },
    setEnabled(on) {
      p.enabled = on;
      return Promise.resolve();
    },
    clear() {
      p.log.length = 0;
    },
  };
  return p;
}

// ---------------------------------------------------------------- Firebase (Android)

/** The part of `@capacitor-firebase/analytics` (8.x) this adapter calls. */
interface FirebaseAnalyticsPlugin {
  logEvent(o: { name: string; params?: Record<string, string | number> }): Promise<void>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  setConsent(o: { type: string; status: 'GRANTED' | 'DENIED' }): Promise<void>;
  resetAnalyticsData(): Promise<void>;
}

/**
 * Event names Google Analytics reserves for its own automatic events. Ours with the same name get a `ta_` prefix
 * (Firebase logs its own `first_open` and `session_start` too, and those drive its built-in retention).
 */
export const FIREBASE_RESERVED = new Set([
  'ad_activeview',
  'ad_click',
  'ad_exposure',
  'ad_impression',
  'ad_query',
  'adunit_exposure',
  'app_background',
  'app_clear_data',
  'app_exception',
  'app_remove',
  'app_store_refund',
  'app_store_subscription_cancel',
  'app_store_subscription_convert',
  'app_store_subscription_renew',
  'app_update',
  'app_upgrade',
  'dynamic_link_app_open',
  'dynamic_link_app_update',
  'dynamic_link_first_open',
  'error',
  'first_open',
  'first_visit',
  'in_app_purchase',
  'notification_dismiss',
  'notification_foreground',
  'notification_open',
  'notification_receive',
  'os_update',
  'session_start',
  'session_start_with_rollout',
  'user_engagement',
]);

/** The name an event is logged under in Firebase. */
export const firebaseName = (name: string): string =>
  FIREBASE_RESERVED.has(name) ? `ta_${name}` : name;

/** Is the native Firebase Analytics plugin in this build (an Android build the owner set up)? */
export const firebaseAvailable = (): boolean =>
  Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('FirebaseAnalytics');

export function createFirebaseProvider(
  plugin: FirebaseAnalyticsPlugin = registerPlugin<FirebaseAnalyticsPlugin>('FirebaseAnalytics'),
): AnalyticsProvider {
  return {
    id: 'firebase',
    async send(batch) {
      // The SDK keeps its own offline store once logEvent returns; a rejected call keeps the batch in our queue.
      for (const e of batch)
        await plugin.logEvent({ name: firebaseName(e.name), params: e.params });
    },
    async setEnabled(on) {
      if (on) {
        // Analytics storage only: never ads, ad personalisation or ad user data (the manifest also turns off the
        // advertising id and removes the AD_ID permission; agents/PUBLISHING.md).
        await plugin.setConsent({ type: 'ANALYTICS_STORAGE', status: 'GRANTED' }); // i18n-ok: SDK constants
        for (const type of ['AD_STORAGE', 'AD_USER_DATA', 'AD_PERSONALIZATION'])
          await plugin.setConsent({ type, status: 'DENIED' }); // i18n-ok
        await plugin.setEnabled({ enabled: true });
      } else {
        await plugin.setConsent({ type: 'ANALYTICS_STORAGE', status: 'DENIED' }); // i18n-ok
        await plugin.setEnabled({ enabled: false });
        // Opting out also clears what the SDK holds on the device and its app-instance id.
        await plugin.resetAnalyticsData();
      }
    },
  };
}
