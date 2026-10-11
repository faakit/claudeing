import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { audio } from '../platform/audio';
import { TILE_SIZE } from '../config';
import type { GameState } from '../state/GameState';
import { channelKeys, flowReach, wateredByChannels } from '../systems/channels';
import { absoluteDay } from '../systems/time';
import { channelFlow, creekSource } from '../systems/valley';
import {
  clodAt,
  clods,
  DIG_FILL_MS,
  fillRect,
  runStart,
  runStepMs,
  runSteps,
  wetBeside,
  type Clod,
  type RunStep,
  type Side,
} from './channelRun';

/** What the farm renderer offers the channels' juice: hold tiles at their before-the-water look, then let go. */
export interface ChannelLooks {
  /** Show these channel tiles dry and these soil tiles unwatered until released. */
  holdDry(keys: Iterable<string>, redraw?: boolean): void;
  /** Let held tiles show their real look again. */
  release(keys: Iterable<string>): void;
}

/** Where the channel tiles come from in the map's tileset (WorldScene knows the gids and the tileset). */
export interface ChannelTiles {
  /** The tileset's texture key, or null when channels are tinted soil sprites (no detail layer). */
  texture: string | null;
  /** A channel's tile, wet or dug, as a source rect in that texture. */
  src(tx: number, ty: number, look: 'wet' | 'dry'): { x: number; y: number } | null;
}

/** Foam on the water's leading edge, and the spray where it meets a fresh cut (palette light blues). */
const FOAM = 0xd6ecf0;
const SPRAY = [0x72aadc, 0xd6ecf0] as const;
/** A clod rests on the bank this long after landing, then fades in two steps. */
const CLOD_REST_MS = 420;
const CLOD_FADE_MS = 140;
/** The fresh cut sits 1 px proud of the ground for this long, then settles flush. */
const SETTLE_MS = 70;
/** The morning's run waits this long after the map opens (the door wipe clears first). */
const RUN_DELAY_MS = 320;

interface Fill {
  key: string;
  tx: number;
  ty: number;
  from: Side;
  /** ms into this fill (negative: waiting for the water to reach it). */
  t: number;
  ms: number;
  img: Phaser.GameObjects.Image | null;
  foam: Phaser.GameObjects.Image | null;
  src: { x: number; y: number } | null;
  /** Soil beside it that darkens when it is full (the morning's run). */
  beside: string[];
  spray: boolean;
}

interface Flying {
  c: Clod;
  img: Phaser.GameObjects.Image;
  cx: number;
  cy: number;
  t: number;
}

/** The morning's run has played for this state on this day (a new game, load or scenario plays it again). */
const ranOn = new WeakMap<object, number>();

/**
 * The channels' juice (feel lane, M4): the spade's cut throws soil onto both banks and settles; where the cut meets
 * running water, the water runs into it from upstream; and the first time the channels come into view each day,
 * the morning's water runs down the ditch from the creek and the soil beside it darkens as it passes. Everything
 * is whole-pixel images over the map (no Graphics, so the batch holds) and runs off the scene's clock; while a
 * hit-stop holds the tweens it holds too. Calm mode: no clods, no settle, no run; the water is simply there.
 */
export class ChannelFx {
  private fills: Fill[] = [];
  private flying: Flying[] = [];
  private pool: Phaser.GameObjects.Image[] = [];
  private tilePool: Phaser.GameObjects.Image[] = [];
  private age = 0;
  /** The morning run waiting for the channels to come into view: its steps and their bounds. */
  private pending: {
    steps: RunStep[];
    beside: Map<string, string[]>;
    box: Phaser.Geom.Rectangle;
  } | null = null;
  private held = new Set<string>();
  /** Channel tiles before the current action (to find the ones a dig just cut). */
  private before: Set<string> | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly looks: ChannelLooks,
    private readonly tiles: ChannelTiles,
    private readonly calm: () => boolean,
  ) {}

  // ---- the morning's run ----

  /**
   * Called once the farm is built: if the channels watered this morning and the run has not played today, hold the
   * reached channels dry and their watered soil unwatered until the run passes them.
   */
  planMorning(state: GameState): void {
    const day = absoluteDay(state);
    if (ranOn.get(state) === day) return;
    const source = creekSource(state);
    if (!source.running || this.calm()) return;
    const flow = channelFlow(state);
    const reach = flowReach(state, source.at, flow);
    if (!reach.length) return;
    ranOn.set(state, day);
    const steps = runSteps(reach, source.at);
    // rain watered everything anyway: the run still flows, but the soil is not held back
    const watered =
      state.weather === 'rain' || state.weather === 'storm'
        ? []
        : wateredByChannels(state, reach, flow).filter((k) => state.farm.tiles[k]?.watered);
    const beside = wetBeside(steps, watered);
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const s of steps) {
      x0 = Math.min(x0, s.tx);
      y0 = Math.min(y0, s.ty);
      x1 = Math.max(x1, s.tx + 1);
      y1 = Math.max(y1, s.ty + 1);
    }
    const box = new Phaser.Geom.Rectangle(
      x0 * TILE_SIZE,
      y0 * TILE_SIZE,
      (x1 - x0) * TILE_SIZE,
      (y1 - y0) * TILE_SIZE,
    );
    this.hold([...steps.map((s) => s.key), ...[...beside.values()].flat()]);
    this.pending = { steps, beside, box };
  }

  /** The run is waiting for the channels to come into view, or running. */
  get running(): boolean {
    return this.pending !== null || this.fills.length > 0;
  }

  private startRun(): void {
    const run = this.pending!;
    this.pending = null;
    const deepest = run.steps.reduce((m, s) => Math.max(m, s.depth), 0);
    const step = runStepMs(deepest);
    for (const s of run.steps)
      this.addFill(s, -runStart(s, step), step, run.beside.get(s.key) ?? [], false);
  }

  // ---- the spade's cut ----

  /** Before an action with the spade in hand: remember the channels, to find the tiles a dig cuts. */
  beforeAct(state: GameState, holding: string | undefined): void {
    this.before = holding === 'spade' ? new Set(channelKeys(state)) : null;
  }

  /**
   * Right after a dig resolved (before the renderer draws it): the new tiles the water reaches are held dry, to
   * fill on the cut's impact. Returns the cut's new tiles in the water's order.
   */
  afterDig(state: GameState): RunStep[] {
    const before = this.before;
    this.before = null;
    if (!before) return [];
    const source = creekSource(state);
    if (!source.running || this.calm()) return [];
    const reach = flowReach(state, source.at, channelFlow(state));
    const fresh = runSteps(reach, source.at).filter((s) => !before.has(s.key));
    this.hold(
      fresh.map((s) => s.key),
      false, // drawn on the cut's impact frame, as any field change
    );
    return fresh;
  }

  /**
   * The cut's impact on (tx, ty), facing `dir`: soil thrown onto both banks, the cut settling, and the water (if
   * `fresh` holds tiles it reaches) running in from upstream, the bank tile first.
   */
  dig(
    tx: number,
    ty: number,
    dir: 'up' | 'down' | 'left' | 'right',
    fresh: readonly RunStep[],
  ): void {
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE / 2;
    if (!this.calm()) {
      for (const c of clods(dir, Math.random)) {
        const img = this.grab(PX_TEXTURE)
          .setTint(c.color)
          .setScale(c.size / 2)
          .setOrigin(0, 0)
          .setDepth(9000); // over the paint marks, like every particle
        img.setPosition(cx + c.x0, cy + c.y0);
        this.flying.push({ c, img, cx, cy, t: 0 });
      }
      this.settle(tx, ty);
    }
    const base = fresh.length ? fresh.reduce((m, s) => Math.min(m, s.depth), Infinity) : 0;
    for (const s of fresh)
      this.addFill(s, -(s.depth - base) * (DIG_FILL_MS * 0.6), DIG_FILL_MS, [], true);
  }

  /** The fresh cut stands 1 px proud for a moment, then settles flush (its dug tile drawn over itself). */
  private settle(tx: number, ty: number): void {
    const src = this.tiles.texture ? this.tiles.src(tx, ty, 'dry') : null;
    if (!src || !this.tiles.texture) return;
    const img = this.grabTile(this.tiles.texture);
    img.setCrop(src.x, src.y, TILE_SIZE, TILE_SIZE);
    img.setPosition(tx * TILE_SIZE - src.x, ty * TILE_SIZE - src.y - 1).setDepth(0.024);
    this.scene.time.delayedCall(SETTLE_MS, () => this.dropTile(img));
  }

  // ---- shared ----

  private addFill(s: RunStep, t: number, ms: number, beside: string[], spray: boolean): void {
    const tex = this.tiles.texture;
    const src = tex ? this.tiles.src(s.tx, s.ty, 'wet') : null;
    this.fills.push({
      key: s.key,
      tx: s.tx,
      ty: s.ty,
      from: s.from,
      t,
      ms,
      img: null,
      foam: null,
      src,
      beside,
      spray,
    });
  }

  private hold(keys: string[], redraw = true): void {
    for (const k of keys) this.held.add(k);
    this.looks.holdDry(keys, redraw);
  }

  private release(keys: string[]): void {
    const out = keys.filter((k) => this.held.delete(k));
    if (out.length) this.looks.release(out);
  }

  /** One frame. `view` is the camera's world view; nothing advances while a hit-stop holds the tweens. */
  update(delta: number, view: Phaser.Geom.Rectangle): void {
    if (this.scene.tweens.timeScale === 0) return;
    this.age += delta;
    if (this.pending && this.age >= RUN_DELAY_MS) {
      const v = new Phaser.Geom.Rectangle(
        view.x + 8,
        view.y + 8,
        view.width - 16,
        view.height - 16,
      );
      if (Phaser.Geom.Intersects.RectangleToRectangle(v, this.pending.box)) this.startRun();
    }
    if (this.fills.length) this.stepFills(delta);
    if (this.flying.length) this.stepClods(delta);
  }

  private stepFills(delta: number): void {
    const tex = this.tiles.texture;
    const done: Fill[] = [];
    for (const f of this.fills) {
      f.t += delta;
      if (f.t < 0) continue;
      const r = fillRect(f.from, f.t / f.ms, TILE_SIZE, f.spray); // a cut eases, the front runs on
      if (tex && f.src) {
        f.img ??= this.grabTile(tex).setDepth(0.025);
        f.img.setPosition(f.tx * TILE_SIZE - f.src.x, f.ty * TILE_SIZE - f.src.y);
        f.img.setCrop(f.src.x + r.x, f.src.y + r.y, r.w, r.h);
      }
      if (r.edge) {
        f.foam ??= this.grab(PX_TEXTURE).setTint(FOAM).setOrigin(0, 0).setDepth(0.026);
        f.foam.setPosition(f.tx * TILE_SIZE + r.edge.x, f.ty * TILE_SIZE + r.edge.y);
        f.foam.setScale(r.edge.w / 2, r.edge.h / 2);
      }
      if (f.t >= f.ms) done.push(f);
    }
    if (!done.length) return;
    this.fills = this.fills.filter((f) => !done.includes(f));
    for (const f of done) {
      this.release([f.key, ...f.beside]);
      if (f.img) this.dropTile(f.img);
      if (f.foam) this.drop(f.foam);
      if (!this.calm()) {
        const cx = f.tx * TILE_SIZE + TILE_SIZE / 2;
        const cy = f.ty * TILE_SIZE + TILE_SIZE / 2;
        if (f.spray) {
          this.spray(cx, cy, 4);
          audio.play('water');
        }
        // a droplet over each soil tile it watered, as the soil darkens
        for (const k of f.beside) {
          const [x, y] = k.split(',').map(Number) as [number, number];
          this.spray(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 1);
        }
      }
    }
  }

  /** A few drops jump where water arrives (pixel squares on the clods' path maths). */
  private spray(x: number, y: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2 + Math.random();
      const c: Clod = {
        x0: 0,
        y0: 0,
        x1: Math.round(Math.cos(a) * (3 + Math.random() * 3)),
        y1: Math.round(Math.sin(a) * 2),
        h: Math.round(3 + Math.random() * 3),
        ms: Math.round(160 + Math.random() * 80),
        size: 1,
        color: SPRAY[i % SPRAY.length]!,
      };
      const img = this.grab(PX_TEXTURE)
        .setTint(c.color)
        .setScale(0.5)
        .setOrigin(0, 0)
        .setDepth(9000);
      img.setPosition(x, y);
      // drops vanish on landing (no rest on the bank)
      this.flying.push({ c: { ...c, size: -1 }, img, cx: x, cy: y, t: 0 });
    }
  }

  private stepClods(delta: number): void {
    const keep: Flying[] = [];
    for (const f of this.flying) {
      f.t += delta;
      const at = clodAt(f.c, f.t);
      if (at) {
        f.img.setPosition(f.cx + at.x, f.cy + at.y);
        keep.push(f);
        continue;
      }
      if (f.c.size < 0) {
        this.drop(f.img); // a water drop is gone when it lands
        continue;
      }
      // landed: one 1 px hop, a rest on the bank, then two fade steps
      const since = f.t - f.c.ms;
      const hop = since < 60 ? 1 : 0;
      f.img.setPosition(f.cx + f.c.x1, f.cy + f.c.y1 - hop);
      if (since > CLOD_REST_MS + CLOD_FADE_MS) {
        this.drop(f.img);
        continue;
      }
      f.img.setAlpha(
        since > CLOD_REST_MS + CLOD_FADE_MS / 2 ? 0.35 : since > CLOD_REST_MS ? 0.7 : 1,
      );
      keep.push(f);
    }
    this.flying = keep;
  }

  private grab(texture: string): Phaser.GameObjects.Image {
    const img = this.pool.pop() ?? this.scene.add.image(0, 0, texture);
    return img.setTexture(texture).setVisible(true).setActive(true).setAlpha(1).clearTint();
  }

  private grabTile(texture: string): Phaser.GameObjects.Image {
    const img = this.tilePool.pop() ?? this.scene.add.image(0, 0, texture);
    return img.setTexture(texture).setOrigin(0, 0).setVisible(true).setActive(true).setAlpha(1);
  }

  private drop(img: Phaser.GameObjects.Image): void {
    img.setVisible(false).setActive(false);
    this.pool.push(img);
  }

  private dropTile(img: Phaser.GameObjects.Image): void {
    if (!img.scene) return;
    img.setVisible(false).setActive(false);
    this.tilePool.push(img);
  }

  /** Leaving the map: drop everything (the renderer and the images go with the scene; nothing is redrawn). */
  destroy(): void {
    this.held.clear();
    this.pending = null;
    this.fills = [];
    this.flying = [];
  }
}
