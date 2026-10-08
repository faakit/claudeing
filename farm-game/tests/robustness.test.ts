import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/platform/SaveStore';
import { STATE_VERSION } from '../src/state/GameState';
import { createGrid } from '../src/systems/movement';
import { BACKUP_KEY, hasNewerSave, loadGame, SAVE_KEY, saveGame } from '../src/systems/save';
import { nearestFreeTile } from '../src/systems/world';
import { newState } from './helpers';

describe('saves from the future', () => {
  it('are detected, not mistaken for an empty slot', async () => {
    const store = new MemoryStore();
    expect(await hasNewerSave(store)).toBe(false);
    await store.write(SAVE_KEY, JSON.stringify({ version: STATE_VERSION + 1 }));
    expect(await loadGame(store)).toBeNull();
    expect(await hasNewerSave(store)).toBe(true);
  });
  it('a normal save is not flagged', async () => {
    const store = new MemoryStore();
    await saveGame(store, newState());
    expect(await hasNewerSave(store)).toBe(false);
    await store.write(BACKUP_KEY, 'garbage{');
    expect(await hasNewerSave(store)).toBe(false);
  });
});

describe('rescuing a damaged player position', () => {
  // 5x5 room with walls around and one pillar
  const rows = [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 1, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ];
  const grid = createGrid(5, 5, 16, rows.flat());
  it('keeps an open tile', () => {
    expect(nearestFreeTile(grid, 1, 1)).toEqual({ tx: 1, ty: 1 });
  });
  it('steps out of a wall to the closest open tile', () => {
    expect(nearestFreeTile(grid, 2, 2)).toMatchObject({
      tx: expect.any(Number),
      ty: expect.any(Number),
    });
    const t = nearestFreeTile(grid, 2, 2);
    expect(rows[t.ty]![t.tx]).toBe(0);
  });
  it('brings a far-away position back into the map', () => {
    const t = nearestFreeTile(grid, 400, -30);
    expect(rows[t.ty]![t.tx]).toBe(0);
  });
});
