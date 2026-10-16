import { describe, expect, it, vi } from 'vitest';
import { createInitialState, endDay, game, type Ledger, playDay } from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

/**
 * The first week (owner, round 4): the human-paced bot, doing its jobs. Nothing ripens before day 5, so the
 * settling-in pay on days 3 and 4 is the only income then; it must stay small, and early gold must not swing
 * the year (the round-3 "+18% to +76% for 500g on day 7" came from a bot that kept its starting seeds and
 * waited for cauliflower: no income until day 11).
 */
describe('balance: the first week', () => {
  const run = (seed: number, opts: { welcome: boolean; lump?: number }) => {
    const saved = game.welcomeJobs;
    if (!opts.welcome) game.welcomeJobs = undefined;
    try {
      const s = createInitialState();
      s.rng = seed;
      const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
      const earned: number[] = [0];
      let firstPlot = 0;
      for (let day = 1; day <= 112; day++) {
        if (day === 7) s.money += opts.lump ?? 0;
        playDay(s, ledger, 150, { jobs: true });
        endDay(s, { passedOut: false, weedCandidates: [] });
        earned.push(s.stats['earned'] ?? 0);
        if (!firstPlot && s.plots.length > 1) firstPlot = day;
      }
      return { earned, firstPlot };
    } finally {
      game.welcomeJobs = saved;
    }
  };
  it('days 3 and 4 earn a little, the week earns more, and a 500g lump on day 7 barely moves the year', () => {
    const log: string[] = [];
    const lifts: number[] = [];
    for (const seed of [42, 7, 99, 1234, 2026]) {
      const before = run(seed, { welcome: false });
      const after = run(seed, { welcome: true });
      const lump = run(seed, { welcome: true, lump: 500 });
      const days34 = (r: typeof after) => r.earned[4]! - r.earned[2]!;
      const lift = lump.earned[112]! / after.earned[112]! - 1;
      lifts.push(lift);
      log.push(
        `seed ${seed}: days 3-4 ${days34(before)} -> ${days34(after)}, day 7 ${before.earned[7]} -> ${after.earned[7]}, ` +
          `day 14 ${before.earned[14]} -> ${after.earned[14]}, first plot day ${before.firstPlot} -> ${after.firstPlot}, ` +
          `year ${before.earned[112]} -> ${after.earned[112]} (+500g on day 7: ${(lift * 100).toFixed(0)}%)`,
      );
      expect(days34(after)).toBeGreaterThan(days34(before));
      expect(days34(after) - days34(before)).toBeLessThan(400); // a nudge, not a living
      expect(after.earned[4]!).toBeLessThan(after.earned[7]! / 2); // the harvest still makes the week
    }
    console.log(log.join(String.fromCharCode(10)));
    const median = [...lifts].sort((a, b) => a - b)[2]!;
    console.log(`+500g on day 7, median lift ${(median * 100).toFixed(1)}%`);
    expect(Math.abs(median)).toBeLessThan(0.15);
  });
});
