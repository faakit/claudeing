import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/state/GameState';

describe('createInitialState', () => {
  it('starts on spring day 1 at 6:00 with starting gold, tools and seeds', () => {
    const s = createInitialState();
    expect(s.time).toMatchObject({ season: 'spring', day: 1, minutes: 360 });
    expect(s.money).toBe(500);
    expect(s.inventory.slots.slice(0, 4).map((x) => x?.item)).toEqual([
      'hoe',
      'watering_can',
      'scythe',
      'fishing_rod',
    ]);
    expect(s.inventory.slots[4]).toEqual({ item: 'parsnip_seed', qty: 10 });
  });

  it('survives a JSON round trip', () => {
    const s = createInitialState();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
