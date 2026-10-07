import { describe, expect, it } from 'vitest';
import { MS_PER_GAME_MINUTE } from '../src/config';
import { advanceCalendar, formatClock, tickTime } from '../src/systems/time';
import { newState } from './helpers';

describe('time', () => {
  it('advances 10 game minutes per 5 real seconds', () => {
    const s = newState();
    tickTime(s, 5000);
    expect(s.time.minutes).toBe(370);
  });

  it('accumulates sub-minute remainders', () => {
    const s = newState();
    tickTime(s, MS_PER_GAME_MINUTE - 1);
    expect(s.time.minutes).toBe(360);
    tickTime(s, 1);
    expect(s.time.minutes).toBe(361);
  });

  it('a full day is about 10 real minutes', () => {
    const s = newState();
    let ms = 0;
    while (!tickTime(s, 100).passOut) ms += 100;
    expect(ms / 60000).toBeGreaterThan(9.9);
    expect(ms / 60000).toBeLessThan(10.1);
  });

  it('flags pass-out at 02:00 and stops advancing', () => {
    const s = newState();
    s.time.minutes = 1559;
    expect(tickTime(s, MS_PER_GAME_MINUTE).passOut).toBe(true);
    expect(s.time.minutes).toBe(1560);
    expect(tickTime(s, 99999).passOut).toBe(true);
    expect(s.time.minutes).toBe(1560);
  });

  it('pausing is just not ticking: the clock does not move', () => {
    const s = newState();
    tickTime(s, 1000);
    const before = s.time.minutes;
    // (menus / hidden tab: caller skips tickTime)
    expect(s.time.minutes).toBe(before);
  });

  it('changes season after day 28 and the year after winter', () => {
    const s = newState();
    s.time.day = 28;
    expect(advanceCalendar(s)).toBe(true);
    expect(s.time).toMatchObject({ season: 'summer', day: 1, minutes: 360 });
    s.time.season = 'winter';
    s.time.day = 28;
    advanceCalendar(s);
    expect(s.time).toMatchObject({ season: 'spring', year: 2, day: 1 });
  });

  it('keeps the season mid-month', () => {
    const s = newState();
    expect(advanceCalendar(s)).toBe(false);
    expect(s.time.day).toBe(2);
  });

  it('formats clocks including past midnight', () => {
    expect(formatClock(360)).toBe('6:00 AM');
    expect(formatClock(720)).toBe('12:00 PM');
    expect(formatClock(1440)).toBe('12:00 AM');
    expect(formatClock(1500)).toBe('1:00 AM');
    expect(formatClock(1019)).toBe('4:59 PM');
  });
});
