import { recipes } from '../data';
import type { GoalDef } from '../data';
import type { GameState } from '../state/GameState';
import { registerDayHook } from '../systems/dayHooks';
import { countItem } from '../systems/inventory';
import { isRecipeUnlocked } from '../systems/skills';
import { currentGoal, noteGoalDay } from '../systems/goals';
import { absoluteDay } from '../systems/time';
import { guidedTracksDone, tutorialOn } from '../systems/tutorial';
import { t } from '../i18n';

// A goal the player is not doing waits after a few quiet days and the next goal shows (critique 12, F4).
// Not while the guided start runs: its steps follow the early goals one by one.
registerDayHook({
  id: 'goals:stall',
  phase: 'end',
  order: 10,
  run(state, ctx) {
    if (tutorialOn(state) && !guidedTracksDone(state)) return;
    const waits = noteGoalDay(state, absoluteDay(state), (g) => goalDoable(state, g));
    const next = currentGoal(state);
    if (waits && next)
      ctx.notes.push(t('goals.stallNote', { next: next.text, waits: waits.text }));
  },
});

/**
 * Goals whose first step needs an unlock: the item, placed or carried, or a recipe for it the player can make now.
 * A stall skip never moves to one of these before then (tutorial review C2-1: "Place a sprinkler or a jar" showed at
 * Farming 1).
 */
const NEEDS: Record<string, string[]> = {
  place: ['sprinkler', 'preserve_jar'],
  preserve: ['preserve_jar'],
  chicken: ['coop'],
};
export function goalDoable(state: GameState, g: GoalDef): boolean {
  const any = NEEDS[g.id];
  if (!any) return true;
  return any.some((item) => {
    if (countItem(state, item) > 0) return true;
    if (Object.values(state.placed).some((list) => list.some((o) => o.type === item))) return true;
    const r = recipes[item];
    return !!r && isRecipeUnlocked(state, r);
  });
}
