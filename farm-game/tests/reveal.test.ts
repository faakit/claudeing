import { describe, expect, it } from 'vitest';
import '../src/mechanics';
import { goals, guide, mail, reveal, tutorial } from '../src/data';
import { endDay } from '../src/systems/day';
import {
  guideTopics,
  isRevealed,
  markRevealed,
  readTopic,
  REVEAL_ON,
  tabHidden,
  unreadTopics,
} from '../src/systems/reveal';
import { startTutorial } from '../src/systems/tutorial';
import { addStat } from '../src/systems/goals';
import { measureText } from '../src/ui/fontMetrics';
import { newState } from './helpers';

const guided = () => {
  const s = newState();
  startTutorial(s, { on: true, gift: false });
  return s;
};
const toDay = (s: ReturnType<typeof newState>, day: number): void => {
  s.time.season = (['spring', 'summer', 'fall', 'winter'] as const)[Math.floor((day - 1) / 28)]!;
  s.time.day = ((day - 1) % 28) + 1;
};
/** Every morning from day 3 up to `day`, as the morning hook runs them: what each introduced. */
const mornings = (s: ReturnType<typeof newState>, day: number): Record<number, string[]> => {
  const out: Record<number, string[]> = {};
  for (let d = 3; d <= day; d++) {
    toDay(s, d);
    const got = markRevealed(s).map((f) => f.id);
    if (got.length) out[d] = got;
  }
  return out;
};
const night = (s: ReturnType<typeof newState>) =>
  endDay(s, { passedOut: false, weedCandidates: [], forageSpots: {} });

// QA round: "Fasear a profundidade do jogo, mostrar mecânicas em dias/semanas seguintes".
describe('the reveal schedule', () => {
  it('a guided game starts with Bag, Goal and Opts; a bare game and an old save see every tab', () => {
    const s = guided();
    expect(s.stats[REVEAL_ON]).toBe(1);
    for (const tab of ['book', 'craft', 'skills']) expect(tabHidden(s, tab)).toBe(true);
    for (const tab of ['bag', 'goals', 'opts']) expect(tabHidden(s, tab)).toBe(false);
    const bare = newState();
    startTutorial(bare, { on: false, gift: false });
    expect(tabHidden(bare, 'craft')).toBe(false);
    expect(tabHidden(newState(), 'book')).toBe(false); // a save with no marker: from before the schedule
  });

  it('tabs arrive with their mornings: the Book on 4, Make on 9, Skill on 12 (tutorial review)', () => {
    const s = guided();
    const at = (day: number) => {
      mornings(s, day);
      return ['book', 'skills', 'craft'].filter((t) => !tabHidden(s, t));
    };
    expect(at(2)).toEqual([]);
    expect(at(3)).toEqual([]);
    expect(at(4)).toEqual(['book']);
    expect(at(8)).toEqual(['book']);
    expect(at(9)).toEqual(['book', 'craft']);
    expect(at(12)).toEqual(['book', 'skills', 'craft']);
    // the day alone does not bring a tab: the morning that introduces it does (with its note and letter)
    const t = guided();
    toDay(t, 9);
    expect(tabHidden(t, 'craft')).toBe(true);
  });

  it('a feature arrives early when play needs it: the craft goal opens Make at once', () => {
    const s = guided();
    toDay(s, 3);
    expect(isRevealed(s, 'crafting')).toBe(false);
    s.goalIndex = goals.findIndex((g) => g.id === 'craft');
    expect(isRevealed(s, 'crafting')).toBe(true);
    expect(tabHidden(s, 'craft')).toBe(false);
    const t = guided();
    addStat(t, 'caught');
    expect(isRevealed(t, 'fishing')).toBe(true);
  });

  it('nothing is introduced on days 1 and 2 (the onboarding gate); from day 3 one feature a morning', () => {
    const s = guided();
    expect(markRevealed(s)).toEqual([]);
    addStat(s, 'caught'); // fished on day 1: shown at once, introduced on day 3
    expect(isRevealed(s, 'fishing')).toBe(true);
    toDay(s, 2);
    expect(markRevealed(s)).toEqual([]);
    // friends come with the first gift (or a week of chats), not on a day
    expect(mornings(s, 16)).toEqual({
      3: ['fishing'],
      4: ['guide'],
      7: ['crows'],
      8: ['clay'],
      9: ['crafting'],
      10: ['mine'],
      12: ['skills'],
      15: ['machines'],
      16: ['animals'],
    });
    addStat(s, 'gifted');
    toDay(s, 17);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['friends']);
  });

  it('two features due on one morning: the first in the schedule goes, the other waits a morning', () => {
    const s = guided();
    mornings(s, 3);
    s.stats['valley.farmGreen'] = 1; // the first green on day 4's night check: that morning is the valley's
    toDay(s, 4);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['valley']);
    expect(isRevealed(s, 'guide')).toBe(false); // the Book waits a morning, tab included
    toDay(s, 5);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['guide']);
    toDay(s, 6);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['fishing']);
  });

  it('the morning says what arrived and brings its letter; an old save gets neither', () => {
    const s = guided();
    toDay(s, 3);
    const sum = night(s); // to day 4
    expect(sum.notes?.join(' ')).toMatch(/the Book, with a Guide/);
    expect(s.mail.list.some((l) => l.title === "Ilse's notes")).toBe(true);
    const old = newState();
    toDay(old, 3);
    const sumOld = night(old);
    expect(sumOld.notes?.join(' ') ?? '').not.toMatch(/New in the/);
    expect(old.mail.list.some((l) => l.title === "Ilse's notes")).toBe(false);
  });

  it('every feature has a day or an early way in, and the days keep a steady pace', () => {
    const days = reveal.features.flatMap((f) => (f.day ? [f.day] : []));
    // day 3 is the first dry morning's watering; then one system a morning, never two by the calendar, in the
    // order play needs them (DECISIONS: the tutorial review)
    expect(Math.min(...days)).toBe(4);
    expect(new Set(days).size).toBe(days.length);
    const order = reveal.features.filter((f) => f.day).map((f) => f.id);
    expect(order).toEqual([
      'guide',
      'fishing',
      'crows',
      'clay',
      'crafting',
      'mine',
      'skills',
      'machines',
      'animals',
      'cooking',
    ]);
    expect([...days].sort((a, b) => a - b)).toEqual(days); // listed in the order they come
    // the first green is that morning's one introduction: the valley comes first in the list
    expect(reveal.features[0]!.id).toBe('valley');
    for (const f of reveal.features) {
      expect(f.day !== undefined || (f.early?.length ?? 0) > 0).toBe(true);
      expect(measureText(f.note)).toBeLessThanOrEqual(184 * 2);
    }
  });

  it('every reveal letter exists, and every intro step only shows once its feature has arrived', () => {
    for (const f of reveal.features.filter((x) => !['valley'].includes(x.id)))
      expect(
        mail.letters.some((l) => l.when.stat === `reveal.${f.id}` || l.when.reveal === f.id),
        f.id,
      ).toBe(true);
    const ids = ['guideGold', 'skillsNew', 'craftNew', 'giving'];
    for (const id of ids) {
      const st = tutorial.steps.find((x) => x.id === id)!;
      expect(st.track).toBe('intro');
      expect(JSON.stringify(st.when)).toMatch(/"revealed"/);
    }
  });
});

describe('the Guide', () => {
  it('its pages arrive with their features and are NEW until opened', () => {
    const s = guided();
    expect(guideTopics(s)).toEqual([]);
    mornings(s, 4);
    expect(guideTopics(s).map((t) => t.id)).toEqual(['gold', 'crops', 'jobs']);
    readTopic(s, 'gold');
    expect(unreadTopics(s).map((t) => t.id)).toEqual(['crops', 'jobs']);
    s.stats['valley.farmGreen'] = 1;
    s.stats['upgraded.kitchen'] = 1;
    s.stats['gifted'] = 1;
    mornings(s, 30);
    expect(guideTopics(s)).toHaveLength(guide.topics.length);
  });

  it('covers what QA asked for: gold, the planting cycle and how each skill levels up', () => {
    const text = (id: string) => guide.topics.find((t) => t.id === id)!.paras.join(' ');
    expect(text('gold')).toMatch(/bin pays the next morning/);
    expect(text('gold')).toMatch(/Spend it/);
    expect(text('crops')).toMatch(/water/);
    expect(text('crops')).toMatch(/wither/);
    expect(text('crops')).toMatch(/28 days/);
    for (const skill of ['Farming', 'Foraging', 'Fishing', 'Mining'])
      expect(text('skills')).toMatch(skill);
    expect(text('skills')).toMatch(/perk/);
    expect(text('crafting')).toMatch(/dry grass/);
  });

  it('a paragraph never runs past a screen of the Book', () => {
    for (const t of guide.topics)
      for (const p of t.paras) expect(measureText(p), `${t.id}: ${p}`).toBeLessThanOrEqual(184 * 8);
  });
});

describe('first-time tips that name a tab', () => {
  it('wait until the reveal schedule brings that tab', async () => {
    const { checkTips } = await import('../src/systems/goals');
    const s = guided();
    for (const st of tutorial.steps) s.stats[`tut.${st.id}`] = 1; // the guided days are over: tips may show
    mornings(s, 7);
    s.stats['level.farming'] = 2; // the first level-up shows Skill at once; the tip names Make too
    checkTips(s);
    expect(s.stats['tip.skills']).toBeUndefined();
    for (let d = 8; d <= 12; d++) {
      toDay(s, d);
      markRevealed(s); // Clay on day 8, Make on 9, then one a morning: Skill is in the Menu by its day at the latest
    }
    expect(s.stats['reveal.crafting']).toBe(9);
    expect(s.stats['reveal.skills']).toBeLessThanOrEqual(12);
    s.time.minutes = 9 * 60; // past the morning's first hour, when tips may show
    for (let d = 12; d < 20 && !s.stats['tip.skills']; d++) {
      toDay(s, d); // one tip a day: earlier ones (quality, forage...) may come first
      for (let i = 0; i < 3; i++) checkTips(s);
    }
    expect(s.stats['tip.skills']).toBe(1);
  });
});
