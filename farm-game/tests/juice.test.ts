import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { gameEvents } from '../src/systems/events';
import { befriend, POINTS_PER_HEART } from '../src/systems/friendship';
import { newState } from './helpers';

describe('flourishes', () => {
  it('a heart gained is announced once, with the new heart count', () => {
    const s = newState();
    const seen: { id: string; hearts: number }[] = [];
    const off = gameEvents.on('heartUp', (h) => seen.push(h));
    befriend(s, 'rosa', POINTS_PER_HEART - 1);
    befriend(s, 'rosa', 1);
    befriend(s, 'rosa', 10);
    befriend(s, 'rosa', -50); // losing points never announces
    off();
    expect(seen).toEqual([{ id: 'rosa', hearts: 1 }]);
  });
});
