import { holdTipsWhile, registerStatWatcher } from '../systems/goals';
import { advance, coachContext, guidedTracksDone, tutorialOn } from '../systems/tutorial';

/**
 * The guided start reacts the moment a stat moves (a harvest, a seed planted, a sale), not a frame later:
 * steps are marked done from the last world the coach layer described. Steps themselves are data
 * (`data/tutorial.json`); see systems/tutorial.ts.
 */
registerStatWatcher('tutorial', (state) => {
  const ctx = coachContext();
  if (ctx && tutorialOn(state)) advance(state, ctx.world, ctx.facts);
});

// First-time tips wait until the guided days are over, so only one instruction is ever on screen.
holdTipsWhile((state) => tutorialOn(state) && !guidedTracksDone(state));
