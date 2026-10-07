import { describe, expect, it } from 'vitest';
import { crops, goals, items, validateContent } from '../src/data';

describe('content data', () => {
  it('passes cross-reference validation', () => {
    expect(() => validateContent()).not.toThrow();
  });

  it('every crop turns a profit within its season', () => {
    for (const [id, c] of Object.entries(crops)) {
      const seed = Object.values(items).find((i) => i.plants === id)!;
      const grow = c.stageDays.reduce((a, b) => a + b, 0);
      // Regrowing crops pay out repeatedly: count harvests that fit in a 28-day season.
      const harvests = c.regrowDays ? 1 + Math.floor((28 - grow) / c.regrowDays) : 1;
      expect(items[c.harvestItem]!.sellPrice! * harvests, id).toBeGreaterThan(seed.buyPrice!);
      expect(grow, `${id} must mature within a season`).toBeLessThanOrEqual(28);
    }
  });

  it('seeds sell for less than they cost (no buy/sell exploit)', () => {
    for (const i of Object.values(items).filter((i) => i.type === 'seed')) {
      expect(i.sellPrice!).toBeLessThan(i.buyPrice!);
    }
  });

  it('goal targets for a stat never decrease along the chain', () => {
    const last: Record<string, number> = {};
    for (const g of goals) {
      expect(g.target).toBeGreaterThanOrEqual(last[g.stat] ?? 0);
      last[g.stat] = g.target;
    }
  });
});
