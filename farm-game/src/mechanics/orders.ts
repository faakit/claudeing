import { registerDayHook } from '../systems/dayHooks';
import { refreshBoard } from '../systems/orders';

// The board is refreshed every morning (after the calendar has moved on, so seasons are right):
// open requests stay until their last day, new ones fill the free places.
registerDayHook({
  id: 'orders:refresh',
  phase: 'morning',
  order: 20,
  run(state, ctx) {
    if (refreshBoard(state) > 0) ctx.notes.push('New requests on the town board.');
  },
});
