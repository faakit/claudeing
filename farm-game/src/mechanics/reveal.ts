import { registerDayHook } from '../systems/dayHooks';
import { markRevealed } from '../systems/reveal';

// The reveal schedule (systems/reveal.ts): a guided game meets one new system a morning at most from day 3. Before
// the post (order 60), so a feature's letter (mail.json `reveal.<id>`) comes the morning it arrives.
registerDayHook({
  id: 'reveal:morning',
  phase: 'morning',
  order: 50,
  run(state, ctx) {
    for (const f of markRevealed(state)) ctx.notes.push(f.note);
  },
});
