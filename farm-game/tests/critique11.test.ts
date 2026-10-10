import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, goals, mail } from '../src/data';
import { POINTS_PER_HEART } from '../src/systems/friendship';
import { boardWants, requestWants } from '../src/systems/orders';
import { BOARD_PRIZE, crateDue, rivalCrate, rivalNotice, settleSeason } from '../src/systems/rival';
import { morningSpecial } from '../src/systems/specials';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import { binWantedSub, keptLine } from '../src/ui/panels/binText';
import type { GameState, Order } from '../src/state/GameState';
import { newState } from './helpers';

const friend = (s: GameState) =>
  (s.friends['clay'] = { points: 5 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 });

describe("critique 11 F1/F2: Clay's crates are said, keep up with a leader, and never end a season", () => {
  it('every 7th day, every 3rd while you lead by four, never on day 28', () => {
    const s = newState();
    expect(crateDue(s, 14)).toBe(true);
    expect(crateDue(s, 12)).toBe(false);
    expect(crateDue(s, 28)).toBe(false); // the season's last move is yours
    s.stats['board.s0.you'] = 6;
    expect(crateDue(s, 12)).toBe(true);
    expect(crateDue(s, 13)).toBe(false);
    expect(crateDue(s, 27)).toBe(true);
    expect(crateDue(s, 28)).toBe(false);
  });

  it('the board says a crate is coming tonight when he has no scoring target', () => {
    const s = newState();
    s.time.day = 14;
    s.orders = { day: absoluteDay(s), list: [] };
    expect(rivalNotice(s)).toBe('Clay ships a crate tonight: a point.');
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
  });

  it('the intro letter names the crates; a friendly Clay still ships them and does not gloat', () => {
    expect(mail.letters.find((l) => l.id === 'clay_intro')!.text).toMatch(/crate/);
    expect(measureText(mail.letters.find((l) => l.id === 'clay_intro')!.text)).toBeLessThanOrEqual(
      184 * 8,
    );
    const s = newState();
    friend(s);
    s.time.day = 15; // the morning after day 14
    expect(rivalCrate(s)).toBe(true);
    s.stats['board.s0.rival'] = 4;
    s.stats['board.s0.you'] = 1;
    s.time.season = 'summer';
    s.time.day = 1;
    const letters = s.mail.list.length;
    expect(settleSeason(s)).toMatch(/Clay won the board/);
    expect(s.mail.list.length).toBe(letters);
  });
});

describe('critique 11 F4/F9: year-two text and the winter prize', () => {
  it('two no-point rows due in year two: "takes two"', () => {
    const s = newState();
    s.time.year = 2;
    s.time.day = 10;
    const today = absoluteDay(s);
    const row = (id: number, item: string): Order => ({
      id,
      item: `${item}|0|`,
      qty: 2,
      reward: 100,
      xp: 5,
      done: false,
      from: today - 1,
      until: today,
    });
    s.orders = { day: today, list: [row(1, 'trout'), row(2, 'wild_leek'), row(3, 'carp')] };
    expect(rivalNotice(s)).toBe('Clay takes two at 2:00 PM: no point.');
    expect(measureText(rivalNotice(s))).toBeLessThanOrEqual(184);
  });

  it('winter of year one pays the year-one prize on spring 1 of year two', () => {
    const s = newState();
    s.stats['board.s3.you'] = 6;
    s.time.year = 2;
    s.time.season = 'spring';
    s.time.day = 1;
    const money = s.money;
    expect(settleSeason(s)).toContain(`+${BOARD_PRIZE}g`);
    expect(s.money).toBe(money + BOARD_PRIZE);
  });
});

describe('critique 11 F5/F6/F10: small feedback', () => {
  it('the wanted bin line fits with a bin count; the kept toast names the special apart', () => {
    expect(binWantedSub(16, 99, 12)).toBe('Board 16  bin 12');
    expect(measureText(binWantedSub(16, 99, 12))).toBeLessThanOrEqual(81);
    const kept = new Map([['potato|', 16]]);
    expect(keptLine(kept, { kind: 'potato|', giver: 'Rosa', requests: 5 })).toBe(
      'Kept 5 Potato for the board and 11 for Rosa.',
    );
    expect(keptLine(kept, { kind: 'potato|', giver: 'Rosa', requests: 0 })).toBe(
      'Kept 16 Potato for Rosa.',
    );
    const s = newState();
    s.special = { id: 'x', giver: 'rosa', item: 'potato', qty: 15, given: 4, reward: 1, due: 20 };
    expect(boardWants(s).get('potato|')).toBe(11);
    expect(requestWants(s).get('potato|')).toBeUndefined();
  });

  it('a special that ran out is said even when a new one is posted the same morning', () => {
    const s = newState();
    s.special = { id: 'x', giver: 'rosa', item: 'potato', qty: 15, given: 9, reward: 1, due: 28 };
    s.time.season = 'summer';
    s.time.day = 1;
    const news = morningSpecial(s) ?? '';
    expect(news).toMatch(/^The special order ran out\. Paid \d+g for what you brought\./);
    expect(news).toMatch(/Special order: /);
  });

  it('of the goals appended this round, the fishing one is last', () => {
    expect(goals.at(-1)?.id).toBe('legend4');
    expect(game.rival.startDay).toBe(8);
  });
});
