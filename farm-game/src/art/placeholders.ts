import Phaser from 'phaser';
import { PLACEHOLDER_TILES, TILESET_KEY, TILE_SIZE } from '../config';
import { DIRECTIONS } from '../systems/direction';
import type { Direction } from '../state/GameState';

/**
 * Code-generated stand-in art (M0-M6). Texture keys and frame names follow the final
 * naming convention, so real atlases can replace these without touching scene code.
 */
export const PLAYER_TEXTURE = 'player';
export const SHADOW_TEXTURE = 'fx_shadow';
export const PLAYER_W = 16;
export const PLAYER_H = 32;

const idleFrame = (d: Direction) => `player_idle_${d}_0`;
const walkFrame = (d: Direction, i: number) => `player_walk_${d}_${i}`;
export const playerIdleFrame = idleFrame;
export const playerWalkFrames = (d: Direction) => [0, 1, 2, 3].map((i) => walkFrame(d, i));

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Ctx = CanvasRenderingContext2D;

function drawTile(ctx: Ctx, index: number): void {
  const tile = PLACEHOLDER_TILES[index]!;
  const x = index * TILE_SIZE;
  const rand = rng(index * 7919 + 13);
  const px = (cx: number, cy: number, color: string, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + cx, cy, w, h);
  };
  px(0, 0, tile.color, TILE_SIZE, TILE_SIZE);
  const speckle = (n: number, color: string) => {
    for (let i = 0; i < n; i++) px(Math.floor(rand() * 15), Math.floor(rand() * 15), color);
  };
  switch (tile.name) {
    case 'grass':
      speckle(14, tile.accent);
      speckle(4, '#6fb05c');
      break;
    case 'dirt':
    case 'path':
      speckle(16, tile.accent);
      break;
    case 'tilled':
    case 'watered':
      for (let r = 2; r < 16; r += 4) px(0, r, tile.accent, 16, 2);
      break;
    case 'water':
      for (let i = 0; i < 3; i++) px(2 + Math.floor(rand() * 8), 2 + i * 5, tile.accent, 4, 1);
      break;
    case 'fence':
      speckle(10, '#4a8a3f');
      px(0, 5, tile.accent, 16, 2);
      px(0, 10, tile.accent, 16, 2);
      px(1, 2, '#7a3f20', 3, 12);
      px(12, 2, '#7a3f20', 3, 12);
      break;
    case 'wall':
      for (let r = 0; r < 16; r += 4) {
        px(0, r + 3, tile.accent, 16, 1);
        const off = (r / 4) % 2 ? 4 : 0;
        for (let c = off; c < 16; c += 8) px(c, r, tile.accent, 1, 4);
      }
      break;
    case 'door':
      for (let r = 0; r < 16; r += 4) px(0, r + 3, '#8f887a', 16, 1);
      px(2, 0, tile.accent, 12, 16);
      px(3, 1, '#7a4f2e', 10, 14);
      px(10, 8, '#f4d35e', 2, 2);
      break;
    case 'floor':
      for (let c = 0; c < 16; c += 8) px(c, 0, tile.accent, 1, 16);
      px(0, 7, tile.accent, 16, 1);
      speckle(5, tile.accent);
      break;
    case 'wallin':
      px(0, 0, tile.accent, 16, 2);
      px(0, 15, '#3d3048', 16, 1);
      speckle(6, tile.accent);
      break;
    case 'bed':
      px(1, 1, '#7a3f20', 14, 14);
      px(2, 2, tile.color, 12, 12);
      px(3, 3, tile.accent, 10, 4);
      break;
    case 'bin':
      px(1, 3, tile.color, 14, 12);
      px(0, 2, tile.accent, 16, 3);
      px(1, 7, '#6e4520', 14, 1);
      px(1, 11, '#6e4520', 14, 1);
      break;
  }
  // Soft grid edge so tile boundaries read while placeholders are in use.
  ctx.fillStyle = 'rgba(0,0,0,0.07)';
  ctx.fillRect(x, TILE_SIZE - 1, TILE_SIZE, 1);
  ctx.fillRect(x + TILE_SIZE - 1, 0, 1, TILE_SIZE);
}

/** Add a 1px dark outline around every opaque pixel (4-neighborhood). */
function outline(ctx: Ctx, ox: number, oy: number, w: number, h: number, color: string): void {
  const src = ctx.getImageData(ox, oy, w, h);
  const out = new Uint8ClampedArray(src.data);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ];
  const alpha = (x: number, y: number) =>
    x < 0 || y < 0 || x >= w || y >= h ? 0 : src.data[(y * w + x) * 4 + 3]!;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha(x, y) > 0) continue;
      if (alpha(x - 1, y) || alpha(x + 1, y) || alpha(x, y - 1) || alpha(x, y + 1)) {
        const i = (y * w + x) * 4;
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
        out[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(new ImageData(out, w, h), ox, oy);
}

const PAL = {
  skin: '#f2c9a0',
  hair: '#5b3a29',
  shirt: '#4a7fc1',
  shirtDark: '#3b66a0',
  pants: '#3d3a5c',
  boots: '#2a2420',
  eye: '#1f1a24',
  line: '#1f1a24',
};

/** Draw one 16x32 player frame. `step` is 0-3 (walk cycle); -1 = idle. */
function drawPlayer(ctx: Ctx, ox: number, oy: number, dir: Direction, step: number): void {
  const r = (x: number, y: number, w: number, h: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(ox + x, oy + y, w, h);
  };
  const bob = step === 1 || step === 3 ? 1 : 0;
  const side = dir === 'left' || dir === 'right';
  const flip = dir === 'left' ? -1 : 1;
  const sx = (x: number, w: number) => (flip === 1 ? x : 16 - x - w); // mirror helper for side view

  // Legs
  if (side) {
    const spread = step === 0 ? 2 : step === 2 ? -2 : 0;
    for (const [lx, c] of [
      [6 + spread, PAL.pants],
      [7 - spread, PAL.pants],
    ] as const) {
      r(sx(lx, 3), 24, 3, 4 - bob, c);
      r(sx(lx, 3), 28 - bob, 3, 2, PAL.boots);
    }
  } else {
    const raiseL = step === 1 ? 1 : 0;
    const raiseR = step === 3 ? 1 : 0;
    r(5, 24, 3, 4 - raiseL, PAL.pants);
    r(5, 28 - raiseL, 3, 2, PAL.boots);
    r(8, 24, 3, 4 - raiseR, PAL.pants);
    r(8, 28 - raiseR, 3, 2, PAL.boots);
  }
  // Torso & arms
  r(4, 15 - bob, 8, 9, PAL.shirt);
  r(4, 21 - bob, 8, 1, PAL.shirtDark);
  if (side) r(sx(6, 3), 16 - bob, 3, 6, PAL.shirtDark);
  else {
    r(3, 16 - bob, 1, 6, PAL.shirtDark);
    r(12, 16 - bob, 1, 6, PAL.shirtDark);
  }
  // Head
  r(4, 6 - bob, 8, 9, PAL.skin);
  if (dir === 'down') {
    r(4, 5 - bob, 8, 3, PAL.hair);
    r(4, 8 - bob, 1, 2, PAL.hair);
    r(11, 8 - bob, 1, 2, PAL.hair);
    r(6, 11 - bob, 1, 2, PAL.eye);
    r(9, 11 - bob, 1, 2, PAL.eye);
  } else if (dir === 'up') {
    r(4, 5 - bob, 8, 9, PAL.hair);
    r(5, 14 - bob, 6, 1, PAL.skin);
  } else {
    r(sx(4, 8), 5 - bob, 8, 3, PAL.hair);
    r(sx(4, 4), 8 - bob, 4, 5, PAL.hair);
    r(sx(9, 1), 11 - bob, 1, 2, PAL.eye);
  }
}

export function generatePlaceholderTextures(scene: Phaser.Scene): void {
  const tiles = scene.textures.createCanvas(
    TILESET_KEY,
    TILE_SIZE * PLACEHOLDER_TILES.length,
    TILE_SIZE,
  );
  if (!tiles) throw new Error(`Could not create texture ${TILESET_KEY}`);
  PLACEHOLDER_TILES.forEach((_, i) => drawTile(tiles.getContext(), i));
  tiles.refresh();

  const sheet = scene.textures.createCanvas(
    PLAYER_TEXTURE,
    PLAYER_W * 5,
    PLAYER_H * DIRECTIONS.length,
  );
  if (!sheet) throw new Error('Could not create player texture');
  const ctx = sheet.getContext();
  DIRECTIONS.forEach((dir, row) => {
    for (let col = 0; col < 5; col++) {
      const ox = col * PLAYER_W;
      const oy = row * PLAYER_H;
      drawPlayer(ctx, ox, oy, dir, col - 1); // col 0 = idle (-1), cols 1-4 = walk 0-3
      outline(ctx, ox, oy, PLAYER_W, PLAYER_H, PAL.line);
      const name = col === 0 ? idleFrame(dir) : walkFrame(dir, col - 1);
      sheet.add(name, 0, ox, oy, PLAYER_W, PLAYER_H);
    }
  });
  sheet.refresh();

  const shadow = scene.textures.createCanvas(SHADOW_TEXTURE, 14, 6);
  if (!shadow) throw new Error('Could not create shadow texture');
  const sctx = shadow.getContext();
  sctx.fillStyle = 'rgba(20,12,30,0.32)';
  sctx.beginPath();
  sctx.ellipse(7, 3, 7, 3, 0, 0, Math.PI * 2);
  sctx.fill();
  shadow.refresh();
}
