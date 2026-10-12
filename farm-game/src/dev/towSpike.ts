/**
 * The towing spike (docs/MILESTONES.md M7, "Spike first"): drift timber on a lab water lane, hooked from the bank
 * with a rope, towed along the bank, tugged off a snag and landed at a slip. Two lanes (scripts/generate-lab-map.mjs
 * writes them into the lab map): `spike`, the first short lane on the showcase's south shore, and `long`, about 18
 * tiles that run south from a head below the farmer, turn west and turn south again to a slip at the bottom.
 * Everything is taps and one thumb:
 *
 * - tap the log (or the water within about 1.5 tiles of it): the farmer walks to the nearest bank in reach and hooks
 *   it on arrival. A tap on the bank while nothing is hooked walks there as usual;
 * - tap where it should go (a bank tile, or the water, which resolves to the bank beside it): the farmer walks along
 *   the bank and the log follows on its 3-tile rope, lagging and swinging round turns. A tap within two tiles of the
 *   slip means the slip (a thumb taps near it while the camera scrolls);
 * - it catches on a snag: the log stops, tilts and bobs, the rope goes taut and the farmer stops at the rope's
 *   length; Action or any tap tugs it free (it pops a tile past the rock) and the walk resumes toward the last tow
 *   goal, whatever set it (critic T1 ruling);
 * - standing within two tiles of the slip with the log free, he hauls it in, and it lands: lifted onto the planks
 *   and dropped, dust and drips, "+1 Timber".
 *
 * Action is the one-thumb route through the whole verb while towing's context is live (systems/towing actionVerb):
 * it hooks a log in view, sends a free hooked log home to the slip, and tugs; the Action button shows the verb's
 * icon meanwhile. The stick works too. Debug builds only: the lab scene runs it when the scenario sets the stat
 * `lab.towSpike` (`lab.towLane` 2 picks the long lane, `lab.towLong` a long log, two tugs). The rules are
 * `systems/towing.ts`; this file is presentation, input and the spike's own placeholder art.
 */
import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { TILE_SIZE } from '../config';
import type { Effects } from '../fx/Effects';
import { inputHub } from '../input/InputHub';
import { audio, SFX_IDS, type Sfx } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { Direction } from '../state/GameState';
import { getState } from '../state/store';
import {
  actionVerb,
  atSlip,
  atSlipBank,
  bankFor,
  drift,
  follow,
  halfExtents,
  haul,
  hookStand,
  inReach,
  land,
  makeLog,
  meansSlip,
  nearestBank,
  ROPE_PX,
  tug,
  type Log,
  type TowState,
  type TowVerb,
  type TowWorld,
} from '../systems/towing';
import { labMap, type TowLaneDef } from './labDef';

/** What the spike needs from its scene (LabScene passes its WorldScene powers). */
export interface TowHost {
  scene: Phaser.Scene;
  fx: Effects;
  walkTo(t: { tx: number; ty: number }, face: Direction | null, done?: () => void): boolean;
  stopWalk(): void;
  readonly walking: boolean;
  readonly walkGoal: { tx: number; ty: number } | null;
  walkable(tx: number, ty: number): boolean;
  readonly farmer: Phaser.GameObjects.Sprite;
  /** Action would act on something in front of the farmer (a ripe crop, a forage good...). */
  readonly actionInFront: boolean;
}

const WATER_ID = 5;
type Tile = { tx: number; ty: number };
type Rect = [number, number, number, number];
const inRect = ([x, y, w, h]: Rect, tx: number, ty: number): boolean =>
  tx >= x && tx < x + w && ty >= y && ty < y + h;

/** Timings (ms): the rope's throw, a tug's pop, the landing (lift, then the drop at `drop`). */
const T = {
  throw: 120,
  pop: 170,
  lean: 110,
  land: 340,
  drop: 230,
  respawn: 1400,
  fadeIn: 300,
  ripple: 700,
  /** An idle farmer with an unreached tow goal walks on after this (never a stall that needs another tap). */
  resume: 250,
} as const;
/** Rope: a 1 px dot every this many px (a solid line); the sag of a slack rope per px of slack, and its most. */
const ROPE_DOT_PX = 1;
const SAG_PER_PX = 0.5;
const SAG_MAX = 9;
const ROPE_COLOR = 0x7c442c; // soil, from the palette: a dark line that reads on water and on the sandy bank
const FOAM_COLOR = 0xf4ead2;
/** A water tap this near a drifting log (px from its centre) hooks it (critic ruling 4). */
const HOOK_TAP_PX = 24;

type Phase = 'drift' | 'hooking' | 'towing' | 'hauling' | 'landing' | 'landed';

/** Where a tow walk is going: a tile, or the slip (its stand is worked out when walked, from where he is). */
type Goal = { slip: true } | { slip: false; tx: number; ty: number };

/** Tap counts and times of the current log, from the first input to its landing (`__farm.dev.tow()`). */
export interface TowMetrics {
  /** The lane: 'spike' or 'long'. */
  lane: string;
  /** The log's way from the spawn to the slip, in tiles. */
  laneTiles: number;
  slip: { bank: Tile; water: Tile };
  snags: Tile[];
  spawn: Tile;
  taps: number;
  actions: number;
  tugs: number;
  firstInputAt: number | null;
  hookedAt: number | null;
  landedAt: number | null;
  /** First input to landing, ms (null until landed). */
  ms: number | null;
  landed: number;
  phase: Phase;
  state: TowState | 'none';
  /** What Action would do now (systems/towing actionVerb). */
  verb: TowVerb;
  /** The tow walk's goal ('slip', a tile, or null). */
  goal: 'slip' | Tile | null;
  log: { x: number; y: number; snagged: boolean; hooked: boolean; axis: 'h' | 'v' };
}

const cue = (name: string, fallback: Sfx): void =>
  audio.play((SFX_IDS as readonly string[]).includes(name) ? (name as Sfx) : fallback);

const VERB_ICON: Record<NonNullable<TowVerb>, string> = {
  hook: 'tow_icon_hook',
  home: 'tow_icon_home',
  busy: 'tow_icon_home',
  tug: 'tow_icon_tug',
};

export class TowSpike {
  private log: Log;
  private phase: Phase = 'drift';
  private state: TowState | 'none' = 'none';
  private now = 0;
  private logImg: Phaser.GameObjects.Image;
  private dots: Phaser.GameObjects.Image[] = [];
  private foam: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  private replans = 0;
  /** How far the farmer may stand from a snagged log (the distance when it caught). */
  private snagMax: number | null = null;
  /** A tow destination tapped while walking to hook the log. */
  private afterHook: Goal | null = null;
  /** The last tow goal (from a tap, the hook walk's chained tap, or Action): walked to until reached. */
  private goal: Goal | null = null;
  private idleSince: number | null = null;
  private resumes = 0;
  private ropeAt = 0;
  private pop: { fx: number; fy: number; at: number } | null = null;
  private leanUntil = 0;
  private leanDir = 0;
  private landAt = 0;
  private landFrom = { x: 0, y: 0 };
  private dropped = false;
  private respawnAt = 0;
  private spawnedAt = 0;
  private rippleAt = 0;
  private verb: TowVerb = null;
  readonly metrics: TowMetrics;
  private readonly world: TowWorld;
  private readonly lane: TowLaneDef;
  private readonly laneId: string;
  private readonly slip: { bank: Tile; water: Tile };

  constructor(
    private readonly host: TowHost,
    private readonly long = false,
    laneId = 'spike',
  ) {
    const L = labMap;
    this.laneId = L.tow[laneId] ? laneId : 'spike';
    this.lane = L.tow[this.laneId]!;
    const lane = this.lane;
    const snags = new Set(lane.snags.map(([x, y]) => `${x},${y}`));
    this.world = {
      water: (tx, ty) =>
        tx >= 0 && ty >= 0 && tx < L.w && ty < L.h && L.ground[ty * L.w + tx] === WATER_ID,
      snag: (tx, ty) => snags.has(`${tx},${ty}`),
    };
    this.slip = {
      bank: { tx: lane.slip.bank[0], ty: lane.slip.bank[1] },
      water: { tx: lane.slip.water[0], ty: lane.slip.water[1] },
    };
    makeTextures(host.scene);
    const s = host.scene;
    for (const [tx, ty] of lane.snags)
      this.props.push(
        s.add
          .image(tx * TILE_SIZE, ty * TILE_SIZE, 'tow_rock')
          .setOrigin(0, 0)
          .setDepth(1),
      );
    this.props.push(
      s.add
        .image(this.slip.bank.tx * TILE_SIZE, this.slip.bank.ty * TILE_SIZE, 'tow_slip')
        .setOrigin(0, 0)
        .setDepth(0.9),
    );
    this.log = this.newLog();
    this.logImg = s.add.image(this.log.x, this.log.y, this.texFor(false)).setDepth(1.2);
    this.metrics = this.freshMetrics(0);
  }

  private newLog(): Log {
    const sp = this.lane.spawn;
    return makeLog(sp.tx * TILE_SIZE + 8, sp.ty * TILE_SIZE + 8, this.long, sp.axis);
  }

  private freshMetrics(landed: number): TowMetrics {
    const sp = this.lane.spawn;
    return {
      lane: this.laneId,
      laneTiles: this.lane.tiles,
      slip: { bank: { ...this.slip.bank }, water: { ...this.slip.water } },
      snags: this.lane.snags.map(([tx, ty]) => ({ tx, ty })),
      spawn: { tx: sp.tx, ty: sp.ty },
      taps: 0,
      actions: 0,
      tugs: 0,
      firstInputAt: null,
      hookedAt: null,
      landedAt: null,
      ms: null,
      landed,
      phase: 'drift',
      state: 'none',
      verb: null,
      goal: null,
      log: {
        x: this.log.x,
        y: this.log.y,
        snagged: false,
        hooked: false,
        axis: this.log.axis,
      },
    };
  }

  private hands(): { x: number; y: number } {
    const p = getState().player;
    return { x: p.x, y: p.y - 6 };
  }

  private input(kind: 'taps' | 'actions'): void {
    this.metrics[kind]++;
    this.metrics.firstInputAt ??= this.now;
  }

  // ---- input ----

  /** A tap on the world (world px). True when the spike took it. */
  onTap(wx: number, wy: number): boolean {
    if (this.phase === 'landing' || this.phase === 'landed') return false;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    const water = this.world.water(tx, ty) || this.world.snag(tx, ty);
    if (this.log.snag) {
      // the rope holds: any tap on the world tugs rather than doing nothing
      this.input('taps');
      return this.doTug();
    }
    if (this.phase === 'drift' || this.phase === 'hooking') {
      const nearLog =
        this.onLog(wx, wy) ||
        (water && Math.hypot(wx - this.log.x, wy - this.log.y) <= HOOK_TAP_PX);
      if (nearLog) {
        this.input('taps');
        return this.startHook(false);
      }
      if (this.phase === 'hooking') {
        // on the way to hook it: where to tow it next, walked to the moment it is hooked
        const dest = this.towGoal(tx, ty);
        if (!dest) return false;
        this.input('taps');
        this.afterHook = dest;
        audio.play('target');
        haptic('tick');
        return true;
      }
      // nothing hooked: a bank tap walks as usual (the scene's own tap); a water tap walks to the bank beside it
      if (!water) return false;
      const bank = bankFor(tx, ty, (x, y) => this.host.walkable(x, y), this.world.water);
      if (!bank) return false;
      this.input('taps');
      return this.host.walkTo(bank, null);
    }
    // hooked and free (towing or hauling in)
    const dest = this.onLog(wx, wy) ? this.besideLog() : this.towGoal(tx, ty);
    if (!dest) return false;
    this.input('taps');
    return this.goTo(dest);
  }

  /** Action pressed. True when the spike took it (towing's context is live: systems/towing actionVerb). */
  onAction(): boolean {
    const verb = this.actionVerbNow();
    if (!verb) return false;
    this.input('actions');
    if (verb === 'tug') return this.doTug();
    if (verb === 'home') return this.goTo({ slip: true });
    if (verb === 'busy') {
      haptic('tick');
      return true;
    }
    // hook: in reach at once, else walk to it
    return this.startHook(false);
  }

  private actionVerbNow(): TowVerb {
    if (this.phase === 'landing' || this.phase === 'landed') return null;
    const v = this.host.scene.cameras.main.worldView;
    const lx = this.log.x;
    const ly = this.log.y;
    const logInView = lx >= v.x + 4 && lx <= v.right - 4 && ly >= v.y + 4 && ly <= v.bottom - 4;
    const homing = this.phase === 'hauling' || (this.goal?.slip === true && this.host.walking);
    return actionVerb({
      hooked: this.log.hooked,
      snagged: !!this.log.snag,
      homing,
      logInView,
      waterDist: this.waterDist(),
      front: this.host.actionInFront,
    });
  }

  /** Tiles from the farmer to the lane's nearest water tile (either axis). */
  private waterDist(): number {
    const f = this.farmerTile();
    let best = Infinity;
    for (const [x, y, w, h] of this.lane.water) {
      const dx = Math.max(x - f.tx, 0, f.tx - (x + w - 1));
      const dy = Math.max(y - f.ty, 0, f.ty - (y + h - 1));
      best = Math.min(best, Math.max(dx, dy));
    }
    return best;
  }

  /** A forgiving hit test on the log (8 px round it). */
  private onLog(wx: number, wy: number): boolean {
    if (this.phase === 'landing' || this.phase === 'landed') return false;
    const { hx, hy } = halfExtents(this.log);
    return Math.abs(wx - this.log.x) <= hx + 8 && Math.abs(wy - this.log.y) <= hy + 8;
  }

  /**
   * What a tap on this tile means as a tow destination: the slip (within two tiles of it), a bank tile, or null. A
   * tap on solid land (a hedge, a wall) means the nearest walkable bank, out to 8 tiles, the slip's way of the
   * nearest (feel critic T5: while a log is hooked no world tap is silent).
   */
  private towGoal(tx: number, ty: number): Goal | null {
    if (meansSlip({ tx, ty }, this.slip)) return { slip: true };
    if (!this.host.walkable(tx, ty) && !this.world.water(tx, ty) && !this.world.snag(tx, ty)) {
      // solid land (the hedge round the lane): the nearest walkable bank, the slip's way of the nearest (T5)
      const bank = nearestBank(tx, ty, (x, y) => this.host.walkable(x, y), this.slip.bank);
      if (!bank) return null;
      return meansSlip(bank, this.slip) ? { slip: true } : { slip: false, ...bank };
    }
    const water = this.world.water(tx, ty) || this.world.snag(tx, ty);
    const bank = water
      ? bankFor(tx, ty, (x, y) => this.host.walkable(x, y), this.world.water)
      : this.host.walkable(tx, ty)
        ? { tx, ty }
        : null;
    if (!bank) return null;
    if (meansSlip(bank, this.slip)) return { slip: true };
    return { slip: false, ...bank };
  }

  /** The bank beside the log (a tap on a towed log: come closer to it). */
  private besideLog(): Goal | null {
    const b = bankFor(
      Math.floor(this.log.x / TILE_SIZE),
      Math.floor(this.log.y / TILE_SIZE),
      (x, y) => this.host.walkable(x, y),
      this.world.water,
    );
    return b ? { slip: false, ...b } : null;
  }

  /** Set the tow goal and walk to it (a tap always wins over an earlier goal). */
  private goTo(g: Goal): boolean {
    this.goal = g;
    this.resumes = 0;
    const t = this.goalTile(g);
    if (this.atGoal(t)) return true;
    return this.host.walkTo(t, null);
  }

  /**
   * A goal's tile. The slip's planks are where the log lands, so the slip's stand is beside them, on the side the
   * farmer comes from (he never stands where the log will drop).
   */
  private goalTile(g: Goal): Tile {
    if (!g.slip) return { tx: g.tx, ty: g.ty };
    const b = this.slip.bank;
    const here = this.farmerTile();
    const side = here.tx >= b.tx ? 1 : -1;
    for (const c of [
      { tx: b.tx + side, ty: b.ty },
      { tx: b.tx - side, ty: b.ty },
      { tx: b.tx, ty: b.ty - 1 },
      { tx: b.tx, ty: b.ty + 1 },
    ])
      if (this.host.walkable(c.tx, c.ty)) return c;
    return { ...b };
  }

  private atGoal(t: Tile): boolean {
    const f = this.farmerTile();
    return f.tx === t.tx && f.ty === t.ty;
  }

  private startHook(replan: boolean): boolean {
    const p = getState().player;
    const from = { tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor((p.y - 3) / TILE_SIZE) };
    if (inReach(this.hands(), this.log)) {
      this.hook();
      return true;
    }
    const stand = hookStand(this.log, from, (x, y) => this.host.walkable(x, y));
    if (!stand || !this.host.walkTo(stand, faceToward(stand, this.log))) {
      haptic('error');
      return false;
    }
    this.phase = 'hooking';
    // a replan keeps a destination chained on the way (it used to drop it: the critic's stall before the snag)
    if (!replan) this.replans = 0;
    return true;
  }

  private hook(): void {
    this.host.stopWalk();
    const next = this.afterHook;
    this.afterHook = null;
    this.log.hooked = true;
    this.phase = 'towing';
    this.ropeAt = this.now;
    this.metrics.hookedAt = this.now;
    if (next) this.goTo(next);
    cue('logHook', 'swing');
    haptic('tick');
  }

  private doTug(): boolean {
    const before = { x: this.log.x, y: this.log.y };
    const r = tug(this.world, this.log);
    if (!r) return false;
    if (r.freed) this.snagMax = null;
    this.metrics.tugs++;
    const h = this.hands();
    this.leanDir = Math.sign(h.x - this.log.x) || 1;
    this.leanUntil = this.now + T.lean;
    if (!r.freed) {
      // a long log gives a little on the first tug
      cue('logTug', 'swing');
      haptic('tick');
      this.pop = { fx: before.x, fy: before.y, at: this.now - T.pop / 2 };
      return true;
    }
    this.pop = { fx: before.x, fy: before.y, at: this.now };
    cue('logTug', 'swing');
    haptic('medium');
    this.host.scene.time.delayedCall(T.pop, () => {
      if (!this.host.scene.sys.isActive()) return;
      this.host.fx.splash(this.log.x, this.log.y);
      audio.play('water');
      // walk on toward the last tow goal, whatever set it (critic T1 ruling)
      if (this.goal) this.goTo(this.goal);
    });
    return true;
  }

  // ---- the frame ----

  update(delta: number): void {
    this.now += delta;
    const h = this.hands();
    const log = this.log;
    if (this.phase === 'drift' || this.phase === 'hooking') {
      const ftx = Math.floor(log.x / TILE_SIZE);
      const fty = Math.floor(log.y / TILE_SIZE);
      drift(this.world, log, this.flowAt(ftx, fty), delta);
      if (this.lane.end.some((r) => inRect(r, ftx, fty))) this.respawn();
    }
    if (this.phase === 'hooking') {
      // in reach on the way: hook at once (fewer seconds); stopped short (it drifted): plan again
      if (inReach(h, log, 4)) this.hook();
      else if (!this.host.walking) {
        if (this.replans++ < 3) this.startHook(true);
        else this.phase = 'drift';
      }
    }
    if (this.phase === 'towing') {
      const was = this.state;
      this.state = follow(this.world, log, h, delta, this.alongAt(log));
      if (this.state === 'snagged') {
        if (was !== 'snagged') {
          cue('logKnock', 'till');
          haptic('tick');
          this.rippleAt = this.now;
          this.host.fx.ripple(log.x, log.y);
        } else if (this.now - this.rippleAt >= T.ripple) {
          this.rippleAt = this.now;
          this.host.fx.ripple(log.x, log.y);
        }
        this.holdFarmer(h);
      }
      if (atSlip(log, this.slip.water)) this.startLanding();
      else if (!log.snag && !this.host.walking && atSlipBank(this.farmerTile(), this.slip.bank)) {
        // standing at the slip (within two tiles): he hauls the log in, hand over hand
        this.phase = 'hauling';
      } else this.keepGoing();
    }
    if (this.phase === 'hauling') {
      if (this.host.walking) this.phase = 'towing';
      else {
        this.state = 'taut';
        const r = haul(this.world, log, this.slip.water, delta);
        if (r === 'arrived') this.startLanding();
        else if (r === 'snagged') this.phase = 'towing';
      }
    }
    if (this.phase === 'landing') this.stepLanding();
    if (this.phase === 'landed' && this.now >= this.respawnAt) this.respawn();
    this.verb = this.actionVerbNow();
    inputHub.actionIcon = this.verb ? VERB_ICON[this.verb] : null;
    this.render(h);
    const m = this.metrics;
    m.phase = this.phase;
    m.state = this.state;
    m.verb = this.verb;
    m.goal = this.goal ? (this.goal.slip ? 'slip' : { tx: this.goal.tx, ty: this.goal.ty }) : null;
    m.log = {
      x: Math.round(log.x),
      y: Math.round(log.y),
      snagged: !!log.snag,
      hooked: log.hooked,
      axis: log.axis,
    };
  }

  /**
   * Never a stall: an idle farmer with a free log and a tow goal he has not reached walks on toward it (a walk cut
   * by the snag, or one that ended early). A reached goal is done.
   */
  private keepGoing(): void {
    if (this.host.walking || this.log.snag || !this.goal) {
      this.idleSince = null;
      return;
    }
    const t = this.goalTile(this.goal);
    if (this.atGoal(t)) {
      this.goal = null;
      this.idleSince = null;
      return;
    }
    this.idleSince ??= this.now;
    if (this.now - this.idleSince < T.resume || this.resumes >= 3) return;
    this.resumes++;
    this.idleSince = null;
    this.host.walkTo(t, null);
  }

  /** The current where a tile is (px/s). */
  private flowAt(tx: number, ty: number): { x: number; y: number } {
    for (const f of this.lane.flow) if (inRect(f.rect, tx, ty)) return { x: f.x, y: f.y };
    return { x: 0, y: 0 };
  }

  /** The lane's downstream direction at the log (a unit vector), or null off the lane's current. */
  private alongAt(log: Log): { x: number; y: number } | null {
    const f = this.flowAt(Math.floor(log.x / TILE_SIZE), Math.floor(log.y / TILE_SIZE));
    const d = Math.hypot(f.x, f.y);
    return d ? { x: f.x / d, y: f.y / d } : null;
  }

  private farmerTile(): Tile {
    const p = getState().player;
    return { tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor((p.y - 3) / TILE_SIZE) };
  }

  /**
   * Snagged: the farmer cannot walk further than the rope (held where it caught, never pulled back); a walk is cut
   * there, and resumes toward the tow goal after the tug. He is held along the line he walks (his row or his
   * column), so a resumed walk never steps sideways first (critic T3: a north-facing frame after the tug).
   */
  private holdFarmer(h: { x: number; y: number }): void {
    const d = Math.hypot(h.x - this.log.x, h.y - this.log.y);
    this.snagMax ??= Math.max(ROPE_PX + 4, d);
    const max = this.snagMax;
    if (d <= max) return;
    if (this.host.walking) this.host.stopWalk();
    const p = getState().player;
    const dx = h.x - this.log.x;
    const dy = h.y - this.log.y;
    // keep his row (solve x) or his column (solve y), whichever moves him less
    const opts: { x: number; y: number }[] = [];
    if (Math.abs(dy) < max) {
      const ax = Math.sqrt(max * max - dy * dy);
      opts.push({ x: this.log.x + Math.sign(dx || 1) * ax, y: p.y });
    }
    if (Math.abs(dx) < max) {
      const ay = Math.sqrt(max * max - dx * dx);
      opts.push({ x: p.x, y: this.log.y + Math.sign(dy || 1) * ay + 6 });
    }
    opts.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const n = opts[0];
    if (n && this.host.walkable(Math.floor(n.x / TILE_SIZE), Math.floor((n.y - 3) / TILE_SIZE))) {
      p.x = n.x;
      p.y = n.y;
    }
  }

  private startLanding(): void {
    this.phase = 'landing';
    this.landAt = this.now;
    this.landFrom = { x: this.log.x, y: this.log.y };
    this.dropped = false;
    this.goal = null;
    this.host.stopWalk();
  }

  private stepLanding(): void {
    const t = this.now - this.landAt;
    if (!this.dropped && t >= T.drop) {
      this.dropped = true;
      const n = land(this.log);
      const at = this.landPoint();
      this.host.fx.dust(at.x, at.y);
      this.host.fx.splash(this.landFrom.x, this.landFrom.y);
      this.host.fx.floatText(at.x, at.y - 26, `+${n} Timber`, 0xf4ead2);
      cue('logLand', 'till');
      haptic('success');
      this.metrics.landedAt = this.now;
      this.metrics.ms =
        this.metrics.firstInputAt === null ? null : this.now - this.metrics.firstInputAt;
      this.metrics.landed++;
    }
    if (t >= T.land) {
      this.phase = 'landed';
      this.respawnAt = this.now + T.respawn;
    }
  }

  private landPoint(): { x: number; y: number } {
    return { x: this.slip.bank.tx * TILE_SIZE + 8, y: this.slip.bank.ty * TILE_SIZE + 10 };
  }

  private respawn(): void {
    this.log = this.newLog();
    this.phase = 'drift';
    this.state = 'none';
    this.pop = null;
    this.goal = null;
    this.afterHook = null;
    this.snagMax = null;
    this.spawnedAt = this.now;
    this.logImg.setAlpha(1);
    Object.assign(this.metrics, this.freshMetrics(this.metrics.landed));
  }

  // ---- drawing (whole pixels; images only, so the batch holds) ----

  private texFor(tilt: boolean): string {
    return `tow_log${this.long ? '_long' : ''}${this.log.axis === 'v' ? '_v' : ''}${tilt ? '_tilt' : ''}`;
  }

  private render(h: { x: number; y: number }): void {
    const log = this.log;
    let x = log.x;
    let y = log.y;
    let tilt = false;
    let alpha = 1;
    if (this.pop) {
      // the pop: from where it was caught to past the snag, in a 4 px hop
      const u = Math.min(1, (this.now - this.pop.at) / T.pop);
      x = this.pop.fx + (log.x - this.pop.fx) * u;
      y = this.pop.fy + (log.y - this.pop.fy) * u - 4 * 4 * u * (1 - u);
      if (u >= 1) this.pop = null;
    } else if (log.snag) {
      // caught: tilted, bobbing a pixel
      tilt = true;
      y += Math.floor(this.now / 220) % 2;
    } else if (this.phase === 'landing' || this.phase === 'landed') {
      const t = Math.min(1, (this.now - this.landAt) / T.drop);
      const to = this.landPoint();
      x = this.landFrom.x + (to.x - this.landFrom.x) * t;
      // lifted out (up 6 px over the water's edge), then dropped onto the planks
      y = this.landFrom.y + (to.y - 1 - this.landFrom.y) * t - 6 * Math.sin(Math.PI * t);
      if (this.phase === 'landed') {
        const left = this.respawnAt - this.now;
        alpha = left < 300 ? Math.round((left / 300) * 3) / 3 : 1;
      }
    } else if (this.phase === 'drift' || this.phase === 'hooking') {
      y += Math.floor(this.now / 500) % 2 ? 0 : -1; // floating
      // a new log comes into the lane in three steps
      const u = (this.now - this.spawnedAt) / T.fadeIn;
      if (u < 1) alpha = Math.max(1, Math.ceil(u * 3)) / 3;
    }
    this.logImg
      .setTexture(this.texFor(tilt))
      .setPosition(Math.round(x), Math.round(y))
      .setAlpha(alpha);
    this.logImg.setDepth(this.phase === 'landing' || this.phase === 'landed' ? 10 + y + 4 : 1.2);
    // the farmer leans back on a tug
    if (this.now < this.leanUntil) this.host.farmer.x += this.leanDir;
    this.drawRope(h, x, y);
    this.drawFoam(Math.round(x), Math.round(y));
  }

  /** Caught: a 1 px foam crest where the log presses on the snag, flickering with the bob (reads without text). */
  private drawFoam(x: number, y: number): void {
    const s = this.log.snag;
    let n = 0;
    if (s && !this.pop) {
      const { hx, hy } = halfExtents(this.log);
      // the end that presses on the snag, toward the snag tile's centre
      const cx = s.tx * TILE_SIZE + 8;
      const cy = s.ty * TILE_SIZE + 8;
      const ex = this.log.axis === 'h' ? x + Math.sign(cx - x) * (hx + 1) : x;
      const ey = this.log.axis === 'v' ? y + Math.sign(cy - y) * (hy + 1) : y;
      const phase = Math.floor(this.now / 220) % 2;
      const pts: [number, number][] =
        this.log.axis === 'h'
          ? [
              [ex, ey - 2 - phase],
              [ex, ey + 2 + phase],
              [ex + Math.sign(cx - x), ey],
            ]
          : [
              [ex - 2 - phase, ey],
              [ex + 2 + phase, ey],
              [ex, ey + Math.sign(cy - y)],
            ];
      for (const [px, py] of pts) {
        const dot = (this.foam[n] ??= this.host.scene.add
          .image(0, 0, PX_TEXTURE)
          .setOrigin(0, 0)
          .setScale(0.5)
          .setTint(FOAM_COLOR));
        dot.setVisible(true).setPosition(px, py).setDepth(1.3);
        n++;
      }
    }
    for (let i = n; i < this.foam.length; i++) this.foam[i]!.setVisible(false);
  }

  private drawRope(h: { x: number; y: number }, lx: number, ly: number): void {
    const hooked = this.log.hooked && (this.phase === 'towing' || this.phase === 'hauling');
    let n = 0;
    if (hooked) {
      const d = Math.hypot(lx - h.x, ly - h.y);
      const taut = !!this.log.snag || d >= ROPE_PX - 1 || this.now < this.leanUntil;
      const sag = taut ? 0 : Math.min(SAG_MAX, (ROPE_PX - d) * SAG_PER_PX);
      // the throw: the rope runs out from the hands to the log
      const reach = Math.min(1, (this.now - this.ropeAt) / T.throw);
      const count = Math.max(2, Math.floor((d * reach) / ROPE_DOT_PX));
      const mx = (h.x + lx) / 2;
      const my = (h.y + ly) / 2 + sag;
      const depth = 10 + getState().player.y - 1;
      for (let i = 1; i < count; i++) {
        const u = (i / count) * reach;
        // a quadratic through the sagging middle
        const px = (1 - u) * (1 - u) * h.x + 2 * (1 - u) * u * mx + u * u * lx;
        const py = (1 - u) * (1 - u) * h.y + 2 * (1 - u) * u * my + u * u * ly;
        const dot = (this.dots[n] ??= this.host.scene.add
          .image(0, 0, PX_TEXTURE)
          .setOrigin(0, 0)
          .setScale(0.5)
          .setTint(ROPE_COLOR));
        dot.setVisible(true).setPosition(Math.round(px), Math.round(py)).setDepth(depth);
        n++;
      }
    }
    for (let i = n; i < this.dots.length; i++) this.dots[i]!.setVisible(false);
  }

  destroy(): void {
    inputHub.actionIcon = null;
    this.logImg.destroy();
    for (const d of this.dots) d.destroy();
    for (const d of this.foam) d.destroy();
    for (const p of this.props) p.destroy();
    this.dots = [];
    this.foam = [];
  }
}

function faceToward(t: Tile, log: Log): Direction {
  const dx = log.x - (t.tx * TILE_SIZE + 8);
  const dy = log.y - (t.ty * TILE_SIZE + 8);
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

/**
 * The spike's placeholder art, palette colours, drawn once: a log (short, long; lying east-west or north-south;
 * tilted when caught), a rock, a slip, and the Action button's towing icons (hook, home, tug).
 */
function makeTextures(scene: Phaser.Scene): void {
  const make = (key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) => {
    if (scene.textures.exists(key)) return;
    const t = scene.textures.createCanvas(key, w, h);
    if (!t) return;
    draw(t.getContext());
    t.refresh();
  };
  const INK = '#2a1a24';
  const BARK = '#7c442c';
  const WOOD = '#b47c4c';
  const SAND = '#dcb47c';
  const STEEL = '#aeb0b4';
  const CREAM = '#f4ead2';
  /** One pixel of a log lying east-west at (x, y), or north-south (the same, turned a quarter). */
  const logArt =
    (len: number, tilt: boolean, vertical: boolean) => (c: CanvasRenderingContext2D) => {
      const put = (x: number, y: number, w: number, h: number, color: string) => {
        c.fillStyle = color;
        if (vertical) c.fillRect(8 - y - h + 1, x, h, w);
        else c.fillRect(x, y, w, h);
      };
      // a round log: ink outline, bark, a lit top line, sawn ends; tilted = one end dipped 2 px
      for (let x = 0; x < len; x++) {
        const dy = tilt && x >= len / 2 ? 2 : 0;
        put(x, dy, 1, 7, INK);
        if (x === 0 || x === len - 1) continue;
        put(x, dy + 1, 1, 5, BARK);
        put(x, dy + 1, 1, 1, WOOD);
      }
      for (const ex of [1, len - 3]) {
        const dy = tilt && ex >= len / 2 ? 2 : 0;
        put(ex, dy + 2, 2, 3, SAND);
        put(ex + (ex === 1 ? 0 : 1), dy + 3, 1, 1, BARK);
      }
    };
  for (const [len, name] of [
    [16, 'tow_log'],
    [30, 'tow_log_long'],
  ] as const)
    for (const tilt of [false, true]) {
      const t = tilt ? '_tilt' : '';
      make(`${name}${t}`, len, 9, logArt(len, tilt, false));
      make(`${name}_v${t}`, 9, len, logArt(len, tilt, true));
    }
  make('tow_rock', 16, 16, (c) => {
    c.fillStyle = INK;
    c.fillRect(2, 4, 12, 10);
    c.fillStyle = '#7a7684';
    c.fillRect(3, 5, 10, 8);
    c.fillStyle = STEEL;
    c.fillRect(4, 5, 7, 3);
    c.fillStyle = '#d6ecf0';
    c.fillRect(1, 13, 14, 1); // foam where the water meets it
  });
  make('tow_slip', 16, 16, (c) => {
    // planks down the bank into the water
    for (let y = 1; y < 16; y += 4) {
      c.fillStyle = INK;
      c.fillRect(1, y, 14, 4);
      c.fillStyle = WOOD;
      c.fillRect(2, y + 1, 12, 2);
      c.fillStyle = SAND;
      c.fillRect(2, y + 1, 12, 1);
    }
  });
  // The Action button's icons while towing owns it, 16 x 16 like the tool icons: hook (a steel hook on a rope),
  // home (a log on the slip's planks), tug (a taut rope and a pull arrow).
  const dots = (c: CanvasRenderingContext2D, color: string, pts: [number, number][]) => {
    c.fillStyle = color;
    for (const [x, y] of pts) c.fillRect(x, y, 1, 1);
  };
  const outline = (c: CanvasRenderingContext2D, pts: [number, number][]) => {
    const out: [number, number][] = [];
    for (const [x, y] of pts)
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        out.push([x + dx, y + dy]);
    dots(c, INK, out);
  };
  make('tow_icon_hook', 16, 16, (c) => {
    const rope: [number, number][] = [];
    for (let y = 1; y <= 6; y++) rope.push([9, y]);
    const hook: [number, number][] = [
      [9, 7],
      [9, 8],
      [9, 9],
      [9, 10],
      [8, 11],
      [7, 12],
      [6, 12],
      [5, 11],
      [4, 10],
      [4, 9],
      [5, 8],
    ];
    outline(c, [...rope, ...hook]);
    dots(c, WOOD, rope);
    dots(c, STEEL, hook);
  });
  make('tow_icon_home', 16, 16, (c) => {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = INK;
      c.fillRect(2, 8 + i * 2, 12, 3);
    }
    for (let i = 0; i < 3; i++) {
      c.fillStyle = WOOD;
      c.fillRect(3, 9 + i * 2, 10, 1);
    }
    c.fillStyle = INK;
    c.fillRect(3, 3, 10, 6);
    c.fillStyle = BARK;
    c.fillRect(4, 4, 8, 4);
    c.fillStyle = WOOD;
    c.fillRect(4, 4, 8, 1);
    c.fillStyle = SAND;
    c.fillRect(4, 5, 2, 2);
  });
  make('tow_icon_tug', 16, 16, (c) => {
    c.fillStyle = INK;
    c.fillRect(1, 7, 14, 3);
    c.fillStyle = WOOD;
    c.fillRect(2, 8, 12, 1);
    const arrow: [number, number][] = [
      [4, 5],
      [3, 6],
      [4, 11],
      [3, 10],
      [5, 4],
      [5, 12],
    ];
    outline(c, arrow);
    dots(c, CREAM, arrow);
  });
}
