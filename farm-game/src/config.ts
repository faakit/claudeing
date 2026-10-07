/** All tunable constants live here. */
export const TILE_SIZE = 16;
export const GAME_WIDTH = 480;
export const GAME_HEIGHT = 270;

export const MAP_KEYS = { farm: 'map_farm' } as const;
export const TILESET_KEY = 'tiles_placeholder';

/** Placeholder tile palette, in tileset order (Tiled gid = index + 1). */
export const PLACEHOLDER_TILES = [
  { name: 'grass', color: '#5a9e4b' },
  { name: 'dirt', color: '#8a6a43' },
  { name: 'tilled', color: '#6b4a2b' },
  { name: 'watered', color: '#4a3220' },
  { name: 'water', color: '#3b78c4' },
  { name: 'path', color: '#c2a878' },
  { name: 'fence', color: '#a0522d' },
  { name: 'wall', color: '#b8b0a0' },
  { name: 'door', color: '#5c3a21' },
] as const;
