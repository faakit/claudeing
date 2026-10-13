/**
 * The reveal schedule (QA round: "phase the game's depth, show mechanics over the following days and weeks").
 *
 * A guided new game meets its systems one at a time: the Book and its Guide on day 3, friendship on day 4, skills
 * on day 5, crafting on day 6, fishing on day 7, then the mine, machines, animals, cooking and the valley over the
 * following weeks (`data/reveal.json`). Until a feature arrives its menu tab is hidden. A feature also arrives early
 * the moment play needs it (the goal chain reaches it, or the player already uses it), so nothing is ever locked
 * away from someone who got there first: the schedule only decides when the game *introduces* a thing.
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
    if (e.stat !== undefined) return (s.stats[e.stat] ?? 0) >= (e.min ?? 1);
    if (e.goal !== undefined) {
      const at = goals.findIndex((g) => g.id === e.goal);
      return at >= 0 && (s.goalIndex >= at || !!s.stats[`goal.${e.goal}`]);
    }
    return false;
  });
}

/** Is this feature introduced (or does the save not follow the schedule)? Pure: it never marks anything. */
export function isRevealed(s: GameState, id: string): boolean {
  if (!revealOn(s) || s.stats[key(id)]) return true;
  const f = feature(id);
  if (!f) return true;
  return (f.day !== undefined && absoluteDay(s) >= f.day) || needsEarly(s, f);
}

/** Is a menu tab hidden because the feature it belongs to has not arrived yet? */
export function tabHidden(s: GameState, tab: string): boolean {
  return reveal.features.some((f) => f.tabs?.includes(tab) && !isRevealed(s, f.id));
}

/**
 * Mark every feature that has arrived and was not marked yet: returns them in schedule order (their notes go in
 * the morning summary, their letters in the mailbox). Days 1 and 2 never mark anything (the guided start's two
 * days stay as tuned: the onboarding gate); a feature needed early on them is shown, and introduced on day 3.
 */
export function markRevealed(s: GameState): RevealFeature[] {
  if (!revealOn(s) || absoluteDay(s) < 3) return [];
  const out: RevealFeature[] = [];
  for (const f of reveal.features) {
    if (s.stats[key(f.id)]) continue;
    if ((f.day !== undefined && absoluteDay(s) >= f.day) || needsEarly(s, f)) {
      s.stats[key(f.id)] = absoluteDay(s);
      out.push(f);
    }
  }
  return out;
}

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
