import { afterEach, describe, expect, it } from 'vitest';
import '../src/mechanics';
import { npcs, recipes } from '../src/data';
import { endDay } from '../src/systems/day';
import {
  chat,
  CHAT_POINTS,
  CHAT_POINTS_FRIEND,
  FRIEND_CURVE,
  giftBlock,
  giftPoints,
  giftsLeft,
  GIFTS_PER_WEEK,
  giveGift,
  heartRewards,
  heartsOf,
  nextHeart,
  pointsForHearts,
  waterHelp,
} from '../src/systems/friendship';
import {
  HEART_AT,
  heartProgress,
  heartsFor,
  MAX_POINTS,
  rescaleOldPoints,
} from '../src/systems/hearts';
import { addItem, countItem } from '../src/systems/inventory';
import { migrate } from '../src/systems/save';
import { isRecipeUnlocked } from '../src/systems/skills';
import { heartRewardList, nextHeartLine } from '../src/ui/panels/heartText';
import { giftNote } from '../src/ui/panels/giftText';
import { lockedText } from '../src/ui/panels/craftText';
import { measureText } from '../src/ui/fontMetrics';
import { setLocale } from '../src/i18n';
import { newState } from './helpers';

afterEach(() => setLocale('en'));

const day = (s: ReturnType<typeof newState>, n: number): void => {
  s.time.day = n;
};

// QA round: "Tá muito fácil ganhar os corações tudo e não tem muito incentivo".
describe('the friendship curve', () => {
  it('each heart costs more than the last, up to 1,000 points', () => {
    expect(HEART_AT).toEqual([0, 100, 250, 450, 700, 1000]);
    expect(heartsFor(99)).toBe(0);
    expect(heartsFor(100)).toBe(1);
    expect(heartsFor(999)).toBe(4);
    expect(heartsFor(MAX_POINTS)).toBe(5);
    expect(pointsForHearts(2.5)).toBe(350);
    expect(heartProgress(260)).toEqual({ have: 10, need: 200 });
    expect(heartProgress(1000)).toBeNull();
  });

  it('old saves keep their hearts and the share of the way to the next', () => {
    expect(rescaleOldPoints(0)).toBe(0);
    expect(rescaleOldPoints(50)).toBe(100);
    expect(rescaleOldPoints(75)).toBe(175); // 1.5 hearts
    expect(rescaleOldPoints(250)).toBe(1000);
    for (let p = 0; p <= 250; p += 5)
      expect(heartsFor(rescaleOldPoints(p))).toBe(Math.min(5, Math.floor(p / 50)));
  });

  it('an old save is rescaled once on load; a new one never', () => {
    const raw = JSON.parse(JSON.stringify(newState()));
    delete raw.stats[FRIEND_CURVE];
    raw.friends = { rosa: { points: 150, talkedDay: 0, giftedDay: 0 } };
    const once = migrate(raw);
    expect(once.friends['rosa']!.points).toBe(450);
    expect(heartsOf(once, 'rosa')).toBe(3);
    const twice = migrate(JSON.parse(JSON.stringify(once)));
    expect(twice.friends['rosa']!.points).toBe(450);
  });

  it('chat counts for less once you are friends', () => {
    const s = newState();
    expect(chat(s, 'rosa').gained).toBe(CHAT_POINTS);
    s.friends['rosa']!.points = pointsForHearts(2);
    day(s, 2);
    expect(chat(s, 'rosa').gained).toBe(CHAT_POINTS_FRIEND);
  });

  it('daily chats alone take more than a season to reach five hearts', () => {
    const s = newState();
    let d = 1;
    while (heartsOf(s, 'rosa') < 5 && d < 400) {
      s.time.day = ((d - 1) % 28) + 1;
      s.time.season = (['spring', 'summer', 'fall', 'winter'] as const)[
        Math.floor((d - 1) / 28) % 4
      ]!;
      s.time.year = 1 + Math.floor((d - 1) / 112);
      chat(s, 'rosa');
      d += 1;
    }
    expect(d).toBeGreaterThan(112); // past the first year's summer
  });

  it('two loved gifts a week and daily chats reach five hearts in four to seven weeks', () => {
    const s = newState();
    const loves = npcs['rosa']!.loves;
    let d = 1;
    while (heartsOf(s, 'rosa') < 5 && d < 200) {
      s.time.day = ((d - 1) % 28) + 1;
      s.time.season = (['spring', 'summer', 'fall', 'winter'] as const)[
        Math.floor((d - 1) / 28) % 4
      ]!;
      chat(s, 'rosa');
      const item = loves[d % loves.length]!;
      addItem(s, item, 1);
      giveGift(s, 'rosa', { item });
      d += 1;
    }
    expect(d).toBeGreaterThan(28);
    expect(d).toBeLessThan(50);
  });
});

describe('gifts', () => {
  it('two a week; a third waits for the next week and nothing changes on the refusal', () => {
    const s = newState();
    addItem(s, 'daffodil', 5);
    expect(giveGift(s, 'mara', { item: 'daffodil' }).ok).toBe(true);
    day(s, 2);
    addItem(s, 'jam', 1);
    expect(giveGift(s, 'mara', { item: 'jam', of: 'tomato' }).ok).toBe(false); // no tomato jam in the bag
    expect(giveGift(s, 'mara', { item: 'daffodil' }).ok).toBe(true);
    day(s, 3);
    expect(giftsLeft(s, 'mara')).toBe(0);
    expect(giftBlock(s, 'mara')).toBe('week');
    const before = JSON.stringify(s);
    expect(giveGift(s, 'mara', { item: 'daffodil' })).toEqual({ ok: false, reason: 'week' });
    expect(JSON.stringify(s)).toBe(before);
    day(s, 8); // a new week
    expect(giftsLeft(s, 'mara')).toBe(GIFTS_PER_WEEK);
    expect(giveGift(s, 'mara', { item: 'daffodil' }).ok).toBe(true);
  });

  it('the same present within two weeks is worth half; quality and a birthday raise it', () => {
    const s = newState();
    addItem(s, 'daffodil', 3);
    expect(giveGift(s, 'mara', { item: 'daffodil' })).toMatchObject({ points: 80, repeat: false });
    day(s, 2);
    expect(giveGift(s, 'mara', { item: 'daffodil' })).toMatchObject({ points: 40, repeat: true });
    s.time.day = 15; // 13 days after the last
    expect(giftPoints(s, 'mara', { item: 'daffodil' })).toBe(40);
    s.time.day = 16;
    expect(giftPoints(s, 'mara', { item: 'daffodil' })).toBe(80);
    expect(giftPoints(s, 'mara', { item: 'daffodil', q: 2 })).toBe(120);
    expect(giftPoints(s, 'mara', { item: 'fiber' })).toBe(-20); // a dislike is never softened
  });

  it("a birthday gift is welcome even when the week's are given, and does not use one up", () => {
    const s = newState();
    addItem(s, 'daffodil', 3);
    giveGift(s, 'mara', { item: 'daffodil' });
    day(s, 9);
    giveGift(s, 'mara', { item: 'daffodil' });
    day(s, 10);
    addItem(s, 'wild_sunflower', 1);
    giveGift(s, 'mara', { item: 'wild_sunflower' });
    day(s, 12); // Mara's birthday
    expect(giftBlock(s, 'mara')).toBeNull();
    expect(giveGift(s, 'mara', { item: 'daffodil' }).ok).toBe(true);
    expect(giftsLeft(s, 'mara')).toBe(0);
  });

  it('the note beside Gift fits, in both languages and both widths', () => {
    for (const locale of ['en', 'pt-BR'] as const) {
      setLocale(locale);
      for (const block of ['today', 'week', null] as const)
        for (const left of [0, 1, 2]) {
          expect(measureText(giftNote(block, left, false))).toBeLessThanOrEqual(88);
          expect(measureText(giftNote(block, left, true))).toBeLessThanOrEqual(56);
        }
    }
    setLocale('en');
  });
});

describe('every heart is worth having', () => {
  it('every villager brings something at every heart', () => {
    for (const id of Object.keys(npcs))
      for (let h = 1; h <= 5; h++)
        expect(heartRewardList(heartRewards(id, h)), `${id} at ${h}`).not.toBe('');
  });

  it('the sheet says what the next heart brings, and it fits three lines', () => {
    const s = newState();
    expect(nextHeart(s, 'mara')?.hearts).toBe(1);
    expect(nextHeartLine(s, 'mara')).toMatch(/^Next heart: a letter/);
    for (const locale of ['en', 'pt-BR'] as const) {
      setLocale(locale);
      for (const id of Object.keys(npcs))
        for (let h = 0; h <= 5; h++) {
          s.friends[id] = { points: pointsForHearts(h), talkedDay: 0, giftedDay: 0 };
          expect(measureText(nextHeartLine(s, id)), `${locale} ${id} ${h}`).toBeLessThanOrEqual(
            184 * 3,
          );
        }
    }
    setLocale('en');
    s.friends['mara']!.points = MAX_POINTS;
    expect(nextHeart(s, 'mara')).toBeNull();
  });

  it('villagers teach recipes: a skill level or their friendship opens them', () => {
    const s = newState();
    const grub = recipes['glow_grub']!;
    expect(isRecipeUnlocked(s, grub)).toBe(false);
    expect(lockedText(s, grub)).toBe('Finn teaches it at 3 hearts');
    s.friends['finn'] = { points: pointsForHearts(3), talkedDay: 0, giftedDay: 0 };
    expect(isRecipeUnlocked(s, grub)).toBe(true);
    const rich = recipes['rich_fertilizer']!;
    expect(isRecipeUnlocked(s, rich)).toBe(false);
    expect(lockedText(s, rich)).toBe('Fishing Lv 2, or Rosa at 2 hearts');
    s.friends['rosa'] = { points: pointsForHearts(2), talkedDay: 0, giftedDay: 0 };
    expect(isRecipeUnlocked(s, rich)).toBe(true);
  });

  it('Rosa at five hearts waters a few dry crops on a dry morning, never on a wet one', () => {
    const s = newState();
    for (let x = 0; x < 10; x++)
      s.farm.tiles[`${x},20`] = {
        watered: false,
        crop: { cropId: 'parsnip', stage: 0, daysInStage: 0, regrow: false },
      };
    expect(waterHelp(s)).toBe(0);
    s.friends['rosa'] = { points: MAX_POINTS, talkedDay: 0, giftedDay: 0 };
    s.weather = 'rain';
    expect(waterHelp(s)).toBe(0);
    s.weather = 'sunny';
    expect(waterHelp(s)).toBe(8);
    expect(Object.values(s.farm.tiles).filter((t) => t.watered)).toHaveLength(8);
  });

  it('heart letters arrive with their gifts', () => {
    const s = newState();
    s.friends['finn'] = { points: pointsForHearts(1), talkedDay: 0, giftedDay: 0 };
    endDay(s, { passedOut: false, weedCandidates: [], forageSpots: {} });
    const letter = s.mail.list.find((l) => l.title === 'The Heron');
    expect(letter?.gift).toEqual({ item: 'worms', qty: 10 });
    expect(countItem(s, 'worms')).toBe(10); // the starter worms; the letter's wait in the mailbox
  });
});
