import { describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  endDay,
  jobDefs,
  JOBS_PER_DAY,
  jobReward,
  type Ledger,
  playDay,
  projects,
  SIM_EARNED,
  welcomeFactor,
} from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

/**
 * A human-paced bot: 150 Action presses a day (about what a 15-minute session allows; the hoe, can and
 * seeds still cover several tiles per press once upgraded). Not pinned, but it must earn a real living
 * and reach the first statue level's price within its first year.
 */
describe('balance simulation (human-paced)', () => {
  it('earns a satisfying year without being a tireless bot', () => {
    const years = [42, 7, 99].map((seed) => {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
      for (let day = 1; day <= 112; day++) {
        playDay(s, ledger, 150);
        endDay(s, { passedOut: false, weedCandidates: [] });
      }
      return s.stats['earned'] ?? 0;
    });
    const median = [...years].sort((a, b) => a - b)[1]!;
    console.log(`human-paced years: ${years.join(', ')} (median ${median})`);
    expect(median).toBeLessThan(SIM_EARNED);
    expect(median).toBeGreaterThan(projects['statue']!.gold);
  });
});

/**
 * Jobs are a nudge, not a living (owner, depth round 2): over the first two weeks, three average jobs a
 * day must pay less than the farm itself earns the tireless bot (median of five seeds).
 */
describe('balance: early jobs against early farming', () => {
  it('days 2 to 14 of jobs pay at most three quarters of what the farm earns by day 14', () => {
    const farm = [42, 7, 99, 1234, 2026]
      .map((seed) => {
        const s = createInitialState();
        s.rng = seed;
        const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
        for (let day = 1; day <= 14; day++) {
          playDay(s, ledger);
          endDay(s, { passedOut: false, weedCandidates: [] });
        }
        return s.stats['earned'] ?? 0;
      })
      .sort((a, b) => a - b)[2]!;
    const early = jobDefs.filter((j) => !j.requires);
    const weight = early.reduce((n, j) => n + j.weight, 0);
    const mean =
      early.reduce((n, j) => n + j.weight * jobReward(j, (j.qty[0] + j.qty[1]) / 2, 1), 0) / weight;
    let jobsGold = 0;
    for (let day = 2; day <= 14; day++) jobsGold += JOBS_PER_DAY * mean * welcomeFactor(day);
    console.log(`farm by day 14 (median): ${farm}; jobs days 2-14: ${Math.round(jobsGold)}`);
    expect(jobsGold).toBeLessThan(farm * 0.75);
    // ...but still worth doing: a day of jobs buys a row of seeds.
    expect(JOBS_PER_DAY * mean).toBeGreaterThan(60);
  });
});
