import { registerDayHook } from '../systems/dayHooks';
import { festivalToday, hasEntered } from '../systems/festivals';
import { t } from '../i18n';

// The morning of a festival, say so: it is the one day in the calendar with a fixed, shared goal.
registerDayHook({
  id: 'festivals:announce',
  phase: 'morning',
  order: 45,
  run(state, ctx) {
    const f = festivalToday(state);
    if (f && !hasEntered(state, f.id)) ctx.notes.push(t('festival.todayNote', { festival: f.def.name }));
  },
});
