import { registerDayHook } from '../systems/dayHooks';
import { generateOrders } from '../systems/orders';
import { absoluteDay } from '../systems/time';

// A fresh board every morning (after the calendar has moved on, so seasons are right).
registerDayHook({
  id: 'orders:refresh',
  phase: 'morning',
  order: 20,
  run(state, ctx) {
    state.orders = { day: absoluteDay(state), list: generateOrders(state) };
    ctx.notes.push('New requests on the town board.');
  },
});
