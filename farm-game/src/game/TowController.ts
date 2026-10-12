/**
 * Towing in a scene (the Weir's verb, docs/MILESTONES.md M7): drift timber on water, hooked from the bank with a
 * rope, towed along the bank, tugged off a snag and landed at a slip. The lab spike (src/dev/towSpike.ts) and the
 * real town river (src/game/weirTow.ts) are courses for it: a course says where the water, snags and slip are, how
 * its logs drift, and what a landing gives. The rules are systems/towing.ts; this is presentation and input, and it
 * draws only images (one atlas with the art lane's frames), so the batch holds.
 *
 * Everything is taps and one thumb (feel critic's go, final-towing.md):
 *
 * - tap a log (or the water within about 1.5 tiles of it): the farmer walks to the nearest bank in reach and hooks it
 *   on arrival; a log not yet in reach of any bank (the east lane before the spur turns it) is met where it will come
 *   to rest. A tap on the bank while nothing is hooked walks there as usual;
 * - tap where it should go (a bank tile, or the water, which resolves to the bank beside it): the farmer walks along
 *   the bank and the log follows on its 3-tile rope, lagging and swinging round turns. A tap within two tiles of the
 *   slip means the slip (a thumb taps near it while the camera scrolls);
 * - it catches on a snag: the log stops, tilts and bobs, a foam crest at the rock, a ripple, the rope goes taut and
 *   the farmer stops at the rope's length; Action or any tap tugs it free and the walk resumes toward the last tow goal
 *   (critic T1 ruling);
 * - standing within two tiles of the slip with the log free, he hauls it in, and it lands: lifted onto the planks and
 *   dropped, dust and drips, "+1 Timber".
 *
 * Action is the one-thumb route through the whole verb while towing's context is live (systems/towing actionVerb): it
 * hooks a log in view, sends a free hooked log home to the slip, and tugs; the Action button shows the verb's icon
 * meanwhile. A crop or forage good in front of the farmer wins while nothing is hooked.
 */
import Phaser from 'phaser';
import { PX_TEXTURE } from '../art/gameArt';
import { TILE_SIZE } from '../config';
import type { Effects } from '../fx/Effects';
import { t } from '../i18n';
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
  follow,
  halfExtents,
  haul,
  hookStand,
  inReach,
  land,
  makeLog,
  meansSlip,
  nearestBank,
  placeAt,
  ROPE_PX,
  tug,
  type Log,
  type TowState,
  type TowVerb,
  type TowWorld,
} from '../systems/towing';

/** What the controller needs from its scene (a WorldScene's powers). */
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

export type Tile = { tx: number; ty: number };
export type Rect = readonly [number, number, number, number];
export const inRect = ([x, y, w, h]: Rect, tx: number, ty: number): boolean =>
  tx >= x && tx < x + w && ty >= y && ty < y + h;

/** One log a course puts on the water: where it enters, which way it lies, and the course's own key for it. */
export interface TowLogSpec {
  key: number;
  lane: string;
  long: boolean;
  axis: 'h' | 'v';
  /** Where it enters (world px, its centre). */
  x: number;
  y: number;
}

/**
 * Where towing happens. The lab spike's lanes and the town river implement it (src/dev/towSpike.ts,
 * src/game/weirTow.ts).
 */
export interface TowCourse {
  /** For the dev readout: the lane id ('spike', 'long', 'weir'). */
  readonly id: string;
  /** The log's way from its entry to the slip, in tiles (the dev readout). */
  readonly tiles: number;
  readonly world: TowWorld;
  /** The water rects (Action's "near the water" test). */
  readonly water: readonly Rect[];
  readonly slip: { bank: Tile; water: Tile };
  readonly snags: readonly Tile[];
  /** Draw a placeholder rock on each snag (the lab; the town's rocks and reeds are map art). */
  readonly rocks: boolean;
  /** The logs on the water when the scene is built. */
  logs(): TowLogSpec[];
  /**
   * One frame of a free log's drift (it is not hooked). `world` also counts the other waiting logs as solid. Return
   * 'end' when the log should come round again at its entry (the lab), 'rest' while it lies still, else 'moved'.
   */
  drift(log: Log, spec: TowLogSpec, world: TowWorld, dtMs: number): 'moved' | 'rest' | 'end';
  /** The way a hooked log is pulled along the course where it is (a unit vector), or null. */
  along(log: Log, spec: TowLogSpec): { x: number; y: number } | null;
  /** Where a drifting log will come to rest (to meet one out of reach), or null. */
  rest(spec: TowLogSpec): { x: number; y: number } | null;
  /** The farmer may hook (owns a hook). False: `refuse` says why, once in a while. */
  canHook(): boolean;
  refuse(): void;
  /** A log reached the slip: the timber it gives, or null when it cannot land now (it stays on the water). */
  landed(spec: TowLogSpec, log: Log): number | null;
  /** The lab: a landed log comes round again; the town: it is gone. */
  readonly respawn: boolean;
}

/** Timings (ms): the rope's throw, a tug's pop, the landing (lift, then the drop at `drop`). */
export const TOW_T = {
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
  /** A farmer waiting at the bank for a drifting log gives up after this. */
  meet: 45000,
} as const;
const T = TOW_T;
/** Rope: a 2 px dot (`tow_rope_dot`) every px (a solid 2 px line); the sag of a slack rope per px of slack, and its most. */
const ROPE_DOT_PX = 1;
const SAG_PER_PX = 0.5;
const SAG_MAX = 9;
/** The foam crest at a snag: 2 px, the palette's ice white (art lane). */
const FOAM_COLOR = 0xd6ecf0;
/** A water tap this near a drifting log (px from its centre) hooks it (critic ruling 4). */
const HOOK_TAP_PX = 24;
/** Reach slack (px inside the rope) to hook a moving log, and a still one (a little past the rope: it lies still). */
const REACH_MOVING = 4;
const REACH_STILL = -6;
/** The hook stand's margin inside the rope for a moving log (it drifts while the farmer walks), and a still one. */
const STAND_MOVING = TILE_SIZE * 0.75;
const STAND_STILL = -6;

type Phase = 'drift' | 'hooking' | 'towing' | 'hauling' | 'landing' | 'landed';

/** Where a tow walk is going: a tile, or the slip (its stand is worked out when walked, from where he is). */
type Goal = { slip: true } | { slip: false; tx: number; ty: number };

/** Tap counts and times of the current log, from the first input to its landing (`__farm.dev.tow()`). */
export interface TowMetrics {
  /** The lane: 'spike', 'long', or the town log's lane ('west', 'middle', 'east'). */
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
  log: { x: number; y: number; snagged: boolean; hooked: boolean; axis: 'h' | 'v'; long: boolean };
  /** Waiting at the bank for the log being hooked to drift into reach (the east lane): no input is needed. */
  meet: boolean;
  /** Every log on the water now. */
  logs: {
    lane: string;
    x: number;
    y: number;
    long: boolean;
    hooked: boolean;
    snagged: boolean;
    still: boolean;
  }[];
}

const cue = (name: string, fallback: Sfx): void =>
  audio.play((SFX_IDS as readonly string[]).includes(name) ? (name as Sfx) : fallback);

const VERB_ICON: Record<NonNullable<TowVerb>, string> = {
  hook: 'tow_icon_hook',
  home: 'tow_icon_home',
  busy: 'tow_icon_home',
  tug: 'tow_icon_tug',
};

interface Entry {
  spec: TowLogSpec;
  log: Log;
  img: Phaser.GameObjects.Image;
  spawnedAt: number;
  /** Not on the water yet: another log lies where it enters. */
  queued: boolean;
  /** It lay still last frame (rested, caught or held). */
  still: boolean;
}

export class TowController {
  private entries: Entry[] = [];
  /** The log being hooked, towed or landed (null while every log drifts). */
  private active: Entry | null = null;
  private phase: Phase = 'drift';
  private state: TowState | 'none' = 'none';
  private now = 0;
  private dots: Phaser.GameObjects.Image[] = [];
  private foam: Phaser.GameObjects.Image[] = [];
  private props: Phaser.GameObjects.Image[] = [];
  private replans = 0;
  /** Walking to (or waiting at) the bank where a drifting log will come to rest. */
  private meeting = false;
  /**
   * A log freed from the rock it waited on: the rope pays out (no pull) until the farmer, walking it down to the slip,
   * is level with it, so it is never drawn back onto the rock.
   */
  private slack = false;
  private hookFrom = 0;
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
  private rippleAt = 0;
  private verb: TowVerb = null;
  readonly metrics: TowMetrics;
  readonly world: TowWorld;
  private readonly slip: { bank: Tile; water: Tile };

  constructor(
    private readonly host: TowHost,
    readonly course: TowCourse,
  ) {
    this.world = course.world;
    this.slip = { bank: { ...course.slip.bank }, water: { ...course.slip.water } };
    makeTowTextures(host.scene);
    const s = host.scene;
    if (course.rocks)
      for (const { tx, ty } of course.snags)
        this.props.push(
          s.add
            .image(tx * TILE_SIZE, ty * TILE_SIZE, 'tow_rock')
            .setOrigin(0, 0)
            .setDepth(1),
        );
    this.props.push(this.slipImage());
    for (const spec of course.logs()) this.addEntry(spec);
    this.metrics = this.freshMetrics(0);
  }

  /** The water rects (probes read `tow.lane.water`). */
  get lane(): { water: readonly Rect[] } {
    return { water: this.course.water };
  }

  /**
   * The slip: the art lane's 16x32 ramp covering its water and bank tiles, from the northern one's top-left
   * (`tow_slip` for water north of the bank, `tow_slip_s` for water south); the 16x16 placeholder on the bank.
   */
  private slipImage(): Phaser.GameObjects.Image {
    const s = this.host.scene;
    const { bank, water } = this.slip;
    const south = water.ty > bank.ty;
    const key = south && s.textures.exists('tow_slip_s') ? 'tow_slip_s' : 'tow_slip';
    const tall = s.textures.getFrame(key)?.height === 32;
    const at = tall ? (water.ty < bank.ty ? water : bank) : bank;
    return s.add
      .image(at.tx * TILE_SIZE, at.ty * TILE_SIZE, key)
      .setOrigin(0, 0)
      .setDepth(0.9);
  }

  private addEntry(spec: TowLogSpec): Entry {
    const log = makeLog(spec.x, spec.y, spec.long, spec.axis);
    const img = this.host.scene.add.image(spec.x, spec.y, texFor(log, false)).setDepth(1.2);
    const e: Entry = { spec, log, img, spawnedAt: this.now, queued: false, still: false };
    e.queued = this.blocked(e, log.x, log.y);
    img.setVisible(!e.queued);
    this.entries.push(e);
    return e;
  }

  /** Another log on the water lies where this one would. */
  private blocked(e: Entry, x: number, y: number): boolean {
    const me = { ...e.log, x, y };
    return this.entries.some((o) => o !== e && !o.queued && !o.log.landed && overlap(me, o.log));
  }

  /** The course's water with the other free logs as solid (logs waiting in a lane queue behind one another). */
  private driftWorld(e: Entry): TowWorld {
    const others = this.entries.filter(
      (o) => o !== e && !o.queued && !o.log.landed && o !== this.active,
    );
    if (!others.length) return this.world;
    return {
      water: (tx, ty) => this.world.water(tx, ty) && !others.some((o) => tileUnder(o.log, tx, ty)),
      snag: (tx, ty) => this.world.snag(tx, ty),
    };
  }

  private freshMetrics(landed: number): TowMetrics {
    const e = this.focus();
    return {
      lane: e?.spec.lane ?? this.course.id,
      laneTiles: this.course.tiles,
      slip: { bank: { ...this.slip.bank }, water: { ...this.slip.water } },
      snags: this.course.snags.map(({ tx, ty }) => ({ tx, ty })),
      spawn: e
        ? { tx: Math.floor(e.spec.x / TILE_SIZE), ty: Math.floor(e.spec.y / TILE_SIZE) }
        : { tx: -1, ty: -1 },
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
      log: this.logInfo(e),
      meet: false,
      logs: [],
    };
  }

  private logInfo(e: Entry | null): TowMetrics['log'] {
    const l = e?.log;
    return {
      x: Math.round(l?.x ?? -1),
      y: Math.round(l?.y ?? -1),
      snagged: !!l?.snag,
      hooked: !!l?.hooked,
      axis: l?.axis ?? 'h',
      long: !!l?.long,
    };
  }

  /** The log the readout follows: the one in hand, else the first on the water. */
  private focus(): Entry | null {
    return this.active ?? this.entries.find((e) => !e.queued && !e.log.landed) ?? null;
  }

  private hands(): { x: number; y: number } {
    const p = getState().player;
    return { x: p.x, y: p.y - 6 };
  }

  private input(kind: 'taps' | 'actions'): void {
    this.metrics[kind]++;
    this.metrics.firstInputAt ??= this.now;
  }

  /** Free logs on the water (not hooked, not landing). */
  private free(): Entry[] {
    return this.entries.filter((e) => !e.queued && !e.log.landed && e !== this.active);
  }

  // ---- input ----

  /** A tap on the world (world px). True when the controller took it. */
  onTap(wx: number, wy: number): boolean {
    if (this.phase === 'landing' || this.phase === 'landed') return false;
    const tx = Math.floor(wx / TILE_SIZE);
    const ty = Math.floor(wy / TILE_SIZE);
    const water = this.world.water(tx, ty) || this.world.snag(tx, ty);
    const a = this.active;
    if (a?.log.snag && a.log.hooked) {
      // the rope holds: any tap on the world tugs rather than doing nothing
      this.input('taps');
      return this.doTug();
    }
    if (this.phase === 'drift' || this.phase === 'hooking') {
      const near = this.logNear(wx, wy, water);
      if (near) {
        if (!this.course.canHook()) {
          this.course.refuse();
          return true;
        }
        this.input('taps');
        return this.startHook(near, false);
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
    const dest = a && this.onLog(a, wx, wy) ? this.besideLog(a) : this.towGoal(tx, ty);
    if (!dest) return false;
    this.input('taps');
    return this.goTo(dest);
  }

  /** The free log a tap means: on it (8 px round), or a water tap within HOOK_TAP_PX of it; the nearest. */
  private logNear(wx: number, wy: number, water: boolean): Entry | null {
    let best: { e: Entry; d: number } | null = null;
    const cands = this.phase === 'hooking' && this.active ? [this.active] : this.free();
    for (const e of cands) {
      const d = Math.hypot(wx - e.log.x, wy - e.log.y);
      if (!(this.onLog(e, wx, wy) || (water && d <= HOOK_TAP_PX))) continue;
      if (!best || d < best.d) best = { e, d };
    }
    return best?.e ?? null;
  }

  /** Action pressed. True when the controller took it (towing's context is live: systems/towing actionVerb). */
  onAction(): boolean {
    const verb = this.actionVerbNow();
    if (!verb) return false;
    if (verb === 'hook' && !this.course.canHook()) return false;
    this.input('actions');
    if (verb === 'tug') return this.doTug();
    if (verb === 'home') return this.goTo({ slip: true });
    if (verb === 'busy') {
      haptic('tick');
      return true;
    }
    // hook: the log in view nearest the farmer, in reach at once, else walk to it
    const e = this.hookCandidate();
    return e ? this.startHook(e, false) : false;
  }

  /** The free log in view that Action would hook: the nearest one a bank can reach (now or where it rests). */
  private hookCandidate(): Entry | null {
    const f = this.farmerTile();
    let best: { e: Entry; d: number } | null = null;
    for (const e of this.free()) {
      if (!this.inView(e.log)) continue;
      if (!this.standFor(e, f)) continue;
      const d = Math.hypot(e.log.x - (f.tx * TILE_SIZE + 8), e.log.y - (f.ty * TILE_SIZE + 8));
      if (!best || d < best.d) best = { e, d };
    }
    return best?.e ?? null;
  }

  private inView(l: Log): boolean {
    const v = this.host.scene.cameras.main.worldView;
    return l.x >= v.x + 4 && l.x <= v.right - 4 && l.y >= v.y + 4 && l.y <= v.bottom - 4;
  }

  private actionVerbNow(): TowVerb {
    if (this.phase === 'landing' || this.phase === 'landed') return null;
    const a = this.active;
    const hooked = !!a?.log.hooked;
    const homing = this.phase === 'hauling' || (this.goal?.slip === true && this.host.walking);
    const logInView =
      this.phase === 'hooking' ? !!a : this.course.canHook() && this.hookCandidate() !== null;
    return actionVerb({
      hooked,
      snagged: hooked && !!a?.log.snag,
      homing,
      logInView,
      waterDist: this.waterDist(),
      front: this.host.actionInFront,
    });
  }

  /** Tiles from the farmer to the course's nearest water tile (either axis). */
  private waterDist(): number {
    const f = this.farmerTile();
    let best = Infinity;
    for (const [x, y, w, h] of this.course.water) {
      const dx = Math.max(x - f.tx, 0, f.tx - (x + w - 1));
      const dy = Math.max(y - f.ty, 0, f.ty - (y + h - 1));
      best = Math.min(best, Math.max(dx, dy));
    }
    return best;
  }

  /** A forgiving hit test on a log (8 px round it). */
  private onLog(e: Entry, wx: number, wy: number): boolean {
    if (e.queued || e.log.landed) return false;
    const { hx, hy } = halfExtents(e.log);
    return Math.abs(wx - e.log.x) <= hx + 8 && Math.abs(wy - e.log.y) <= hy + 8;
  }

  /**
   * What a tap on this tile means as a tow destination: the slip (within two tiles of it), a bank tile, or null. A
   * tap on solid land (a hedge, a wall) means the nearest walkable bank, out to 8 tiles, the slip's way of the
   * nearest (feel critic T5: while a log is hooked no world tap is silent).
   */
  private towGoal(tx: number, ty: number): Goal | null {
    if (meansSlip({ tx, ty }, this.slip)) return { slip: true };
    if (!this.host.walkable(tx, ty) && !this.world.water(tx, ty) && !this.world.snag(tx, ty)) {
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

  /** The bank beside a log (a tap on a towed log: come closer to it). */
  private besideLog(e: Entry): Goal | null {
    const b = bankFor(
      Math.floor(e.log.x / TILE_SIZE),
      Math.floor(e.log.y / TILE_SIZE),
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

  /** Is this log lying still (rested at its lane's end, caught, or held)? */
  private still(e: Entry): boolean {
    return e.still || !!e.log.snag;
  }

  /** Where to stand to hook this log: in reach of it now, or of where it will rest. */
  private standFor(e: Entry, from: Tile, meet = false): { tile: Tile; meet: boolean } | null {
    const w = (x: number, y: number) => this.host.walkable(x, y);
    const now = meet
      ? null
      : hookStand(e.log, from, w, 6, this.still(e) ? STAND_STILL : STAND_MOVING);
    if (now) return { tile: now, meet: false };
    if (this.still(e)) return null;
    const r = this.course.rest(e.spec);
    if (!r) return null;
    const at = hookStand({ ...e.log, x: r.x, y: r.y }, from, w, 6, STAND_STILL);
    return at ? { tile: at, meet: true } : null;
  }

  private startHook(e: Entry, replan: boolean): boolean {
    const from = this.farmerTile();
    this.active = e;
    if (inReach(this.hands(), e.log, this.still(e) ? REACH_STILL : REACH_MOVING)) {
      this.hook();
      return true;
    }
    // a replan for a log that drifted on meets it where it will rest
    const s = this.standFor(e, from, replan && !this.still(e));
    const stand = s?.tile;
    this.meeting = !!s?.meet;
    if (!stand || !this.host.walkTo(stand, faceToward(stand, e.log))) {
      if (!replan) this.active = null;
      haptic('error');
      return false;
    }
    if (this.phase !== 'hooking') this.hookFrom = this.now;
    this.phase = 'hooking';
    // a replan keeps a destination chained on the way (it used to drop it: the critic's stall before the snag)
    if (!replan) this.replans = 0;
    return true;
  }

  private hook(): void {
    const e = this.active;
    if (!e) return;
    this.host.stopWalk();
    const next = this.afterHook;
    this.afterHook = null;
    e.log.hooked = true;
    this.phase = 'towing';
    this.ropeAt = this.now;
    this.metrics.hookedAt = this.now;
    this.metrics.lane = e.spec.lane;
    this.metrics.spawn = {
      tx: Math.floor(e.spec.x / TILE_SIZE),
      ty: Math.floor(e.spec.y / TILE_SIZE),
    };
    if (next) this.goTo(next);
    cue('logHook', 'swing');
    haptic('tick');
  }

  private doTug(): boolean {
    const e = this.active;
    if (!e) return false;
    const before = { x: e.log.x, y: e.log.y };
    const h = this.hands();
    const waited = !!e.log.snag?.drift;
    const r = tug(this.world, e.log, h);
    if (!r) return false;
    if (r.freed) this.snagMax = null;
    // a log that waited caught on a rock comes free and the farmer walks it on down to the slip (he stood upstream to
    // hook it: standing there, the rope would draw it straight back onto the rock)
    if (r.freed && waited) {
      this.goal ??= { slip: true };
      this.slack = true;
    }
    this.metrics.tugs++;
    this.leanDir = Math.sign(h.x - e.log.x) || 1;
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
      this.host.fx.splash(e.log.x, e.log.y);
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
    // free logs drift (a queued one enters once its way is clear)
    for (const e of this.entries) {
      if (e.log.landed || e === this.active) continue;
      if (e.queued) {
        if (!this.blocked(e, e.log.x, e.log.y)) {
          e.queued = false;
          e.spawnedAt = this.now;
          e.img.setVisible(true);
        }
        continue;
      }
      this.driftOne(e, delta);
    }
    const a = this.active;
    if (a && this.phase === 'hooking') {
      this.driftOne(a, delta);
      // in reach on the way: hook at once (fewer seconds); stopped short: wait for a drifting log, else plan again
      if (inReach(h, a.log, this.still(a) ? REACH_STILL : REACH_MOVING)) this.hook();
      else if (!this.host.walking) {
        const waiting = this.meeting && !this.still(a) && this.now - this.hookFrom < T.meet;
        if (waiting) {
          // waiting at the bank for it to drift into reach
        } else if (this.replans++ < 3) this.startHook(a, true);
        else {
          this.phase = 'drift';
          this.active = null;
        }
      }
    }
    if (a && this.phase === 'towing') {
      const log = a.log;
      const was = this.state;
      if (this.slack && (h.y >= log.y - 4 || !this.goal || log.snag)) this.slack = false;
      this.state = this.slack
        ? 'slack'
        : follow(this.world, log, h, delta, this.course.along(log, a.spec));
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
    if (a && this.phase === 'hauling') {
      if (this.host.walking) this.phase = 'towing';
      else {
        this.state = 'taut';
        const r = haul(this.world, a.log, this.slip.water, delta);
        if (r === 'arrived') this.startLanding();
        else if (r === 'snagged') this.phase = 'towing';
      }
    }
    if (this.phase === 'landing') this.stepLanding();
    if (this.phase === 'landed' && this.now >= this.respawnAt) this.afterLanded();
    this.verb = this.actionVerbNow();
    inputHub.actionIcon = this.verb ? VERB_ICON[this.verb] : null;
    this.render(h);
    const m = this.metrics;
    m.phase = this.phase;
    m.state = this.state;
    m.verb = this.verb;
    m.goal = this.goal ? (this.goal.slip ? 'slip' : { tx: this.goal.tx, ty: this.goal.ty }) : null;
    m.log = this.logInfo(this.focus());
    m.meet =
      this.phase === 'hooking' &&
      this.meeting &&
      !this.host.walking &&
      !!this.active &&
      !this.still(this.active);
    m.logs = this.entries
      .filter((e) => !e.queued && !e.log.landed)
      .map((e) => ({
        lane: e.spec.lane,
        x: Math.round(e.log.x),
        y: Math.round(e.log.y),
        long: e.log.long,
        hooked: e.log.hooked,
        snagged: !!e.log.snag,
        still: this.still(e),
      }));
  }

  private driftOne(e: Entry, delta: number): void {
    if (e.log.hooked) return;
    const r = this.course.drift(e.log, e.spec, this.driftWorld(e), delta);
    e.still = r === 'rest';
    if (r !== 'end') return;
    // the lab: an unhooked log at its lane's end comes round again (a walk to hook it is called off)
    if (e === this.active) {
      this.active = null;
      this.phase = 'drift';
      this.goal = null;
      this.afterHook = null;
    }
    this.resetEntry(e);
    if (!this.active) Object.assign(this.metrics, this.freshMetrics(this.metrics.landed));
  }

  /** A log comes round again at its entry (the lab's lanes). */
  private resetEntry(e: Entry): void {
    const fresh = makeLog(e.spec.x, e.spec.y, e.spec.long, e.spec.axis);
    Object.assign(e.log, fresh);
    delete e.log.wp;
    e.spawnedAt = this.now;
    e.still = false;
    e.img.setAlpha(1);
  }

  /**
   * Never a stall: an idle farmer with a free log and a tow goal he has not reached walks on toward it (a walk cut
   * by the snag, or one that ended early). A reached goal is done.
   */
  private keepGoing(): void {
    const log = this.active?.log;
    if (this.host.walking || log?.snag || !this.goal) {
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
    const log = this.active!.log;
    const d = Math.hypot(h.x - log.x, h.y - log.y);
    this.snagMax ??= Math.max(ROPE_PX + 4, d);
    const max = this.snagMax;
    if (d <= max) return;
    if (this.host.walking) this.host.stopWalk();
    const p = getState().player;
    const dx = h.x - log.x;
    const dy = h.y - log.y;
    // keep his row (solve x) or his column (solve y), whichever moves him less
    const opts: { x: number; y: number }[] = [];
    if (Math.abs(dy) < max) {
      const ax = Math.sqrt(max * max - dy * dy);
      opts.push({ x: log.x + Math.sign(dx || 1) * ax, y: p.y });
    }
    if (Math.abs(dx) < max) {
      const ay = Math.sqrt(max * max - dx * dx);
      opts.push({ x: p.x, y: log.y + Math.sign(dy || 1) * ay + 6 });
    }
    opts.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y));
    const n = opts[0];
    if (n && this.host.walkable(Math.floor(n.x / TILE_SIZE), Math.floor((n.y - 3) / TILE_SIZE))) {
      p.x = n.x;
      p.y = n.y;
    }
  }

  private startLanding(): void {
    const a = this.active!;
    this.phase = 'landing';
    this.landAt = this.now;
    this.landFrom = { x: a.log.x, y: a.log.y };
    this.dropped = false;
    this.goal = null;
    this.host.stopWalk();
  }

  private stepLanding(): void {
    const a = this.active!;
    const el = this.now - this.landAt;
    if (!this.dropped && el >= T.drop) {
      const n = this.course.landed(a.spec, a.log);
      if (n === null) {
        // it cannot land now (the bag is full): it stays at the slip, unhooked
        a.log.hooked = false;
        a.log.snag = null;
        a.still = true;
        this.active = null;
        this.phase = 'drift';
        this.state = 'none';
        return;
      }
      this.dropped = true;
      land(a.log);
      const at = this.landPoint();
      this.host.fx.dust(at.x, at.y);
      this.host.fx.splash(this.landFrom.x, this.landFrom.y);
      this.host.fx.floatText(at.x, at.y - 26, t('tow.landed', { count: n }), 0xf4ead2);
      cue('logLand', 'till');
      haptic('success');
      this.metrics.landedAt = this.now;
      this.metrics.ms =
        this.metrics.firstInputAt === null ? null : this.now - this.metrics.firstInputAt;
      this.metrics.landed++;
    }
    if (el >= T.land) {
      this.phase = 'landed';
      this.respawnAt = this.now + T.respawn;
    }
  }

  private landPoint(): { x: number; y: number } {
    return { x: this.slip.bank.tx * TILE_SIZE + 8, y: this.slip.bank.ty * TILE_SIZE + 10 };
  }

  /** After a landing: the lab's log comes round again; the town's is gone (the next one is the readout's log). */
  private afterLanded(): void {
    const a = this.active;
    this.active = null;
    this.phase = 'drift';
    this.state = 'none';
    this.pop = null;
    this.goal = null;
    this.afterHook = null;
    this.snagMax = null;
    if (a && this.course.respawn) this.resetEntry(a);
    else if (a) {
      a.img.destroy();
      this.entries = this.entries.filter((e) => e !== a);
    }
    Object.assign(this.metrics, this.freshMetrics(this.metrics.landed));
  }

  // ---- drawing (whole pixels; images only, so the batch holds) ----

  private render(h: { x: number; y: number }): void {
    for (const e of this.entries) if (!e.queued) this.renderLog(e);
    const a = this.active;
    const lx = a ? a.img.x : 0;
    const ly = a ? a.img.y : 0;
    // the farmer leans back on a tug
    if (this.now < this.leanUntil) this.host.farmer.x += this.leanDir;
    this.drawRope(h, lx, ly);
    this.drawFoam();
  }

  private renderLog(e: Entry): void {
    const log = e.log;
    const mine = e === this.active;
    let x = log.x;
    let y = log.y;
    let tilt = false;
    let alpha = 1;
    if (mine && this.pop) {
      // the pop: from where it was caught to past the snag, in a 4 px hop
      const u = Math.min(1, (this.now - this.pop.at) / T.pop);
      x = this.pop.fx + (log.x - this.pop.fx) * u;
      y = this.pop.fy + (log.y - this.pop.fy) * u - 4 * 4 * u * (1 - u);
      if (u >= 1) this.pop = null;
    } else if (log.snag) {
      // caught: tilted, bobbing a pixel
      tilt = true;
      y += Math.floor(this.now / 220) % 2;
    } else if (mine && (this.phase === 'landing' || this.phase === 'landed')) {
      const u = Math.min(1, (this.now - this.landAt) / T.drop);
      const to = this.landPoint();
      x = this.landFrom.x + (to.x - this.landFrom.x) * u;
      // lifted out (up 6 px over the water's edge), then dropped onto the planks
      y = this.landFrom.y + (to.y - 1 - this.landFrom.y) * u - 6 * Math.sin(Math.PI * u);
      if (this.phase === 'landed') {
        const left = this.respawnAt - this.now;
        alpha = left < 300 ? Math.round((left / 300) * 3) / 3 : 1;
      }
    } else if (!log.hooked) {
      y += Math.floor(this.now / 500) % 2 ? 0 : -1; // floating
      // a new log comes onto the water in three steps
      const u = (this.now - e.spawnedAt) / T.fadeIn;
      if (u < 1) alpha = Math.max(1, Math.ceil(u * 3)) / 3;
    }
    // the art's tilted frames raise the west end (east-west) or kick the south end west (north-south): flipped so
    // the end that dips is the one at the snag (art lane)
    const sn = log.snag;
    const flip = tilt && sn ? (log.axis === 'h' ? sn.tx * 16 + 8 > x : sn.ty * 16 + 8 < y) : false;
    e.img
      .setTexture(texFor(log, tilt))
      .setFlip(log.axis === 'h' && flip, log.axis === 'v' && flip)
      .setPosition(Math.round(x), Math.round(y))
      .setAlpha(alpha);
    e.img.setDepth(
      mine && (this.phase === 'landing' || this.phase === 'landed') ? 10 + y + 4 : 1.2,
    );
  }

  /** Caught: a 2 px foam crest where the log presses on the snag, flickering with the bob (reads without text). */
  private drawFoam(): void {
    let n = 0;
    for (const e of this.entries) {
      const s = e.log.snag;
      if (!s || e.queued || (e === this.active && this.pop)) continue;
      const x = Math.round(e.img.x);
      const y = Math.round(e.img.y);
      const { hx, hy } = halfExtents(e.log);
      // the end that presses on the snag, toward the snag tile's centre
      const cx = s.tx * TILE_SIZE + 8;
      const cy = s.ty * TILE_SIZE + 8;
      const ex = e.log.axis === 'h' ? x + Math.sign(cx - x) * (hx + 1) : x;
      const ey = e.log.axis === 'v' ? y + Math.sign(cy - y) * (hy + 1) : y;
      const phase = Math.floor(this.now / 220) % 2;
      const pts: [number, number][] =
        e.log.axis === 'h'
          ? [
              [ex, ey - 3 - phase],
              [ex, ey + 2 + phase],
              [ex + Math.sign(cx - x), ey],
            ]
          : [
              [ex - 3 - phase, ey],
              [ex + 2 + phase, ey],
              [ex, ey + Math.sign(cy - y)],
            ];
      for (const [px, py] of pts) {
        const dot = (this.foam[n] ??= this.host.scene.add
          .image(0, 0, PX_TEXTURE)
          .setOrigin(0, 0)
          .setTint(FOAM_COLOR));
        dot.setVisible(true).setPosition(px, py).setDepth(1.3);
        n++;
      }
    }
    for (let i = n; i < this.foam.length; i++) this.foam[i]!.setVisible(false);
  }

  private drawRope(h: { x: number; y: number }, lx: number, ly: number): void {
    const a = this.active;
    const hooked = !!a?.log.hooked && (this.phase === 'towing' || this.phase === 'hauling');
    let n = 0;
    if (hooked && a) {
      const d = Math.hypot(lx - h.x, ly - h.y);
      const taut = !!a.log.snag || d >= ROPE_PX - 1 || this.now < this.leanUntil;
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
          .image(0, 0, 'tow_rope_dot')
          .setOrigin(0.5, 0.5));
        dot.setVisible(true).setPosition(Math.round(px), Math.round(py)).setDepth(depth);
        n++;
      }
    }
    for (let i = n; i < this.dots.length; i++) this.dots[i]!.setVisible(false);
  }

  /** Is a log hooked right now (a save while towing brings it back to its lane's north edge). */
  get towing(): boolean {
    return !!this.active?.log.hooked;
  }

  destroy(): void {
    inputHub.actionIcon = null;
    for (const e of this.entries) e.img.destroy();
    for (const d of this.dots) d.destroy();
    for (const d of this.foam) d.destroy();
    for (const p of this.props) p.destroy();
    this.entries = [];
    this.dots = [];
    this.foam = [];
  }
}

function texFor(log: Log, tilt: boolean): string {
  return `tow_log${log.long ? '_long' : ''}${log.axis === 'v' ? '_v' : ''}${tilt ? '_tilt' : ''}`;
}

/** The tiles under a log (any part of its footprint). */
function tileUnder(log: Log, tx: number, ty: number): boolean {
  const { hx, hy } = halfExtents(log);
  return (
    tx >= Math.floor((log.x - hx) / TILE_SIZE) &&
    tx <= Math.floor((log.x + hx) / TILE_SIZE) &&
    ty >= Math.floor((log.y - hy) / TILE_SIZE) &&
    ty <= Math.floor((log.y + hy) / TILE_SIZE)
  );
}

function overlap(a: Log, b: Log): boolean {
  const A = halfExtents(a);
  const B = halfExtents(b);
  return Math.abs(a.x - b.x) < A.hx + B.hx + 2 && Math.abs(a.y - b.y) < A.hy + B.hy + 2;
}

function faceToward(t: Tile, log: Log): Direction {
  const dx = log.x - (t.tx * TILE_SIZE + 8);
  const dy = log.y - (t.ty * TILE_SIZE + 8);
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
}

/** Is there open water for this log here (the lab's and town's courses check spawns with it)? */
export const fitsAt = (world: TowWorld, log: Log, x: number, y: number): boolean =>
  placeAt(world, log, x, y).ok;

/**
 * Placeholder art, palette colours, drawn once and only where the atlas has no frame of that name: logs (short,
 * long; east-west or north-south; tilted when caught), a rock, a slip, the rope's dot, and the Action button's towing
 * icons (hook, home, tug). The art lane's atlas frames replace them by key.
 */
export function makeTowTextures(scene: Phaser.Scene): void {
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
  make('tow_rope_dot', 2, 2, (c) => {
    c.fillStyle = WOOD;
    c.fillRect(0, 0, 2, 1);
    c.fillStyle = INK;
    c.fillRect(0, 1, 2, 1);
  });
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
