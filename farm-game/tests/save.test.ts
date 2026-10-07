import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../src/platform/SaveStore';
import { createInitialState, STATE_VERSION } from '../src/state/GameState';
import { performAction } from '../src/systems/actions';
import { BACKUP_KEY, loadGame, migrate, SAVE_KEY, saveGame } from '../src/systems/save';
import { grass, newState } from './helpers';

describe('save/load', () => {
  it('round trip equals the original state', async () => {
    const store = new MemoryStore();
    const s = newState();
    performAction(s, grass(3, 3));
    s.money = 777;
    await saveGame(store, s);
    const loaded = await loadGame(store);
    expect(loaded?.fromBackup).toBe(false);
    expect(loaded?.state).toEqual(s);
  });

  it('returns null when nothing is saved', async () => {
    expect(await loadGame(new MemoryStore())).toBeNull();
  });

  it('keeps the previous save as a backup', async () => {
    const store = new MemoryStore();
    const a = newState();
    a.money = 1;
    await saveGame(store, a);
    const b = newState();
    b.money = 2;
    await saveGame(store, b);
    expect(JSON.parse(store.data.get(BACKUP_KEY)!).money).toBe(1);
    expect(JSON.parse(store.data.get(SAVE_KEY)!).money).toBe(2);
  });

  it('falls back to the backup when the main save is corrupted', async () => {
    const store = new MemoryStore();
    const a = newState();
    a.money = 1;
    await saveGame(store, a);
    const b = newState();
    b.money = 2;
    await saveGame(store, b);
    store.data.set(SAVE_KEY, '{"version": 2, "time": oops');
    const loaded = await loadGame(store);
    expect(loaded?.fromBackup).toBe(true);
    expect(loaded?.state.money).toBe(1);
  });

  it('a corrupt main save never overwrites a good backup', async () => {
    const store = new MemoryStore();
    const a = newState();
    a.money = 1;
    await saveGame(store, a);
    await saveGame(store, { ...a, money: 2 });
    store.data.set(SAVE_KEY, 'garbage');
    await saveGame(store, { ...a, money: 3 });
    expect(JSON.parse(store.data.get(BACKUP_KEY)!).money).toBe(1);
  });

  it('rejects structurally invalid saves', async () => {
    const store = new MemoryStore();
    const bad = JSON.parse(JSON.stringify(newState()));
    bad.money = -5;
    store.data.set(SAVE_KEY, JSON.stringify(bad));
    expect(await loadGame(store)).toBeNull();
    expect(() => migrate({ version: STATE_VERSION + 1 })).toThrow(/newer/);
    expect(() => migrate({})).toThrow();
  });

  it('migrates a v1 save (M1 shape) to the current version', () => {
    const v1 = {
      version: 1,
      day: 5,
      season: 'summer',
      money: 1234,
      player: { map: 'house', x: 100, y: 120, facing: 'up' },
    };
    const s = migrate(v1);
    expect(s.version).toBe(STATE_VERSION);
    expect(s.time).toMatchObject({ day: 5, season: 'summer' });
    expect(s.money).toBe(1234);
    expect(s.player).toMatchObject({ map: 'house', x: 100, y: 120, facing: 'up' });
    expect(s.inventory.slots[0]?.item).toBe('hoe');
    expect(s.farm.tiles).toEqual({});
  });

  it('fills fields added after a save was written', () => {
    const old = JSON.parse(JSON.stringify(createInitialState()));
    delete old.settings;
    expect(migrate(old).settings).toBeDefined();
  });
});
