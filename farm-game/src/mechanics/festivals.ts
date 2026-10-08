import { registerDayHook } from '../systems/dayHooks';
import { festivalToday, hasEntered } from '../systems/festivals';

// The morning of a festival, say so: it is the one day in the calendar with a fixed, shared goal.
registerDayHook({
  id: 'festivals:announce',
  phase: 'morning',
  order: 45,
  run(state, ctx) {
    const f = festivalToday(state);
    if (f && !hasEntered(state, f.id)) ctx.notes.push(`${f.def.name} today! Visit the town board.`);
  },
});
