import { describe, expect, it, vi } from 'vitest';
import { boardLine, boardRun, SIM_EARNED } from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

/**
 * The board race against Clay for a farmer who never fishes or forages (critique 9, F1): he scores only on
 * farm goods, so a farmer who keeps what the requests want wins most seasons, and one who ships everything
 * still wins some. Two years, three seeds, from spring of year one (Clay starts on day 8).
 */
describe('balance simulation: the board race with evening fishing', () => {
  it('fishing in the evening adds board points and some gold, never a runaway (sim fidelity, round 3)', () => {
    const log: string[] = [];
    for (const seed of [42, 7, 99]) {
      const farmer = boardRun({ keepForBoard: true }, seed);
      const fisher = boardRun({ keepForBoard: true, fish: true }, seed);
      log.push(
        `seed ${seed}: farmer y1 ${farmer.yearOne} ${boardLine(farmer)} | fisher y1 ${fisher.yearOne} caught ${fisher.caught} ${boardLine(fisher)}`,
      );
      const you = (r: ReturnType<typeof boardRun>) => r.out.reduce((n, t) => n + t.you, 0);
      expect(fisher.caught).toBeGreaterThan(100);
      expect(you(fisher)).toBeGreaterThan(you(farmer) * 0.8); // fishing costs no board points
      // A few fish an evening are only about 2k by day 14, but early gold compounds: seeds, then land on day 28
      // instead of later (round 3: 379k to 407k for the year against a 250k median). So sensitive is year one to
      // early gold (critique 10, F7: one 300g board prize moved a seed by 60k) that the bound is against the
      // pinned median, not one farmer.
      expect(fisher.yearOne).toBeLessThan(SIM_EARNED * 2);
    }
    console.log(log.join(String.fromCharCode(10)));
  });
});
