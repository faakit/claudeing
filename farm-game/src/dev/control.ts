/**
 * Deterministic control of a running game (debug builds only): the game clock (pause, speed), the engine loop
 * (pause, step N frames), the RNG seed, and jumps in time. Everything works on the live game through Phaser's
 * step events, without touching game code.
 */
import Phaser from 'phaser';
import { game as gameData, mapsData } from '../data';
import { forageCandidates, oreCandidates, weedCandidates } from '../game/farmInfo';
import { runtime } from '../state/runtime';
import { getState } from '../state/store';
import { endDay } from '../systems/day';
import { gameEvents } from '../systems/events';
import { tickTime } from '../systems/time';
import { teleportPlayer, type TiledMapLike } from '../systems/world';
import { mapCacheKey } from '../scenes/PreloadScene';
import { parseClock } from './scenarios';

/** mulberry32: the same generator the game's rules use (systems/rng.ts), for Math.random in dev runs. */
function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const nativeRandom = Math.random;

export class DevControl {
  private clockPaused = false;
  private frozen: {
    day: number;
    season: string;
    year: number;
    minutes: number;
    acc: number;
  } | null = null;
  private clockScale = 1;
  private loopPaused = false;
  private stepTime = 0;
  /** Frames rendered since the dev tools started (the await helpers count on it). */
  frame = 0;
  seedValue: number | null = null;

  constructor(private readonly game: Phaser.Game) {
    game.events.on(Phaser.Core.Events.POST_STEP, (_time: number, delta: number) =>
      this.afterStep(delta),
    );
    game.events.on(Phaser.Core.Events.POST_RENDER, () => this.frame++);
  }

  // ---- the game clock (in-game minutes); the world keeps moving ----

  get clock() {
    return {
      paused: this.clockPaused,
      scale: this.clockScale,
      minutes: getState().time.minutes,
    };
  }

  /** Freeze the in-game clock: minutes stop, the world (movement, input, animation) runs on. */
  pauseClock(): void {
    this.clockPaused = true;
    this.snapshot();
  }

  resumeClock(): void {
    this.clockPaused = false;
    this.frozen = null;
  }

  /** Game-clock speed: 1 is normal, 10 runs a game hour in 3 real seconds. The world moves at normal speed. */
  setClockScale(k: number): void {
    this.clockScale = Math.max(0, Math.min(200, k));
  }

  private snapshot(): void {
    const t = getState().time;
    this.frozen = { day: t.day, season: t.season, year: t.year, minutes: t.minutes, acc: t.acc };
  }

  private afterStep(delta: number): void {
    const s = getState();
    if (this.clockPaused) {
      const f = this.frozen;
      // A new day (sleep, a jump) moves the frozen time with it.
      if (!f || f.day !== s.time.day || f.season !== s.time.season || f.year !== s.time.year) {
        this.snapshot();
        return;
      }
      if (s.time.minutes !== f.minutes) {
        // A jump while paused (setTime) is deliberate when it is far from the frozen minute.
        if (Math.abs(s.time.minutes - f.minutes) > 1) this.snapshot();
        else {
          s.time.minutes = f.minutes;
          s.time.acc = f.acc;
        }
      } else s.time.acc = f.acc;
      return;
    }
    if (this.clockScale !== 1 && runtime.inGame && !runtime.blocked) {
      const extra = Math.min(delta, 100) * (this.clockScale - 1);
      if (extra > 0) tickTime(s, extra);
      // scale < 1: give back part of what the world scene added this frame
      else if (extra < 0) s.time.acc = Math.max(0, s.time.acc + extra);
    }
  }

  // ---- the engine loop ----

  get isLoopPaused(): boolean {
    return this.loopPaused;
  }

  /** Stop the engine (nothing updates or renders) until `resumeLoop` or `step`. */
  pauseLoop(): void {
    if (this.loopPaused) return;
    this.loopPaused = true;
    this.stepTime = this.game.loop.now;
    this.game.loop.sleep();
  }

  resumeLoop(): void {
    if (!this.loopPaused) return;
    this.loopPaused = false;
    this.game.loop.wake();
  }

  /** Run exactly `n` frames of `dtMs` each (pausing the loop first). Synchronous and deterministic. */
  step(n = 1, dtMs = 1000 / 60): number {
    this.pauseLoop();
    for (let i = 0; i < n; i++) {
      this.stepTime += dtMs;
      this.game.step(this.stepTime, dtMs);
    }
    return this.frame;
  }

  // ---- randomness ----

  /** Seed the game's RNG (state.rng) and, for visuals, Math.random and Phaser's RND. */
  seed(n: number): void {
    this.seedValue = n >>> 0;
    getState().rng = this.seedValue;
    Math.random = mulberry(this.seedValue);
    Phaser.Math.RND.sow([String(this.seedValue)]);
  }

  /** Back to the browser's own Math.random (state.rng stays as it is). */
  unseed(): void {
    this.seedValue = null;
    Math.random = nativeRandom;
  }

  // ---- time jumps ----

  /**
   * Set the date or the time of day directly ("18:30" or minutes). Nothing is simulated in between: crops do not
   * grow, nothing is paid. Use `skipDays` to live through days.
   */
  setTime(t: {
    clock?: string;
    minutes?: number;
    day?: number;
    season?: string;
    year?: number;
  }): void {
    const s = getState();
    const m = t.clock !== undefined ? parseClock(t.clock) : t.minutes;
    if (m !== undefined && m !== null)
      s.time.minutes = Math.max(gameData.dayStartMinutes, Math.min(gameData.dayEndMinutes - 1, m));
    if (t.day !== undefined) s.time.day = Math.max(1, Math.min(gameData.seasonLength, t.day));
    if (t.season !== undefined) s.time.season = t.season as typeof s.time.season;
    if (t.year !== undefined) s.time.year = Math.max(1, t.year);
    s.time.acc = 0;
    if (this.clockPaused) this.snapshot();
  }

  /**
   * Live through `n` nights at once (the full day rollover: crops grow, the bin pays, mail and orders arrive),
   * without the sleep screens. The player wakes in bed (`wake`, default) or stays where they are. The world scene
   * restarts so everything redraws.
   */
  skipDays(n = 1, opts: { wake?: boolean } = {}): void {
    const s = getState();
    const cache = this.game.cache.tilemap;
    const farm = cache.get(mapCacheKey('farm'))?.data as TiledMapLike | undefined;
    const forageSpots: Record<string, [number, number][]> = {};
    const oreSpots: Record<string, [number, number][]> = {};
    for (const id of Object.keys(mapsData.maps)) {
      const raw = cache.get(mapCacheKey(id))?.data as TiledMapLike | undefined;
      if (raw) {
        forageSpots[id] = forageCandidates(raw);
        oreSpots[id] = oreCandidates(raw);
      }
    }
    for (let i = 0; i < n; i++)
      endDay(s, {
        passedOut: false,
        weedCandidates: farm ? weedCandidates(farm) : [],
        forageSpots,
        oreSpots,
      });
    s.lastSummary = null;
    if (opts.wake !== false) teleportPlayer(s, mapsData.wake);
    gameEvents.emit('farmChanged', undefined);
    const key = mapsData.maps[s.player.map]?.scene;
    const world = this.game.scene.getScenes(true).find((sc) => 'coachWorld' in sc);
    if (key && world) {
      world.scene.stop();
      this.game.scene.start(key);
    }
  }
}
