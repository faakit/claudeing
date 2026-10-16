import { describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  endDay,
  fundProjects,
  type Ledger,
  playDay,
  projectLevel,
  projects,
} from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

/**
 * The same bot over two years, also funding town projects as soon as it can (it is handed the goods a
 * project asks for, standing in for the mine and the machines it does not play). This measures whether the
 * late-game sinks absorb a tireless farmer's gold.
 */
describe('balance simulation (two years, funding projects)', () => {
  it("the late-game sinks absorb a tireless farmer's second year", () => {
    const s = createInitialState();
    s.rng = 42;
    const ledger: Ledger = { shipped: 0, orders: 0, jarsLoaded: 0, eggs: 0 };
    const log: string[] = [];
    let sunk = 0;
    for (let day = 1; day <= 224; day++) {
      playDay(s, ledger);
      sunk += fundProjects(s);
      endDay(s, { passedOut: false, weedCandidates: [] });
      if (day % 28 === 0)
        log.push(
          `day ${day} (y${s.time.year} ${s.time.season}): gold ${s.money}, earned ${s.stats['earned'] ?? 0}, ` +
            `sunk ${sunk}, projects ${s.stats['projectsDone'] ?? 0}, statue ${projectLevel(s, 'statue')}`,
        );
    }
    console.log(log.join('\n'));
    // Without the repeatable statue this bot ended year two holding about 280k with nothing to buy
    // (depth round 2). Now most of it goes into the statue (level 3 or more by the end of year two).
    expect(sunk).toBeGreaterThan(250_000);
    expect(s.money).toBeLessThan(100_000);
    expect(projectLevel(s, 'statue')).toBeGreaterThanOrEqual(3);
    // board projects only: a place's fund is opened from its site and counts at the opening (systems/valley.ts)
    expect(s.stats['projectsDone']).toBe(
      Object.values(projects).filter((p) => !p.repeat && !p.place).length,
    );
  });
});
