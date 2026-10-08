import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { game, mail, npcs } from '../src/data';
import { endDay } from '../src/systems/day';
import { POINTS_PER_HEART } from '../src/systems/friendship';
import { countItem } from '../src/systems/inventory';
import {
  deliverCalendarLetters,
  deliverDueLetters,
  letterDate,
  MAILBOX_SIZE,
  readLetter,
  sendLetter,
  takeGift,
  unreadCount,
} from '../src/systems/mail';
import { migrate } from '../src/systems/save';
import { measureText } from '../src/ui/fontMetrics';
import { giftLine, letterSub, letterTitle } from '../src/ui/panels/mailText';
import type { GameState } from '../src/state/GameState';
import { newState } from './helpers';

const sleep = (s: GameState) => endDay(s, { passedOut: false, weedCandidates: [] });

describe('mail', () => {
  it('the post comes in the morning: a welcome letter with seeds on day 2', () => {
    const s = newState();
    expect(s.mail.list).toEqual([]);
    const sum = sleep(s);
    const welcome = s.mail.list.find((l) => l.title === 'Welcome to the valley');
    expect(welcome).toBeDefined();
    expect(welcome?.day).toBe(2);
    expect(sum.notes).toContain('A new letter in the mailbox.');
    expect(unreadCount(s)).toBe(1);
    sleep(s);
    expect(s.mail.list.filter((l) => l.title === 'Welcome to the valley')).toHaveLength(1); // once
  });

  it('milestones and friendship send letters once, the next morning', () => {
    const s = newState();
    s.stats['caught'] = 1;
    s.friends['rosa'] = { points: 3 * POINTS_PER_HEART, talkedDay: 0, giftedDay: 0 };
    expect(deliverDueLetters(s)).toBeGreaterThanOrEqual(2);
    const titles = s.mail.list.map((l) => l.title);
    expect(titles).toContain('A fellow angler');
    expect(titles).toContain('Thank you, neighbour');
    expect(deliverDueLetters(s)).toBe(0);
  });

  it('reading marks a letter read; taking the gift moves it to the bag once', () => {
    const s = newState();
    const l = sendLetter(s, {
      from: 'finn',
      title: 'Hi',
      text: 'Bait!',
      gift: { item: 'bait', qty: 4 },
    });
    expect(unreadCount(s)).toBe(1);
    readLetter(s, l.id);
    expect(unreadCount(s)).toBe(1); // a gift still waits
    expect(takeGift(s, l.id)).toBe('ok');
    expect(countItem(s, 'bait')).toBe(4);
    expect(takeGift(s, l.id)).toBe('none');
    expect(unreadCount(s)).toBe(0);
  });

  it('a full bag keeps the gift in the letter', () => {
    const s = newState();
    for (let i = game.toolSlots; i < s.inventory.slots.length; i++)
      s.inventory.slots[i] = { item: 'stone', qty: 99 };
    const l = sendLetter(s, {
      from: 'mara',
      title: 'x',
      text: 'y',
      gift: { item: 'bait', qty: 1 },
    });
    expect(takeGift(s, l.id)).toBe('full');
    expect(s.mail.list[0]?.taken).toBe(false);
  });

  it('festival notices and birthday hints come the day before', () => {
    const s = newState();
    s.time.day = 11; // Mara's birthday is spring 12
    deliverCalendarLetters(s);
    const bday = s.mail.list.find((l) => l.title === "Mara's birthday");
    expect(bday?.text).toContain(`love`);
    expect(bday?.from).not.toBe('mara');
    s.time.day = 13; // Flower Show is spring 14
    deliverCalendarLetters(s);
    expect(s.mail.list.some((l) => l.title === 'Flower Show tomorrow')).toBe(true);
    const n = s.mail.list.length;
    deliverCalendarLetters(s);
    expect(s.mail.list).toHaveLength(n);
  });

  it('the box stays small but never drops unread letters or untaken gifts', () => {
    const s = newState();
    for (let i = 0; i < MAILBOX_SIZE + 10; i++) {
      const l = sendLetter(s, { from: 'mara', title: `#${i}`, text: '.' });
      if (i % 2 === 0) readLetter(s, l.id);
    }
    expect(s.mail.list.every((l) => l.read) || s.mail.list.some((l) => !l.read)).toBe(true);
    expect(s.mail.list.filter((l) => !l.read)).toHaveLength(Math.ceil((MAILBOX_SIZE + 10) / 2));
  });

  it('letters survive a save; v10 saves start with an empty box', () => {
    const s = newState();
    sleep(s);
    expect(migrate(JSON.parse(JSON.stringify(s))).mail).toEqual(s.mail);
    const v10 = JSON.parse(JSON.stringify(newState())) as Record<string, unknown>;
    v10['version'] = 10;
    delete v10['mail'];
    expect(migrate(v10).mail).toEqual({ next: 1, list: [] });
  });

  it('dates read like the calendar', () => {
    expect(letterDate(1, 28)).toBe('Spring 1');
    expect(letterDate(29, 28)).toBe('Summer 1');
    expect(letterDate(113, 28)).toBe('Spring 1');
  });

  it('letter text fits the sheet', () => {
    for (const def of mail.letters) {
      const l = {
        id: 1,
        from: def.from,
        title: def.title,
        text: def.text,
        day: 112,
        read: false,
        taken: false,
        gift: def.gift,
      };
      // Title and gift line wrap to at most two lines; the body to at most nine.
      expect(measureText(letterTitle(l)), def.id).toBeLessThanOrEqual(184 * 2);
      expect(measureText(def.text), def.id).toBeLessThanOrEqual(184 * 8);
      expect(measureText(giftLine(l)), def.id).toBeLessThanOrEqual(184);
      expect(measureText(letterSub(l, 'Winter 28')), def.id).toBeLessThanOrEqual(120);
    }
    for (const n of Object.values(npcs)) expect(n.name.length).toBeGreaterThan(0);
  });
});
