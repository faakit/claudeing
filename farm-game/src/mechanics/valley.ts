import { valley } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { sendLetter } from '../systems/mail';
import { checkFarmGreen, ROSA_LETTER_STAT, rosaLetterDue } from '../systems/valley';

// The Dry Year's valley (docs/WORLD-PLAN.md, systems/valley.ts).

// The first green: checked on the night, before the calendar moves on, so the farm wakes green. Rosa's letter with
// Ilse's tin and journal is a data letter (mail.json `first_green`, waiting on `valley.farmGreen`).
registerDayHook({
  id: 'valley:first-green',
  phase: 'start',
  run(state, ctx) {
    if (!checkFarmGreen(state)) return;
    ctx.notes.push(valley.farmGreen.note);
    ctx.scratch['firstGreen'] = true;
  },
});

// Rosa's title-screen letter is kept in the mailbox, already read, once the guided days are over (never on days
// 1-2, where the guide's mail step reads the mailbox). No note: it is not news.
registerDayHook({
  id: 'valley:keep-letter',
  phase: 'morning',
  order: 61,
  run(state) {
    if (!rosaLetterDue(state)) return;
    state.stats[ROSA_LETTER_STAT] = 1;
    const l = valley.letter;
    const letter = sendLetter(state, { from: l.from, title: l.title, text: `${l.text} ${l.sign}` });
    letter.read = true;
    letter.day = 1;
  },
});
