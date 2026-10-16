import { describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  endDay,
  goalProgress,
  type Ledger,
  maxEnergy,
  playDay,
  SIM_EARNED,
} from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

describe('balance simulation (decent player, full year)', () => {
  it('a competent farmer earns a satisfying amount from crops, orders and jars, without a runaway', () => {
    const s = createInitialState();
    s.rng = 42;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
    const log: string[] = [];
    for (let day = 1; day <= 112; day++) {
      playDay(s, ledger);
      endDay(s, { passedOut: false, weedCandidates: [] });
      ledger.shipped += s.lastSummary?.total ?? 0;
      if (day % 14 === 0)
        log.push(
          `day ${day} (${s.time.season} ${s.time.day}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, ` +
            `shipped ${ledger.shipped}, orders ${ledger.orders}, jars ${ledger.jarsLoaded}, ` +
            `plots ${s.plots.length}, energy ${maxEnergy(s)}, eggs ${ledger.eggs}, ` +
            `goal ${goalProgress(s)?.goal.id ?? 'done'}`,
        );
    }
    console.log(log.join('\n'));
    const earned = s.stats['earned'] ?? 0;
    expect(s.money).toBeGreaterThan(0);
    expect(earned).toBeGreaterThan(SIM_EARNED * 0.67);
    expect(earned).toBeLessThan(SIM_EARNED * 1.7);
    // Side income stays a side: requests are a bonus on top of the farm, not the farm.
    expect(ledger.orders).toBeLessThan(earned * 0.35);
    expect(ledger.jarsLoaded).toBeGreaterThan(20);
    // Gold has somewhere to go: the bot bought land.
    expect(s.plots.length).toBeGreaterThan(2);
    // Scarecrows over every plot: the crows get next to nothing.
    expect(s.stats['crowsAte'] ?? 0).toBeLessThan(10);
    // Clay takes one request a day, and only on its last day (critique 7, F2): what he takes, the bot had
    // its full days for. Logged, not bounded: most of what he takes would have expired anyway.
    const posted = Math.max(...s.orders.list.map((o) => o.id));
    console.log(`requests posted ${posted}, Clay took ${s.stats['rivalTook'] ?? 0}`);
    for (const o of s.orders.list.filter((x) => x.rival)) expect(o.takenOn).toBe(o.until);
  });

  // One seed is a tripwire, not evidence (critique 5, F9): the same bot on five seeds, judged on the median.
  it('five seeds agree: the median year sits near the pinned one and none runs away', () => {
    const years = [42, 7, 99, 1234, 2026].map((seed) => {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
      for (let day = 1; day <= 112; day++) {
        playDay(s, ledger);
        endDay(s, { passedOut: false, weedCandidates: [] });
      }
      return s.stats['earned'] ?? 0;
    });
    const median = [...years].sort((a, b) => a - b)[2]!;
    console.log(`five seeds: ${years.join(', ')} (median ${median})`);
    expect(median).toBeGreaterThan(SIM_EARNED * 0.8);
    expect(median).toBeLessThan(SIM_EARNED * 1.25);
    for (const y of years) {
      expect(y).toBeGreaterThan(SIM_EARNED * 0.6);
      expect(y).toBeLessThan(SIM_EARNED * 1.6);
    }
  });
});
