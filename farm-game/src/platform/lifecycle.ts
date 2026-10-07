/**
 * One lifecycle for every platform. The web feeds it from the Page Visibility API; native shells
 * (Capacitor) feed it from app state events. Game code only ever listens here.
 *
 *  - 'pause'  the app is going to the background (or being closed): save, silence, stop the clock.
 *  - 'resume' it is visible again.
 *  - 'back'   a hardware/system back request (Android back button).
 */
export type LifecycleEvent = 'pause' | 'resume' | 'back';

type Listener = () => void;

export class Lifecycle {
  private listeners: Record<LifecycleEvent, Set<Listener>> = {
    pause: new Set(),
    resume: new Set(),
    back: new Set(),
  };
  private paused = false;

  get isPaused(): boolean {
    return this.paused;
  }

  on(event: LifecycleEvent, fn: Listener): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  /** Idempotent: a duplicate pause (e.g. visibilitychange then pagehide) fires listeners once. */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.fire('pause');
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.fire('resume');
  }

  /** Returns true if any listener handled the request, so the caller can fall back (e.g. exit the app). */
  back(): boolean {
    const handled = this.listeners.back.size > 0;
    this.fire('back');
    return handled;
  }

  private fire(event: LifecycleEvent): void {
    // Copy first so a listener may unsubscribe itself; one failing listener must not block the rest.
    for (const fn of [...this.listeners[event]]) {
      try {
        fn();
      } catch (err) {
        console.error(`lifecycle "${event}" listener failed`, err);
      }
    }
  }
}

export const lifecycle = new Lifecycle();

/** Feed a Lifecycle from the browser. Targets are injectable so this is testable without a DOM. */
export function installWebLifecycle(
  target: Lifecycle,
  doc: EventTarget & { hidden: boolean },
  win: EventTarget,
): void {
  doc.addEventListener('visibilitychange', () => (doc.hidden ? target.pause() : target.resume()));
  // iOS Safari sometimes skips visibilitychange when the tab is closed or swiped away.
  win.addEventListener('pagehide', () => target.pause());
  // Restored from the back/forward cache.
  win.addEventListener('pageshow', () => {
    if (!doc.hidden) target.resume();
  });
}
