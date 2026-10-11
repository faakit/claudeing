/**
 * The towing spike (docs/MILESTONES.md M7, "Spike first"): on the lab map's south shore, one water lane flowing
 * west, one snag (a rock beside the bank) and a slip where the road meets the shore. A placeholder log drifts down
 * the lane; everything is taps and one thumb:
 *
 * - tap the log (anywhere on screen): the farmer walks to the nearest bank in reach and hooks it on arrival;
 * - tap where it should go (a bank tile, or the water, which resolves to the bank beside it): the farmer walks
 *   along the bank and the log follows on its 3-tile rope, lagging and swinging round turns;
 * - it catches on the snag: the log stops and bobs, tilted, the rope goes taut and the farmer stops at the rope's
 *   length; Action or a tap on the log tugs it free (it pops a tile past the rock) and the walk resumes;
 * - at the slip it lands by itself: lifted onto the planks and dropped, dust and drips, "+1 Timber".
 *
 * The stick works too (walk along the bank, the log follows). Debug builds only: the lab scene runs it when the
 * scenario sets the stat `lab.towSpike` (scenario `tow-spike`; `lab.towLong` makes the log a long one, two tugs).
 * The rules are `systems/towing.ts`; this file is presentation, input and the spike's own placeholder art.
 */
import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { TILE_SIZE } from '../config';
import type { Effects } from '../fx/Effects';
import { audio, SFX_IDS, type Sfx } from '../platform/audio';
import { haptic } from '../platform/haptics';
import type { Direction } from '../state/GameState';
import { getState } from '../state/store';
import {
  atSlip,
  atSlipBank,
  haul,
  bankFor,
  drift,
  follow,
  halfExtents,
  hookStand,
  inReach,
  land,
  makeLog,
  ROPE_PX,
  tug,
  type Log,
  type TowState,
  type TowWorld,
} from '../systems/towing';
import { labMap } from './labDef';

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
}

/** The lab's shore (scripts/generate-lab-map.mjs): water rows 29-32, the bank at row 28, the road at x 13. */
const WATER_ID = 5;
const SNAG = { tx: 17, ty: 29 };
const SLIP = { bank: { tx: 13, ty: 28 }, water: { tx: 13, ty: 29 } };
/** Where a log comes into view, and the current (px/s, westward). */
const SPAWN = { x: 19 * TILE_SIZE + 8, y: 30 * TILE_SIZE + 8 };
const FLOW = { x: -6, y: 0 };
/** A log that drifts past here (unhooked) comes round again upstream. */
const WEST_END = 2 * TILE_SIZE;

/** Timings (ms): the rope's throw, a tug's pop, the landing (lift, then the drop at `drop`). */
const T = {
  throw: 120,
  pop: 170,
  lean: 110,
  land: 340,
  drop: 230,
  rest: 900,
  respawn: 1400,
} as const;
/** Rope: a 1 px dot every this many px (a solid line); the sag of a slack rope per px of slack, and its most. */
const ROPE_DOT_PX = 1;
const SAG_PER_PX = 0.5;
const SAG_MAX = 9;
const ROPE_COLOR = 0x7c442c; // soil, from the palette: a dark line that reads on water and on the sandy bank

type Phase = 'drift' | 'hooking' | 'towing' | 'hauling' | 'landing' | 'landed';

/** Tap counts and times of the current log, from the first input to its landing (`__farm.dev.tow()`). */
export interface TowMetrics {
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
  log: { x: number; y: number; snagged: boolean; hooked: boolean };
}

const cue = (name: string, fallback: Sfx): void =>
  audio.play((SFX_IDS as readonly string[]).includes(name) ? (name as Sfx) : fallback);

export class TowSpike {
  private log: Log;
  private phase: Phase = 'drift';
  private state: TowState | 'none' = 'none';
  private now = 0;
  private logImg: Phaser.GameObjects.Image;
  private dots: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  /** Where a walk cut short by the snag was going (it resumes after the tug). */
  private resume: { tx: number; ty: number } | null = null;
  private replans = 0;
  /** How far the farmer may stand from a snagged log (the distance when it caught). */
  private snagMax: number | null = null;
  /** A tow destination tapped while walking to hook the log. */
  private afterHook: { tx: number; ty: number } | null = null;
  private ropeAt = 0;
  private pop: { fx: number; fy: number; at: number } | null = null;
  private leanUntil = 0;
  private leanDir = 0;
  private landAt = 0;
  private landFrom = { x: 0, y: 0 };
  private dropped = false;
  private respawnAt = 0;
  readonly metrics: TowMetrics;
  private readonly world: TowWorld;

  constructor(
    private readonly host: TowHost,
    private readonly long = false,
  ) {
    const L = labMap;
    this.world = {
      water: (tx, ty) =>
        tx >= 0 && ty >= 0 && tx < L.w && ty < L.h && L.ground[ty * L.w + tx] === WATER_ID,
      snag: (tx, ty) => tx === SNAG.tx && ty === SNAG.ty,
    };
    makeTextures(host.scene);
    const s = host.scene;
    this.props.push(
      s.add
        .image(SNAG.tx * TILE_SIZE, SNAG.ty * TILE_SIZE, 'tow_rock')
        .setOrigin(0, 0)
        .setDepth(1),
      s.add
        .image(SLIP.bank.tx * TILE_SIZE, SLIP.bank.ty * TILE_SIZE, 'tow_slip')
        .setOrigin(0, 0)
        .setDepth(0.9),
    );
    this.log = makeLog(SPAWN.x, SPAWN.y, long);
    this.logImg = s.add.image(SPAWN.x, SPAWN.y, long ? 'tow_log_long' : 'tow_log').setDepth(1.2);
    this.metrics = this.freshMetrics(0);
  }

  private freshMetrics(landed: number): TowMetrics {
    return {
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
      log: { x: this.log.x, y: this.log.y, snagged: false, hooked: false },
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
    this.input('taps');
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    if (this.onLog(wx, wy)) {
      if (this.phase === 'drift' || this.phase === 'hooking') return this.startHook();
      if (this.log.snag) return this.doTug();
      if (this.phase === 'towing') return this.walkBeside(tx, ty);
    }
    if (this.phase === 'hooking') {
      // on the way to hook it: where to tow it next, walked to the moment it is hooked
      const water = this.world.water(tx, ty) || this.world.snag(tx, ty);
      const dest = water
        ? bankFor(tx, ty, (x, y) => this.host.walkable(x, y), this.world.water)
        : this.host.walkable(tx, ty)
          ? { tx, ty }
          : null;
      if (dest) {
        this.afterHook = this.offSlip(dest);
        audio.play('target');
        haptic('tick');
        return true;
      }
    }
    if (this.world.water(tx, ty) || this.world.snag(tx, ty)) return this.walkBeside(tx, ty);
    if (this.phase === 'towing' && this.host.walkable(tx, ty)) {
      if (this.log.snag) return this.doTug(); // the rope holds: a tap anywhere tugs rather than doing nothing
      this.resume = null;
      return this.towTo({ tx, ty });
    }
    return false;
  }

  /** Action pressed. True when the spike took it (hook in reach, or tug). */
  onAction(): boolean {
    if (this.log.snag) {
      this.input('actions');
      return this.doTug();
    }
    if ((this.phase === 'drift' || this.phase === 'hooking') && inReach(this.hands(), this.log)) {
      this.input('actions');
      this.hook();
      return true;
    }
    return false;
  }

  /** A forgiving hit test on the log (6 px round it). */
  private onLog(wx: number, wy: number): boolean {
    if (this.phase === 'landing' || this.phase === 'landed') return false;
    const { hx, hy } = halfExtents(this.log);
    return Math.abs(wx - this.log.x) <= hx + 6 && Math.abs(wy - this.log.y) <= hy + 8;
  }

  /**
   * A walk while towing. The slip's planks are where the log lands, so a walk to them stops beside them, on the
   * side the farmer comes from (he never stands where the log will drop).
   */
  private towTo(t: { tx: number; ty: number }): boolean {
    return this.host.walkTo(this.offSlip(t), null);
  }

  private offSlip(t: { tx: number; ty: number }): { tx: number; ty: number } {
    if (t.tx !== SLIP.bank.tx || t.ty !== SLIP.bank.ty) return t;
    const here = this.farmerTile();
    const side = here.tx >= SLIP.bank.tx ? 1 : -1;
    for (const c of [
      { tx: SLIP.bank.tx + side, ty: SLIP.bank.ty },
      { tx: SLIP.bank.tx - side, ty: SLIP.bank.ty },
      { tx: SLIP.bank.tx, ty: SLIP.bank.ty - 1 },
    ])
      if (this.host.walkable(c.tx, c.ty)) return c;
    return t;
  }

  private walkBeside(tx: number, ty: number): boolean {
    const bank = bankFor(tx, ty, (x, y) => this.host.walkable(x, y), this.world.water);
    if (!bank) return false;
    if (this.log.snag) return this.doTug();
    this.resume = null;
    return this.towTo(bank);
  }

  private startHook(): boolean {
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
    this.replans = 0;
    this.afterHook = null;
    return true;
  }

  private hook(): void {
    this.host.stopWalk();
    const next = this.afterHook;
    this.afterHook = null;
    if (next) this.towTo(next);
    this.log.hooked = true;
    this.phase = 'towing';
    this.ropeAt = this.now;
    this.metrics.hookedAt = this.now;
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
      if (this.resume) this.towTo(this.resume);
      this.resume = null;
    });
    return true;
  }

  // ---- the frame ----

  update(delta: number): void {
    this.now += delta;
    const h = this.hands();
    const log = this.log;
    if (this.phase === 'drift' || this.phase === 'hooking') {
      drift(this.world, log, FLOW, delta);
      if (log.x < WEST_END) this.respawn();
    }
    if (this.phase === 'hooking') {
      // in reach on the way: hook at once (fewer seconds); stopped short (it drifted): plan again
      if (inReach(h, log, 4)) this.hook();
      else if (!this.host.walking) {
        if (this.replans++ < 3) this.startHook();
        else this.phase = 'drift';
      }
    }
    if (this.phase === 'towing') {
      const was = this.state;
      this.state = follow(this.world, log, h, delta);
      if (this.state === 'snagged') {
        if (was !== 'snagged') {
          cue('logKnock', 'till');
          haptic('tick');
        }
        this.holdFarmer(h);
      }
      if (atSlip(log, SLIP.water)) this.startLanding();
      else if (!log.snag && !this.host.walking && atSlipBank(this.farmerTile(), SLIP.bank)) {
        // standing at the slip: he hauls the log in, hand over hand
        this.phase = 'hauling';
      }
    }
    if (this.phase === 'hauling') {
      if (this.host.walking) this.phase = 'towing';
      else {
        this.state = 'taut';
        const r = haul(this.world, log, SLIP.water, delta);
        if (r === 'arrived') this.startLanding();
        else if (r === 'snagged') this.phase = 'towing';
      }
    }
    if (this.phase === 'landing') this.stepLanding();
    if (this.phase === 'landed' && this.now >= this.respawnAt) this.respawn();
    this.render(h);
    const m = this.metrics;
    m.phase = this.phase;
    m.state = this.state;
    m.log = { x: Math.round(log.x), y: Math.round(log.y), snagged: !!log.snag, hooked: log.hooked };
  }

  private farmerTile(): { tx: number; ty: number } {
    const p = getState().player;
    return { tx: Math.floor(p.x / TILE_SIZE), ty: Math.floor((p.y - 3) / TILE_SIZE) };
  }

  /**
   * Snagged: the farmer cannot walk further than the rope (held where it caught, never pulled back); a walk is cut
   * there, to resume after the tug.
   */
  private holdFarmer(h: { x: number; y: number }): void {
    const d = Math.hypot(h.x - this.log.x, h.y - this.log.y);
    this.snagMax ??= Math.max(ROPE_PX + 4, d);
    const max = this.snagMax;
    if (d <= max) return;
    if (this.host.walking) {
      this.resume ??= this.host.walkGoal;
      this.host.stopWalk();
    }
    const p = getState().player;
    const nx = this.log.x + ((h.x - this.log.x) / d) * max;
    const ny = this.log.y + ((h.y - this.log.y) / d) * max + 6;
    if (this.host.walkable(Math.floor(nx / TILE_SIZE), Math.floor((ny - 3) / TILE_SIZE))) {
      p.x = nx;
      p.y = ny;
    }
  }

  private startLanding(): void {
    this.phase = 'landing';
    this.landAt = this.now;
    this.landFrom = { x: this.log.x, y: this.log.y };
    this.dropped = false;
    this.resume = null;
    this.host.stopWalk();
  }

  private stepLanding(): void {
    const t = this.now - this.landAt;
    if (!this.dropped && t >= T.drop) {
      this.dropped = true;
      const n = land(this.log);
      const at = { x: SLIP.bank.tx * TILE_SIZE + 8, y: SLIP.bank.ty * TILE_SIZE + 10 };
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

  private respawn(): void {
    this.log = makeLog(SPAWN.x, SPAWN.y, this.long);
    this.phase = 'drift';
    this.state = 'none';
    this.pop = null;
    this.logImg.setAlpha(1);
    Object.assign(this.metrics, this.freshMetrics(this.metrics.landed));
  }

  // ---- drawing (whole pixels; images only, so the batch holds) ----

  private render(h: { x: number; y: number }): void {
    const log = this.log;
    let x = log.x;
    let y = log.y;
    let tex = this.long ? 'tow_log_long' : 'tow_log';
    if (this.pop) {
      // the pop: from where it was caught to past the snag, in a 4 px hop
      const u = Math.min(1, (this.now - this.pop.at) / T.pop);
      x = this.pop.fx + (log.x - this.pop.fx) * u;
      y = this.pop.fy + (log.y - this.pop.fy) * u - 4 * 4 * u * (1 - u);
      if (u >= 1) this.pop = null;
    } else if (log.snag) {
      // caught: tilted, bobbing a pixel
      tex += '_tilt';
      y += Math.floor(this.now / 220) % 2;
    } else if (this.phase === 'landing' || this.phase === 'landed') {
      const t = Math.min(1, (this.now - this.landAt) / T.drop);
      const to = { x: SLIP.bank.tx * TILE_SIZE + 8, y: SLIP.bank.ty * TILE_SIZE + 9 };
      x = this.landFrom.x + (to.x - this.landFrom.x) * t;
      // lifted out (up 6 px over the water's edge), then dropped onto the planks
      y = this.landFrom.y + (to.y - this.landFrom.y) * t - 6 * Math.sin(Math.PI * t);
      if (this.phase === 'landed') {
        const left = this.respawnAt - this.now;
        this.logImg.setAlpha(left < 300 ? Math.round((left / 300) * 3) / 3 : 1);
      }
    } else if (this.phase === 'drift' || this.phase === 'hooking') {
      y += Math.floor(this.now / 500) % 2 ? 0 : -1; // floating
    }
    this.logImg.setTexture(tex).setPosition(Math.round(x), Math.round(y));
    this.logImg.setDepth(this.phase === 'landing' || this.phase === 'landed' ? 10 + y + 4 : 1.2);
    // the farmer leans back on a tug
    if (this.now < this.leanUntil) this.host.farmer.x += this.leanDir;
    this.drawRope(h, x, y);
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
    this.logImg.destroy();
    for (const d of this.dots) d.destroy();
    for (const p of this.props) p.destroy();
    this.dots = [];
  }
}

function faceToward(t: { tx: number; ty: number }, log: Log): Direction {
  const dx = log.x - (t.tx * TILE_SIZE + 8);
  const dy = log.y - (t.ty * TILE_SIZE + 8);
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

/** The spike's placeholder art, palette colours, drawn once: a log (short, long, and tilted when caught), a rock, a slip. */
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
  const log = (len: number, tilt: boolean) => (c: CanvasRenderingContext2D) => {
    // a round log lying east-west: ink outline, bark, a lit top line, sawn ends; tilted = one end dipped a pixel
    for (let x = 0; x < len; x++) {
      const dy = tilt && x >= len / 2 ? 1 : 0;
      c.fillStyle = INK;
      c.fillRect(x, dy, 1, 7);
      if (x === 0 || x === len - 1) continue;
      c.fillStyle = BARK;
      c.fillRect(x, dy + 1, 1, 5);
      c.fillStyle = WOOD;
      c.fillRect(x, dy + 1, 1, 1);
    }
    for (const ex of [1, len - 3]) {
      const dy = tilt && ex >= len / 2 ? 1 : 0;
      c.fillStyle = SAND;
      c.fillRect(ex, dy + 2, 2, 3);
      c.fillStyle = BARK;
      c.fillRect(ex + (ex === 1 ? 0 : 1), dy + 3, 1, 1);
    }
  };
  make('tow_log', 16, 8, log(16, false));
  make('tow_log_tilt', 16, 8, log(16, true));
  make('tow_log_long', 30, 8, log(30, false));
  make('tow_log_long_tilt', 30, 8, log(30, true));
  make('tow_rock', 16, 16, (c) => {
    c.fillStyle = INK;
    c.fillRect(2, 4, 12, 10);
    c.fillStyle = '#7a7684';
    c.fillRect(3, 5, 10, 8);
    c.fillStyle = '#aeb0b4';
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
}
