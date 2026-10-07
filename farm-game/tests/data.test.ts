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

describe('content validation fails loudly on bad data', () => {
  /** Run `fn` with a temporary edit to shared data, always restoring it. */
  function withEdit(edit: () => () => void, fn: () => void) {
    const undo = edit();
    try {
      fn();
    } finally {
      undo();
    }
  }

  it('rejects a seed that plants an unknown crop', () => {
    withEdit(
      () => {
        const old = items['parsnip_seed']!.plants;
        items['parsnip_seed']!.plants = 'nope';
        return () => (items['parsnip_seed']!.plants = old);
      },
      () => expect(() => validateContent()).toThrow(/unknown crop "nope"/),
    );
  });

  it('rejects a crop that harvests a missing item', () => {
    withEdit(
      () => {
        const old = crops['potato']!.harvestItem;
        crops['potato']!.harvestItem = 'ghost';
        return () => (crops['potato']!.harvestItem = old);
      },
      () => expect(() => validateContent()).toThrow(/unknown item "ghost"/),
    );
  });

  it('rejects a crop with too few growth stages', () => {
    withEdit(
      () => {
        const old = crops['potato']!.stageDays;
        crops['potato']!.stageDays = [1];
        return () => (crops['potato']!.stageDays = old);
      },
      () => expect(() => validateContent()).toThrow(/stageDays/),
    );
  });

  it('rejects an item missing required art/description fields', () => {
    withEdit(
      () => {
        const old = items['fiber']!.description;
        items['fiber']!.description = '';
        return () => (items['fiber']!.description = old);
      },
      () => expect(() => validateContent()).toThrow(/missing "description"/),
    );
  });

  it('passes again once the data is restored', () => {
    expect(() => validateContent()).not.toThrow();
  });
});
