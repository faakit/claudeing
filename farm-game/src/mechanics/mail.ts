import { registerDayHook } from '../systems/dayHooks';
import { deliverCalendarLetters, deliverDueLetters } from '../systems/mail';

// The post comes in the morning: letters whose time has come, festival notices and birthday hints.
// Slower news lives here instead of in toasts that vanish; the mailbox shows a marker until it is read.
registerDayHook({
  id: 'mail:deliver',
  phase: 'morning',
  order: 60,
  run(state, ctx) {
    const n = deliverDueLetters(state) + deliverCalendarLetters(state);
    if (n > 0)
      ctx.notes.push(n > 1 ? `${n} new letters in the mailbox.` : 'A new letter in the mailbox.');
  },
});
