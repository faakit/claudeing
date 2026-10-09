import { registerDayHook } from '../systems/dayHooks';
import { crowVisit } from '../systems/crows';

// After the morning weather is settled (crows stay away in the rain), before the summary is written.
registerDayHook({
  id: 'crows:visit',
  phase: 'morning',
  order: 15,
  run(state, ctx) {
    const ate = crowVisit(state);
    if (ate) ctx.notes.push(`A crow ate a ${ate.toLowerCase()}. Scarecrows keep them off.`);
  },
});
