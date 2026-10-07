/** Everything that must be saved lives here. Plain, serializable data only. */
export interface GameState {
  version: number;
  day: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  money: number;
}

export const STATE_VERSION = 1;

export function createInitialState(): GameState {
  return { version: STATE_VERSION, day: 1, season: 'spring', money: 500 };
}
