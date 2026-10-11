import type Phaser from 'phaser';
import { ATLAS_FILES } from '../art/manifest';
import { PLAYER_H, PLAYER_TEXTURE, PLAYER_W, playerIdleFrame } from '../art/placeholders';
import type { Direction } from '../state/GameState';
import { DIRECTIONS } from '../systems/direction';

/**
 * Where the farmer's animation frames come from. The art agent's round-4 frames (agents/out/art-feel-frames.md
 * on art/round4: an 8-frame walk, 4-frame tool swings, an opening door) are looked up by name when they exist, so
 * this branch works before and after the art merge; until then everything falls back to today's frames.
 */
export interface FrameRef {
  texture: string;
  frame: string;
  flipX: boolean;
}

const BREATH_TEXTURE = 'fx_player_breath';
/** Rows of the idle frame that sink 1 px on the out-breath (head and shoulders). */
const BREATH_ROWS = 17;

/** Tool item -> the art's tool name and the facings it drew (art-feel-frames.md, section 2). */
const TOOL_ANIMS: Record<string, { tool: string; dirs: readonly Direction[] }> = {
  hoe: { tool: 'hoe', dirs: ['down', 'up', 'right', 'left'] },
  pickaxe: { tool: 'pick', dirs: ['down', 'up', 'right', 'left'] },
  watering_can: { tool: 'can', dirs: ['down', 'right', 'left'] },
  scythe: { tool: 'scythe', dirs: ['down', 'right', 'left'] },
  fishing_rod: { tool: 'rod', dirs: ['down', 'right', 'left'] },
};
/** Frames per tool use: 0 wind-up, 1 swing, 2 contact (the impact), 3 follow-through. */
export const TOOL_FRAMES = 4;
export const TOOL_CONTACT_FRAME = 2;
/**
 * Per-frame times (ms) per tool. The art suggested 90/50/110/80 for the hoe; the wind-up is shortened so the
 * impact lands about 100 ms after the press (the press-in shows on the touch's own frame).
 */
export const TOOL_TIMING: Record<string, readonly [number, number, number, number]> = {
  hoe: [60, 40, 110, 80],
  pick: [60, 40, 110, 80],
  scythe: [50, 30, 90, 90],
  can: [50, 40, 120, 120],
  rod: [70, 40, 120, 120],
};

export class PlayerFrames {
  readonly walkCount: number;
  private readonly chars: string;

  constructor(private readonly scene: Phaser.Scene) {
    this.chars = ATLAS_FILES.chars.key;
    this.walkCount = this.has(PLAYER_TEXTURE, 'player_walk_down_7') ? 8 : 4;
    ensureBreathFrames(scene, this.chars);
  }

  private has(texture: string, frame?: string): boolean {
    const t = this.scene.textures;
    if (!t.exists(texture)) return false;
    return frame === undefined || t.get(texture).has(frame);
  }

  walk(dir: Direction, i: number): FrameRef {
    return {
      texture: PLAYER_TEXTURE,
      frame: `player_walk_${dir}_${i % this.walkCount}`,
      flipX: false,
    };
  }

  idle(dir: Direction, breath: 0 | 1): FrameRef {
    if (breath === 1) {
      if (this.has(PLAYER_TEXTURE, `player_idle_${dir}_1`))
        return { texture: PLAYER_TEXTURE, frame: `player_idle_${dir}_1`, flipX: false };
      if (this.has(BREATH_TEXTURE, `breath_${dir}`))
        return { texture: BREATH_TEXTURE, frame: `breath_${dir}`, flipX: false };
    }
    return { texture: PLAYER_TEXTURE, frame: playerIdleFrame(dir), flipX: false };
  }

  /** The tool use's four frames and their times, or null when that tool and facing are not drawn. */
  tool(
    item: string | undefined,
    dir: Direction,
  ): { frames: FrameRef[]; ms: readonly number[] } | null {
    const t = item ? TOOL_ANIMS[item] : undefined;
    if (!t || !t.dirs.includes(dir)) return null;
    const frames: FrameRef[] = [];
    for (let i = 0; i < TOOL_FRAMES; i++) {
      const key = `player_tool_${t.tool}_${dir}_${i}`;
      if (!this.has(key)) return null;
      frames.push({ texture: key, frame: '__BASE', flipX: false });
    }
    return { frames, ms: TOOL_TIMING[t.tool]! };
  }

  /** A tall facade door opening (0 closed .. 3 open), or null when not drawn. */
  door(): FrameRef[] | null {
    const out: FrameRef[] = [];
    for (let i = 0; i < 4; i++) {
      const key = `obj_door_open_${i}`;
      if (!this.has(key)) return null;
      out.push({ texture: key, frame: '__BASE', flipX: false });
    }
    return out;
  }
}

/** Apply a frame to a sprite (texture, frame and mirroring). */
export function showFrame(sprite: Phaser.GameObjects.Sprite, f: FrameRef): void {
  if (sprite.texture.key !== f.texture) sprite.setTexture(f.texture, f.frame);
  else if (sprite.frame.name !== f.frame) sprite.setFrame(f.frame);
  if (sprite.flipX !== f.flipX) sprite.setFlipX(f.flipX);
}

/**
 * Placeholder out-breath frames (the art drew breathing for villagers and animals, not the farmer): each
 * direction's idle frame with its top rows moved down 1 px, built once from whichever pixels the idle frame shows.
 */
function ensureBreathFrames(scene: Phaser.Scene, chars: string): void {
  const textures = scene.textures;
  if (textures.exists(BREATH_TEXTURE)) return;
  const tex = textures.createCanvas(BREATH_TEXTURE, PLAYER_W * DIRECTIONS.length, PLAYER_H);
  if (!tex) return;
  const ctx = tex.getContext();
  DIRECTIONS.forEach((dir, i) => {
    const name = playerIdleFrame(dir);
    const fromAtlas = textures.exists(chars) && textures.get(chars).has(name);
    const key = fromAtlas ? chars : PLAYER_TEXTURE;
    if (!textures.exists(key)) return;
    const frame = textures.getFrame(key, name);
    const img = textures.get(key).getSourceImage() as CanvasImageSource;
    if (!frame || !img) return;
    const ox = i * PLAYER_W;
    const { cutX: cx, cutY: cy } = frame;
    const below = PLAYER_H - BREATH_ROWS;
    try {
      ctx.drawImage(img, cx, cy + BREATH_ROWS, PLAYER_W, below, ox, BREATH_ROWS, PLAYER_W, below);
      ctx.drawImage(img, cx, cy, PLAYER_W, BREATH_ROWS, ox, 1, PLAYER_W, BREATH_ROWS);
    } catch {
      return; // not drawable (a GPU-only source): that direction keeps its still idle frame
    }
    tex.add(`breath_${dir}`, 0, ox, 0, PLAYER_W, PLAYER_H);
  });
  tex.refresh();
}
