import { registerDayHook } from '../systems/dayHooks';
import { crowVisit } from '../systems/crows';
import { t } from '../i18n';

// After the morning weather is settled (crows stay away in the rain), before the summary is written.
registerDayHook({
  id: 'crows:visit',
  phase: 'morning',
  order: 15,
  run(state, ctx) {
    const ate = crowVisit(state);
    if (ate) ctx.notes.push(t('crows.ate', { crop: ate.toLowerCase() }));
  },
});
