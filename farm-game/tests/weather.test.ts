import { describe, expect, it } from 'vitest';
import { performAction } from '../src/systems/actions';
import { endDay } from '../src/systems/day';
import { getSoil, isMature } from '../src/systems/farming';
import { rollWeather } from '../src/systems/weather';
import { equip, grass, newState } from './helpers';

describe('weather', () => {
  it('a new game starts with calm sunny days', () => {
    const s = newState();
    expect(s.weather).toBe('sunny');
    for (let i = 0; i < 50; i++) {
      s.rng = i * 7919;
      expect(rollWeather(s)).toBe('sunny'); // day 1 of year 1
    }
  });

  it('winter never rains and rain frequency follows the season chance', () => {
    const s = newState();
    s.time.day = 10;
    s.time.season = 'winter';
    for (let i = 0; i < 300; i++) expect(rollWeather(s)).toBe('sunny');
    s.time.season = 'spring';
    let rain = 0;
    for (let i = 0; i < 3000; i++) if (rollWeather(s) === 'rain') rain++;
    expect(rain / 3000).toBeGreaterThan(0.2);
    expect(rain / 3000).toBeLessThan(0.36);
  });

  it('is deterministic for a given seed', () => {
    const a = newState();
    const b = newState();
    a.time.day = b.time.day = 9;
    expect(rollWeather(a)).toBe(rollWeather(b));
  });

  it('a rainy morning waters every tilled tile so crops grow without the can', () => {
    const s = newState();
    performAction(s, grass(5, 5));
    equip(s, 'parsnip_seed');
    performAction(s, grass(5, 5));
    s.time.day = 10;
    let sawRain = false;
    for (let attempt = 0; attempt < 60 && !sawRain; attempt++) {
      const t = JSON.parse(JSON.stringify(s)) as typeof s;
      t.rng = attempt * 104729 + 1;
      const sum = endDay(t, { passedOut: false, weedCandidates: [] });
      if (sum.weather === 'rain') {
        sawRain = true;
        expect(t.weather).toBe('rain');
        expect(getSoil(t, 5, 5)!.watered).toBe(true);
        expect(isMature(getSoil(t, 5, 5)!.crop!)).toBe(false);
      } else {
        expect(getSoil(t, 5, 5)!.watered).toBe(false);
      }
    }
    expect(sawRain).toBe(true);
  });
});
