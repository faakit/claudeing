import { registerDayHook } from '../systems/dayHooks';
import { currentGoal, noteGoalDay } from '../systems/goals';
import { absoluteDay } from '../systems/time';
import { guidedTracksDone, tutorialOn } from '../systems/tutorial';

// A goal the player is not doing waits after a few quiet days and the next goal shows (critique 12, F4).
// Not while the guided start runs: its steps follow the early goals one by one.
registerDayHook({
  id: 'goals:stall',
  phase: 'end',
  order: 10,
  run(state, ctx) {
    if (tutorialOn(state) && !guidedTracksDone(state)) return;
    const waits = noteGoalDay(state, absoluteDay(state));
    const next = currentGoal(state);
    if (waits && next)
      ctx.notes.push(`New goal: ${next.text}. "${waits.text}" can wait in Menu > Goal.`);
  },
});
