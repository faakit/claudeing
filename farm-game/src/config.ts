/** All tunable constants live here. */
export const TILE_SIZE = 16;
// Portrait, 1:2. Almost every phone is between 9:16 and 9:20, so a 1:2 canvas fits them all with
// slim bars at worst. 200 logical px across is ~12 tiles: big readable sprites and 44px+ touch targets.
export const GAME_WIDTH = 200;
export const GAME_HEIGHT = 400;

// Screen zones (logical px). Everything the thumb touches lives in the bottom dock.
export const HUD_H = 74; // read-only info at the top, out of thumb reach on purpose
export const DOCK_H = 112; // controls + hotbar
export const DOCK_Y = GAME_HEIGHT - DOCK_H;
export const WORLD_VIEW = { x: 0, y: HUD_H, w: GAME_WIDTH, h: DOCK_Y - HUD_H } as const;
/** The floating joystick may start anywhere below this line (the lower ~60% of the screen). */
export const THUMB_ZONE_Y = 150;

export const MAP_KEYS = { farm: 'map_farm' } as const;
export const TILESET_KEY = 'tiles_placeholder';

/**
 * Placeholder tile set, in tileset order (Tiled gid = index + 1).
 * scripts/generate-maps.mjs uses the same numbering.
 */
export const PLACEHOLDER_TILES = [
  { name: 'grass', color: '#5a9e4b', accent: '#4a8a3f' },
  { name: 'dirt', color: '#8a6a43', accent: '#755833' },
  { name: 'tilled', color: '#6b4a2b', accent: '#553a21' },
  { name: 'watered', color: '#4a3220', accent: '#3a271a' },
  { name: 'water', color: '#3b78c4', accent: '#6fa3e0' },
  { name: 'path', color: '#c2a878', accent: '#ad935f' },
  { name: 'fence', color: '#5a9e4b', accent: '#a0522d' },
  { name: 'wall', color: '#b8b0a0', accent: '#8f887a' },
  { name: 'door', color: '#b8b0a0', accent: '#5c3a21' },
  { name: 'floor', color: '#b98a5a', accent: '#9a6f45' },
  { name: 'wallin', color: '#6d5a78', accent: '#4f3f5a' },
  { name: 'bed', color: '#c4473a', accent: '#f4ead2' },
  { name: 'bin', color: '#8b5a2b', accent: '#c28a4a' },
  { name: 'tree', color: '#5a9e4b', accent: '#2f7a3a' },
  { name: 'flower', color: '#5a9e4b', accent: '#f2a6c0' },
  { name: 'shopwall', color: '#d9c7a0', accent: '#b04a3a' },
  { name: 'shopdoor', color: '#d9c7a0', accent: '#b04a3a' },
  { name: 'board', color: '#5a9e4b', accent: '#c9a26a' },
  { name: 'bush', color: '#5a9e4b', accent: '#2f8a45' },
  { name: 'stone', color: '#6a6672', accent: '#56525e' },
  { name: 'rock', color: '#4a4652', accent: '#2f2c36' },
] as const;

/** Tile kind by gid, for game rules (water refills the can, etc). */
export const tileKind = (gid: number): string => PLACEHOLDER_TILES[gid - 1]?.name ?? 'none';

// --- Player & movement (M1) ---
export const PLAYER_SPEED = 64; // px/s
/** Collision box at the feet: halfW each side of x, h tall above y. */
export const PLAYER_HITBOX = { halfW: 5, h: 6 } as const;
/** Max perpendicular nudge (px) that lets the player slide around a corner into a gap. */
export const CORNER_ASSIST_PX = 4;
/** Clamp for frame deltas so a lag spike can never tunnel through a wall. */
export const MAX_FRAME_MS = 50;
export const WALK_FPS = 8;

// --- Camera & transitions ---
export const CAMERA_LERP = 0.12;
export const FADE_MS = 180;
export const FADE_COLOR = { r: 16, g: 12, b: 28 } as const;
export const VOID_COLOR = '#14101f';

// --- Touch controls (logical px at 480x270) ---
export const JOYSTICK = { radius: 24, deadzone: 6, axisBias: 1.25 } as const;
export const TAP_MAX_MS = 250;
export const TAP_MAX_MOVE = 8;
export const UI_LAYOUT = { actionRadius: 28, interactRadius: 21, menuRadius: 14, edge: 6 } as const;
export const EVT_INTERACT_TARGET = 'interact-target';

// --- Time (M2) ---
/** Real ms per in-game minute: 5s per 10 minutes, so a 20h game day lasts ~10 real minutes. */
export const MS_PER_GAME_MINUTE = 500;
/** Longest frame delta fed to the clock, so a backgrounded tab can't skip hours. */
export const MAX_CLOCK_DT_MS = 100;

// --- Season ground tint (multiply); real seasonal tilesets replace this in M7 ---
export const SEASON_TINT = {
  spring: 0xffffff,
  summer: 0xfff0b8,
  fall: 0xffc48c,
  winter: 0xc4d6f2,
} as const;
export const ACTION_LOCK_MS = { ok: 200, fail: 280 } as const;
