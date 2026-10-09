import Phaser from 'phaser';
import { WORLD_VIEW } from '../config';
import type { GameState } from '../state/GameState';
import { glowFor } from '../ui/daylight';

/**
 * Night glow: stepped, dithered pixel-art light pools drawn additively over the day tint at the map's `lights`
 * (lamps, windows, the forge and fireplace, torches, crystals), a soft halo around the player outdoors, and
 * fireflies on warm nights. It lives in the UI scene, right above the tint, because light has to brighten what
 * the tint darkened; the world scene publishes its lights and camera through `glowSource`.
 */
export interface GlowLight {
  kind: string;
  x: number;
  y: number;
}

export const glowSource: {
  map: string;
  outdoor: boolean;
  lights: GlowLight[];
  cam: Phaser.Cameras.Scene2D.Camera | null;
  version: number;
} = { map: '', outdoor: false, lights: [], cam: null, version: 0 };

/** Called by the world scene when a map starts (and with no camera when it shuts down). */
export function publishGlow(
  map: string,
  outdoor: boolean,
  lights: GlowLight[],
  cam: Phaser.Cameras.Scene2D.Camera | null,
): void {
  Object.assign(glowSource, { map, outdoor, lights, cam, version: glowSource.version + 1 });
}

/** The lights of a Tiled map (the hidden `lights` object group written by scripts/map-art.mjs). */
export function parseLights(map: {
  layers: { name: string; objects?: { name: string; x: number; y: number }[] }[];
}): GlowLight[] {
  const layer = map.layers.find((l) => l.name === 'lights');
  return (layer?.objects ?? [])
    .filter((o) => o.name !== 'chimney')
    .map((o) => ({ kind: o.name, x: o.x, y: o.y }));
}

type Shape = { radii: number[]; colors: number[]; alphas: number[]; squash?: number; dy?: number };
/** Three stepped rings per light, warm palette colours (lamp, gold, orange; ice and sky for crystals). */
export const GLOW_SHAPES: Record<string, Shape> = {
  lamp: { radii: [5, 10, 16], colors: [0xfff0a0, 0xf4cc3c, 0xe48c24], alphas: [0.8, 0.45, 0.2] },
  window: {
    radii: [4, 8, 12],
    colors: [0xfff0a0, 0xf4cc3c, 0xe48c24],
    alphas: [0.75, 0.4, 0.16],
    squash: 0.7,
    dy: 5,
  },
  fire: { radii: [5, 10, 15], colors: [0xf4cc3c, 0xe48c24, 0xcc3a2a], alphas: [0.85, 0.45, 0.2] },
  torch: { radii: [3, 7, 12], colors: [0xf4cc3c, 0xe48c24, 0xcc3a2a], alphas: [0.85, 0.45, 0.2] },
  crystal: { radii: [3, 7, 11], colors: [0xd6ecf0, 0x72aadc, 0x3c74b4], alphas: [0.7, 0.35, 0.15] },
  halo: { radii: [8, 16, 26], colors: [0xfff0a0, 0xf4cc3c, 0xe48c24], alphas: [0.25, 0.14, 0.07] },
  firefly: { radii: [1, 2, 4], colors: [0xfff0a0, 0xb4d45a, 0xb4d45a], alphas: [1, 0.55, 0.22] },
};
const FIRE_KINDS = new Set(['fire', 'torch']);

/**
 * Pixel colour of a glow shape at (dx, dy) from its centre: which ring, with a checker dither across each ring
 * edge so the steps read as hand-placed pixels, not a gradient. Pure, for tests. Returns null outside.
 */
export function glowPixel(
  shape: Shape,
  dx: number,
  dy: number,
): { color: number; alpha: number } | null {
  const d = Math.hypot(dx, dy / (shape.squash ?? 1));
  const checker = (Math.abs(Math.round(dx)) + Math.abs(Math.round(dy))) % 2 === 0;
  for (let i = 0; i < shape.radii.length; i++) {
    const r = shape.radii[i]!;
    const edge = d > r - 0.6 && d <= r + 0.6;
    if (d <= r - 0.6 || (edge && checker))
      return { color: shape.colors[i]!, alpha: shape.alphas[i]! };
  }
  return null;
}

const TEXTURE = 'fx_glow';

function ensureTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) return;
  const frames = Object.entries(GLOW_SHAPES).map(([k, s]) => {
    const r = s.radii[s.radii.length - 1]! + 1;
    return { k, s, w: 2 * r + 1, h: 2 * Math.ceil(r * (s.squash ?? 1)) + 1 };
  });
  const W = frames.reduce((a, f) => a + f.w + 1, 0);
  const H = Math.max(...frames.map((f) => f.h));
  const tex = scene.textures.createCanvas(TEXTURE, W, H);
  if (!tex) return;
  const ctx = tex.getContext();
  let x0 = 0;
  for (const { k, s, w, h } of frames) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const p = glowPixel(s, x - cx, y - cy);
        if (!p) continue;
        ctx.fillStyle = `rgba(${p.color >> 16},${(p.color >> 8) & 255},${p.color & 255},${p.alpha})`;
        ctx.fillRect(x0 + x, y, 1, 1);
      }
    tex.add(k, 0, x0, 0, w, h);
    x0 += w + 1;
  }
  tex.refresh();
}

interface Glow {
  img: Phaser.GameObjects.Image;
  light: GlowLight;
  shape: Shape;
  flicker: number;
  next: number;
}
interface Fly {
  img: Phaser.GameObjects.Image;
  bx: number;
  by: number;
  ph: number;
}

export class NightGlow {
  private glows: Glow[] = [];
  private halo: Phaser.GameObjects.Image;
  private flies: Fly[] = [];
  private version = -1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly depth: number,
  ) {
    ensureTexture(scene);
    this.halo = this.make('halo');
    for (let i = 0; i < 8; i++)
      this.flies.push({ img: this.make('firefly'), bx: 0, by: 0, ph: i * 1.7 });
  }

  private make(frame: string): Phaser.GameObjects.Image {
    return this.scene.add
      .image(0, 0, TEXTURE, frame)
      .setDepth(this.depth)
      .setScrollFactor(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setVisible(false);
  }

  private rebuild(): void {
    this.glows.forEach((g) => g.img.destroy());
    this.glows = glowSource.lights
      .filter((l) => GLOW_SHAPES[l.kind])
      .map((light) => ({
        img: this.make(light.kind),
        light,
        shape: GLOW_SHAPES[light.kind]!,
        flicker: 1,
        next: 0,
      }));
    this.version = glowSource.version;
  }

  /** Place a glow at a world position, cropped to the world view so light never spills onto the HUD. */
  private place(img: Phaser.GameObjects.Image, wx: number, wy: number, alpha: number): void {
    const cam = glowSource.cam!;
    const sx = Math.round(wx - cam.scrollX + cam.x);
    const sy = Math.round(wy - cam.scrollY + cam.y);
    const fw = img.frame.width;
    const fh = img.frame.height;
    const left = sx - (fw - 1) / 2;
    const top = sy - (fh - 1) / 2;
    const x0 = Math.max(0, WORLD_VIEW.x - left);
    const y0 = Math.max(0, WORLD_VIEW.y - top);
    const x1 = Math.min(fw, WORLD_VIEW.x + WORLD_VIEW.w - left);
    const y1 = Math.min(fh, WORLD_VIEW.y + WORLD_VIEW.h - top);
    if (alpha <= 0 || x1 <= x0 || y1 <= y0) {
      img.setVisible(false);
      return;
    }
    img
      .setVisible(true)
      .setPosition(sx, sy)
      .setCrop(x0, y0, x1 - x0, y1 - y0)
      .setAlpha(alpha);
  }

  update(time: number, state: GameState): void {
    if (this.version !== glowSource.version) this.rebuild();
    const cam = glowSource.cam;
    const amount = cam ? glowFor(glowSource.map, state.time.minutes, glowSource.outdoor) : 0;
    const calm = state.settings.reduceMotion;
    for (const g of this.glows) {
      if (FIRE_KINDS.has(g.light.kind) && !calm && time > g.next) {
        // fire flickers between two steps at uneven intervals
        g.flicker = g.flicker === 1 ? 0.8 : 1;
        g.next = time + 120 + ((g.light.x * 7 + time) % 160);
      }
      const a = amount * (calm ? 1 : g.flicker);
      if (!cam) g.img.setVisible(false);
      else this.place(g.img, g.light.x, g.light.y + (g.shape.dy ?? 0), a);
    }
    const p = state.player;
    if (cam && glowSource.outdoor && amount > 0) this.place(this.halo, p.x, p.y - 12, amount);
    else this.halo.setVisible(false);
    this.updateFlies(time, state, amount, calm);
  }

  /** A few fireflies drift over the view on warm nights outdoors (still, dim dots with reduced motion). */
  private updateFlies(time: number, state: GameState, amount: number, calm: boolean): void {
    const cam = glowSource.cam;
    const warm = state.time.season === 'spring' || state.time.season === 'summer';
    const on =
      !!cam &&
      glowSource.outdoor &&
      warm &&
      state.weather === 'sunny' &&
      amount >= 0.5 &&
      glowSource.map !== 'town';
    const count = glowSource.map === 'woods' ? 8 : 5;
    this.flies.forEach((f, i) => {
      if (!on || i >= count) {
        f.img.setVisible(false);
        f.bx = 0;
        return;
      }
      const v = cam.worldView;
      const out = f.bx < v.x - 20 || f.bx > v.right + 20 || f.by < v.y - 20 || f.by > v.bottom + 20;
      if (f.bx === 0 || out) {
        f.bx = v.x + (((i * 53 + 17) % 97) / 97) * v.width;
        f.by = v.y + (((i * 31 + 41) % 89) / 89) * v.height;
      }
      const t = calm ? 0 : time / 1000;
      const wx = f.bx + Math.sin(t * 0.7 + f.ph) * 18;
      const wy = f.by + Math.sin(t * 0.45 + f.ph * 2) * 10;
      // blink in steps: off, half, full
      const blink = calm ? 0.5 : [0, 0.5, 1, 1, 0.5][Math.floor(t * 2 + f.ph) % 5]!;
      this.place(f.img, wx, wy, amount * blink);
    });
  }
}
