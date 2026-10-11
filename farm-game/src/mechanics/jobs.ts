import { registerDayHook } from '../systems/dayHooks';
import { registerStatWatcher } from '../systems/goals';
import { npcs } from '../data';
import { checkJobs, generateJobs, welcomeFactor } from '../systems/jobs';
import { absoluteDay } from '../systems/time';

// Every morning villagers post a few small jobs. They give the hours after the chores a purpose and
// point new players at fishing, the mine and the board.
registerDayHook({
  id: 'jobs:post',
  phase: 'morning',
  order: 25,
  run(state, ctx) {
    state.jobs = { day: absoluteDay(state), list: generateJobs(state) };
    // One line for all of them: a busy morning summary must still show the weather.
    const who = [...new Set(state.jobs.list.map((j) => npcs[j.giver]?.name ?? j.giver))];
    if (who.length === 0) return;
    const pay = welcomeFactor(absoluteDay(state));
    ctx.notes.push(
      pay > 1
        ? `New jobs from ${listOf(who)}: ${pay === 2 ? 'double' : `${pay}x`} pay while you settle in. See Menu > Goal.`
        : `New jobs from ${listOf(who)}. See Menu > Goal.`,
    );
  },
});

// Shipping jobs pay at the night's payout, for goods that stayed in the bin.
registerDayHook({
  id: 'jobs:payout',
  phase: 'payout',
  order: -10,
  run: (state) => checkJobs(state, true),
});

function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

registerStatWatcher('jobs', checkJobs);
