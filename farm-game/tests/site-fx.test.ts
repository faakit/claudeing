import { describe, expect, it } from 'vitest';
import { chips, PICK, PICK_LOOSE_MS, SITE_BEAT, SPADE } from '../src/fx/SiteFx';

describe('restoration beats (feel critic, review 6)', () => {
  it('the pickaxe day: three strikes about 560 ms apart, the stone loose on the third, about 2.6 s', () => {
    expect(PICK.swings).toEqual([0, 560, 1120]);
    expect(PICK_LOOSE_MS).toBe(PICK.swings[2] + PICK.strike);
    // the stone has rolled and faded before the world moves again
    expect(PICK_LOOSE_MS + PICK.roll + PICK.rest + PICK.fade).toBeLessThanOrEqual(
      SITE_BEAT.pickaxe + 100,
    );
    expect(SITE_BEAT.pickaxe).toBeLessThanOrEqual(2600);
  });

  it('the spade day: two cuts, then the water runs in with time to see it full, under 2 s', () => {
    expect(SPADE.fillAt).toBeGreaterThan(SPADE.swings[1] + SPADE.strike);
    expect(SPADE.fillAt + SPADE.fill).toBeLessThan(SITE_BEAT.channel);
    expect(SITE_BEAT.channel).toBeLessThan(2000);
  });

  it('chips fly out toward the farmer, up and out, 4 to 6 a strike, 1-2 px', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const toward of [-1, 1])
      for (const strike of [0, 1, 2]) {
        const c = chips(toward, strike, rnd);
        expect(c.length).toBe(4 + strike);
        for (const x of c) {
          expect(Math.sign(x.x1)).toBe(toward);
          expect(x.h).toBeGreaterThan(0);
          expect([1, 2]).toContain(x.size);
        }
      }
  });
});
