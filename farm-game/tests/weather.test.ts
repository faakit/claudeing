import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { fish as fishTable } from '../src/data';
import { endDay } from '../src/systems/day';
import { pickFish } from '../src/systems/fishing';
import { addItem } from '../src/systems/inventory';
import { placeObject } from '../src/systems/placeables';
import { migrate } from '../src/systems/save';
import { isWet, rollWeather } from '../src/systems/weather';
import { growTree, treeOf } from '../src/systems/trees';
import { newState } from './helpers';

const sleep = (s: ReturnType<typeof newState>) =>
  endDay(s, { passedOut: false, weedCandidates: [], forageSpots: {} });

describe('forecast', () => {
  it("tomorrow's weather is announced tonight and arrives as announced", () => {
    const s = newState();
    s.time.year = 2;
    for (let i = 0; i < 40; i++) {
      s.time.day = 1; // stay within the season
      const announced = s.forecast;
      sleep(s);
      expect(s.weather).toBe(announced);
    }
  });

  it('the first days of a new game are calm', () => {
    const s = newState();
    expect(rollWeather(s)).toBe('sunny');
  });

  it('storms only come in summer and fall, and are much rarer than rain', () => {
    const s = newState();
    s.time.year = 2;
    const counts = { spring: 0, summer: 0, fall: 0, winter: 0 };
    let storms = 0;
    let rains = 0;
    for (const season of Object.keys(counts) as (keyof typeof counts)[]) {
      s.time.season = season;
      for (let i = 0; i < 600; i++) {
        const w = rollWeather(s);
        if (w === 'storm') {
          counts[season] += 1;
          storms += 1;
        }
        if (w === 'rain') rains += 1;
      }
    }
    expect(counts.spring + counts.winter).toBe(0);
    expect(counts.summer).toBeGreaterThan(0);
    expect(counts.fall).toBeGreaterThan(0);
    expect(storms).toBeLessThan(rains / 2);
  });
});

describe('storms', () => {
  it('are wet: they water the soil for free', () => {
    const s = newState();
    s.farm.tiles['3,3'] = { watered: false, crop: null };
    s.forecast = 'storm';
    sleep(s);
    expect(s.weather).toBe('storm');
    expect(isWet(s.weather)).toBe(true);
    expect(s.farm.tiles['3,3']?.watered).toBe(true);
  });

  it('shake ripe fruit off the trees, so picking before bed pays', () => {
    const s = newState();
    s.time.season = 'spring';
    const tree = placeObject(s, 'farm', 4, 4, 'cherry_sapling');
    for (let i = 0; i < 13; i++) growTree(tree, 'spring');
    expect(treeOf(tree).fruit).toBeGreaterThan(0);
    s.forecast = 'storm';
    const summary = sleep(s);
    expect(treeOf(tree).fruit).toBe(0);
    expect((summary.notes ?? []).some((n) => n.includes('storm blew fruit'))).toBe(true);
  });

  it('leave a rainbow: the next morning has a second helping of forage', () => {
    const s = newState();
    s.forecast = 'storm';
    const spots = {
      woods: Array.from(
        { length: 40 },
        (_, i) => [2 + (i % 10), 3 + Math.floor(i / 10)] as [number, number],
      ),
    };
    sleep(s);
    s.forecast = 'sunny';
    const summary = endDay(s, { passedOut: false, weedCandidates: [], forageSpots: spots });
    expect((summary.notes ?? []).some((n) => n.includes('rainbow'))).toBe(true);
    const calm = newState();
    calm.forecast = 'sunny';
    sleep(calm);
    calm.forecast = 'sunny';
    endDay(calm, { passedOut: false, weedCandidates: [], forageSpots: spots });
    expect(Object.keys(s.forage['woods'] ?? {}).length).toBeGreaterThan(
      Object.keys(calm.forage['woods'] ?? {}).length,
    );
  });

  it('stir the water: wet-weather fish bite more often than on a rainy day', () => {
    const wetFish = new Set(fishTable.filter((f) => f.weather).map((f) => f.item));
    const share = (weather: 'rain' | 'storm') => {
      const s = newState();
      s.time.season = 'summer';
      s.weather = weather;
      let hits = 0;
      for (let i = 0; i < 600; i++) if (wetFish.has(pickFish(s, 'town')?.item ?? '')) hits += 1;
      return hits / 600;
    };
    expect(share('storm')).toBeGreaterThan(share('rain'));
  });
});

describe('save v6', () => {
  it('v5 saves gain a calm forecast; junk weather falls back to sunny', () => {
    const s = newState();
    const raw = JSON.parse(JSON.stringify({ ...s, version: 5 }));
    delete raw.forecast;
    expect(migrate(raw).forecast).toBe('sunny');
    const raw2 = JSON.parse(JSON.stringify(s));
    raw2.weather = 'hail';
    raw2.forecast = 'storm';
    const out = migrate(raw2);
    expect(out.weather).toBe('sunny');
    expect(out.forecast).toBe('storm');
    addItem(out, 'bait', 1);
  });
});
