import { registerDayHook } from '../systems/dayHooks';
import { registerStatWatcher } from '../systems/goals';
import { checkJobs, generateJobs, jobLabel } from '../systems/jobs';
import { absoluteDay } from '../systems/time';

// Every morning villagers post a few small jobs. They give the hours after the chores a purpose and
// point new players at fishing, the mine and the board.
registerDayHook({
  id: 'jobs:post',
  phase: 'morning',
  order: 25,
  run(state, ctx) {
    state.jobs = { day: absoluteDay(state), list: generateJobs(state) };
    for (const job of state.jobs.list) ctx.notes.push(`Job: ${jobLabel(job)} (+${job.reward}g)`);
  },
});

registerStatWatcher('jobs', checkJobs);
