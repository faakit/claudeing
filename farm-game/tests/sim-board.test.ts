import { describe, expect, it, vi } from 'vitest';
import { boardLine, boardRun } from './sim-bot';

// Year-long sims take seconds each; never fail on vitest's 5 s default under load (critique 11, F8).
vi.setConfig({ testTimeout: 60_000 });

/**
 * The board race against Clay for a farmer who never fishes or forages (critique 9, F1): he scores only on
 * farm goods, so a farmer who keeps what the requests want wins most seasons, and one who ships everything
 * still wins some. Two years, three seeds, from spring of year one (Clay starts on day 8).
 */
describe('balance simulation: the board race for a pure farmer', () => {
  it('a farmer who keeps goods for the board wins most seasons; shipping everything wins fewer', () => {
    const log: string[] = [];
    let keepWins = 0;
    let shipWins = 0;
    for (const seed of [42, 7, 99]) {
      const keep = boardRun({ keepForBoard: true }, seed);
      const ship = boardRun({}, seed);
      keepWins += keep.wins;
      shipWins += ship.wins;
      log.push(`seed ${seed}: keep ${boardLine(keep)} | ship ${boardLine(ship)}`);
    }
    console.log(log.join(String.fromCharCode(10)));
    // Of 24 seasons. Critique 9: 0 of 72. Round 3 first fix: keep 23, ship 13 (a formality, critique 10 F2).
    // Now Clay takes farm rows first and ships crates (weekly, every 3rd day while you lead by 4): keep 19, ship 1.
    // Round 4, with the calibrated start (more spring crop rows filled, as in play): keep 21, ship 4; then
    // crates counted from the last one and daily while you lead by 5 (critique 12, F1): keep 20 (margins of 1
    // to 6, mostly 2 to 4), ship 3.
    expect(keepWins).toBeGreaterThanOrEqual(12);
    expect(keepWins).toBeLessThanOrEqual(22); // a race, not a walkover
    expect(shipWins).toBeLessThan(keepWins / 2); // keeping goods for the board is what wins it
  });
});
