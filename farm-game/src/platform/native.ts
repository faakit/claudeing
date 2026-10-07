import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar } from '@capacitor/status-bar';
import { registerHapticsDriver, type HapticKind } from './haptics';
import { lifecycle, type Lifecycle } from './lifecycle';

export const isNative = (): boolean => Capacitor.isNativePlatform();

/** Plugin calls reject on unsupported devices; none of them may ever take the game down. */
const safely = (p: Promise<unknown> | undefined): void => {
  void p?.catch(() => undefined);
};

/**
 * Connect the native shell (Capacitor iOS/Android) to the game: real haptics, the shared lifecycle,
 * the Android back button, and a hidden status bar. A no-op on the web. Call once at startup.
 */
export function initNative(target: Lifecycle = lifecycle): void {
  if (!isNative()) return;

  registerHapticsDriver((kind: HapticKind) => {
    if (kind === 'tick') safely(Haptics.impact({ style: ImpactStyle.Light }));
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
  // game: close the open dialog / open the menu. If nothing handles it (title screen), leave the app.
  safely(
    App.addListener('backButton', () => {
      if (!target.back()) safely(App.exitApp());
    }),
  );

  safely(StatusBar.hide());
}

/** Hide the native splash once the first real screen is drawn (avoids a blank flash). No-op on the web. */
export function hideSplash(): void {
  if (isNative()) safely(SplashScreen.hide({ fadeOutDuration: 250 }));
}
