import { goals, tips } from '../data';
import type { GoalDef } from '../data';
import type { GameState } from '../state/GameState';
import { gameEvents, toast } from './events';

export const currentGoal = (state: GameState): GoalDef | null => goals[state.goalIndex] ?? null;

export const stat = (state: GameState, name: string): number => state.stats[name] ?? 0;

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
  let goal = currentGoal(state);
  while (goal && stat(state, goal.stat) >= goal.target) {
    state.money += goal.reward;
    state.goalIndex += 1;
    gameEvents.emit('moneyChanged', { delta: goal.reward });
    gameEvents.emit('goalCompleted', { text: goal.text, reward: goal.reward });
    toast(`Goal complete! +${goal.reward}g`, 'good');
    goal = currentGoal(state);
  }
  gameEvents.emit('goalChanged', undefined);
  checkTips(state);
}

/** One-time explanations the first time a mechanic shows up (stored as `tip.<id>` stats, so saved). */
export function checkTips(state: GameState): void {
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
