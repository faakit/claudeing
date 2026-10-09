import { registerDayHook } from '../systems/dayHooks';
import { cartHere } from '../systems/cart';

// The morning news says when the traveling cart is in town.
registerDayHook({
  id: 'cart:news',
  phase: 'morning',
  order: 60,
  run(state, ctx) {
    if (cartHere(state)) ctx.notes.push('The traveling cart is in town today.');
  },
});
