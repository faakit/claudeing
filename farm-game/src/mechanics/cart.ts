import { registerDayHook } from '../systems/dayHooks';
import { cartHere } from '../systems/cart';
import { t } from '../i18n';

// The morning news says when the traveling cart is in town.
registerDayHook({
  id: 'cart:news',
  phase: 'morning',
  order: 60,
  run(state, ctx) {
    if (cartHere(state)) ctx.notes.push(t('cart.morningNote'));
  },
});
