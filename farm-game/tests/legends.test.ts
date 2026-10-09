import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { fish, mail } from '../src/data';
import { fishFor, resolveCatch } from '../src/systems/fishing';
import { orderCandidates } from '../src/systems/orders';
import { measureText } from '../src/ui/fontMetrics';
import { newState } from './helpers';

const legends = fish.filter((f) => f.legend);

describe('legendary fish', () => {
  it('one per season, each hard, and each bites until caught once', () => {
    expect(legends).toHaveLength(4);
    expect(new Set(legends.flatMap((f) => f.seasons)).size).toBe(4);
    for (const f of legends) expect(f.difficulty).toBeGreaterThanOrEqual(0.8);
    const s = newState();
    s.time.season = 'summer';
    expect(fishFor(s, 'farm').map((f) => f.item)).toContain('sun_carp');
    expect(resolveCatch(s, 'sun_carp', { caught: true, perfect: false }).ok).toBe(true);
    expect(s.stats['legends']).toBe(1);
    expect(fishFor(s, 'farm').map((f) => f.item)).not.toContain('sun_carp');
  });

  it('weather legends wait for rain, and the board never asks for a legend', () => {
    const s = newState();
    s.time.season = 'fall';
    s.weather = 'sunny';
    expect(fishFor(s, 'woods').map((f) => f.item)).not.toContain('old_whiskers');
    s.weather = 'rain';
    expect(fishFor(s, 'woods').map((f) => f.item)).toContain('old_whiskers');
    for (const season of ['spring', 'summer', 'fall', 'winter'] as const) {
      s.time.season = season;
      expect(orderCandidates(s).some((r) => legends.some((f) => f.item === r.item))).toBe(false);
    }
  });

  it("Finn's letter tells where they hide, and fits a few letter pages", () => {
    const letter = mail.letters.find((l) => l.id === 'legends')!;
    expect(letter.from).toBe('finn');
    expect(measureText(letter.text)).toBeLessThanOrEqual(184 * 10);
  });
});
