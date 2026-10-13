import { npcs } from '../data';
import { registerDayHook } from '../systems/dayHooks';
import { isBirthday, waterHelp } from '../systems/friendship';
import { villagerHome } from '../systems/houses';
import { t } from '../i18n';

// A birthday is worth knowing about the moment you wake up.
registerDayHook({
  id: 'villagers:birthdays',
  phase: 'morning',
  order: 40,
  run(state, ctx) {
    for (const [id, def] of Object.entries(npcs))
      if (isBirthday(state, id) && villagerHome(state, id))
        ctx.notes.push(t('npc.birthdayNote', { name: def.name }));
  },
});

// A close friend helps on the farm (QA round: hearts worth having): Rosa at five hearts waters a few dry crops on
// a dry morning (`waterHelp`, how many). After the weather is set, so a rain morning needs no help.
registerDayHook({
  id: 'villagers:waterHelp',
  phase: 'end',
  order: 20,
  run(state, ctx) {
    const n = waterHelp(state);
    if (n > 0) ctx.notes.push(t('npc.waterHelpNote', { n }));
  },
});
