/**
 * The reveal schedule (QA round: "phase the game's depth, show mechanics over the following days and weeks").
 *
 * A guided new game meets its systems one at a time, one a morning at most (tutorial review): the Book and its
 * Guide on day 4, friendship on day 5, fishing on day 6, crafting on day 9, the mine on day 10, skills on day 12,
 * machines on day 15, animals on day 16, cooking on day 21, and the valley on the first-green morning
 * (`data/reveal.json`, in the order they are introduced). A feature due on a morning another took waits for the
 * next one. Until a feature arrives its menu tab is hidden. A feature is also shown early the moment play needs it
 * (the goal chain reaches it, or the player already uses it), so nothing is ever locked away from someone who got
 * there first: the schedule only decides when the game *introduces* a thing (its note, letter and intro).
 *
 * State is stats only (no save change):
 * - `reveal.on`: this save follows the schedule (set when the guided start begins). Saves without it (every save
 *   from before the QA round, bare `?tutorial=0` games, sandbox scenarios) see everything at once;
 * - `reveal.<id>`: the absolute day a feature was introduced (its morning note and letter went out);
 * - `guide.read.<topic>`: a Guide page was opened.
 */
import { goals, guide, reveal, type GuideTopic, type RevealFeature } from '../data';
import type { GameState } from '../state/GameState';
import { absoluteDay } from './time';

export const REVEAL_ON = 'reveal.on';
const key = (id: string): string => `reveal.${id}`;
const readKey = (topic: string): string => `guide.read.${topic}`;

/** Does this save follow the reveal schedule? */
export const revealOn = (s: Pick<GameState, 'stats'>): boolean => !!s.stats[REVEAL_ON];

export const feature = (id: string): RevealFeature | undefined =>
  reveal.features.find((f) => f.id === id);

/** Does play already need this feature (its goal reached, or the thing already used)? */
export function needsEarly(s: GameState, f: RevealFeature): boolean {
  return (f.early ?? []).some((e) => {
    if (e.after !== undefined && revealOn(s) && !s.stats[key(e.after)]) return false;
    if (e.stat !== undefined) return (s.stats[e.stat] ?? 0) >= (e.min ?? 1);
    if (e.goal !== undefined) {
      const at = goals.findIndex((g) => g.id === e.goal);
      return at >= 0 && (s.goalIndex >= at || !!s.stats[`goal.${e.goal}`]);
    }
    return false;
  });
}

/**
 * Is this feature here (or does the save not follow the schedule)? Introduced (marked by the morning), or needed
 * early by play. Its day alone is not enough: the morning that introduces it marks it, so the tab, the note, the
 * letter and the intro arrive together. Pure: it never marks anything.
 */
export function isRevealed(s: GameState, id: string): boolean {
  if (!revealOn(s) || s.stats[key(id)]) return true;
  const f = feature(id);
  if (!f) return true;
  return needsEarly(s, f);
}

/** Has this feature's introduction (note, letter) gone out? Intros wait for it. */
export const introduced = (s: GameState, id: string): boolean =>
  !revealOn(s) || !feature(id) || !!s.stats[key(id)];

/** Is a menu tab hidden because the feature it belongs to has not arrived yet? */
export function tabHidden(s: GameState, tab: string): boolean {
  return reveal.features.some((f) => f.tabs?.includes(tab) && !isRevealed(s, f.id));
}

/**
 * Introduce the first feature (in schedule order) that is due this morning, by its day or because play needs it:
 * one a morning, so two systems never arrive together; another due one waits for the next morning. Returns it (its
 * note goes in the morning summary, its letter in the mailbox), or nothing. Days 1 and 2 never mark anything (the
 * guided start's two days stay as tuned: the onboarding gate); a feature needed early on them is shown, and
 * introduced from day 3.
 */
export function markRevealed(s: GameState): RevealFeature[] {
  if (!revealOn(s) || absoluteDay(s) < 3) return [];
  const today = absoluteDay(s);
  const due = reveal.features.filter(
    (f) => !s.stats[key(f.id)] && ((f.day !== undefined && today >= f.day) || needsEarly(s, f)),
  );
  // a feature tied to a mechanic that starts that day (the crows, Clay's race: `fixed`) goes first; then the first
  // green; then the earliest day that has come; then the first of those play needed early, in schedule order
  const byDay = due
    .filter((f) => f.day !== undefined && today >= f.day)
    .sort((a, b) => a.day! - b.day!);
  const f = byDay.find((x) => x.fixed) ?? due.find((x) => x.id === 'valley') ?? byDay[0] ?? due[0];
  if (!f) return [];
  s.stats[key(f.id)] = today;
  return [f];
}

/** Is a `fixed` feature due this morning (it is never held back by a waiting letter)? */
export const fixedDue = (s: GameState): boolean =>
  revealOn(s) &&
  reveal.features.some(
    (f) => f.fixed && f.day !== undefined && !s.stats[key(f.id)] && absoluteDay(s) >= f.day,
  );

/** Was this feature introduced this very day (its intro may show today)? */
export const revealedToday = (s: GameState, id: string): boolean =>
  revealOn(s) && s.stats[key(id)] === absoluteDay(s);

/** Guide topics the player can read now, in book order. */
export const guideTopics = (s: GameState): GuideTopic[] =>
  guide.topics.filter((t) => isRevealed(s, t.reveal));

export const topicRead = (s: GameState, topic: string): boolean => !!s.stats[readKey(topic)];
export function readTopic(s: GameState, topic: string): void {
  s.stats[readKey(topic)] = 1;
}
/** Topics the player can read and has not opened yet (the Guide marks them NEW). */
export const unreadTopics = (s: GameState): GuideTopic[] =>
  guideTopics(s).filter((t) => !topicRead(s, t.id));

/** Start the schedule for a new guided game (`startTutorial`). */
export function startReveal(s: GameState): void {
  s.stats[REVEAL_ON] = 1;
}
