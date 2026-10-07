/** Browser display helpers: fullscreen + portrait lock, and gesture/scroll suppression. */

type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

export const fullscreenSupported = (): boolean =>
  document.fullscreenEnabled === true &&
  typeof document.documentElement.requestFullscreen === 'function';

/** iOS Safari on iPhone has no element fullscreen; "Add to Home Screen" is the way there. */
export const isIosSafari = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent) &&
  !('standalone' in navigator && (navigator as { standalone?: boolean }).standalone);

export const isStandalone = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as { standalone?: boolean }).standalone === true;

/** Enter fullscreen and lock to portrait (Android Chrome allows the lock only in fullscreen). */
export async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
    (screen.orientation as LockableOrientation | undefined)?.unlock?.();
    return;
  }
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await (screen.orientation as LockableOrientation | undefined)?.lock?.('portrait');
  } catch {
    /* denied, unsupported, or not lockable: the game still plays */
  }
}

/**
 * Stop the browser from hijacking touches meant for the game: pinch/double-tap zoom, the
 * long-press context menu, and pull-to-refresh style overscroll. CSS handles most of it
 * (touch-action, overscroll-behavior); these cover Safari's gesture events and context menu.
 */
export function suppressBrowserGestures(): void {
  const stop = (e: Event) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'contextmenu', 'dblclick']) {
    document.addEventListener(type, stop, { passive: false });
  }
  // iOS Safari ignores user-scalable=no; multi-touch moves would otherwise pinch-zoom the page.
  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault();
    },
    { passive: false },
  );
}

/** iOS reports stale sizes right after rotation; refresh the scale after it settles. */
export function refreshOnRotate(refresh: () => void): void {
  const later = () => {
    refresh();
    window.setTimeout(refresh, 250);
    window.setTimeout(refresh, 700);
  };
  window.addEventListener('orientationchange', later);
  window.addEventListener('resize', later);
}
