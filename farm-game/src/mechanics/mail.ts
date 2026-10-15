import { registerDayHook } from '../systems/dayHooks';
import { deliverCalendarLetters, deliverDueLetters } from '../systems/mail';
import { t } from '../i18n';

// The post comes in the morning: letters whose time has come, festival notices and birthday hints.
// Slower news lives here instead of in toasts that vanish; the mailbox shows a marker until it is read.
registerDayHook({
  id: 'mail:deliver',
  phase: 'morning',
  order: 60,
  run(state, ctx) {
    // the calendar's letters first: a paced save's other post waits for a quiet morning (systems/mail.ts)
    const cal = deliverCalendarLetters(state);
    const n = cal + deliverDueLetters(state, cal);
    if (n > 0) ctx.notes.push(t('mail.newLetters', { count: n }));
  },
});
