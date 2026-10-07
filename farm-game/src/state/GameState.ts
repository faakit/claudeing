import { PLAYER_HITBOX, TILE_SIZE } from '../config';
import { mapsData } from '../data';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Player position is the feet-center in map pixels. */
export interface PlayerState {
  map: string;
  x: number;
  y: number;
  facing: Direction;
}

/** Everything that must be saved lives here. Plain, serializable data only. */
export interface GameState {
  version: number;
  day: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  money: number;
  player: PlayerState;
}

export const STATE_VERSION = 1;

/** Feet position that puts the hitbox center in the middle of tile (tx, ty). */
export function spawnPosition(tx: number, ty: number): { x: number; y: number } {
  return {
    x: tx * TILE_SIZE + TILE_SIZE / 2,
    y: ty * TILE_SIZE + TILE_SIZE / 2 + PLAYER_HITBOX.h / 2,
  };
}

export function createInitialState(): GameState {
  const { map, tx, ty, facing } = mapsData.start;
  return {
    version: STATE_VERSION,
    day: 1,
    season: 'spring',
    money: 500,
    player: { map, ...spawnPosition(tx, ty), facing },
  };
}
