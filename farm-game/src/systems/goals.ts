import { goals, tips } from '../data';
import type { GoalDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';

/**
 * Goals run in order (`goalIndex`), but an `aside` goal (a legendary fish) does not hold up the ones after it:
 * the next goal is shown and completed while it stays open (owner, round 4). A goal finished past an open
 * aside goal is remembered as the stat `goal.<id>` until `goalIndex` moves past it, so saves need no new field.
 */
const doneKey = (g: GoalDef): string => `goal.${g.id}`;
/** A goal that sat without progress (`noteGoalDay`) waits like an aside goal (critique 12, F4). */
const waitKey = (g: GoalDef): string => `goalWait.${g.id}`;
const passedOver = (state: GameState, g: GoalDef): boolean =>
  !!g.aside || !!state.stats[waitKey(g)];
const isDoneAt = (state: GameState, i: number): boolean =>
  i < state.goalIndex || !!state.stats[doneKey(goals[i]!)];

/** The goal the HUD shows: the first open one that is not aside, else the first open aside goal. */
export function currentGoal(state: GameState): GoalDef | null {
  let aside: GoalDef | null = null;
  for (let i = state.goalIndex; i < goals.length; i++) {
    if (isDoneAt(state, i)) continue;
    const g = goals[i]!;
    if (!passedOver(state, g)) return g;
    aside ??= g;
  }
  return aside;
}

/** Open aside goals passed over on the way to the current goal (the Goal tab lists them). */
export function asideGoals(state: GameState): GoalDef[] {
  const cur = currentGoal(state);
  const out: GoalDef[] = [];
  for (let i = state.goalIndex; i < goals.length && goals[i] !== cur; i++)
    if (!isDoneAt(state, i) && passedOver(state, goals[i]!)) out.push(goals[i]!);
  return out;
}

/** How many goals are finished, out of order ones included. */
export const goalsDone = (state: GameState): number =>
  goals.reduce((n, _g, i) => (isDoneAt(state, i) ? n + 1 : n), 0);

/** The last `n` finished goals, in chain order. */
export const recentGoals = (state: GameState, n: number): GoalDef[] =>
  goals.filter((_g, i) => isDoneAt(state, i)).slice(-n);

export const stat = (state: GameState, name: string): number => state.stats[name] ?? 0;

/** Days the shown goal may sit without any progress before the next one is shown instead. */
export const STALL_DAYS = 3;

/**
 * Once a day (absolute `day`): when the shown goal's stat has not moved for `STALL_DAYS` days, it waits and the
 * next goal shows (critique 12, F4: a farmer who never forages sat on "Pick up 3 wild goods" for 26 days). The
 * waiting goal stays under "Also open" and still completes when met; nothing is reordered. Tracked in stats
 * (`goalStall.*`, `goalWait.<id>`), so no save change. Returns the goal that now waits, if any.
 */
export function noteGoalDay(state: GameState, day: number): GoalDef | null {
  const cur = currentGoal(state);
  if (!cur) return null;
  const at = goals.indexOf(cur) + 1;
  const value = stat(state, cur.stat);
  if (state.stats['goalStall.i'] !== at || state.stats['goalStall.v'] !== value) {
    state.stats['goalStall.i'] = at;
    state.stats['goalStall.v'] = value;
    state.stats['goalStall.day'] = day;
    return null;
  }
  if (day - (state.stats['goalStall.day'] ?? day) < STALL_DAYS) return null;
  state.stats[waitKey(cur)] = 1;
  const next = currentGoal(state);
  if (!next || next === cur || next.aside) {
    delete state.stats[waitKey(cur)]; // nothing better to show: it stays the goal
    return null;
  }
  checkGoals(state); // goals the player already met on the way pay now, so the note names a real next goal
  return cur;
}

export function goalProgress(state: GameState): { goal: GoalDef; value: number } | null {
  const goal = currentGoal(state);
  return goal ? { goal, value: Math.min(goal.target, stat(state, goal.stat)) } : null;
}

/** Called after any stat may have moved (daily jobs watch their stats this way). */
export type StatWatcher = (state: GameState) => void;
const watchers = new Map<string, StatWatcher>();

/** Add (or replace, by id) something that reacts to stat changes. Mechanics register theirs. */
export function registerStatWatcher(id: string, fn: StatWatcher): void {
  watchers.set(id, fn);
}

/** Complete every goal that is already satisfied, paying rewards and announcing each. */
export function checkGoals(state: GameState): void {
  for (const fn of watchers.values()) fn(state);
  // Every open goal up to and including the current one may complete; repeat while one does (a cascade).
  for (let more = true; more;) {
    more = false;
    const cur = currentGoal(state);
    for (let i = state.goalIndex; i < goals.length && cur; i++) {
      const goal = goals[i]!;
      if (!isDoneAt(state, i) && stat(state, goal.stat) >= goal.target) {
        state.stats[doneKey(goal)] = 1;
        state.money += goal.reward;
        gameEvents.emit('moneyChanged', { delta: goal.reward });
        gameEvents.emit('goalCompleted', { text: goal.text, reward: goal.reward });
        toast(`Goal complete! +${goal.reward}g`, 'good');
        more = true;
      }
      if (goal === cur) break;
    }
    while (state.goalIndex < goals.length && state.stats[doneKey(goals[state.goalIndex]!)]) {
      delete state.stats[doneKey(goals[state.goalIndex]!)];
      delete state.stats[waitKey(goals[state.goalIndex]!)];
      state.goalIndex += 1;
    }
  }
  gameEvents.emit('goalChanged', undefined);
  checkTips(state);
}

/** Something (the guided start) may hold first-time tips back; they show once it lets go. */
let tipsHeld: (state: GameState) => boolean = () => false;
export function holdTipsWhile(fn: (state: GameState) => boolean): void {
  tipsHeld = fn;
}

/** One-time explanations the first time a mechanic shows up (stored as `tip.<id>` stats, so saved). */
export function checkTips(state: GameState): void {
  if (tipsHeld(state)) return;
  for (const tip of tips) {
    const key = `tip.${tip.id}`;
    if (state.stats[key] || stat(state, tip.stat) < tip.min) continue;
    state.stats[key] = 1;
    toast(tip.text, 'info');
    return; // one at a time; the next waits for the next check
  }
}

/** Increment a lifetime stat and re-check goals. */
export function addStat(state: GameState, name: string, amount = 1): void {
  state.stats[name] = stat(state, name) + amount;
  checkGoals(state);
}
