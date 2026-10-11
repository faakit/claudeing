import Phaser from 'phaser';
import { FADE_COLOR } from '../config';
import {
  DITHER_LEVELS,
  ditherCovered,
  WIPE_HOLD_FRAMES,
  WIPE_MAX_STEP_MS,
  wipeLevel,
} from './feel';

const KEY = (level: number) => `fx_dither_${level}`;
const SIZE = 4;

/** Build the 4x4 dither tiles once (17 levels, 0 = clear .. 16 = solid), so a wipe never uploads mid-run. */
export function ensureDitherTextures(scene: Phaser.Scene): void {
  const color = `rgb(${FADE_COLOR.r},${FADE_COLOR.g},${FADE_COLOR.b})`;
  for (let level = 0; level <= DITHER_LEVELS; level++) {
    if (scene.textures.exists(KEY(level))) continue;
    const tex = scene.textures.createCanvas(KEY(level), SIZE, SIZE);
    if (!tex) continue;
    const ctx = tex.getContext();
    ctx.fillStyle = color;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) if (ditherCovered(x, y, level)) ctx.fillRect(x, y, 1, 1);
    tex.refresh();
  }
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'closing'; t: number; ms: number; done: () => void }
  | { kind: 'covered' }
  | { kind: 'holding'; frames: number; ms: number }
  | { kind: 'opening'; t: number; ms: number };

/**
 * The map-change transition: a crisp 4x4 ordered-dither wipe in the palette's ink, in whole pixels, one draw.
 * It closes, stays closed while the next map is built (so that frame's hitch is never seen), then opens a couple
 * of frames after the new map has drawn. Its clock takes at most a 30 Hz step, so a long frame cannot make it
 * jump. Nothing here blocks input: the world takes input again as soon as the wipe starts to open.
 */
export class Wipe {
  /** A wipe closed over one scene and the next one should open out of it (the title into the game). */
  static carry = false;
  /** One tile sprite over the covered area; its 4x4 texture is the level showing. */
  private readonly tile: Phaser.GameObjects.TileSprite;
  private phase: Phase = { kind: 'idle' };
  private shown = -1;
  private rectKey = '';

  constructor(
    scene: Phaser.Scene,
    rect: { x: number; y: number; w: number; h: number },
    depth: number,
  ) {
    ensureDitherTextures(scene);
    this.tile = scene.add
      .tileSprite(rect.x, rect.y, rect.w, rect.h, KEY(DITHER_LEVELS))
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(depth)
      .setVisible(false);
  }

  /** Move or resize the covered area (the whole screen for a new game, the world view for a door). */
  setRect(rect: { x: number; y: number; w: number; h: number }, depth: number): void {
    const key = `${rect.x},${rect.y},${rect.w},${rect.h},${depth}`;
    if (key === this.rectKey) return;
    this.rectKey = key;
    this.tile.setPosition(rect.x, rect.y).setSize(rect.w, rect.h).setDepth(depth);
  }

  get busy(): boolean {
    return this.phase.kind !== 'idle';
  }

  get covered(): boolean {
    return this.phase.kind === 'covered' || this.phase.kind === 'holding';
  }

  /** Close over `ms`, then call `done` once fully covered. Reduced motion: covers at once. */
  close(ms: number, done: () => void, calm = false): void {
    if (calm || ms <= 0) {
      this.show(DITHER_LEVELS);
      this.phase = { kind: 'covered' };
      done();
      return;
    }
    this.phase = { kind: 'closing', t: 0, ms, done };
  }

  /** Start covered (a reveal right after another scene's wipe closed). */
  cover(): void {
    this.show(DITHER_LEVELS);
    this.phase = { kind: 'covered' };
  }

  /** Open over `ms` once the new scene has drawn `WIPE_HOLD_FRAMES` frames. */
  open(ms: number, calm = false): void {
    if (this.phase.kind === 'idle') return;
    if (calm || ms <= 0) {
      this.show(0);
      this.phase = { kind: 'idle' };
      return;
    }
    this.show(DITHER_LEVELS);
    this.phase = { kind: 'holding', frames: WIPE_HOLD_FRAMES, ms };
  }

  /** Each frame (from the owning scene's update). */
  update(deltaMs: number): void {
    const dt = Math.min(deltaMs, WIPE_MAX_STEP_MS);
    const p = this.phase;
    if (p.kind === 'closing') {
      p.t += dt;
      this.show(wipeLevel(p.t / p.ms));
      if (p.t >= p.ms) {
        this.show(DITHER_LEVELS);
        this.phase = { kind: 'covered' };
        p.done();
      }
    } else if (p.kind === 'holding') {
      if (--p.frames <= 0) this.phase = { kind: 'opening', t: 0, ms: p.ms };
    } else if (p.kind === 'opening') {
      p.t += dt;
      this.show(DITHER_LEVELS - wipeLevel(p.t / p.ms));
      if (p.t >= p.ms) {
        this.show(0);
        this.phase = { kind: 'idle' };
      }
    }
  }

  private show(level: number): void {
    if (level === this.shown) return;
    this.shown = level;
    if (level <= 0) this.tile.setVisible(false);
    else this.tile.setTexture(KEY(level)).setVisible(true);
  }

  /** The dither level showing now (0 = clear), for probes. */
  get level(): number {
    return Math.max(0, this.shown);
  }

  destroy(): void {
    this.tile.destroy();
  }
}
