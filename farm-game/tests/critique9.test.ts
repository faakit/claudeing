import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { cart, game, items, mail, npcs, projects } from '../src/data';
import { cartTag } from '../src/systems/cart';
import { endDay } from '../src/systems/day';
import { shipAllProduce } from '../src/systems/economy';
import { addItem, countItem } from '../src/systems/inventory';
import {
  boardWants,
  CROP_SHARE,
  cropSupply,
  generateOrders,
  keepForRequests,
  wantedByBoard,
} from '../src/systems/orders';
import { isProjectOpen, itemNeeds, landmarksOn } from '../src/systems/projects';
import {
  applyRival,
  BOARD_PRIZE,
  boardScoreLine,
  boardTally,
  isFarmGood,
  lastSeasonLine,
  rivalMinute,
  rivalNotice,
  settleSeason,
} from '../src/systems/rival';
import { migrate } from '../src/systems/save';
import { specialGiveCount } from '../src/systems/specials';
import { absoluteDay } from '../src/systems/time';
import { measureText } from '../src/ui/fontMetrics';
import { boardWantsLine, keptLine } from '../src/ui/panels/binText';
import { cartSub } from '../src/ui/panels/cartText';
import type { GameState, Order } from '../src/state/GameState';
import { newState } from './helpers';

/** A board on the rival's first day with one request, posted yesterday and on its last day. */
function oneRow(item: string, qty = 2, other = 'parsnip'): GameState {
  const s = newState();
  s.time.day = game.rival.startDay;
  const today = absoluteDay(s);
  const order = (id: number, it: string): Order => ({
    id,
    item: `${it}|0|`,
    qty,
    reward: 100 * id,
    xp: 5,
    done: false,
    from: today - 1,
    until: today,
  });
  // A second, cheaper row so his pick is never the last open one.
  s.orders = { day: today, list: [order(2, item), order(1, other)] };
  return s;
}

describe('critique 9 F1: the season score against Clay', () => {
  it('the score has a line of its own every day once Clay is about, and every line fits', () => {
    const s = oneRow('trout');
    expect(boardScoreLine(s)).toBe('This season: you 0, Clay 0.');
    expect(rivalNotice(s)).toBe('Clay wants this one at 2:00 PM.'); // his target does not hide the score
    expect(measureText('This season: you 99, Clay 99.')).toBeLessThanOrEqual(184);
    for (const line of [
      'Clay scores on farm goods only.',
      'Last season: you won 99 to 99.',
      'Last season: Clay won 99 to 99.',
      'Last season: a draw, 99 to 99.',
      'Clay took it: no point.',
    ])
      expect(measureText(line), line).toBeLessThanOrEqual(184);
    const early = newState();
    expect(boardScoreLine(early)).toBeNull(); // before day 8 the board says nothing about Clay
  });

  it('Clay scores only on farm goods: fish, wild goods and jam of wild goods are taken without a point', () => {
    const fish = oneRow('trout', 2, 'wild_leek');
    fish.time.minutes = rivalMinute(fish);
    const took = applyRival(fish)!;
    expect(took.item).toMatch(/^trout/);
    expect(took.noPoint).toBe(true);
    expect(boardTally(fish, absoluteDay(fish)).rival).toBe(0);

    const crop = oneRow('potato');
    crop.time.minutes = rivalMinute(crop);
    expect(applyRival(crop)?.noPoint).toBeUndefined();
    expect(boardTally(crop, absoluteDay(crop)).rival).toBe(1);

    expect(isFarmGood({ item: 'egg|0|' })).toBe(true);
    expect(isFarmGood({ item: 'jam|0|strawberry' })).toBe(true);
    expect(isFarmGood({ item: 'pickles|0|wild_leek' })).toBe(false);
    expect(isFarmGood({ item: 'wild_leek|0|' })).toBe(false);
    // The mark survives a save.
    expect(migrate(JSON.parse(JSON.stringify(fish))).orders.list[0]?.noPoint).toBe(true);
  });

  it('the stakes are said before anyone wins: the intro letter and the losing letter name the prize', () => {
    const intro = mail.letters.find((l) => l.id === 'clay_intro')!;
    expect(intro.text).toContain(`${BOARD_PRIZE}g`);
    expect(intro.text).toMatch(/trophy/);
    const s = newState();
    s.stats['board.s0.rival'] = 4;
    s.time.season = 'summer';
    s.time.day = 1;
    settleSeason(s);
    expect(s.mail.list.at(-1)?.text).toContain(`${BOARD_PRIZE}g`);
    expect(measureText(s.mail.list.at(-1)!.text)).toBeLessThanOrEqual(184 * 8);
  });

  it('a draw is said, and last season stays on the board for three days', () => {
    const s = newState();
    s.stats['board.s0.you'] = 6;
    s.stats['board.s0.rival'] = 6;
    s.time.season = 'summer';
    s.time.day = 1;
    expect(settleSeason(s)).toBe('A draw with Clay on the board last season (6 to 6).');
    expect(lastSeasonLine(s)).toBe('Last season: a draw, 6 to 6.');
    expect(boardScoreLine(s)).toBe('Last season: a draw, 6 to 6.');
    s.time.day = 3;
    expect(lastSeasonLine(s)).not.toBeNull();
    s.time.day = 4;
    expect(lastSeasonLine(s)).toBeNull();
    expect(boardScoreLine(s)).toBe('This season: you 0, Clay 0.');
    expect(rivalNotice(s)).toBe('Clay scores on farm goods only.');
  });

  it('a win puts a trophy in the house that counts the seasons, and Mara writes', () => {
    const s = newState();
    expect(landmarksOn(s, 'house')).toEqual([]);
    for (const [season, day] of [
      ['summer', 1],
      ['fall', 1],
    ] as const) {
      const before = s.mail.list.length;
      s.stats[`board.s${season === 'summer' ? 0 : 1}.you`] = 9;
      s.time.season = season;
      s.time.day = day;
      expect(settleSeason(s)).toMatch(/You beat Clay/);
      expect(s.mail.list.length).toBe(before + 1);
      expect(s.mail.list.at(-1)?.from).toBe('mara');
      expect(measureText(s.mail.list.at(-1)!.text)).toBeLessThanOrEqual(184 * 8);
    }
    const [trophy] = landmarksOn(s, 'house');
    expect(trophy).toMatchObject({ kind: 'trophy', sprite: 'obj_trophy_board', tx: 6, ty: 2 });
    expect(trophy?.text).toBe('Board Trophy: seasons won on the board, 2.');
    expect(measureText(trophy!.text)).toBeLessThanOrEqual(184 * 2);
    expect(landmarksOn(s, 'farm').some((l) => l.kind === 'trophy')).toBe(false);
  });

  it("Clay's 2-heart scene no longer says you keep beating him", () => {
    const bet = npcs['clay']!.events!.find((e) => e.hearts === 2)!;
    expect(bet.lines.join(' ')).not.toMatch(/beating|winner/i);
  });
});

describe('critique 9 F2: crop requests leave slack, and the bin speaks up', () => {
  it('a crop request asks for about three quarters of what you could hand over', () => {
    const s = newState();
    for (let x = 9; x < 13; x++)
      s.farm.tiles[`${x},16`] = {
        watered: false,
        crop: { cropId: 'potato', stage: 3, daysInStage: 0, regrow: false },
      };
    let asked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      s.rng = seed;
      for (const o of generateOrders(s))
        if (o.item.startsWith('potato|')) {
          asked += 1;
          const supply = cropSupply(s, 'potato', o.until! - absoluteDay(s));
          expect(o.qty).toBeLessThanOrEqual(Math.max(1, Math.floor(supply * CROP_SHARE)));
          expect(o.qty).toBeLessThan(supply);
        }
    }
    expect(asked).toBeGreaterThan(0);
  });

  it('"Ship all produce" keeps what the open requests want, lowest quality first, and says so', () => {
    const s = oneRow('potato', 4);
    s.orders.list[0]!.until = absoluteDay(s) + 2;
    addItem(s, 'potato', 3);
    addItem(s, { item: 'potato', q: 2 }, 3);
    addItem(s, 'wild_leek', 2);
    expect(boardWants(s).get('potato|')).toBe(4);
    expect(wantedByBoard(s, { item: 'potato', q: 2 })).toBe(4);
    const res = shipAllProduce(s, boardWants(s));
    expect(res.kept.get('potato|')).toBe(4);
    expect(countItem(s, 'potato')).toBe(4);
    expect(s.shipping['potato|2|']).toBe(2); // three plain kept, one gold kept, two gold shipped
    expect(s.shipping['wild_leek|0|']).toBe(2);
    expect(keptLine(res.kept)).toBe('Kept 4 Potato for the board.');
    // A done request keeps nothing.
    s.orders.list[0]!.done = true;
    expect(boardWants(s).get('potato|')).toBeUndefined();
  });

  it("the bin's lines fit a toast", () => {
    expect(boardWantsLine(5, { item: 'cauliflower', q: 2 })).toBe('The board wants 5 Cauliflower.');
    const three = new Map([
      ['potato|', 2],
      ['egg|', 3],
      ['jam|strawberry', 1],
    ]);
    expect(keptLine(three)).toBe('Kept 2 Potato, 3 Egg and more for the board.');
    const two = new Map([
      ['cauliflower|', 2],
      ['jam|strawberry', 1],
    ]);
    expect(keptLine(two)).toBe('Kept 2 Cauliflower and 1 Strawberry Jam for the board.');
    for (const t of [keptLine(two)!, boardWantsLine(15, { item: 'cauliflower' })])
      expect(measureText(t)).toBeLessThanOrEqual(184 * 2);
  });
});

describe('critique 9 F3: the special keeps back a request you are part-way to', () => {
  it('holding 2 of a request for 3, the special gives none of them', () => {
    const s = oneRow('cauliflower', 3);
    s.orders.list[0]!.until = absoluteDay(s) + 1; // tomorrow is its last day: the rest may ripen
    s.special = {
      id: 'x',
      giver: 'mara',
      item: 'cauliflower',
      qty: 7,
      given: 0,
      reward: 1000,
      due: absoluteDay(s) + 10,
    };
    addItem(s, 'cauliflower', 2);
    expect(keepForRequests(s, 'cauliflower')).toBe(3);
    expect(specialGiveCount(s, keepForRequests(s, 'cauliflower'))).toBe(0);
    addItem(s, 'cauliflower', 3);
    expect(specialGiveCount(s, keepForRequests(s, 'cauliflower'))).toBe(2);
    // On its last day, a request you cannot fill keeps nothing back.
    const t = oneRow('cauliflower', 3);
    addItem(t, 'cauliflower', 2);
    expect(keepForRequests(t, 'cauliflower')).toBe(0);
  });
});

describe('critique 9 F6: the morning after a season', () => {
  it("names Clay's last take before the result it decided", () => {
    const s = newState();
    s.time.day = game.seasonLength;
    s.time.minutes = 600;
    s.orders = {
      day: absoluteDay(s),
      list: [
        {
          id: 1,
          item: 'potato|0|',
          qty: 3,
          reward: 300,
          xp: 5,
          done: false,
          from: absoluteDay(s) - 1,
          until: absoluteDay(s),
        },
        { id: 2, item: 'parsnip|0|', qty: 3, reward: 100, xp: 5, done: false },
      ],
    };
    s.stats['board.s0.you'] = 3;
    s.stats['board.s0.rival'] = 3;
    const sum = endDay(s, { passedOut: false, weedCandidates: [] });
    const took = (sum.notes ?? []).findIndex((n) => /Clay filled 3 Potato/.test(n));
    const result = (sum.notes ?? []).findIndex((n) => /Clay won the board last season/.test(n));
    expect(took).toBeGreaterThanOrEqual(0);
    expect(result).toBeGreaterThan(took);
  });

  it('the "finish a project" nudge comes once a season, not every morning', () => {
    const s = newState();
    s.money = 1_000_000;
    for (const id of Object.keys(projects))
      if (isProjectOpen(s, id)) for (const n of itemNeeds(s, id)) addItem(s, n.item, n.need);
    let said = 0;
    for (let d = 0; d < 6; d++) {
      const sum = endDay(s, { passedOut: false, weedCandidates: [] });
      if ((sum.notes ?? []).some((n) => /You could finish/.test(n))) said += 1;
    }
    expect(said).toBe(1);
  });
});

describe('critique 9 F7: the cart says what a good is for before you pay', () => {
  it('every row names its use in a word or two, and fits', () => {
    for (const e of cart.stock) {
      const tag = cartTag(e.item);
      expect(tag, e.item).toBeTruthy();
      expect(measureText(cartSub(9999, 5, tag)), e.item).toBeLessThanOrEqual(200 - 8 - 28 - 43 - 2);
    }
    expect(cartTag('strawberry_seed')).toBe('Spring crop');
    expect(cartSub(900, 0, 'Market Road')).toBe('Sold out');
    expect(items['ruby']).toBeDefined();
  });
});

describe('round 3: the statue grows with its level', () => {
  it('each level shows its own sprite, up to the last drawn one', () => {
    const s = newState();
    expect(landmarksOn(s, 'town').some((l) => l.id === 'statue')).toBe(false);
    s.stats['project.statue'] = 1;
    for (const [level, key] of [
      [1, 'obj_landmark_statue_1'],
      [3, 'obj_landmark_statue_3'],
      [6, 'obj_landmark_statue_6'],
      [9, 'obj_landmark_statue_6'],
    ] as const) {
      s.stats['project.statue.level'] = level;
      const statue = landmarksOn(s, 'town').find((l) => l.id === 'statue')!;
      expect(statue.sprite).toBe(key);
      expect(statue.text).toContain(`level ${level}`);
    }
  });
});

describe('round 3: trophies at home for festivals and legends', () => {
  it('a first place and a legend each stand in the house, counting', () => {
    const s = newState();
    s.stats['festivalWins'] = 2;
    s.stats['legends'] = 1;
    const shown = landmarksOn(s, 'house');
    expect(shown.map((l) => l.id).sort()).toEqual(['trophy.festival', 'trophy.legends']);
    expect(shown.find((l) => l.id === 'trophy.legends')?.text).toBe(
      'Legend Wall: legendary fish caught, 1 of 4.',
    );
    for (const l of shown) expect(measureText(l.text)).toBeLessThanOrEqual(184 * 2);
  });
});
