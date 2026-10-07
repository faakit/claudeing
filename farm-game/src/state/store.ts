import { createInitialState, type GameState } from './GameState';

let state: GameState = createInitialState();

export const getState = (): GameState => state;
export const setState = (next: GameState): void => {
  state = next;
};
