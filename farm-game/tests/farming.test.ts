import { describe, expect, it } from 'vitest';
import { crops } from '../src/data';
import { addItem, countItem } from '../src/systems/inventory';
import {
  getSoil,
  growCrops,
  harvest,
  isMature,
  killOutOfSeason,
  plant,
  spawnWeeds,
  till,
  water,
} from '../src/systems/farming';
import { FULL_INVENTORY, newState } from './helpers';

function growDays(s: ReturnType<typeof newState>, days: number, watered = true) {
  for (let i = 0; i < days; i++) {
    if (watered) water(s, 1, 1);
    growCrops(s);
  }
}

describe('farming', () => {
  it('plants only on tilled, empty, in-season soil', () => {
    const s = newState();
    expect(plant(s, 1, 1, 'parsnip')).toBe('no_soil');
    till(s, 1, 1);
    expect(plant(s, 1, 1, 'tomato')).toBe('out_of_season');
    expect(plant(s, 1, 1, 'parsnip')).toBe('ok');
    expect(plant(s, 1, 1, 'parsnip')).toBe('occupied');
  });

  it('tilling twice is refused', () => {
    const s = newState();
    expect(till(s, 1, 1)).toBe(true);
    expect(till(s, 1, 1)).toBe(false);
  });

  it('parsnip: watered every day matures after its growth days, then harvests', () => {
    const s = newState();
    till(s, 1, 1);
    plant(s, 1, 1, 'parsnip');
    const days = crops['parsnip']!.stageDays.reduce((a, b) => a + b, 0);
    growDays(s, days - 1);
    expect(isMature(getSoil(s, 1, 1)!.crop!)).toBe(false);
    expect(harvest(s, 1, 1)).toEqual({ ok: false, reason: 'immature' });
    growDays(s, 1);
    expect(isMature(getSoil(s, 1, 1)!.crop!)).toBe(true);
    expect(harvest(s, 1, 1)).toMatchObject({ ok: true, item: 'parsnip', qty: 1 });
    expect(countItem(s, 'parsnip')).toBe(1);
    expect(getSoil(s, 1, 1)!.crop).toBeNull();
  });

  it('an unwatered day pauses growth', () => {
    const s = newState();
    till(s, 1, 1);
    plant(s, 1, 1, 'parsnip');
    growDays(s, 1);
    const stage = getSoil(s, 1, 1)!.crop!.stage;
    growDays(s, 3, false);
    expect(getSoil(s, 1, 1)!.crop!.stage).toBe(stage);
    growDays(s, 1);
    expect(getSoil(s, 1, 1)!.crop!.stage).toBe(stage + 1);
  });

  it('growth dries every tile each night', () => {
    const s = newState();
    till(s, 1, 1);
    water(s, 1, 1);
    growCrops(s);
    expect(getSoil(s, 1, 1)!.watered).toBe(false);
  });

  it('regrowing crops reset after harvest and are ready again after regrowDays', () => {
    const s = newState();
    s.time.season = 'summer';
    till(s, 1, 1);
    plant(s, 1, 1, 'corn');
    const def = crops['corn']!;
    growDays(
      s,
      def.stageDays.reduce((a, b) => a + b, 0),
    );
    expect(harvest(s, 1, 1).ok).toBe(true);
    const crop = getSoil(s, 1, 1)!.crop!;
    expect(isMature(crop)).toBe(false);
    growDays(s, def.regrowDays! - 1);
    expect(isMature(getSoil(s, 1, 1)!.crop!)).toBe(false);
    growDays(s, 1);
    expect(isMature(getSoil(s, 1, 1)!.crop!)).toBe(true);
    expect(harvest(s, 1, 1).ok).toBe(true);
  });

  it('out-of-season crops die at the season change', () => {
    const s = newState();
    till(s, 1, 1);
    till(s, 2, 1);
    plant(s, 1, 1, 'parsnip');
    s.time.season = 'summer';
    expect(killOutOfSeason(s)).toBe(1);
    expect(getSoil(s, 1, 1)!.crop).toBeNull();
    expect(getSoil(s, 2, 1)).toBeDefined();
  });

  it('a full inventory blocks harvest and keeps the crop', () => {
    const s = newState();
    till(s, 1, 1);
    plant(s, 1, 1, 'parsnip');
    growDays(s, 4);
    addItem(s, 'melon', FULL_INVENTORY);
    expect(harvest(s, 1, 1)).toEqual({ ok: false, reason: 'full' });
    expect(getSoil(s, 1, 1)!.crop).not.toBeNull();
  });

  it('spawns weeds only on free candidate tiles, capped per day', () => {
    const s = newState();
    const candidates: [number, number][] = Array.from({ length: 50 }, (_, i) => [i, 0]);
    till(s, 0, 0);
    spawnWeeds(s, candidates);
    const weeds = Object.keys(s.farm.weeds);
    expect(weeds.length).toBe(4);
    expect(weeds).not.toContain('0,0');
  });
});
