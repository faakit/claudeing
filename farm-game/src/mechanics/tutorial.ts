import { registerDayHook } from '../systems/dayHooks';
import { runtime } from '../state/runtime';
import { waterCapacity } from '../systems/actions';
import { holdTipsWhile, registerStatWatcher } from '../systems/goals';
import {
  advance,
  canNote,
  coachContext,
  guidedMorningCan,
  guidedTracksDone,
  tutorialOn,
} from '../systems/tutorial';

/**
 * The guided start reacts the moment a stat moves (a harvest, a seed planted, a sale), not a frame later:
 * steps are marked done from the last world the coach layer described. Steps themselves are data
 * (`data/tutorial.json`); see systems/tutorial.ts.
 */
registerStatWatcher('tutorial', (state) => {
  const ctx = coachContext();
  if (ctx && tutorialOn(state)) advance(state, ctx.world, ctx.facts);
});

// First-time tips wait until the guided days are over, and after them while a coach line or a sheet is on screen
// (the day-2 shop's "Wild goods grow back..." toast sat on "Tap a price"; the Book's tip on the morning sheet), so
// only one instruction is ever on screen. A held tip shows at the next check once the screen is clear.
holdTipsWhile(
  (state) =>
    tutorialOn(state) && (!guidedTracksDone(state) || runtime.coaching || runtime.modals > 0),
);

// The first guided morning: Rosa fills the can (critic review 3: day 2's watering kept starting empty).
registerDayHook({
  id: 'tutorial:can',
  phase: 'end',
  run(state, ctx) {
    if (guidedMorningCan(state, waterCapacity(state))) ctx.notes.push(canNote());
  },
});
