import { registerDayHook } from '../systems/dayHooks';
import { morningSpecial } from '../systems/specials';

// One big seasonal request at a time: settled and posted in the morning, after the regular board.
registerDayHook({
  id: 'specials:post',
  phase: 'morning',
  order: 22,
  run(state, ctx) {
    const news = morningSpecial(state);
    if (news) ctx.notes.push(news);
  },
});
