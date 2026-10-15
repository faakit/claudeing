import { registerDayHook } from '../systems/dayHooks';
import { orderLabel, refreshBoard } from '../systems/orders';
import { rivalCrate, rivalName, settleRival, settleSeason } from '../systems/rival';
import { t } from '../i18n';

// The board is refreshed every morning (after the calendar has moved on, so seasons are right):
// open requests stay until their last day, new ones fill the free places.
registerDayHook({
  id: 'orders:refresh',
  phase: 'morning',
  order: 20,
  run(state, ctx) {
    // The rival came by yesterday even if nobody looked at the board after his hour.
    const took = settleRival(state);
    // A take that scored is "filled"; a fish or wild row he cleared says it was no point (critique 10, F4).
    const scored = took.filter((o) => !o.noPoint);
    const cleared = took.filter((o) => o.noPoint);
    if (scored.length)
      ctx.notes.push(
        t('orders.rivalFilled', {
          name: rivalName(),
          orders: scored.map(orderLabel).join(t('common.and')),
        }),
      );
    if (cleared.length)
      ctx.notes.push(
        t('orders.rivalCleared', {
          name: rivalName(),
          orders: cleared.map(orderLabel).join(t('common.and')),
        }),
      );
    if (rivalCrate(state))
      ctx.notes.push(t('orders.rivalCrate', { name: rivalName() }));
    // A new season: the board's score for the last one is settled, after his last take that counts in it
    // (critique 9, F6).
    if (ctx.scratch['seasonChanged']) {
      const news = settleSeason(state);
      if (news) ctx.notes.push(news);
    }
    if (refreshBoard(state) > 0) ctx.notes.push(t('orders.newNote'));
  },
});
