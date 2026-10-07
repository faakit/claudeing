/** All tunable constants live here. */
export const TILE_SIZE = 16;
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

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
] as const;

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
export const JOYSTICK = { radius: 26, deadzone: 7, axisBias: 1.25 } as const;
export const TAP_MAX_MS = 250;
export const TAP_MAX_MOVE = 8;
export const UI_LAYOUT = { margin: 14, actionRadius: 26, interactRadius: 20 } as const;
export const EVT_INTERACT_TARGET = 'interact-target';
