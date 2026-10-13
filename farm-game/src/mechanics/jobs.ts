import { registerDayHook } from '../systems/dayHooks';
import { registerStatWatcher } from '../systems/goals';
import { npcs } from '../data';
import { checkJobs, generateJobs, welcomeFactor } from '../systems/jobs';
import { absoluteDay } from '../systems/time';
import { fmtGold, t } from '../i18n';

// Every morning villagers post a few small jobs on the town board (taken and turned in there). They give the hours
// after the chores a purpose and point new players at fishing, the mine and town.
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
        ? t('jobs.newWelcome', {
            who: listOf(who),
            pay: pay === 2 ? t('jobs.double') : t('jobs.factor', { factor: pay }),
          })
        : t('jobs.newNote', { who: listOf(who) }),
    );
  },
});

// At the night's payout every finished job not turned in is paid by post (shipping jobs only then, for goods that
// stayed in the bin): nothing is lost by not walking back to the board.
registerDayHook({
  id: 'jobs:payout',
  phase: 'payout',
  order: -10,
  run(state, ctx) {
    const gold = checkJobs(state, true);
    if (gold > 0) ctx.notes.push(t('jobs.byPost', { gold: fmtGold(gold) }));
  },
});

function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')}${t('common.and')}${names[names.length - 1]}`;
}

registerStatWatcher('jobs', checkJobs);
