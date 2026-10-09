import type Phaser from 'phaser';
import { ATLAS_FILES } from '../art/manifest';
import type { GameState } from '../state/GameState';

/**
 * Ambient life by season, time and map: a few petals in spring, seed puffs in summer, falling leaves in autumn,
 * snow in winter, butterflies on fine days, dust motes in the mine and the house. One small emitter on the ui atlas
 * (a single draw), capped low so it stays a touch of life, never weather. Nothing with reduced motion.
 * Fireflies are part of the night glow (they have to shine above the night tint).
 *
 * Everything lives in world space (owner's bug, round 3): the emitter sits still at the world origin and only its
 * emit zone follows the camera, so new motes appear in view while the ones already drifting stay where they are
 * when the camera scrolls (since Phaser 3.60, live particles move with their emitter). Butterflies flit around the
 * map's flower patches (the hidden `blooms` group written by scripts/map-art.mjs) and are re-homed off-screen
 * near the player when the player walks far away.
 */
export interface AmbientPlan {
  frames: string[];
  /** ms between particles */
  every: number;
  max: number;
  fall: [number, number];
  drift: [number, number];
  life: number;
  butterflies: number;
}

const ATLAS = ATLAS_FILES.ui.key;

/** What drifts through the view. Pure, so tests can check the plan per season, hour and map. */
export function ambientPlan(
  map: string,
  outdoor: boolean,
  season: string,
  minutes: number,
  weather: string,
): AmbientPlan | null {
  const night = minutes >= 1200 || minutes < 330;
  if (!outdoor) {
    if (map === 'mine' || map === 'house')
      return {
        frames: ['fx_px'],
        every: 900,
        max: 6,
        fall: [-2, 2],
        drift: [-3, 3],
        life: 7000,
        butterflies: 0,
      };
    return null;
  }
  if (weather !== 'sunny') return null;
  const woods = map === 'woods' ? 1.6 : map === 'town' ? 0.6 : 1;
  const fine = !night && (season === 'spring' || season === 'summer');
  const bf = fine ? (map === 'town' ? 1 : 2) : 0;
  const base = (frames: string[], every: number, max: number, fall: [number, number]) => ({
    frames,
    every: Math.round(every / woods),
    max: Math.round(max * woods),
    fall,
    drift: [-7, 7] as [number, number],
    life: 7000,
    butterflies: bf,
  });
  if (season === 'winter') return { ...base(['fx_snow'], 260, 22, [9, 16]), butterflies: 0 };
  if (night) return null;
  if (season === 'fall') return base(['fx_leaf_o', 'fx_leaf_r'], 700, 9, [7, 13]);
  if (season === 'summer') return base(['fx_seed'], 1300, 5, [-3, 3]);
  return base(['fx_petal'], 1000, 7, [5, 10]);
}

export interface Point {
  x: number;
  y: number;
}
export interface View extends Point {
  width: number;
  height: number;
}

/** The flower patches of a Tiled map (the hidden `blooms` object group), in world pixels. */
export function parseBlooms(map: {
  layers: { name: string; objects?: { x: number; y: number }[] }[];
}): Point[] {
  const layer = map.layers.find((l) => l.name === 'blooms');
  return (layer?.objects ?? []).map((o) => ({ x: o.x, y: o.y }));
}

/** Small seeded generator, so a flock's flight is repeatable in tests. */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Fly extends Point {
  vx: number;
  vy: number;
  home: Point;
  /** the point it is fluttering towards (near home), and ms until it picks another */
  tx: number;
  ty: number;
  wait: number;
  /** wing beat phase */
  ph: number;
}

/** How far around its patch a butterfly wanders, its top speed, and when it is "far" from the player. */
export const FLOCK = { roam: 20, speed: 24, near: 150, far: 230, margin: 10 } as const;

/**
 * Butterflies in world space. The camera only decides where a re-homed butterfly enters (just outside the view);
 * it never moves one that is flying. Pure (no Phaser), so tests can scroll a fake camera and check positions.
 */
export class Flock {
  readonly flies: Fly[] = [];
  private readonly rand: () => number;

  constructor(
    private readonly spots: Point[],
    count: number,
    focus: Point,
    seed = 1,
  ) {
    this.rand = rng(seed);
    for (let i = 0; i < count; i++) {
      const home = this.pickHome(focus, i);
      const at = this.near(home);
      this.flies.push({ ...at, vx: 0, vy: 0, home, tx: at.x, ty: at.y, wait: 0, ph: i * 2.4 });
    }
  }

  /** A patch near the player (a different one per butterfly when there are several); else open ground nearby. */
  private pickHome(focus: Point, i: number): Point {
    const close = this.spots
      .map((s) => ({ s, d: Math.hypot(s.x - focus.x, s.y - focus.y) }))
      .filter((e) => e.d <= FLOCK.near)
      .sort((a, b) => a.d - b.d);
    if (close.length) {
      const pick = close[(i + Math.floor(this.rand() * close.length)) % close.length]!;
      return { x: pick.s.x, y: pick.s.y };
    }
    const a = this.rand() * Math.PI * 2;
    const r = 40 + this.rand() * 60;
    return { x: Math.round(focus.x + Math.cos(a) * r), y: Math.round(focus.y + Math.sin(a) * r) };
  }

  private near(p: Point): Point {
    const a = this.rand() * Math.PI * 2;
    const r = this.rand() * FLOCK.roam;
    return { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.6 };
  }

  /** Just outside the view, on the side nearest the new home, so it flutters in instead of popping up. */
  private entry(home: Point, v: View): Point {
    const m = FLOCK.margin;
    const cx = Math.min(Math.max(home.x, v.x), v.x + v.width);
    const cy = Math.min(Math.max(home.y, v.y), v.y + v.height);
    const d = [home.x - v.x, v.x + v.width - home.x, home.y - v.y, v.y + v.height - home.y];
    const side = d.indexOf(Math.min(...d));
    if (side === 0) return { x: v.x - m, y: cy };
    if (side === 1) return { x: v.x + v.width + m, y: cy };
    if (side === 2) return { x: cx, y: v.y - m };
    return { x: cx, y: v.y + v.height + m };
  }

  step(dt: number, view: View, focus: Point): void {
    const s = Math.min(dt, 100) / 1000;
    this.flies.forEach((f, i) => {
      if (Math.hypot(f.home.x - focus.x, f.home.y - focus.y) > FLOCK.far) {
        // the player walked away: this butterfly finds a patch near them and enters from off-screen
        f.home = this.pickHome(focus, i);
        const e = this.entry(f.home, view);
        f.x = e.x;
        f.y = e.y;
        f.vx = f.vy = 0;
        f.wait = 0;
      }
      f.wait -= dt;
      if (f.wait <= 0 || Math.hypot(f.tx - f.x, f.ty - f.y) < 3) {
        const t = this.near(f.home);
        f.tx = t.x;
        f.ty = t.y;
        f.wait = 700 + this.rand() * 1500;
      }
      // steer towards the target with a little jitter: short, wavering hops
      const ax = (f.tx - f.x) * 2.2 - f.vx * 1.6 + (this.rand() - 0.5) * 90;
      const ay = (f.ty - f.y) * 2.2 - f.vy * 1.6 + (this.rand() - 0.5) * 90;
      f.vx += ax * s;
      f.vy += ay * s;
      const sp = Math.hypot(f.vx, f.vy);
      if (sp > FLOCK.speed) {
        f.vx *= FLOCK.speed / sp;
        f.vy *= FLOCK.speed / sp;
      }
      f.x += f.vx * s;
      f.y += f.vy * s;
    });
  }
}

/** The part of the world new motes appear in: the view plus a strip above it (things fall into view). */
export function emitArea(v: View): View {
  return { x: v.x, y: v.y - 12, width: v.width, height: v.height + 12 };
}

/** An emit zone source Phaser's random zone reads; it moves with the camera, the emitter itself never moves. */
export class EmitArea {
  x = 0;
  y = 0;
  width = 0;
  height = 0;
  set(v: View): void {
    Object.assign(this, emitArea(v));
  }
  getRandomPoint(p: Point): Point {
    p.x = this.x + Math.random() * this.width;
    p.y = this.y + Math.random() * this.height;
    return p;
  }
}

export class Ambient {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private readonly area = new EmitArea();
  private flock: Flock | null = null;
  private imgs: Phaser.GameObjects.Image[] = [];
  private readonly kind = 'o'; // the white one read as a letter at 1x
  private key = '';
  private last = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: string,
    private readonly outdoor: boolean,
    private readonly blooms: Point[] = [],
  ) {}

  update(time: number, state: GameState): void {
    const calm = state.settings.reduceMotion;
    const plan = calm
      ? null
      : ambientPlan(this.map, this.outdoor, state.time.season, state.time.minutes, state.weather);
    const key = plan ? `${plan.frames.join()}|${plan.max}|${plan.butterflies}` : '';
    if (key !== this.key) this.rebuild(plan, key, state.player);
    const v = this.scene.cameras.main.worldView;
    this.area.set(v);
    const dt = this.last < 0 ? 16 : time - this.last;
    this.last = time;
    if (!this.flock) return;
    this.flock.step(dt, v, state.player);
    const t = time / 1000;
    this.flock.flies.forEach((f, i) => {
      // a 1 px flutter on top of the flight, wings flapping in two frames
      const bob = Math.round(Math.sin(t * 7 + f.ph));
      this.imgs[i]
        ?.setPosition(Math.round(f.x), Math.round(f.y) + bob)
        .setFlipX(f.vx < 0)
        .setFrame(`fx_butterfly_${this.kind}${Math.floor(t * 6 + i) % 2}`);
    });
  }

  private rebuild(plan: AmbientPlan | null, key: string, focus: Point): void {
    this.key = key;
    this.emitter?.destroy();
    this.emitter = null;
    this.imgs.forEach((im) => im.destroy());
    this.imgs = [];
    this.flock = null;
    const tex = this.scene.textures.exists(ATLAS) ? this.scene.textures.get(ATLAS) : null;
    if (!plan || !tex) return;
    const frames = plan.frames.filter((f) => tex.has(f));
    this.area.set(this.scene.cameras.main.worldView);
    if (frames.length) {
      this.emitter = this.scene.add
        .particles(0, 0, ATLAS, {
          frame: frames,
          lifespan: plan.life,
          speedX: { min: plan.drift[0], max: plan.drift[1] },
          speedY: { min: plan.fall[0], max: plan.fall[1] },
          frequency: plan.every,
          quantity: 1,
          maxAliveParticles: plan.max,
          alpha: { start: 1, end: 0, ease: 'Stepped', steps: 3 },
          emitZone: {
            type: 'random',
            source: this.area,
            quantity: 1,
          } as unknown as Phaser.Types.GameObjects.Particles.EmitZoneData,
        })
        .setDepth(4000);
    }
    const n = tex.has(`fx_butterfly_${this.kind}0`) ? plan.butterflies : 0;
    if (n > 0) {
      const seed = [...this.map].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
      this.flock = new Flock(this.blooms, n, focus, seed);
      for (let i = 0; i < n; i++)
        this.imgs.push(
          this.scene.add.image(0, 0, ATLAS, `fx_butterfly_${this.kind}0`).setDepth(4000),
        );
    }
  }

  /** World positions of what is drifting now (particles and butterflies), for the anchor probe and tests. */
  debugPositions(): { motes: Point[]; flies: Point[] } {
    const e = this.emitter;
    const motes: Point[] = [];
    if (e) e.forEachAlive((p) => motes.push({ x: e.x + p.x, y: e.y + p.y }), null);
    return { motes, flies: (this.flock?.flies ?? []).map((f) => ({ x: f.x, y: f.y })) };
  }

  destroy(): void {
    this.rebuild(null, '', { x: 0, y: 0 });
  }
}
