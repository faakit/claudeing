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

  it('tabs arrive by day: the Book on 3, Skill on 5, Make on 6', () => {
    const s = guided();
    const at = (day: number) => {
      toDay(s, day);
      return ['book', 'skills', 'craft'].filter((t) => !tabHidden(s, t));
    };
    expect(at(2)).toEqual([]);
    expect(at(3)).toEqual(['book']);
    expect(at(4)).toEqual(['book']);
    expect(at(5)).toEqual(['book', 'skills']);
    expect(at(6)).toEqual(['book', 'skills', 'craft']);
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

  it('nothing is introduced on days 1 and 2 (the onboarding gate); from day 3 one morning at a time', () => {
    const s = guided();
    expect(markRevealed(s)).toEqual([]);
    addStat(s, 'caught'); // fished on day 1: shown, but introduced on day 3
    toDay(s, 2);
    expect(markRevealed(s)).toEqual([]);
    toDay(s, 3);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['guide', 'fishing']);
    expect(markRevealed(s)).toEqual([]);
    toDay(s, 4);
    expect(markRevealed(s).map((f) => f.id)).toEqual(['friends']);
  });

  it('the morning says what arrived and brings its letter; an old save gets neither', () => {
    const s = guided();
    toDay(s, 2);
    const sum = night(s); // to day 3
    expect(sum.notes?.join(' ')).toMatch(/the Book, with a Guide/);
    expect(s.mail.list.some((l) => l.title === "Ilse's notes")).toBe(true);
    const old = newState();
    toDay(old, 2);
    const sumOld = night(old);
    expect(sumOld.notes?.join(' ') ?? '').not.toMatch(/New in the/);
    expect(old.mail.list.some((l) => l.title === "Ilse's notes")).toBe(false);
  });

  it('every feature has a day or an early way in, and the days keep a steady pace', () => {
    const days = reveal.features.flatMap((f) => (f.day ? [f.day] : []));
    expect(Math.min(...days)).toBe(3);
    expect(new Set(days).size).toBe(days.length); // never two on one morning by the calendar
    for (const f of reveal.features) {
      expect(f.day !== undefined || (f.early?.length ?? 0) > 0).toBe(true);
      expect(measureText(f.note)).toBeLessThanOrEqual(184 * 2);
    }
  });

  it('every reveal letter exists, and every intro step only shows once its feature has arrived', () => {
    for (const f of reveal.features.filter((x) => !['valley'].includes(x.id)))
      expect(
        mail.letters.some((l) => l.when.stat === `reveal.${f.id}`),
        f.id,
      ).toBe(true);
    const ids = ['guideGold', 'guideCrops', 'skillsNew', 'skillsGuide', 'craftNew'];
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
    toDay(s, 3);
    expect(guideTopics(s).map((t) => t.id)).toEqual(['gold', 'crops', 'jobs']);
    readTopic(s, 'gold');
    expect(unreadTopics(s).map((t) => t.id)).toEqual(['crops', 'jobs']);
    toDay(s, 30);
    s.stats['valley.farmGreen'] = 1;
    s.stats['upgraded.kitchen'] = 1;
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
