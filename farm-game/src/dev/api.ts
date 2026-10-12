/**
 * `window.__farm.dev`: the typed dev API (debug builds only: `npm run dev`, or `?debug` on a build).
 *
 * Quick use from Playwright (see scripts/lib/farm.mjs, which wraps all of this):
 *
 *   await page.goto(`${url}?debug&scenario=ripe-plot`);
 *   await page.waitForFunction(() => window.__farm?.dev?.readyState === 'ready');
 *   await page.evaluate(() => window.__farm.dev.wait.sceneReady());
 *   await page.evaluate(() => window.__farm.dev.wait.actionDone()); // after pressing Action
 */
import type { ActLog } from '../input/controlsLog';
import type { GameState } from '../state/GameState';
import type { GameEvents } from '../systems/events';
import type { WaitOptions } from './waits';

export interface ScenarioInfo {
  name: string;
  title: string;
  about?: string;
  tags?: string[];
}

export interface FrameStats {
  /** Frames per second over the last second. */
  fps: number;
  /** Mean ms between frames over the last 60 frames. */
  frameMs: number;
  /** Mean ms of game JS per frame (update + render submission) over the last 60 frames. */
  jsMs: number;
  /** GL draw calls in the last frame. */
  draws: number;
}

export interface FarmDevApi {
  /** API version: bumped when a call changes shape. */
  readonly version: 1;
  /** 'installing' until the lab is registered and a requested `?scenario=` has started, then 'ready'. */
  readonly readyState: 'installing' | 'ready' | 'error';
  /** The error that stopped installing (readyState 'error'). */
  readonly error: string | null;
  /** Resolves when readyState is 'ready'. */
  ready(): Promise<void>;

  // ---- scenarios ----
  /** Every scenario (src/dev/scenarios/*.json). */
  scenarios(): ScenarioInfo[];
  /** The scenario that was loaded last (null in a normal game). */
  readonly scenario: string | null;
  /**
   * Switch to a scenario now (from the title or mid-game) and resolve when its world is ready. Saves go to memory
   * from then on (the page is a sandbox; your real save is never touched), and the URL gets `scenario=<name>` so a
   * reload reproduces it.
   */
  load(name: string): Promise<void>;
  /** The state a scenario builds, without switching to it. */
  build(name: string): GameState;
  /** True once a scenario ran in this page: saves stay in memory. */
  readonly sandboxed: boolean;

  // ---- deterministic control ----
  clock: {
    /** Freeze the in-game clock (the world keeps moving). */
    pause(): void;
    resume(): void;
    /** Game-clock speed multiplier (1 normal; 60 = a game hour every 30 real seconds / 60). */
    scale(k: number): void;
    get(): { paused: boolean; scale: number; minutes: number };
  };
  loop: {
    /** Stop the engine: nothing updates or renders. */
    pause(): void;
    resume(): void;
    /** Run exactly n frames of dtMs each (pauses the loop first). Returns the frame counter. */
    step(n?: number, dtMs?: number): number;
    readonly paused: boolean;
    /** Frames rendered since the dev tools started. */
    readonly frame: number;
  };
  /** Seed the rules' RNG (state.rng) and Math.random / Phaser's RND for visuals. */
  seed(n: number): void;
  time: {
    /** Set the clock ("18:30" or minutes) and/or the date directly; nothing is simulated in between. */
    set(t: {
      clock?: string;
      minutes?: number;
      day?: number;
      season?: string;
      year?: number;
    }): void;
    /** Live through n nights (full rollover, no sleep screens). The player wakes in bed unless wake is false. */
    skipDays(n?: number, opts?: { wake?: boolean }): void;
  };
  /**
   * Show a map in one of its stages (map stages, M2): sets the valley stats that pick that variant (keeping the rest
   * of the game) and restarts the scene where the player stands. Rejects for a map or variant that does not exist.
   */
  stage(map: string, variant: string): Promise<void>;
  /** Move the player to a map (default: where that map's doors drop you) and restart the scene there. */
  goto(
    map: string,
    tx?: number,
    ty?: number,
    facing?: 'up' | 'down' | 'left' | 'right',
  ): Promise<void>;

  // ---- awaits (each rejects after opts.timeout ms, default 10000) ----
  wait: {
    until<T>(
      pred: () => T | false | null | undefined,
      what: string,
      opts?: WaitOptions,
    ): Promise<T>;
    frames(n?: number, opts?: WaitOptions): Promise<true>;
    event<K extends keyof GameEvents>(name: K, opts?: WaitOptions): Promise<GameEvents[K]>;
    sceneReady(key?: string, opts?: WaitOptions): Promise<string>;
    transitionDone(opts?: WaitOptions): Promise<string>;
    panelOpen(name?: string, opts?: WaitOptions): Promise<string>;
    panelClosed(opts?: WaitOptions): Promise<true>;
    /** The next Action result after this call (start waiting before the input). */
    actionDone(opts?: WaitOptions): Promise<ActLog>;
    idle(frames?: number, opts?: WaitOptions): Promise<true>;
  };
  /** The open sheet's name once settled, or null. */
  openSheet(): string | null;

  // ---- geometry ----
  /** Logical (200x400 canvas) screen point of a world tile's centre, from the live camera. */
  tileToScreen(tx: number, ty: number): { x: number; y: number } | null;
  /** World tile under a logical screen point. */
  screenToTile(x: number, y: number): { tx: number; ty: number } | null;

  // ---- dev menu and overlays ----
  menu: { open(): void; close(): void; toggle(): void; readonly isOpen: boolean };
  overlay: { fps(on?: boolean): boolean; tiles(on?: boolean): boolean };
  /** FPS, frame time, JS ms and draw calls (measured while the dev tools run). */
  frameStats(): FrameStats;
  /**
   * Towing's taps and times for the current log, on the lab's spike (`tow-spike`) or the town river (`tow-first-log`),
   * or null where nothing tows.
   */
  tow(): import('../game/TowController').TowMetrics | null;
}
