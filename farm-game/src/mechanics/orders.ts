import { registerDayHook } from '../systems/dayHooks';
import { orderLabel, refreshBoard } from '../systems/orders';
import { rivalName, settleRival, settleSeason } from '../systems/rival';

// The board is refreshed every morning (after the calendar has moved on, so seasons are right):
// open requests stay until their last day, new ones fill the free places.
registerDayHook({
  id: 'orders:refresh',
  phase: 'morning',
  order: 20,
  run(state, ctx) {
    // The rival came by yesterday even if nobody looked at the board after his hour.
    const took = settleRival(state);
    if (took.length)
      ctx.notes.push(`${rivalName()} filled ${took.map(orderLabel).join(' and ')} on the board.`);
    // A new season: the board's score for the last one is settled, after his last take that counts in it
    // (critique 9, F6).
    if (ctx.scratch['seasonChanged']) {
      const news = settleSeason(state);
      if (news) ctx.notes.push(news);
    }
    if (refreshBoard(state) > 0) ctx.notes.push('New requests on the town board.');
  },
});
