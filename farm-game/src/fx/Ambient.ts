import Phaser from 'phaser';
import { ATLAS_FILES } from '../art/manifest';
import type { GameState } from '../state/GameState';

/**
 * Ambient life by season, time and map: a few petals in spring, seed puffs in summer, falling leaves in autumn,
 * snow in winter, butterflies on fine days, dust motes in the mine and the house. One small emitter on the ui atlas
 * (a single draw), capped low so it stays a touch of life, never weather. Nothing with reduced motion.
 * Fireflies are part of the night glow (they have to shine above the night tint).
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

export class Ambient {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private flies: { img: Phaser.GameObjects.Image; ph: number; kind: string }[] = [];
  private key = '';

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: string,
    private readonly outdoor: boolean,
  ) {}

  update(time: number, state: GameState): void {
    const calm = state.settings.reduceMotion;
    const plan = calm
      ? null
      : ambientPlan(this.map, this.outdoor, state.time.season, state.time.minutes, state.weather);
    const key = plan ? `${plan.frames.join()}|${plan.max}|${plan.butterflies}` : '';
    if (key !== this.key) this.rebuild(plan, key);
    const cam = this.scene.cameras.main;
    const v = cam.worldView;
    if (this.emitter) this.emitter.setPosition(v.x, v.y - 12);
    this.flies.forEach((f, i) => {
      const t = time / 1000;
      // a lazy figure-of-eight across the view, wings flapping in two frames
      const x = v.x + v.width * (0.5 + 0.38 * Math.sin(t * 0.21 + f.ph));
      const y =
        v.y + v.height * (0.45 + 0.3 * Math.sin(t * 0.33 + f.ph * 1.3) * Math.cos(t * 0.11));
      f.img
        .setPosition(Math.round(x), Math.round(y))
        .setFrame(`fx_butterfly_${f.kind}${Math.floor(t * 6 + i) % 2}`);
    });
  }

  private rebuild(plan: AmbientPlan | null, key: string): void {
    this.key = key;
    this.emitter?.destroy();
    this.emitter = null;
    this.flies.forEach((f) => f.img.destroy());
    this.flies = [];
    const tex = this.scene.textures.exists(ATLAS) ? this.scene.textures.get(ATLAS) : null;
    if (!plan || !tex) return;
    const frames = plan.frames.filter((f) => tex.has(f));
    if (frames.length) {
      const v = this.scene.cameras.main.worldView;
      this.emitter = this.scene.add
        .particles(v.x, v.y, ATLAS, {
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
            source: new Phaser.Geom.Rectangle(0, 0, v.width, v.height + 12),
            quantity: 1,
          } as Phaser.Types.GameObjects.Particles.EmitZoneData,
        })
        .setDepth(4000);
    }
    for (let i = 0; i < plan.butterflies; i++) {
      const kind = i % 2 ? 'o' : 'w';
      if (!tex.has(`fx_butterfly_${kind}0`)) continue;
      this.flies.push({
        img: this.scene.add.image(0, 0, ATLAS, `fx_butterfly_${kind}0`).setDepth(4000),
        ph: i * 2.4,
        kind,
      });
    }
  }

  destroy(): void {
    this.rebuild(null, '');
  }
}
