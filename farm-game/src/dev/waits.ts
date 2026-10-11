/**
 * Await helpers that resolve on game events and frame state instead of fixed timeouts (debug builds only).
 * Each one checks once per rendered frame and rejects after `timeout` real milliseconds with a message that says
 * what it was waiting for.
 */
import Phaser from 'phaser';
import { controlsLog, type ActLog } from '../input/controlsLog';
import { inputHub } from '../input/InputHub';
import { runtime } from '../state/runtime';
import { gameEvents, type GameEvents } from '../systems/events';

type Loose = Record<string, unknown>;
const loose = (o: unknown): Loose => o as Loose;

/** Names `panelOpen` understands: the panel types plus the sheets the UI scene keeps by name. */
export const NAMED_SHEETS = ['jar', 'move', 'npc', 'plot', 'summary', 'yearEnd'] as const;

export interface WaitOptions {
  /** Real milliseconds before giving up (default 10000). */
  timeout?: number;
}

export class DevWaits {
  private acts = 0;
  private lastAct: ActLog | null = null;

  constructor(private readonly game: Phaser.Game) {
    // Count Action results as they are logged (a quick act can start and end between two polls).
    const push = controlsLog.push.bind(controlsLog);
    controlsLog.push = (e) => {
      push(e);
      if (e.kind === 'act') {
        this.acts++;
        this.lastAct = e;
      }
    };
  }

  /** The active map scene (Farm, Town, Lab...), if any. */
  world(): Phaser.Scene | undefined {
    return this.game.scene.getScenes(true).find((s) => 'coachWorld' in s);
  }

  ui(): Phaser.Scene | undefined {
    const ui = this.game.scene.getScene('UI');
    return ui?.sys.isActive() ? ui : undefined;
  }

  /** Modal sheets of the UI scene by name ("menu", "bin", "npc"...). */
  sheets(): Map<string, Loose> {
    const out = new Map<string, Loose>();
    const ui = this.ui();
    if (!ui) return out;
    const panels = loose(ui)['panels'] as Map<string, Loose> | undefined;
    panels?.forEach((m, k) => out.set(k, m));
    for (const k of NAMED_SHEETS) {
      const m = loose(ui)[k];
      if (m) out.set(k, loose(m));
    }
    return out;
  }

  /** The open sheet's name, once it has finished sliding in (null when none is open). */
  openSheet(): string | null {
    const ui = this.ui();
    for (const [name, m] of this.sheets())
      if (m['isOpen'] && !ui?.tweens.isTweening(m['root'] as object)) return name;
    return null;
  }

  /** Resolve with the first truthy value `pred` returns, checked once per rendered frame. */
  until<T>(
    pred: () => T | false | null | undefined,
    what: string,
    opts: WaitOptions = {},
  ): Promise<T> {
    const timeout = opts.timeout ?? 10_000;
    return new Promise<T>((resolve, reject) => {
      const t0 = performance.now();
      const check = (): boolean => {
        let v: T | false | null | undefined;
        try {
          v = pred();
        } catch {
          v = undefined;
        }
        if (v) {
          cleanup();
          resolve(v);
          return true;
        }
        if (performance.now() - t0 > timeout) {
          cleanup();
          reject(new Error(`timed out after ${timeout} ms waiting for ${what}`));
          return true;
        }
        return false;
      };
      const onFrame = () => void check();
      // A paused loop renders no frames: fall back to a slow timer so timeouts still fire.
      const timer = window.setInterval(check, 100);
      const cleanup = () => {
        this.game.events.off(Phaser.Core.Events.POST_RENDER, onFrame);
        window.clearInterval(timer);
      };
      if (!check()) this.game.events.on(Phaser.Core.Events.POST_RENDER, onFrame);
    });
  }

  /** `n` rendered frames from now. */
  frames(n = 1, opts?: WaitOptions): Promise<true> {
    let left = n;
    return this.until(() => --left < 0, `${n} frames`, opts);
  }

  /** The next emission of a game event (its payload). */
  event<K extends keyof GameEvents>(name: K, opts: WaitOptions = {}): Promise<GameEvents[K]> {
    const timeout = opts.timeout ?? 10_000;
    return new Promise((resolve, reject) => {
      const off = gameEvents.on(name, (p) => {
        window.clearTimeout(timer);
        off();
        resolve(p);
      });
      const timer = window.setTimeout(() => {
        off();
        reject(new Error(`timed out after ${timeout} ms waiting for the "${String(name)}" event`));
      }, timeout);
    });
  }

  /** The world is on screen and playable: a map scene and the UI run, no fade, door or flow in progress. */
  sceneReady(key?: string, opts?: WaitOptions): Promise<string> {
    return this.until(
      () => {
        const w = this.world();
        if (!w || (key && w.scene.key !== key) || !this.ui()) return null;
        if (loose(w)['transitioning'] || w.cameras.main.fadeEffect.isRunning) return null;
        return runtime.inGame && !runtime.busy ? w.scene.key : null;
      },
      `the ${key ?? 'world'} scene to be ready`,
      opts,
    );
  }

  /** A door or scene change has finished (the new map has faded in). */
  transitionDone(opts?: WaitOptions): Promise<string> {
    return this.sceneReady(undefined, opts);
  }

  /** A sheet is open and settled (any sheet, or the named one: "menu", "bin", "npc", "fishing"...). */
  panelOpen(name?: string, opts?: WaitOptions): Promise<string> {
    return this.until(
      () => {
        const open = this.openSheet();
        return open && (!name || open === name) ? open : null;
      },
      name ? `the "${name}" sheet to open` : 'a sheet to open',
      opts,
    );
  }

  /** No sheet is open. */
  panelClosed(opts?: WaitOptions): Promise<true> {
    return this.until(
      () => ![...this.sheets().values()].some((m) => m['isOpen']),
      'every sheet to close',
      opts,
    );
  }

  /**
   * The next Action result (a tool use, a pickup, a placement...) after this call: resolves with the log entry
   * (`ok`, what was marked and what was used). Call it before the input that triggers the action.
   */
  actionDone(opts?: WaitOptions): Promise<ActLog> {
    const before = this.acts;
    return this.until(() => (this.acts > before ? this.lastAct : null), 'an Action result', opts);
  }

  /**
   * Nothing is in motion for `frames` frames in a row: the player stands still (no walk, route, painted row or
   * swing), no input is held, no door or flow runs, and no sheet is sliding.
   */
  idle(frames = 3, opts?: WaitOptions): Promise<true> {
    let quiet = 0;
    return this.until(
      () => {
        const w = this.world();
        const ui = this.ui();
        const busy =
          !w ||
          !!loose(w)['transitioning'] ||
          !!loose(w)['route'] ||
          !!loose(w)['work'] ||
          Number(loose(w)['actionLock'] ?? 0) > 0 ||
          w.cameras.main.fadeEffect.isRunning ||
          inputHub.direction !== null ||
          inputHub.actionHeld ||
          runtime.busy ||
          [...this.sheets().values()].some((m) => ui?.tweens.isTweening(m['root'] as object));
        quiet = busy ? 0 : quiet + 1;
        return quiet >= frames;
      },
      `${frames} idle frames`,
      opts,
    );
  }
}
