import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/state/GameState';

describe('createInitialState', () => {
  it('starts on spring day 1 with 500 gold and survives a JSON round trip', () => {
    const state = createInitialState();
    expect(state).toMatchObject({ day: 1, season: 'spring', money: 500 });
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });
});
