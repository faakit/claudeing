import { registerDayHook } from '../systems/dayHooks';
import { festivalToday } from '../systems/festivals';
import { calendarLetterDue, letterOverdue } from '../systems/mail';
import { fixedDue, markRevealed } from '../systems/reveal';

// The reveal schedule (systems/reveal.ts): a guided game meets one new system a morning at most from day 3. Before
// the post (order 60), so a feature's letter (mail.json `reveal.<id>`) comes the morning it arrives. A morning the
// calendar already fills (a festival, or its notice or a birthday hint in the post), or that a letter has waited two
// mornings for, introduces nothing: the next feature waits a morning (tutorial review: one new thing, one letter a
// morning).
registerDayHook({
  id: 'reveal:morning',
  phase: 'morning',
  order: 50,
  run(state, ctx) {
    if (festivalToday(state) || calendarLetterDue(state)) return;
    if (letterOverdue(state) && !fixedDue(state)) return;
    for (const f of markRevealed(state)) ctx.notes.push(f.note);
  },
});
