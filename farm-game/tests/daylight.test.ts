import { describe, expect, it } from 'vitest';
import { game } from '../src/data';
import { DAYLIGHT_KEYS, daylightColor, indoorColor, nightAmount } from '../src/ui/daylight';

const brightness = (c: number) => ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255);

describe('daylight', () => {
  it('is neutral at midday and dark at night', () => {
    expect(daylightColor(720)).toBe(0xffffff);
    expect(brightness(daylightColor(1500))).toBeLessThan(brightness(0xffffff) * 0.75);
  });
  it('gets steadily darker through the evening', () => {
    let last = Infinity;
    for (let m = 1020; m <= 1560; m += 30) {
      const b = brightness(daylightColor(m));
      expect(b).toBeLessThanOrEqual(last);
      last = b;
    }
  });
  it('clamps outside the keyframes', () => {
    expect(daylightColor(0)).toBe(daylightColor(360));
    expect(daylightColor(5000)).toBe(daylightColor(1560));
  });
  it('indoors is always brighter than outdoors at night', () => {
    expect(brightness(indoorColor(daylightColor(1500)))).toBeGreaterThan(
      brightness(daylightColor(1500)),
    );
  });
  it('night amount ramps 0..1', () => {
    expect(nightAmount(600)).toBe(0);
    expect(nightAmount(1500)).toBe(1);
    expect(nightAmount(1230)).toBeGreaterThan(0);
  });

  it('keyframes span exactly the game day, so a rebalanced day length is caught here', () => {
    expect(DAYLIGHT_KEYS[0]![0]).toBe(game.dayStartMinutes);
    expect(DAYLIGHT_KEYS[DAYLIGHT_KEYS.length - 1]![0]).toBe(game.dayEndMinutes);
  });
});

describe('night glow', () => {
  it('is off by day, full at night, and comes on in four steps', async () => {
    const { glowAmount } = await import('../src/ui/daylight');
    expect(glowAmount(720)).toBe(0);
    expect(glowAmount(1080)).toBe(0);
    expect(glowAmount(1400)).toBe(1);
    const levels = new Set<number>();
    for (let m = 1000; m <= 1560; m += 5) levels.add(glowAmount(m));
    expect([...levels].sort()).toEqual([0, 0.25, 0.5, 0.75, 1]);
    let last = 0;
    for (let m = 1000; m <= 1560; m += 5) {
      expect(glowAmount(m)).toBeGreaterThanOrEqual(last);
      last = glowAmount(m);
    }
  });
  it('keeps the mine lit and the house cozy', async () => {
    const { glowFor } = await import('../src/ui/daylight');
    expect(glowFor('mine', 720, false)).toBeGreaterThan(0);
    expect(glowFor('house', 720, false)).toBeGreaterThan(0);
    expect(glowFor('farm', 720, true)).toBe(0);
    expect(glowFor('house', 1400, false)).toBe(1);
  });
});
