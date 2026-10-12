import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { registerHapticsDriver, type HapticKind } from './haptics';
import { lifecycle, type Lifecycle } from './lifecycle';
import { t } from '../i18n';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Plugin calls reject on unsupported devices; none of them may ever take the game down. */
const safely = (p: Promise<unknown> | undefined): void => {
  void p?.catch(() => undefined);
};

/** What the game lends the native shell: the quit question and a last save before the app closes. */
export interface NativeHooks {
  /** Ask the player before quitting (true = quit). Default: the WebView's confirm, a native Android dialog. */
  confirmQuit?: () => boolean;
  /** Runs before the app exits (the game saves here); the exit waits for it, at most `EXIT_WAIT_MS`. */
  beforeExit?: () => Promise<unknown>;
}

/** The longest a quit waits for the last save. */
export const EXIT_WAIT_MS = 1500;

/**
 * Connect the native shell (Capacitor iOS/Android) to the game: real haptics, the shared lifecycle,
 * the Android back button, and a hidden status bar. A no-op on the web. Call once at startup.
 */
export function initNative(target: Lifecycle = lifecycle, hooks: NativeHooks = {}): void {
  if (!isNative()) return;

  registerHapticsDriver((kind: HapticKind) => {
    if (kind === 'tick') safely(Haptics.impact({ style: ImpactStyle.Light }));
    else if (kind === 'medium') safely(Haptics.impact({ style: ImpactStyle.Medium }));
    else
      safely(
        Haptics.notification({
          type: kind === 'success' ? NotificationType.Success : NotificationType.Error,
        }),
      );
  });

  safely(
    App.addListener('appStateChange', ({ isActive }) =>
      isActive ? target.resume() : target.pause(),
    ),
  );
  // Registering a backButton listener replaces Android's default "close the app", so route it to the
  // game first: in play it closes the open sheet or opens the menu. When nothing used the press (the title
  // screen), ask before quitting, save, then leave.
  const confirmQuit = hooks.confirmQuit ?? (() => window.confirm(t('title.quitConfirm')));
  let quitting = false;
  safely(
    App.addListener('backButton', () => {
      if (quitting || target.back()) return;
      if (!confirmQuit()) return;
      quitting = true;
      const saved = hooks.beforeExit?.().catch(() => undefined) ?? Promise.resolve();
      const timeout = new Promise((r) => globalThis.setTimeout(r, EXIT_WAIT_MS));
      void Promise.race([saved, timeout]).then(() => safely(App.exitApp()));
    }),
  );

  safely(StatusBar.hide());
}

/** Hide the native splash once the first real screen is drawn (avoids a blank flash). No-op on the web. */
export function hideSplash(): void {
  if (isNative()) safely(SplashScreen.hide({ fadeOutDuration: 250 }));
}
