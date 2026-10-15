// The tutorial review (owner: "a few dialogs feel cluttered and the progression doesn't make sense"): one new thing a
// morning, one letter a morning, one coach line at a time, and the order a new player needs things in.
import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { mail, reveal, tutorial } from '../src/data';
import { endDay } from '../src/systems/day';
import { checkTips, currentGoal, tipsHeldNow } from '../src/systems/goals';
import { deliverDueLetters, letterLeads } from '../src/systems/mail';
import { advance, PACE_DAY, startTutorial, type CoachWorld } from '../src/systems/tutorial';
import { runtime } from '../src/state/runtime';
import { arrangeNotes } from '../src/ui/panels/summaryNotes';
import { newState } from './helpers';

type S = ReturnType<typeof newState>;
const guided = (): S => {
  const s = newState();
  startTutorial(s, { on: true, gift: false });
  return s;
};
const bump = (s: S, k: string, n = 1) => (s.stats[k] = (s.stats[k] ?? 0) + n);
const night = (s: S) => endDay(s, { passedOut: false, weedCandidates: [], forageSpots: {} });

/** A light new player's first `days` mornings: what each brought (new unread letters, features introduced). */
function firstWeeks(days: number) {
  const s = guided();
  const seen = new Set<number>();
  const out: { day: number; letters: string[]; features: string[]; notes: string[] }[] = [];
  for (let d = 1; d < days; d++) {
    if (d === 1) {
      bump(s, 'harvested', 3);
      bump(s, 'planted', 5);
      bump(s, 'shipped', 3);
      bump(s, 'foraged', 3);
      bump(s, 'talked');
    } else {
      bump(s, 'talked');
      bump(s, 'foraged', 2);
      if (d === 2) bump(s, 'bought', 5);
      if (d >= 5) {
        bump(s, 'harvested', 5);
        bump(s, 'shipped', 5);
      }
    }
    const sum = night(s);
    const fresh = s.mail.list.filter((l) => !seen.has(l.id));
    fresh.forEach((l) => seen.add(l.id));
    const features = Object.keys(s.stats)
      .filter((k) => k.startsWith('reveal.') && k !== 'reveal.on' && s.stats[k] === d + 1)
      .map((k) => k.slice(7));
    out.push({
      day: d + 1,
      letters: fresh.filter((l) => !l.read).map((l) => l.title),
      features,
      notes: sum.notes ?? [],
    });
  }
  return { s, out };
}

describe('the first weeks of a guided game', () => {
  it('bring at most one new letter and one new system a morning, in the order play needs them', () => {
    const { out } = firstWeeks(22);
    for (const m of out) {
      expect(m.letters.length, `day ${m.day}: ${m.letters.join(', ')}`).toBeLessThanOrEqual(1);
      expect(m.features.length, `day ${m.day}: ${m.features.join(', ')}`).toBeLessThanOrEqual(1);
    }
    const order = out.flatMap((m) => m.features);
    // the core loop and the town come first (days 1-2), then the Guide, then one system at a time. This player
    // never fishes or gifts: the farm greens on day 6 and takes that morning, the crows and Clay keep their days,
    // fishing and Make slide a few mornings, friends come with a week of chats
    expect(order).toEqual([
      'guide',
      'valley',
      'crows',
      'clay',
      'fishing',
      'crafting',
      'mine',
      'skills',
      'machines',
      'animals',
      'friends',
      'cooking',
    ]);
    const day = (id: string) => out.find((m) => m.features.includes(id))!.day;
    expect(day('guide')).toBe(4);
    expect(day('crows')).toBe(7); // before the crows can come (day 8)
    expect(day('clay')).toBe(8); // the race's first day
    expect(day('crafting')).toBeLessThan(day('machines')); // the jars are made at the Make tab
    expect(day('fishing')).toBeLessThan(day('crafting')); // the fish goal comes before the craft goal
    expect(day('skills')).toBeLessThan(day('machines')); // the sprinkler wants Farming 2
    // nothing scheduled on day 3 (the first dry morning teaches watering) or on a calendar morning
    expect(out.find((m) => m.day === 3)!.features).toEqual([]);
    expect(out.find((m) => m.day === 11)!.features).toEqual([]); // the birthday hint is in the post
    expect(out.find((m) => m.day === 13)!.features).toEqual([]); // the Flower Show notice
    // nothing waits past two mornings over its day: a quiet morning holds back only what is not yet overdue
    for (const id of [
      'guide',
      'crows',
      'clay',
      'fishing',
      'crafting',
      'mine',
      'skills',
      'machines',
      'animals',
    ])
      expect(day(id) - reveal.features.find((f) => f.id === id)!.day!, id).toBeLessThanOrEqual(3);
  });

  it("day 2 brings Mara's welcome alone; Rosa's first-harvest letter waits for the player's own crops", () => {
    const { out } = firstWeeks(12);
    expect(out[0]).toMatchObject({ day: 2, letters: ['Welcome to the valley'] });
    expect(out[1]).toMatchObject({ day: 3, letters: [], features: [] }); // the dry morning: water, nothing new
    const at = out.find((m) => m.letters.includes('Your first harvest!'))!;
    expect(at.day).toBe(5); // the morning the day-1 rows ripen
  });

  it('a waiting letter comes on the next quiet morning; an old save still gets every letter at once', () => {
    const s = guided();
    s.time.day = 9;
    s.stats['mail.welcome'] = 1; // day 2's letter came long ago
    bump(s, 'caught'); // a first catch: Finn's letter is not a lead letter
    s.stats['reveal.crafting'] = 9; // Orin's letter leads (the Make tab's morning)
    expect(deliverDueLetters(s)).toBe(1);
    expect(s.mail.list.map((l) => l.title)).toEqual(['A workbench']);
    s.time.day = 10;
    expect(deliverDueLetters(s, 1)).toBe(0); // a calendar letter came this morning
    expect(deliverDueLetters(s)).toBe(1);
    expect(s.mail.list.at(-1)?.title).toBe('A fellow angler');
    const old = newState();
    old.time.day = 9;
    bump(old, 'caught');
    old.stats['harvested'] = 1;
    expect(deliverDueLetters(old)).toBeGreaterThanOrEqual(2);
  });

  it("Clay's and the crows' letters wait for their mornings in a scheduled save, by day in an old one", () => {
    const clay = mail.letters.find((l) => l.id === 'clay_intro')!;
    const crows = mail.letters.find((l) => l.id === 'crows')!;
    expect(clay.when).toMatchObject({ day: 8, reveal: 'clay' });
    expect(crows.when).toMatchObject({ day: 7, reveal: 'crows' });
    expect(letterLeads(clay) && letterLeads(crows)).toBe(true);
    const s = guided();
    s.time.day = 9;
    deliverDueLetters(s);
    expect(s.mail.list.some((l) => l.title === 'Nothing personal')).toBe(false);
    s.stats['reveal.clay'] = 9;
    deliverDueLetters(s);
    expect(s.mail.list.some((l) => l.title === 'Nothing personal')).toBe(true);
    const old = newState();
    old.time.day = 8;
    deliverDueLetters(old);
    expect(old.mail.list.some((l) => l.title === 'Nothing personal')).toBe(true);
  });

  it('the morning folds the daily jobs into the routine line; the settling-in double pay stays news', () => {
    expect(
      arrangeNotes([
        'New requests on the town board.',
        'New jobs from Finn, Mara and Rosa on the town board.',
        'A new letter in the mailbox.',
      ]),
    ).toEqual(['A new letter in the mailbox.', 'New jobs and requests on the board.']);
    const double = 'New jobs from Orin on the town board: double pay while you settle in.';
    expect(arrangeNotes([double])).toEqual([double]);
  });
});

describe('the coach: one line, one new intro a day', () => {
  const world = (map = 'farm'): CoachWorld => ({
    map,
    tile: { tx: 14, ty: 12 },
    facing: 'down',
    action: null,
    objects: [],
    npcs: [],
    blocked: () => false,
    actKind: () => null,
    inView: () => true,
  });
  const afterGuide = (): S => {
    const s = guided();
    s.time.minutes = 9 * 60; // past the morning's first hour
    for (const st of tutorial.steps) if (st.track !== 'intro') s.stats[`tut.${st.id}`] = 1;
    for (const id of ['forage', 'waterDaily', 'late', 'tired']) s.stats[`tut.${id}`] = 1;
    s.stats['foraged'] = 3;
    s.stats['talked'] = 2;
    return s;
  };

  it('two feature intros due on one morning: the second waits for tomorrow', () => {
    const s = afterGuide();
    s.time.day = 12;
    s.stats['reveal.guide'] = 4;
    s.stats['reveal.skills'] = 11; // arrived yesterday: today's paced intros are not held for another topic
    const first = advance(s, world(), { panel: null, tab: null }).current;
    expect(first?.id).toBe('guideGold');
    expect(s.stats[PACE_DAY]).toBe(12);
    s.stats['guide.read.gold'] = 1;
    // the Gold page read: on the same day the Skill intro stays quiet
    expect(advance(s, world(), { panel: null, tab: null }).current).toBeNull();
    s.time.day = 13;
    expect(advance(s, world(), { panel: null, tab: null }).current?.id).toBe('skillsNew');
  });

  it('every intro is paced but the need-driven ones, and the cut lines are gone', () => {
    const paced = tutorial.steps.filter((x) => x.track === 'intro' && !x.need).map((x) => x.id);
    for (const id of [
      'waterDaily',
      'guideGold',
      'skillsNew',
      'craftNew',
      'giving',
      'clay',
      'valleyAsk',
    ])
      expect(paced, id).toContain(id);
    // need-driven: fired by what the player is doing this minute
    for (const id of [
      'fish',
      'cast',
      'noBait',
      'mine',
      'stone',
      'buySeeds',
      'jobBoard',
      'jobTurnIn',
      'late',
    ])
      expect(paced, id).not.toContain(id);
    // merged or cut: the clock and energy lines (the late and tired intros teach them when they matter), the day-2
    // Menu step (the Guide's intro teaches the Menu), the shop's second line, the settling-in jobs line, the
    // second and third Guide intros (the Guide marks its pages NEW)
    for (const id of [
      'clock',
      'energy',
      'menu',
      'shop',
      'welcomeJobs',
      'guideCrops',
      'skillsGuide',
    ])
      expect(
        tutorial.steps.some((x) => x.id === id),
        id,
      ).toBe(false);
    expect(tutorial.steps.find((x) => x.id === 'cast')?.text).toBe(
      'Face the water and press Action.',
    );
  });

  it('the gift intro waits for the Guide (it showed on day 3, before anything about hearts)', () => {
    const s = afterGuide();
    s.time.day = 3;
    const npc = { panel: 'npc', tab: null, npc: 'mara' };
    expect(advance(s, world('town'), npc).current?.id).not.toBe('giving');
    s.time.day = 5;
    s.stats['reveal.guide'] = 4;
    s.stats['tut.guideGold'] = 1;
    expect(advance(s, world('town'), npc).current?.id).toBe('giving');
  });

  it('a morning sheet holds at most four notes, news first, one board line', () => {
    const out = arrangeNotes([
      'Wild goods are growing in the woods.',
      'Clay cleared 4 Fiber off the board: no point.',
      'New requests on the town board.',
      'New jobs from Finn and Mara on the town board.',
      'The traveling cart is in town today.',
      "It's Mara's birthday today!",
      'New in the Menu: Skill. Work makes you better at it.',
      'A new letter in the mailbox.',
    ]);
    expect(out).toEqual([
      'A new letter in the mailbox.',
      'New in the Menu: Skill. Work makes you better at it.',
      'The traveling cart is in town today.',
      "It's Mara's birthday today!",
    ]);
  });

  it('no special order before day 7 in a guided game; an old save posts one from day 2', async () => {
    const { morningSpecial } = await import('../src/systems/specials');
    const s = guided();
    s.time.day = 2;
    expect(morningSpecial(s)).toBeNull();
    s.time.day = 7;
    expect(morningSpecial(s)).toMatch(/Special order/);
    const old = newState();
    old.time.day = 2;
    expect(morningSpecial(old)).toMatch(/Special order/);
  });

  it('one first-time tip a day in a guided game', () => {
    const s = afterGuide();
    s.stats['qualityHarvested'] = 1;
    s.stats['ordersDone'] = 1;
    const shown = () =>
      Object.keys(s.stats).filter((k) => /^tip\.(forage|quality|orders)$/.test(k)).length;
    for (let day = 6; day <= 8; day++) {
      s.time.day = day;
      const before = shown();
      for (let i = 0; i < 5; i++) checkTips(s);
      expect(shown() - before, `day ${day}`).toBe(1);
    }
  });

  it('first-time tips wait while a coach line or a sheet is on screen', () => {
    const s = afterGuide();
    s.time.day = 6;
    s.stats['harvested'] = 1;
    s.stats['qualityHarvested'] = 1;
    expect(tipsHeldNow(s)).toBe(false);
    runtime.coaching = true;
    try {
      expect(tipsHeldNow(s)).toBe(true);
      checkTips(s);
      expect(s.stats['tip.quality']).toBeUndefined();
    } finally {
      runtime.coaching = false;
    }
    runtime.modals = 1;
    try {
      expect(tipsHeldNow(s)).toBe(true);
    } finally {
      runtime.modals = 0;
    }
    for (let d = 6; d < 12 && !s.stats['tip.quality']; d++) {
      s.time.day = d; // one tip a day: another may come first
      checkTips(s);
    }
    expect(s.stats['tip.quality']).toBe(1);
    expect(currentGoal(s)).toBeDefined();
  });
});
