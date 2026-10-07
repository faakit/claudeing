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

describe('save sanitising (corrupt-but-parseable saves must never crash the game)', () => {
  const base = () => JSON.parse(JSON.stringify(newState()));

  it('fills missing nested objects instead of crashing later', () => {
    const raw = base();
    delete raw.farm.weeds;
    delete raw.upgrades.stamina;
    delete raw.settings.sfx;
    delete raw.stats;
    delete raw.shipping;
    const s = migrate(raw);
    expect(s.farm.weeds).toEqual({});
    expect(s.upgrades.stamina).toBe(0);
    expect(s.settings.sfx).toBeGreaterThan(0);
    expect(s.stats).toEqual({});
    expect(s.shipping).toEqual({});
  });

  it('drops unknown items and crops (content renamed in an update)', () => {
    const raw = base();
    raw.inventory.slots[5] = { item: 'moonfruit', qty: 3 };
    raw.inventory.slots[6] = { item: 'parsnip', qty: 12 };
    raw.farm.tiles['4,4'] = {
      watered: true,
      crop: { cropId: 'ghost_plant', stage: 2, daysInStage: 0, regrow: false },
    };
    raw.shipping = { moonfruit: 4, parsnip: 2, hoe: 1 };
    const s = migrate(raw);
    expect(s.inventory.slots[5]).toBeNull();
    expect(s.inventory.slots[6]).toEqual({ item: 'parsnip', qty: 12 });
    expect(s.farm.tiles['4,4']).toEqual({ watered: true, crop: null });
    expect(s.shipping).toEqual({ parsnip: 2 });
  });

  it('restores tools, pads the inventory, and clamps wild numbers', () => {
    const raw = base();
    raw.inventory.slots = [null, { item: 'parsnip', qty: 99999 }];
    raw.inventory.selected = 42;
    raw.energy = 9999;
    raw.water = -5;
    raw.upgrades.can = 77;
    raw.time.minutes = 99999;
    raw.time.day = 400;
    const s = migrate(raw);
    expect(s.inventory.slots).toHaveLength(24);
    expect(s.inventory.slots.slice(0, 3).map((x) => x?.item)).toEqual([
      'hoe',
      'watering_can',
      'scythe',
    ]);
    expect(s.inventory.slots[1]?.item).toBe('watering_can');
    expect(s.inventory.selected).toBe(7);
    expect(s.energy).toBeLessThanOrEqual(100);
    expect(s.water).toBe(0);
    expect(s.upgrades.can).toBe(3);
    expect(s.time.minutes).toBe(1560);
    expect(s.time.day).toBe(28);
  });

  it('ignores junk farm keys and bad crop stages', () => {
    const raw = base();
    raw.farm.tiles['not,a,key'] = { watered: false, crop: null };
    raw.farm.tiles['3,3'] = {
      watered: false,
      crop: { cropId: 'parsnip', stage: 99, daysInStage: -4, regrow: 'yes' },
    };
    const s = migrate(raw);
    expect(Object.keys(s.farm.tiles)).toEqual(['3,3']);
    expect(s.farm.tiles['3,3']!.crop).toEqual({
      cropId: 'parsnip',
      stage: 4,
      daysInStage: 0,
      regrow: false,
    });
  });
});

describe('saveNow ordering', () => {
  it('a save requested during another save is not dropped and the newest state wins', async () => {
    const slow = new MemoryStore();
    const origWrite = slow.write.bind(slow);
    slow.write = async (k, v) => {
      await new Promise((r) => setTimeout(r, 15));
      return origWrite(k, v);
    };
    const a = newState();
    a.money = 1;
    const b = newState();
    b.money = 2;
    // Mirrors persistence.saveNow: strictly sequential, each writes the snapshot it was given.
    let chain: Promise<unknown> = Promise.resolve();
    const enqueue = (st: typeof a) =>
      (chain = chain.then(() => saveGame(slow, JSON.parse(JSON.stringify(st)))));
    enqueue(a);
    enqueue(b);
    await chain;
    expect((await loadGame(slow))?.state.money).toBe(2);
  });
});
