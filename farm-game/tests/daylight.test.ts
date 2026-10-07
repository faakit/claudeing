import { describe, expect, it } from 'vitest';
import { daylightColor, indoorColor, nightAmount } from '../src/ui/daylight';

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
});
