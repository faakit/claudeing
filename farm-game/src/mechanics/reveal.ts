import { registerDayHook } from '../systems/dayHooks';
import { festivalToday } from '../systems/festivals';
import { calendarLetterDue } from '../systems/mail';
import { markRevealed } from '../systems/reveal';

// The reveal schedule (systems/reveal.ts): a guided game meets one new system a morning at most from day 3. Before
// the post (order 60), so a feature's letter (mail.json `reveal.<id>`) comes the morning it arrives. A morning the
// calendar already fills (a festival, or its notice or a birthday hint in the post) is quiet: only an urgent feature
// comes (the goal's, a fixed one, or one two mornings overdue). A letter that is not a feature's waits for a morning
// with no other letter (systems/mail.ts): it never takes a system's morning.
registerDayHook({
  id: 'reveal:morning',
  phase: 'morning',
  order: 50,
  run(state, ctx) {
    const quiet = !!festivalToday(state) || calendarLetterDue(state);
    for (const f of markRevealed(state, quiet)) ctx.notes.push(f.note);
  },
});
