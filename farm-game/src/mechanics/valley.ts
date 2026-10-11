import { items, valley } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { sendLetter } from '../systems/mail';
import { absoluteDay } from '../systems/time';
import {
  askPlaces,
  checkFarmGreen,
  openPlaces,
  owns,
  ROSA_LETTER_STAT,
  rosaLetterDue,
  stageOf,
} from '../systems/valley';
import { t } from '../i18n';

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

// The places (systems/valley.ts): openings first (a place restored overnight; maps change at this morning's load),
// then the asks. Before the post, so a letter waiting on a place arrives the same morning.
registerDayHook({
  id: 'valley:places',
  phase: 'morning',
  order: 55,
  run(state, ctx) {
    for (const id of openPlaces(state)) {
      const p = valley.places[id]!;
      ctx.notes.push(p.opening.note);
      // the tool the place opens comes with the opening, by letter, if the work day could not hand it over
      const item = p.opening.item;
      if (item && !owns(state, item))
        sendLetter(state, {
          from: p.npc,
          title: items[item]?.name ?? item,
          text: t('valley.spadeLetter'),
          gift: { item, qty: 1 },
        });
    }
    askPlaces(state);
    // The morning after the spring opens, an unsigned sack of fertilizer at the gate (Clay, WORLD-PLAN 5.1).
    const opened = state.stats['place.spring.opened'] ?? 0;
    if (
      stageOf(state, 'spring') >= 3 &&
      absoluteDay(state) > opened &&
      !state.stats['valley.compost']
    )
      state.stats['valley.compost'] = 1;
  },
});
